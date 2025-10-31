import json
import os
import sys
import runpy
import subprocess

base_dir = os.path.dirname(os.path.abspath(__file__))
db_dir = os.path.join(base_dir, "..", "database", "search")
colbert_dir = os.path.join(base_dir, "..", "database", "search2")
os.makedirs(db_dir, exist_ok=True)
os.makedirs(colbert_dir, exist_ok=True)

output_path = os.path.join(db_dir, "documents.jsonl")
index_path = os.path.join(db_dir, "bm25_index")
colbert_index_path = os.path.join(colbert_dir, "colbert_index")
colbert_jsonl_path = os.path.join(colbert_dir, "documents.jsonl")

class SearchBack:
    def __init__(self, Document,
                 db_dir=db_dir,
                 index_path=index_path,
                 colbert_dir=colbert_dir,
                 colbert_index_path=colbert_index_path,
                 colbert_jsonl_path=colbert_jsonl_path):
        self.db_dir = db_dir
        self.documents = Document.query.all()
        self.output_path = output_path
        self.index_path = index_path
        self.colbert_dir = colbert_dir
        self.colbert_index_path = colbert_index_path
        self.colbert_jsonl_path = colbert_jsonl_path

    def export_documents_to_jsonl(self, path=None):
        path = path or self.output_path
        with open(path, 'w', encoding='utf-8') as f:
            for doc in self.documents:
                line = {
                    'id': str(doc.id),
                    'contents': doc.raw_text if doc.raw_text else ''
                }
                f.write(json.dumps(line, ensure_ascii=False) + '\n')

    def run_pyserini_index(self):
        sys.argv = [
            "pyserini.index",
            "--collection", "JsonCollection",
            "--input", self.db_dir,
            "--index", self.index_path,
            "--generator", "DefaultLuceneDocumentGenerator",
            "--threads", "8"
        ]
        runpy.run_module("pyserini.index", run_name="__main__")


    def run(self):
        # Export for BM25
        self.export_documents_to_jsonl(self.output_path)
        self.run_pyserini_index()
        # Export for ColBERT (TSV format)
     

