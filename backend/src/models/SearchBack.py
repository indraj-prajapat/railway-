import json ,tempfile
import os
import sys
import runpy
import subprocess
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

# ===============================
# 📁 PATH SETUP
# ===============================
base_dir = os.path.dirname(os.path.abspath(__file__))
db_dir = os.path.join(base_dir, "..", "database", "search")
colbert_dir = os.path.join(base_dir, "..", "database", "search2")
os.makedirs(db_dir, exist_ok=True)
os.makedirs(colbert_dir, exist_ok=True)

output_path = os.path.join(db_dir, "documents.jsonl")
output_path2 = os.path.join(db_dir, "documents.tsv")
index_path = os.path.join(db_dir, "bm25_index")
colbert_index_path = os.path.join(colbert_dir, "colbert_index")
colbert_jsonl_path = os.path.join(colbert_dir, "documents.jsonl")

# ===============================
# 🔍 CLASS DEFINITION
# ===============================
class SearchBack:
    def __init__(self, Document,
                 db_dir=db_dir,
                 index_path=index_path,
                 colbert_dir=colbert_dir,
                 colbert_index_path=colbert_index_path,
                 colbert_jsonl_path=colbert_jsonl_path,
                 output_path=output_path,
                 output_path2=output_path2):

        print("🚀 [INIT] Initializing SearchBack class...")
        self.db_dir = db_dir
        self.documents = Document.query.all()
        self.output_path = output_path        # JSONL file
        self.output_path2 = output_path2      # TSV file
        self.index_path = index_path
        self.colbert_dir = colbert_dir
        self.colbert_index_path = colbert_index_path
        self.colbert_jsonl_path = colbert_jsonl_path
        print(f"📂 [INIT] Database directory: {db_dir}")
        print(f"📄 [INIT] JSONL path: {output_path}")
        print(f"📄 [INIT] TSV path: {output_path2}")
        print("✅ [INIT] Initialization complete.\n")

    # ===============================
    # ✏️ EXPORT DOCUMENTS TO JSONL
    # ===============================
    def export_documents_to_jsonl(self, path=None):
        path = path or self.output_path
        print(f"📤 [DEBUG] Exporting documents to JSONL: {path}")

        with open(path, 'w', encoding='utf-8') as f:
            count = 0
            for doc in self.documents:
                line = {
                    'id': str(doc.id),
                    'contents': doc.raw_text if doc.raw_text else ''
                }
                f.write(json.dumps(line, ensure_ascii=False) + '\n')
                count += 1
            print(f"✅ [DEBUG] {count} documents exported to {path}\n")


    # ===============================
    # 🧱 BM25 INDEX (PYSERINI)
    # ===============================
    def run_pyserini_index(self):
        print("⚙ [DEBUG] Running Pyserini index builder...")
        sys.argv = [
            "pyserini.index",
            "--collection", "JsonCollection",
            "--input", self.db_dir,
            "--index", self.index_path,
            "--generator", "DefaultLuceneDocumentGenerator",
            "--threads", "8"
        ]
        runpy.run_module("pyserini.index", run_name="__main__")
        print("✅ [DEBUG] Pyserini index successfully created.\n")

    # ===============================
    # 🧠 BI-ENCODER (FAISS)
    # ===============================
    def byencoder(self):
        print("🔍 [DEBUG] Starting byencoder() function...")

        DATA_JSONL = self.output_path
        INDEX_DIR = self.colbert_dir
        MODEL_NAME = "sentence-transformers/msmarco-distilbert-base-v4"
        INDEX_PATH = os.path.join(INDEX_DIR, "biencoder_index.faiss")
        print(f"🔧 [DEBUG] INDEX_DIR = {INDEX_DIR}")
        print(f"🔧 [DEBUG] MODEL_NAME = {MODEL_NAME}")
        MANIFEST_PATH = os.path.join(INDEX_DIR, "manifest.json") 
        os.makedirs(INDEX_DIR, exist_ok=True)
        print(f"📁 [DEBUG] Created or verified directory: {INDEX_DIR}")

        def load_corpus(jsonl_path):
            doc_ids, passages = [], []
            kept = 0
            with open(jsonl_path, "r", encoding="utf-8") as f:
                for ln, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                        did = int(obj["id"])
                        txt = str(obj["contents"])
                        doc_ids.append(did)
                        passages.append(txt)
                        kept += 1
                    except Exception as e:
                        # hard fail is safer; or log and skip
                        raise RuntimeError(f"Bad JSONL at line {ln}: {e}")
            if not passages:
                raise RuntimeError("No documents loaded from JSONL")
            return np.array(doc_ids, dtype="int64"), passages

        def build_index():
            # 1) Load model
            model = SentenceTransformer(MODEL_NAME)

            # 2) Load corpus
            doc_ids, passages = load_corpus(DATA_JSONL)
            print(f"Loaded {len(passages)} docs")

            # 3) Encode with L2 normalization (cosine-ready for Inner Product)
            embeddings = model.encode(
                passages,
                batch_size=64,
                show_progress_bar=True,
                convert_to_numpy=True,
                normalize_embeddings=True
            ).astype("float32")
            d = embeddings.shape[1]
            assert embeddings.shape[0] == doc_ids.shape[0], "Embedding count != doc id count"

            # 4) Build IndexIDMap2 around IndexFlatIP
            base = faiss.IndexFlatIP(d)  # cosine through inner product on normalized vectors
            index = faiss.IndexIDMap2(base)

            # 5) Add with explicit IDs (no positional mapping needed)
            index.add_with_ids(embeddings, doc_ids)
            assert index.ntotal == len(doc_ids), "Index size mismatch after add"

            # 6) Atomic write
            with tempfile.NamedTemporaryFile(dir=INDEX_DIR, delete=False) as tmpf:
                tmp_path = tmpf.name
            faiss.write_index(index, tmp_path)
            os.replace(tmp_path, INDEX_PATH)

            # 7) Manifest to ensure consistency at load time
            manifest = {
                "model": MODEL_NAME,
                "count": int(index.ntotal),
                "dim": int(d)
            }
            with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
                json.dump(manifest, f, ensure_ascii=False)

            print(f"Wrote index to {INDEX_PATH} with {index.ntotal} vectors, dim={d}")

        build_index()

    def search_biencoder(self,query, top_k=100):
        MODEL_NAME = "sentence-transformers/msmarco-distilbert-base-v4"
        INDEX_PATH = self.colbert_dir + "/biencoder_index.faiss"
        MANIFEST_PATH = self.colbert_dir + "/manifest.json"
        # Optional: sanity load
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        # 1) Load model and index
        model = SentenceTransformer(MODEL_NAME)
        index = faiss.read_index(INDEX_PATH)
        if not query.strip():
            return []

        # 2) Encode query with same normalization
        q_emb = model.encode([query], convert_to_numpy=True, normalize_embeddings=True).astype("float32")

        # 3) Search
        scores, ids = index.search(q_emb, top_k)  # ids: shape (1, k) int64, scores: shape (1, k) float32

        # 4) Filter invalids and extreme sentinels
        out = []
        for s, did in zip(scores[0], ids[0]):
            if did == -1:
                continue
            if not np.isfinite(s):
                continue
            # With cosine, valid range is roughly [-1, 1], but allow small num tolerance
            if s < -1.0:
                # drop sentinels like -3.4028235e38
                continue
            out.append((int(did), float(s)))
        return out
    # ===============================
    # 🚀 FULL RUN PIPELINE
    # ===============================
    def run(self):
        print("🚀 [RUN] Starting full indexing pipeline...\n")
        self.export_documents_to_jsonl(self.output_path)
        self.run_pyserini_index()
        self.byencoder()
        print("🎉 [RUN] Full pipeline execution complete.\n")
