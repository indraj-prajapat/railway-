import json
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
    # 🔄 CONVERT JSONL → TSV
    # ===============================
    def convert_jsonl_to_tsv(self):
        import json, os
        jsonl_path = self.output_path  # ✅ correct JSONL file
        print("📂 [DEBUG] Starting convert_jsonl_to_tsv()...")
        print(f"📄 [DEBUG] Source JSONL file: {jsonl_path}")

        if not os.path.exists(jsonl_path):
            print(f"❌ [ERROR] File not found: {jsonl_path}")
            return

        base, _ = os.path.splitext(jsonl_path)
        tsv_path = f"{base}.tsv"
        print(f"🗂 [DEBUG] Output TSV file: {tsv_path}")

        json_count, tsv_count = 0, 0

        with open(jsonl_path, 'r', encoding='utf-8') as jf, open(tsv_path, 'w', encoding='utf-8') as tf:
            for line in jf:
                json_count += 1
                try:
                    doc = json.loads(line.strip())
                    doc_id = str(doc.get('id', ''))
                    contents = doc.get('contents', '')
                    tf.write(f"{doc_id}\t{contents}\n")
                    tsv_count += 1
                except Exception as e:
                    print(f"⚠️ [DEBUG] Skipping line {json_count} due to error: {e}")

        print(f"✅ [DEBUG] Conversion complete: {tsv_count}/{json_count} lines written to {tsv_path}")
        print("🎯 [DEBUG] convert_jsonl_to_tsv() finished.\n")

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

        DATA_PATH = self.output_path2
        INDEX_DIR = self.colbert_dir
        MODEL_NAME = "sentence-transformers/msmarco-distilbert-base-v4"
        print(f"🔧 [DEBUG] DATA_PATH = {DATA_PATH}")
        print(f"🔧 [DEBUG] INDEX_DIR = {INDEX_DIR}")
        print(f"🔧 [DEBUG] MODEL_NAME = {MODEL_NAME}")

        os.makedirs(INDEX_DIR, exist_ok=True)
        print(f"📁 [DEBUG] Created or verified directory: {INDEX_DIR}")

        # Load model
        print("🚀 [DEBUG] Loading bi-encoder model...")
        model = SentenceTransformer(MODEL_NAME)
        print("✅ [DEBUG] Model loaded successfully.")

        # Load documents
        print("📚 [DEBUG] Reading corpus file...")
        doc_ids, passages = [], []
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            line_count = 0
            for line in f:
                line_count += 1
                parts = line.strip().split("\t")
                if len(parts) >= 2:
                    doc_ids.append(parts[0])
                    passages.append(parts[1])
            print(f"📄 [DEBUG] Total lines read: {line_count}")
            print(f"📊 [DEBUG] Documents loaded: {len(doc_ids)}")

        # Compute embeddings
        print("⚙ [DEBUG] Encoding passages...")
        embeddings = model.encode(
            passages,
            batch_size=64,
            show_progress_bar=True,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        print(f"✅ [DEBUG] Embeddings computed. Shape: {embeddings.shape}")

        # Save FAISS index
        print("💾 [DEBUG] Creating FAISS index...")
        d = embeddings.shape[1]
        print(f"📐 [DEBUG] Embedding dimension: {d}")
        index = faiss.IndexFlatIP(d)  # Inner product for cosine similarity
        index.add(embeddings)
        print(f"✅ [DEBUG] Added {index.ntotal} vectors to FAISS index.")

        faiss_path = os.path.join(INDEX_DIR, "biencoder_index.faiss")
        faiss.write_index(index, faiss_path)
        print(f"💾 [DEBUG] FAISS index written to: {faiss_path}")

        # Save mapping
        id_map_path = os.path.join(INDEX_DIR, "id_map.json")
        with open(id_map_path, "w", encoding="utf-8") as f:
            json.dump(doc_ids, f)
        print(f"✅ [DEBUG] ID mapping saved to: {id_map_path}")

        print(f"🎯 [DEBUG] FAISS index and mapping completed successfully in {INDEX_DIR}")
        print("✅ [DEBUG] byencoder() execution finished.\n")

    # ===============================
    # 🚀 FULL RUN PIPELINE
    # ===============================
    def run(self):
        print("🚀 [RUN] Starting full indexing pipeline...\n")
        self.export_documents_to_jsonl(self.output_path)
        self.convert_jsonl_to_tsv()
        self.run_pyserini_index()
        self.byencoder()
        print("🎉 [RUN] Full pipeline execution complete.\n")
