from flask_sqlalchemy import SQLAlchemy
from src.extensions import db
from datetime import datetime
import uuid
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default="viewer")   # admin/editor/viewer/user
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    chats = db.relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")

    uploaded_documents = db.relationship("Document", back_populates="uploader")
    user_contractors = db.relationship("UserContractor", backref="user", lazy=True)
    VALID_ROLES = ["admin", "editor", "viewer", "user"]

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def is_admin(self): return self.role == "admin"
    def is_editor(self): return self.role == "editor"
    def is_viewer(self): return self.role == "viewer"

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"

class DocumentPermission(db.Model):
    __tablename__ = "document_permissions"

    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id', ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete="CASCADE"), nullable=False)

    # permission flags
    can_view = db.Column(db.Boolean, default=False)
    can_edit = db.Column(db.Boolean, default=False)

    # who granted the permission (admin), optional
    granted_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    granted_at = db.Column(db.DateTime, default=datetime.utcnow)

    document = db.relationship('Document', back_populates='permissions', foreign_keys=[document_id])
    user = db.relationship('User', foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "user_id": self.user_id,
            "can_view": self.can_view,
            "can_edit": self.can_edit,
            "granted_by": self.granted_by,
            "granted_at": self.granted_at.isoformat() if self.granted_at else None
        }

    __table_args__ = (db.UniqueConstraint('document_id', 'user_id', name='_document_user_uc'),)




class UserContractor(db.Model):
    __tablename__ = "user_contractors"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    contractor = db.Column(db.String(500), nullable=False)
    permission = db.Column(db.String(20), nullable=False, default="view")  # "view" or "edit"

    db.UniqueConstraint("user_id", "contractor")
