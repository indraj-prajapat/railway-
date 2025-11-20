import json
import tempfile
import os
import sys
import runpy
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from src.Azure.azure_uploader import AzureUploader
from io import BytesIO
import time
import threading
import shutil
from dotenv import load_dotenv

load_dotenv()

from pyserini.search.lucene import LuceneSearcher
class SearchBack:
    def __init__(self, Document):

        print("🚀 Using Azure-only indexing mode...\n")

        self.documents = Document.query.all()

        # Azure prefix folders
        self.prefix_json = "search/documents.jsonl"
        self.prefix_index = "search/bm25_index/"     # a folder
        self.prefix_colbert_json = "search2/documents.jsonl"
        self.prefix_colbert_faiss = "search2/biencoder_index.faiss"
        self.prefix_manifest = "search2/manifest.json"

        self.azure = AzureUploader(
            connection_string=os.getenv("AZURE_CONN_STR"),
            container="database"
        )
        self._faiss_index = None
        self._faiss_index_loaded_at = None
        self._faiss_index_lock = threading.Lock()
        self._faiss_model = None
    # ============================================================
    # 1) WRITE documents.jsonl → Azure
    # ============================================================
    def export_documents_to_jsonl(self):
        print("📤 Writing JSONL directly to Azure...")

        buffer = BytesIO()

        count = 0
        for doc in self.documents:
            line = {
                "id": str(doc.id),
                "contents": doc.raw_text or ""
            }
            buffer.write((json.dumps(line, ensure_ascii=False) + "\n").encode("utf-8"))
            count += 1

        buffer.seek(0)
        self.azure.upload_stream(self.prefix_json, buffer)
        
        # also upload to search2/ folder (for colbert)
        buffer.seek(0)
        self.azure.upload_stream(self.prefix_colbert_json, buffer)

        print(f"✅ Uploaded {count} docs → {self.prefix_json}\n")

    # ============================================================
    # 2) BUILD BM25 INDEX → write directly to Azure
    # ============================================================
    def run_pyserini_index(self):
        print("⚙ Building Lucene BM25 index in memory...")

        # Step 1: download JSONL temporarily
        json_bytes = self.azure.download_as_bytes(self.prefix_json)
        tmp_dir = tempfile.mkdtemp()
        jsonl_path = os.path.join(tmp_dir, "documents.jsonl")

        with open(jsonl_path, "wb") as f:
            f.write(json_bytes)

        # Step 2: create an "input folder" for Pyserini
        input_dir = os.path.join(tmp_dir, "json")
        os.makedirs(input_dir, exist_ok=True)

        # Move JSONL into input folder:
        os.rename(jsonl_path, os.path.join(input_dir, "documents.jsonl"))

        # Step 3: Run pyserini to generate local index
        index_dir = os.path.join(tmp_dir, "bm25_index")

        sys.argv = [
            "pyserini.index",
            "--collection", "JsonCollection",
            "--input", input_dir,
            "--index", index_dir,
            "--generator", "DefaultLuceneDocumentGenerator",
            "--threads", "8"
        ]
        runpy.run_module("pyserini.index", run_name="__main__")

        print("📤 Uploading BM25 index folder to Azure...")

        # Step 4: Upload full index directory to Azure "search/bm25_index/"
        for root, dirs, files in os.walk(index_dir):
            for file in files:
                local_path = os.path.join(root, file)
                blob_path = "search/bm25_index/" + file
                self.azure.upload_file(blob_path, local_path)

        print("✅ BM25 index uploaded to Azure (folder: search/bm25_index)\n")

    # ============================================================
    # 3) BUILD BI-ENCODER INDEX → Azure
    # ============================================================
    def byencoder(self):

        print("🔍 Building bi-encoder FAISS index in memory...")

        # 1) Download JSONL corpus from Azure
        json_bytes = self.azure.download_as_bytes(self.prefix_colbert_json)
        json_lines = json_bytes.decode("utf-8").splitlines()

        doc_ids = []
        passages = []

        for line in json_lines:
            if not line.strip():
                continue
            obj = json.loads(line)
            doc_ids.append(int(obj["id"]))
            passages.append(str(obj["contents"]))

        doc_ids = np.array(doc_ids, dtype="int64")

        print(f"📘 Loaded {len(passages)} documents from Azure")

        # 2) Encode
        model = SentenceTransformer("sentence-transformers/msmarco-distilbert-base-v4")
        embeddings = model.encode(
            passages,
            batch_size=64,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=True
        ).astype("float32")

        # 3) Build in memory FAISS
        d = embeddings.shape[1]
        base = faiss.IndexFlatIP(d)
        index = faiss.IndexIDMap2(base)
        index.add_with_ids(embeddings, doc_ids)

        print(f"🔧 FAISS index ready with {index.ntotal} vectors")

        # 4) Write FAISS into bytes buffer
        tmp = tempfile.NamedTemporaryFile(delete=False)
        faiss.write_index(index, tmp.name)

        # Upload FAISS file
        self.azure.upload_file(self.prefix_colbert_faiss, tmp.name)

        # Upload manifest
        manifest = {
            "model": "sentence-transformers/msmarco-distilbert-base-v4",
            "count": int(index.ntotal),
            "dim": int(d)
        }
        manifest_bytes = json.dumps(manifest).encode("utf-8")
        self.azure.upload_bytes(self.prefix_manifest, manifest_bytes)

        print("✅ Uploaded FAISS + manifest to Azure\n")

    def _ensure_faiss_loaded(self, remote_index_blob="search2/biencoder_index.faiss", remote_manifest_blob="search2/manifest.json"):
        """
        Ensure FAISS index and model are loaded into memory (cached).
        Downloads index blob to a temp file and reads it with faiss.read_index
        Model name is read from manifest; model is loaded via SentenceTransformer.
        This function is thread-safe and idempotent.
        """
        # quick path
        if getattr(self, "_faiss_index", None) is not None and getattr(self, "_faiss_model", None) is not None:
            return

        # lock for first-time load
        with getattr(self, "_faiss_index_lock", threading.Lock()):
            if getattr(self, "_faiss_index", None) is not None and getattr(self, "_faiss_model", None) is not None:
                return

            print("⬇ Downloading FAISS index from Azure (temp file)...")
            # download faiss
            faiss_bytes = self.azure.download_as_bytes(remote_index_blob)
            tmp_f = tempfile.NamedTemporaryFile(suffix=".faiss", delete=False)
            tmp_path = tmp_f.name
            tmp_f.write(faiss_bytes)
            tmp_f.flush()
            tmp_f.close()

            try:
                idx = faiss.read_index(tmp_path)
            except Exception as e:
                # cleanup and re-raise
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
                raise RuntimeError(f"Failed to read FAISS index: {e}")

            # load manifest if exists
            model_name = "sentence-transformers/msmarco-distilbert-base-v4"
            try:
                mf_bytes = self.azure.download_as_bytes(remote_manifest_blob)
                mf = json.loads(mf_bytes.decode("utf-8"))
                if "model" in mf:
                    model_name = mf["model"]
            except Exception:
                # manifest missing -> default model
                pass

            # load model
            print(f"⬇ Loading bi-encoder model: {model_name}")
            model = SentenceTransformer(model_name)

            # cache in memory
            self._faiss_index = idx
            self._faiss_index_loaded_at = time.time()
            self._faiss_index_tmpfile = tmp_path  # keep temp file path so index can be read again if needed (optional)
            self._faiss_model = model
            print("✅ FAISS and model loaded into memory (cached).")

    def search_biencoder(self, query: str, top_k: int = 100, remote_index_blob="search2/biencoder_index.faiss", remote_manifest_blob="search2/manifest.json"):
        """
        High-level search that uses the cached FAISS index and model. Downloads once and caches.
        """
        if not query or not query.strip():
            return []

        # ensure loaded
        self._ensure_faiss_loaded(remote_index_blob, remote_manifest_blob)

        # encode query
        q_emb = self._faiss_model.encode([query], convert_to_numpy=True, normalize_embeddings=True).astype("float32")
        scores, ids = self._faiss_index.search(q_emb, top_k)

        out = []
        for s, did in zip(scores[0], ids[0]):
            if int(did) == -1:
                continue
            if not np.isfinite(s):
                continue
            if s < -1.0:
                continue
            out.append((int(did), float(s)))
        return out
    
    def _download_bm25_to_tempdir(self, bm25_prefix="search/bm25_index/"):
        """
        Downloads all blobs with prefix bm25_prefix into a temp directory,
        preserving filenames. Returns the local index directory path.
        """
        tmp_dir = tempfile.mkdtemp(prefix="bm25_index_")
        # list blobs under prefix
        blob_names = self.azure.list_blobs(prefix=bm25_prefix)
        if not blob_names:
            raise RuntimeError(f"No BM25 index blobs found under prefix: {bm25_prefix}")

        for blob_name in blob_names:
            # preserve the relative path after prefix
            rel = blob_name[len(bm25_prefix):].lstrip("/")
            local_path = os.path.join(tmp_dir, rel)
            local_parent = os.path.dirname(local_path)
            if local_parent and not os.path.exists(local_parent):
                os.makedirs(local_parent, exist_ok=True)
            # download
            self.azure.download_to_file(blob_name, local_path)

        return tmp_dir

    def search_bm25(self, query: str, top_k: int = 100, bm25_prefix="search/bm25_index/"):
        """
        Downloads BM25 lucene index to a temp dir, runs Pyserini LuceneSearcher,
        returns list of (docid, score) or (hit) data depending on your needs.
        """
        if not query or not query.strip():
            return []

        temp_index_dir = None
        try:
            temp_index_dir = self._download_bm25_to_tempdir(bm25_prefix=bm25_prefix)
            # Pyserini expects the directory that contains the Lucene index files
            searcher = LuceneSearcher(temp_index_dir)
            hits = searcher.search(query, k=top_k)
            results = []
            for hit in hits:
                # hit.docid() is usually the internal docid stored; you may need to parse/stored id mapping
                # Pyserini returns hit.score, hit.docid() and you can fetch stored fields if indexed.
                results.append({
                    "doc_id": hit.docid,
                    "score": hit.score
                })
                print(f"doc_id: {hit.docid}, score: {hit.score}")
            return results
        finally:
            if temp_index_dir:
                try:
                    shutil.rmtree(temp_index_dir)
                except Exception:
                    pass
    # ============================================================
    # FULL RUN
    # ============================================================
    def run(self):
        print("🚀 Running full Azure-based indexing pipeline...\n")
        self.export_documents_to_jsonl()
        self.run_pyserini_index()
        self.byencoder()
        print("🎉 Completed! Index stored fully in Azure.\n")
