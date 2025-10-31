from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
from src.extensions import db
from sqlalchemy.types import TypeDecorator, TEXT
import json
from sqlalchemy import event
class JSONType(TypeDecorator):
    impl = TEXT

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value)
        return None

    def process_result_value(self, value, dialect):
        if value is not None:
            return json.loads(value)
        return None
class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    blob_url = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)  # in bytes
    file_type = db.Column(db.String(50), nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    processed = db.Column(db.Boolean, default=False)
    contractor = db.Column(db.String(500), nullable=False)
    version = db.Column(db.Integer, default=1)
    path = db.Column(db.String(500), nullable=False)
    raw_text = db.Column(db.String, nullable=True)
    folder_id = db.Column(db.Integer, nullable=True)

    # NEW: who uploaded this file (user id)
    uploaded_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    uploader = db.relationship("User", back_populates="uploaded_documents", foreign_keys=[uploaded_by])

    # Relationships
    keywords = db.relationship('DocumentKeyword', back_populates='document', cascade='all, delete-orphan')
    permissions = db.relationship('DocumentPermission', back_populates='document', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Document {self.original_filename}>'

    def to_dict(self, include_permissions=False):
        d = {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'blob_url': self.blob_url,
            'file_size': self.file_size,
            'version': self.version,
            'file_type': self.file_type,
            'contractor': self.contractor,
            'mime_type': self.mime_type,
            'upload_date': self.upload_date.isoformat() if self.upload_date else None,
            'processed': self.processed,
            'keywords': [kw.keyword.name for kw in self.keywords],
            'path': self.path,
            'raw_text': self.raw_text,
            'folder_id': self.folder_id,
            'uploaded_by': self.uploaded_by,
        }
        if include_permissions:
            d['permissions'] = [p.to_dict() for p in self.permissions]
        return d
    


    
class Keyword(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    frequency = db.Column(db.Integer, default=1)  # How many times this keyword appears across all documents
    
    # Relationships
    documents = db.relationship('DocumentKeyword', back_populates='keyword', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Keyword {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'frequency': self.frequency
        }

class DocumentKeyword(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False)
    keyword_id = db.Column(db.Integer, db.ForeignKey('keyword.id'), nullable=False)
    relevance_score = db.Column(db.Float, default=1.0)  # How relevant this keyword is to the document
    
    # Relationships
    document = db.relationship('Document', back_populates='keywords')
    keyword = db.relationship('Keyword', back_populates='documents')
    
    def __repr__(self):
        return f'<DocumentKeyword {self.document_id}-{self.keyword_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'keyword_id': self.keyword_id,
            'relevance_score': self.relevance_score,
            'keyword_name': self.keyword.name if self.keyword else None
        }

class UploadStatus(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), nullable=False)  # 'uploading', 'processing', 'completed', 'failed'
    progress = db.Column(db.Integer, default=0)  # 0-100
    message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<UploadStatus {self.filename}: {self.status}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'status': self.status,
            'progress': self.progress,
            'message': self.message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class DocumentEmbedding(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False)
    embedding = db.Column(db.PickleType, nullable=False)  # or JSON if you prefer
    document = db.relationship("Document", backref="embedding", lazy=True)

class Folder(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    parent_id = db.Column(db.Integer, nullable=True)  


class ChatHistory(db.Model):
    __tablename__ = "chat_history"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    chat = db.Column(db.JSON, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="chats")
