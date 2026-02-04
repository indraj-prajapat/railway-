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
from typing import List
from sentence_transformers import CrossEncoder
import math
load_dotenv()
import logging
logger = logging.getLogger(__name__)
from pyserini.search.lucene import LuceneSearcher
from src.models.document import Document, DocumentChunk
from src.models.model_hub import ModelHub
class SearchBack:
    def __init__(self, Document,
                 cross_encoder_model: str = "models/cross-encoder/ms-marco-MiniLM-L-6-v2",
                batch_size: int = 16,
                device: str | None = None):

        print("🚀 Using Azure-only indexing mode...\n")

        self.documents = Document.query.all()
        self.chunks = DocumentChunk.query.all()
        try:
            self.batch_size = int(os.getenv("CE_BATCH_SIZE", str(batch_size)))
        except Exception:
            self.batch_size = batch_size
        self.cross_encoder = ModelHub.get_cross_encoder(device=device)
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
        self._bm25_index_dir = None
    # ============================================================
    # 1) WRITE documents.jsonl → Azure
    # ============================================================
    def export_documents_to_jsonl(self):
        print("📤 Writing JSONL directly to Azure...")

        buffer = BytesIO()

        count = 0
        # Write chunk-level JSONL for BM25 and bi-encoder
        for ch in self.chunks:
            line = {
                "id": f"doc:{int(ch.document_id)}:ch:{int(ch.chunk_index)}",
                "doc_id": int(ch.document_id),
                "contents": ch.text or ""
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
            # Use document-level IDs for FAISS to allow aggregation per doc
            doc_ids.append(int(obj.get("doc_id")))
            passages.append(str(obj.get("contents", "")))

        doc_ids = np.array(doc_ids, dtype="int64")

        print(f"📘 Loaded {len(passages)} documents from Azure")

        # 2) Encode
        model = ModelHub.get_biencoder()
        try:
            st_bs = int(os.getenv("ST_BATCH_SIZE", "32"))
        except Exception:
            st_bs = 32
        embeddings = model.encode(
            passages,
            batch_size=st_bs,
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
            "model": "models/sentence-transformers/msmarco-distilbert-base-v4",
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
            model_name = "models/sentence-transformers/msmarco-distilbert-base-v4"
            # try:
            #     mf_bytes = self.azure.download_as_bytes(remote_manifest_blob)
            #     mf = json.loads(mf_bytes.decode("utf-8"))
            #     if "model" in mf:
            #         model_name = mf["model"]
            # except Exception:
            #     # manifest missing -> default model
            #     pass

            # load model
            print(f"⬇ Loading bi-encoder model")
            model = ModelHub.get_biencoder()

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

        if self._bm25_index_dir is None:
            self._bm25_index_dir = self._download_bm25_to_tempdir(bm25_prefix=bm25_prefix)
        searcher = LuceneSearcher(self._bm25_index_dir)
        hits = searcher.search(query, k=top_k)
        results_map = {}
        for hit in hits:
            docid_str = getattr(hit, "docid", None)
            doc_id = None
            if isinstance(docid_str, str) and docid_str.startswith("doc:"):
                try:
                    doc_id = int(docid_str.split(":")[1])
                except Exception:
                    doc_id = None
            if doc_id is None:
                try:
                    doc_id = int(docid_str)
                except Exception:
                    continue
            prev = results_map.get(doc_id, float("-inf"))
            if hit.score > prev:
                results_map[doc_id] = hit.score
        results = [{"doc_id": did, "score": sc} for did, sc in results_map.items()]
        return results
    # ============================================================
    # FULL RUN
    # ============================================================
    def run(self):
        print("🚀 Running full Azure-based indexing pipeline...\n")
        self.export_documents_to_jsonl()
        self.run_pyserini_index()
        self.byencoder()
        print("🎉 Completed! Index stored fully in Azure.\n")

    def rerank_cross_encoder(
        self,
        query: str,
        documents
    ) -> List[float]:
        """
        Re-rank documents using a Cross-Encoder.

        Args:
            query (str): User query
            documents (List[str]): List of document texts

        Returns:
            List[float]: Relevance scores aligned with documents
        """

        if not query or not documents:
            return []

        # Clean documents (avoid None / empty strings)
        cleaned_docs = [
            doc if isinstance(doc, str) and doc.strip() else ""
            for doc in documents
        ]
        logger.info(f"Reranking {cleaned_docs[0]} documents with Cross-Encoder")

        # Create (query, document) pairs
        pairs = [(query, doc) for doc in cleaned_docs]

        scores: List[float] = []

        # Batched inference (VERY IMPORTANT)
        num_batches = math.ceil(len(pairs) / self.batch_size)

        for i in range(num_batches):
            batch_pairs = pairs[
                i * self.batch_size : (i + 1) * self.batch_size
            ]

            batch_scores = self.cross_encoder.predict(batch_pairs)
            scores.extend(batch_scores.tolist())

        return scores
