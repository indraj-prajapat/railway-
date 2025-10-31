import io
import csv
import PyPDF2
import docx
import pptx
import openpyxl
import xlrd
import filetype  # pip install filetype

def extract_text_from_bytes(file_bytes: bytes,mime) -> str:
    """
    Extract text from raw file bytes without needing filename.
    Supports: pdf, docx, doc, xlsx, xls, pptx, ppt, csv, txt
    """
    text = ""
    try:
        # Detect file type
        kind = filetype.guess(file_bytes)
        ext = kind.extension if kind else None

        # --- PDF ---
        if mime == "application/pdf" or ext == "pdf":
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                text += page.extract_text() or ""

        # --- DOCX ---
        elif ext == "docx" or mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            doc = docx.Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                text += para.text + "\n"

        # --- DOC (old Word) ---
        elif ext == "doc" or mime == "application/msword":
            import textract
            text = textract.process(io.BytesIO(file_bytes)).decode("utf-8", errors="ignore")

        # --- PPTX ---
        elif ext == "pptx" or mime == "application/vnd.openxmlformats-officedocument.presentationml.presentation":
            prs = pptx.Presentation(io.BytesIO(file_bytes))
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text"):
                        text += shape.text + "\n"

        # --- PPT (old PowerPoint) ---
        elif ext == "ppt" or mime == "application/vnd.ms-powerpoint":
            import textract
            text = textract.process(io.BytesIO(file_bytes)).decode("utf-8", errors="ignore")

        # --- XLSX ---
        elif ext == "xlsx" or mime == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            for sheet in wb.sheetnames:
                ws = wb[sheet]
                for row in ws.iter_rows(values_only=True):
                    text += " ".join([str(cell) for cell in row if cell is not None]) + "\n"

        # --- XLS ---
        elif ext == "xls" or mime == "application/vnd.ms-excel":
            wb = xlrd.open_workbook(file_contents=file_bytes)
            for sheet in wb.sheets():
                for row_idx in range(sheet.nrows):
                    row = sheet.row_values(row_idx)
                    text += " ".join([str(cell) for cell in row if cell]) + "\n"

        # --- CSV ---
        elif mime == "text/csv":
            csvfile = io.StringIO(file_bytes.decode("utf-8", errors="ignore"))
            reader = csv.reader(csvfile)
            for row in reader:
                text += " ".join(row) + "\n"

        # --- TXT ---
        elif ext in ["txt", "log"] or (mime and mime.startswith("text/")):
            text = file_bytes.decode("utf-8", errors="ignore")

        else:
            text = "[Unsupported file type]"

    except Exception as e:
        text = f"[Error extracting text: {str(e)}]"

    return text.strip()
