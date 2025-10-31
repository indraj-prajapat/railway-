import os
import mimetypes
from typing import Dict
import docx
import PyPDF2
import pandas as pd




class DocumentProcessor:
    def extract_text_from_file(self, file_path: str, mime_type: str) -> str:
        """Extract text content from various file types"""
        try:
            if mime_type.startswith('text/'):
                return self._extract_from_text(file_path)
            elif mime_type == 'application/pdf':
                return self._extract_from_pdf(file_path)
            elif mime_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']:
                return self._extract_from_docx(file_path)
            elif mime_type in ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']:
                return self._extract_from_excel_csv(file_path)
            else:
                return ""
        except Exception as e:
            print(f"Error extracting text from {file_path}: {str(e)}")
            return ""
    
    def _extract_from_text(self, file_path: str) -> str:
        """Extract text from plain text files"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            return file.read()
    
    def _extract_from_pdf(self, file_stream) -> str:
        """Extract text from PDF files"""
        text = ""
        try:
            pdf_reader = PyPDF2.PdfReader(file_stream)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        except Exception as e:
            print(f"Error reading PDF {file_stream}: {e}")
        return text
    
    def _extract_from_docx(self, file_path: str) -> str:
        """Extract text from Word documents"""
        try:
            doc = docx.Document(file_path)
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text
        except Exception as e:
            print(f"Error reading DOCX {file_path}: {str(e)}")
            return ""
    
    def _extract_from_excel_csv(self, file_path: str) -> str:
        """Extract text from Excel/CSV files"""
        try:
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
            
            # Convert all data to string and concatenate
            text = ""
            for column in df.columns:
                text += f"{column}: "
                text += " ".join(df[column].astype(str).tolist()) + "\n"
            return text
        except Exception as e:
            print(f"Error reading Excel/CSV {file_path}: {str(e)}")
            return ""
    

    def get_file_info(self, file_path: str) -> Dict:
        """Get file information including size, type, and MIME type"""
        file_size = os.path.getsize(file_path)
        mime_type, _ = mimetypes.guess_type(file_path)
        
        # Determine file type category
        if mime_type:
            if mime_type.startswith('text/'):
                file_type = 'text'
            elif mime_type == 'application/pdf':
                file_type = 'pdf'
            elif 'word' in mime_type:
                file_type = 'word'
            elif 'excel' in mime_type or mime_type == 'text/csv':
                file_type = 'spreadsheet'
            else:
                file_type = 'other'
        else:
            file_type = 'unknown'
        
        return {
            'file_size': file_size,
            'file_type': file_type,
            'mime_type': mime_type or 'application/octet-stream'
        }