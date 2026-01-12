"""
High-performance drop-in replacement for the original DocumentMatcher.
Production-ready version with logging, dynamic context windows, and optimizations.

Author: <you>
Version: 2.0
"""
from __future__ import annotations

import io
import re
import logging
import typing as _t
from dataclasses import dataclass
from enum import Enum
from functools import lru_cache

# ---------- Configure Logging ------------------------------------------------
logger = logging.getLogger(__name__)


# ---------- Types ------------------------------------------------------------
class MatchGranularity(str, Enum):
    LINE = "line"
    SENTENCE = "sentence"
    PARAGRAPH = "paragraph"
    CELL = "cell"


@dataclass(slots=True)
class MatchSpan:
    text: str
    context: str
    granularity: MatchGranularity
    score: float
    location: dict[str, _t.Any]


@dataclass(slots=True)
class MatchResult:
    is_match: bool
    reason: str
    evidence: MatchSpan | None
    matches: list[MatchSpan]
    metadata: dict[str, _t.Any]


# ---------- Pure Helper Functions --------------------------------------------
def _normalise(text: str) -> str:
    """Lower-case + collapse whitespace for matching."""
    return re.sub(r"\s+", " ", text.lower())


@lru_cache(maxsize=2**14)
def _keyword_score_cached(norm_text: str, norm_query: str) -> float:
    """Cached keyword score – avoids re-counting identical strings."""
    if not norm_text or not norm_query:
        return 0.0
    return norm_text.count(norm_query) / (1 + len(norm_text.split()))


def _compute_dynamic_window(doc_length: int, granularity: MatchGranularity) -> int:
    """
    Compute context window size based on document length.
    Larger documents get larger context windows.
    """
    if granularity == MatchGranularity.LINE:
        if doc_length < 100:
            return 2
        elif doc_length < 500:
            return 3
        elif doc_length < 2000:
            return 5
        else:
            return 7
    elif granularity == MatchGranularity.SENTENCE:
        if doc_length < 50:
            return 1
        elif doc_length < 200:
            return 2
        else:
            return 3
    return 0  # Paragraphs use self-context


# ---------- Semantic Embedding Cache -----------------------------------------
_EMB_CACHE: dict[str, _t.Any] = {}
_ST_MODEL: _t.Any = None
_ST_UTIL: _t.Any = None


def _get_st_model() -> tuple[_t.Any, _t.Any]:
    """
    Lazy load sentence-transformers model with aggressive fallback strategy.
    Handles meta tensor issues by downloading and loading weights directly.
    """
    global _ST_MODEL, _ST_UTIL
    if _ST_MODEL is None:
        logger.info("Loading sentence-transformers model...")
        from sentence_transformers import SentenceTransformer, util
        import torch
        import os
        
        # Set environment variables to avoid issues
        os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
        
        # Strategy 1: Try with local_files_only first (if cached)
        try:
            logger.debug("Attempting to load from cache...")
            _ST_MODEL = SentenceTransformer(
                "all-MiniLM-L6-v2",
                device='cpu',
                local_files_only=True
            )
            _ST_UTIL = util
            logger.info("Model loaded successfully from cache (CPU)")
            return _ST_MODEL, _ST_UTIL
        except Exception as e:
            logger.debug(f"Cache load failed: {e}")
        
        # Strategy 2: Download with specific settings to avoid meta tensors
        try:
            logger.debug("Downloading model with safe settings...")
            
            # Use transformers directly to download with safe settings
            from transformers import AutoTokenizer, AutoModel
            
            # Download tokenizer and model separately with safe settings
            tokenizer = AutoTokenizer.from_pretrained(
                "all-MiniLM-L6-v2",
                use_fast=True
            )
            
            model = AutoModel.from_pretrained(
                "all-MiniLM-L6-v2",
                torch_dtype=torch.float32,  # Explicit dtype
                low_cpu_mem_usage=False      # Avoid lazy loading
            )
            
            # Move to CPU explicitly
            model = model.to('cpu')
            model.eval()
            
            # Now wrap in SentenceTransformer
            _ST_MODEL = SentenceTransformer(
                "all-MiniLM-L6-v2",
                device='cpu'
            )
            _ST_UTIL = util
            logger.info("Model loaded successfully (downloaded with safe settings)")
            return _ST_MODEL, _ST_UTIL
            
        except Exception as e:
            logger.warning(f"Safe download failed: {e}")
        
        # Strategy 3: Last resort - try without specifying device
        try:
            logger.debug("Attempting load without device specification...")
            _ST_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
            # Force to CPU after loading
            _ST_MODEL = _ST_MODEL.to('cpu')
            _ST_UTIL = util
            logger.info("Model loaded successfully (unspecified device, moved to CPU)")
            return _ST_MODEL, _ST_UTIL
        except Exception as e:
            logger.error(f"All loading strategies failed: {e}")
            raise RuntimeError(
                "Could not load sentence-transformers model. "
                "Please run: pip install --upgrade torch transformers sentence-transformers"
            ) from e
    
    return _ST_MODEL, _ST_UTIL


def _semantic_score(text: str, query: str) -> float:
    """Compute semantic similarity using cached embeddings."""
    if not text.strip():
        return 0.0
    
    model, util = _get_st_model()
    key = text
    if key not in _EMB_CACHE:
        _EMB_CACHE[key] = model.encode([text], convert_to_tensor=True, show_progress_bar=False)
    
    emb_q = model.encode([query], convert_to_tensor=True, show_progress_bar=False)
    similarity = float(util.cos_sim(emb_q, _EMB_CACHE[key])[0][0])
    return similarity


# ---------- File Type Detection ----------------------------------------------
def _detect_extension(data: bytes) -> str | None:
    """Detect file type from magic bytes."""
    if data.startswith(b"%PDF"):
        return ".pdf"
    if data.startswith(b"PK\x03\x04"):
        try:
            import zipfile
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                names = set(zf.namelist())
                if "word/document.xml" in names:
                    return ".docx"
                if "xl/workbook.xml" in names:
                    return ".xlsx"
                if "ppt/presentation.xml" in names:
                    return ".pptx"
        except Exception:
            pass
    return None


# ---------- Text Extractors --------------------------------------------------
def _pdf_text_chunks(data: bytes) -> _t.Iterator[tuple[str, int]]:
    """Yield (page_text, page_number) – streaming, low memory."""
    try:
        import fitz
        doc = fitz.open(stream=data, filetype="pdf")
        for p, page in enumerate(doc, 1):
            yield page.get_text(), p
    except ImportError:
        import PyPDF2 as fpdf
        src = io.BytesIO(data)
        reader = fpdf.PdfReader(src)
        for i, page in enumerate(reader.pages, 1):
            yield (page.extract_text() or ""), i


def _docx_text(data: bytes) -> str:
    """Extract text from DOCX including tables."""
    from docx import Document
    doc = Document(io.BytesIO(data))
    parts = [p.text for p in doc.paragraphs if p.text.strip()]
    for tbl in doc.tables:
        for row in tbl.rows:
            parts.append("\t".join(cell.text.strip() for cell in row.cells))
    return "\n".join(parts)


def _pptx_text(data: bytes) -> str:
    """Extract text from PPTX slides."""
    from pptx import Presentation
    prs = Presentation(io.BytesIO(data))
    out: list[str] = []
    for idx, slide in enumerate(prs.slides, 1):
        out.append(f"--- Slide {idx} ---")
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                out.append(shape.text)
    return "\n".join(out)


def _xlsx_tables(data: bytes) -> dict[str, _t.Any]:
    """Load all sheets from Excel file."""
    import pandas as pd
    xls = pd.ExcelFile(io.BytesIO(data))
    return {name: xls.parse(name, dtype=str, keep_default_na=False) for name in xls.sheet_names}


def _csv_table(data: bytes) -> _t.Any:
    """Load CSV as DataFrame."""
    import pandas as pd
    return pd.read_csv(io.BytesIO(data), dtype=str, keep_default_na=False)


def _plain_text(data: bytes) -> str:
    """Decode bytes to text."""
    try:
        return data.decode("utf-8")
    except Exception:
        return data.decode("latin-1", errors="ignore")


# ---------- Core DocumentMatcher Class ---------------------------------------
class DocumentMatcher:
    """
    High-performance document matcher with semantic search capabilities.
    """

    def __init__(
        self,
        enable_semantic: bool = True,
        pdf_highlight: bool = False,
        log_level: str = "INFO",
    ) -> None:
        """
        Initialize DocumentMatcher.

        Args:
            enable_semantic: Enable semantic similarity scoring
            pdf_highlight: Enable PDF highlighting (adds overhead)
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        """
        self.enable_semantic = enable_semantic
        self.pdf_highlight = pdf_highlight
        
        # Configure logging
        logging.basicConfig(
            level=getattr(logging, log_level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        logger.info(
            f"DocumentMatcher initialized: semantic={enable_semantic}, "
            f"pdf_highlight={pdf_highlight}"
        )

    def _best_spans(
        self, full_text: str, query: str, top_k: int = 8
    ) -> list[MatchSpan]:
        """
        Multi-granularity matching with dynamic context windows.
        
        Uses document length to determine optimal context window sizes.
        """
        norm_q = _normalise(query)
        if not norm_q:
            logger.warning("Empty query after normalization")
            return []

        logger.debug(f"Searching for query: '{query}' (normalized: '{norm_q}')")
        
        # Split text into different granularities
        lines = full_text.splitlines()
        sentences = re.split(r"(?<=[.!?])\s+", full_text.strip())
        paras = [p.strip() for p in re.split(r"\n{2,}", full_text) if p.strip()]

        logger.debug(
            f"Document structure: {len(lines)} lines, {len(sentences)} sentences, "
            f"{len(paras)} paragraphs"
        )

        # Compute dynamic window sizes
        line_window = _compute_dynamic_window(len(lines), MatchGranularity.LINE)
        sent_window = _compute_dynamic_window(len(sentences), MatchGranularity.SENTENCE)
        
        logger.debug(f"Context windows: line={line_window}, sentence={sent_window}")

        spans: list[tuple[float, str, str, MatchGranularity, dict]] = []

        # Process lines
        for no, line in enumerate(lines, 1):
            norm_line = _normalise(line)
            if not norm_line:
                continue
            
            k_score = _keyword_score_cached(norm_line, norm_q)
            if k_score == 0 and not self.enable_semantic:
                continue
            
            s_score = _semantic_score(line, query) if self.enable_semantic else 0.0
            score = k_score + 0.3 * s_score
            
            if score <= 0:
                continue
            
            # Dynamic context window
            start_idx = max(0, no - line_window - 1)
            end_idx = min(len(lines), no + line_window)
            ctx = "\n".join(lines[start_idx:end_idx])
            
            spans.append((score, line, ctx, MatchGranularity.LINE, {"line_no": no}))

        # Process sentences
        for no, sent in enumerate(sentences, 1):
            norm_sent = _normalise(sent)
            if not norm_sent:
                continue
            
            k_score = _keyword_score_cached(norm_sent, norm_q)
            if k_score == 0 and not self.enable_semantic:
                continue
            
            s_score = _semantic_score(sent, query) if self.enable_semantic else 0.0
            score = k_score + 0.3 * s_score
            
            if score <= 0:
                continue
            
            # Dynamic context window
            start_idx = max(0, no - sent_window - 1)
            end_idx = min(len(sentences), no + sent_window)
            ctx = " ".join(sentences[start_idx:end_idx])
            
            spans.append((score, sent, ctx, MatchGranularity.SENTENCE, {"sentence_no": no}))

        # Process paragraphs
        for no, para in enumerate(paras, 1):
            norm_p = _normalise(para)
            k_score = _keyword_score_cached(norm_p, norm_q)
            if k_score == 0 and not self.enable_semantic:
                continue
            
            s_score = _semantic_score(para, query) if self.enable_semantic else 0.0
            score = k_score + 0.3 * s_score
            
            if score <= 0:
                continue
            
            spans.append((score, para, para, MatchGranularity.PARAGRAPH, {"paragraph_no": no}))

        # Sort by score and return top k
        spans.sort(reverse=True, key=lambda t: t[0])
        
        logger.info(f"Found {len(spans)} matches, returning top {min(top_k, len(spans))}")
        
        return [
            MatchSpan(text=t[1], context=t[2], granularity=t[3], score=t[0], location=t[4])
            for t in spans[:top_k]
        ]

    def _search_table(
        self, df: _t.Any, query: str, sheet: str | None = None
    ) -> list[MatchSpan]:
        """
        Vectorized cell search with batch processing.
        
        Processes entire DataFrame at once for maximum performance.
        """
        import pandas as pd
        
        logger.debug(
            f"Searching table: shape={df.shape}, sheet={sheet}, query='{query}'"
        )
        
        # Normalize query
        STOP_WORDS = {
            "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
            "by", "a", "an", "is", "are", "was", "were", "be", "been", "have", "has",
            "had", "do", "does", "did", "will", "would", "could", "can", "should",
            "may", "might", "must", "shall"
        }
        
        def _tokenize(txt: str) -> list[str]:
            """Lower-case, keep alphanumerics, drop short tokens & stop-words."""
            txt = re.sub(r"[^a-z0-9]+", " ", txt.lower())
            tokens = {t for t in txt.split() if len(t) > 1} - STOP_WORDS
            return list(tokens)
        
        query_tokens = _tokenize(query)
        if not query_tokens:
            logger.warning("No valid query tokens after normalization")
            return []
        
        logger.debug(f"Query tokens: {query_tokens}")

        # Vectorized search across entire DataFrame
        try:
            # Create masks for each query token
            word_masks = {}
            for word in query_tokens:
                word_masks[word] = df.map(lambda cell: word in str(cell).lower())
            
            # Combine masks: any row with any query token
            combined_mask = pd.concat(word_masks.values(), axis=1).any(axis=1)
            
            # Get matching cells
            matching_cells = []
            for row_idx in df.index[combined_mask]:
                for col_idx, col_name in enumerate(df.columns):
                    cell_value = str(df.at[row_idx, col_name])
                    cell_lower = cell_value.lower()
                    
                    # Check if any query token matches
                    if any(token in cell_lower for token in query_tokens):
                        matching_cells.append((row_idx, col_idx, col_name, cell_value))
            
            logger.info(f"Vectorized search found {len(matching_cells)} matching cells")
            
        except Exception as e:
            logger.error(f"Vectorized search failed: {e}, falling back to row iteration")
            
            # Fallback: iterate through rows
            matching_cells = []
            for row_idx in df.index:
                for col_idx, col_name in enumerate(df.columns):
                    cell_value = str(df.at[row_idx, col_name])
                    cell_lower = cell_value.lower()
                    
                    if any(token in cell_lower for token in query_tokens):
                        matching_cells.append((row_idx, col_idx, col_name, cell_value))

        if not matching_cells:
            logger.debug("No matching cells found")
            return []

        # Build MatchSpan objects
        matches: list[MatchSpan] = []
        for row_idx, col_idx, col_name, cell_value in matching_cells:
            # Compute score
            score = sum(cell_value.lower().count(token) for token in query_tokens)
            score = score / (1 + len(cell_value.split()))
            
            # Build context from row
            row_data = df.iloc[row_idx]
            ctx_items = [f"{k}={v}" for k, v in list(row_data.items())[:5]]
            context = " | ".join(ctx_items)
            
            location = {
                "row_index": int(row_idx),
                "col_index": col_idx,
                "col_name": col_name
            }
            if sheet:
                location["sheet"] = sheet
            
            matches.append(
                MatchSpan(
                    text=cell_value,
                    context=f"Row {row_idx} • {context}",
                    granularity=MatchGranularity.CELL,
                    score=score,
                    location=location,
                )
            )

        # Sort by score, then by row index
        matches.sort(key=lambda m: (-m.score, m.location.get("row_index", 0)))
        
        logger.info(f"Returning {len(matches)} cell matches")
        return matches

    def _highlight_pdf(self, data: bytes, query: str) -> bytes | None:
        """Add highlights to PDF for search query."""
        try:
            import fitz
        except ImportError:
            logger.warning("PyMuPDF not available, skipping PDF highlighting")
            return None
        
        logger.debug(f"Highlighting PDF for query: '{query}'")
        doc = fitz.open(stream=data, filetype="pdf")
        found = False
        
        for page in doc:
            for rect in page.search_for(query, quads=True):
                page.add_highlight_annot(rect).update()
                found = True
        
        if found:
            logger.info("PDF highlighting successful")
            return doc.tobytes()
        else:
            logger.debug("No matches found for PDF highlighting")
            return None

    def match(
        self,
        file_input: bytes | io.IOBase,
        query: str,
        file_type: str | None = None,
    ) -> MatchResult:
        """
        Match query against document content.

        Args:
            file_input: Document as bytes or file-like object
            query: Search query string
            file_type: Optional file extension override (.pdf, .docx, etc.)

        Returns:
            MatchResult with matches, evidence, and metadata
        """
        logger.info(f"Starting match operation for query: '{query}'")
        
        # Normalize input
        if isinstance(file_input, io.IOBase):
            data = file_input.read()
            if isinstance(file_input, io.BytesIO):
                file_input.seek(0)
        elif isinstance(file_input, bytes):
            data = file_input
        else:
            raise TypeError("file_input must be bytes or file-like object")

        # Detect file type
        detected = file_type or _detect_extension(data) or ".txt"
        detected = detected.lower()
        
        logger.info(f"Detected file type: {detected}, size: {len(data)} bytes")

        q = query.strip()
        meta: dict[str, _t.Any] = {"file_type": detected, "query": q, "file_size": len(data)}
        matches: list[MatchSpan] = []
        evidence: MatchSpan | None = None
        is_match = False
        reason = "no_match"

        try:
            if detected == ".pdf":
                logger.debug("Processing PDF document")
                text_chunks: list[str] = []
                for txt, page_num in _pdf_text_chunks(data):
                    text_chunks.append(txt)
                    logger.debug(f"Extracted text from page {page_num}: {len(txt)} chars")
                
                full_text = "\n".join(text_chunks)
                logger.info(f"Total PDF text length: {len(full_text)} chars")
                
                matches = self._best_spans(full_text, q, top_k=8)
                reason = "keyword" if matches else "no_match"
                
                if self.pdf_highlight and matches:
                    if highlighted := self._highlight_pdf(data, q):
                        meta["pdf_highlighted_bytes"] = highlighted
                        meta["highlighted"] = True

            elif detected == ".docx":
                logger.debug("Processing DOCX document")
                full_text = _docx_text(data)
                logger.info(f"Extracted DOCX text length: {len(full_text)} chars")
                matches = self._best_spans(full_text, q, top_k=8)
                reason = "keyword" if matches else "no_match"

            elif detected == ".pptx":
                logger.debug("Processing PPTX presentation")
                full_text = _pptx_text(data)
                logger.info(f"Extracted PPTX text length: {len(full_text)} chars")
                matches = self._best_spans(full_text, q, top_k=8)
                reason = "keyword" if matches else "no_match"

            elif detected == ".xlsx":
                logger.debug("Processing XLSX workbook")
                sheets = _xlsx_tables(data)
                logger.info(f"Found {len(sheets)} sheets")
                
                for name, df in sheets.items():
                    logger.debug(f"Searching sheet '{name}': shape={df.shape}")
                    sheet_matches = self._search_table(df, q, sheet=name)
                    matches.extend(sheet_matches)
                
                reason = "exact_cell_match" if matches else "no_match"
                meta.update({"sheet_count": len(sheets), "hit_count": len(matches)})

            elif detected == ".csv":
                logger.debug("Processing CSV file")
                df = _csv_table(data)
                logger.info(f"CSV shape: {df.shape}")
                matches = self._search_table(df, q)
                reason = "exact_cell_match" if matches else "no_match"
                meta["hit_count"] = len(matches)

            else:
                logger.debug(f"Processing as plain text: {detected}")
                full_text = _plain_text(data)
                logger.info(f"Plain text length: {len(full_text)} chars")
                matches = self._best_spans(full_text, q, top_k=8)
                reason = "keyword" if matches else "no_match"

            if matches:
                is_match = True
                evidence = matches[0]
                logger.info(
                    f"Match successful: {len(matches)} matches, "
                    f"best score={evidence.score:.4f}"
                )
            else:
                logger.info("No matches found")

        except Exception as exc:
            logger.error(f"Error during matching: {exc}", exc_info=True)
            reason = "error"
            meta["error"] = str(exc)

        return MatchResult(
            is_match=is_match,
            reason=reason,
            evidence=evidence,
            matches=matches,
            metadata=meta,
        )


# ---------- Example Usage ----------------------------------------------------
if __name__ == "__main__":
    # Configure logging for demo
    logging.basicConfig(level=logging.INFO)
    
    # Create matcher
    matcher = DocumentMatcher(
        enable_semantic=True,
        pdf_highlight=False,
        log_level="INFO"
    )
    
    # Example: Match against a text document
    sample_text = b"""
    This is a sample document about machine learning.
    Machine learning is a subset of artificial intelligence.
    It involves training models on data to make predictions.
    Deep learning uses neural networks with multiple layers.
    """
    
    result = matcher.match(sample_text, "machine learning", file_type=".txt")
    
    print(f"\nMatch Result:")
    print(f"  Is Match: {result.is_match}")
    print(f"  Reason: {result.reason}")
    print(f"  Matches Found: {len(result.matches)}")
    
    if result.evidence:
        print(f"\nBest Match:")
        print(f"  Text: {result.evidence.text}")
        print(f"  Score: {result.evidence.score:.4f}")
        print(f"  Granularity: {result.evidence.granularity.value}")