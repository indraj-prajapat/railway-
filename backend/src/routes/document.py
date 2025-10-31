import os
import io
import uuid
import mimetypes
import shutil
import json 
import numpy as np 
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file, current_app
from werkzeug.utils import secure_filename
from sqlalchemy import func, desc
from src.models.document import *
from src.services.document_processor import DocumentProcessor
from src.models.textExtractUpdate import extract_text_from_bytes
from src.extensions import db
from rank_bm25 import BM25Okapi
from flask import send_file, jsonify
from pdf2docx import Converter
import tempfile, os, mimetypes
import re , traceback
document_bp = Blueprint('document', __name__)
processor = DocumentProcessor()


from flask_cors import CORS
from google.auth.transport.requests import Request
CORS(document_bp, origins=["http://localhost:5173"])

from src.models.user import *
import jwt

from functools import wraps
from google.oauth2 import service_account
import google.auth.transport.requests
from src.models.SearchBack import SearchBack
from azure.storage.blob import BlobServiceClient
import os
from dotenv import load_dotenv

load_dotenv()
AZURE_STORAGE_KEY = os.getenv("AZURE_STORAGE_KEY")
AZURE_CONN_STR =os.getenv("AZURE_CONN_STR")
CONTAINER_NAME = "uploads"

blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONN_STR)
container_client = blob_service_client.get_container_client(CONTAINER_NAME)



    
# Configuration
JWT_SECRET = os.getenv("JWT_SECRET")
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv','ppt', 'pptx'}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB




def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS









SECRET_KEY = "super-secret-key"
# ----------------- Token Decorator -----------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            token = request.headers["Authorization"].split(" ")[1]
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_user = User.query.get(data["user_id"])
        except:
            return jsonify({"error": "Token is invalid"}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# ----------------- Auth Routes -----------------
@document_bp.route("/register", methods=["POST"])
@token_required
def register(current_user):
    if not current_user.is_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.json
    if not data.get("username") or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Missing fields"}), 400

    user = User(username=data["username"], email=data["email"], role=data.get("role", "viewer"))
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "User created", "user": user.to_dict()}), 201


@document_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    user = User.query.filter_by(email=data.get("email")).first()
    if not user or not user.check_password(data.get("password")):
        return jsonify({"error": "Invalid credentials"}), 401

    token = jwt.encode(
        {"user_id": user.id, "exp": datetime.utcnow() + timedelta(hours=24)},
        SECRET_KEY,
        algorithm="HS256"
    )
    return jsonify({"token": token, "user": user.to_dict()})


@document_bp.route("/users", methods=["GET"])
@token_required
def get_users(current_user):
    if not current_user.is_admin():
        return jsonify({"error": "Admin access required"}), 403

    users = User.query.all()
    return jsonify([u.to_dict() for u in users])


@document_bp.route("/change-password", methods=["POST"])
@token_required
def change_password(current_user):
    data = request.json
    if not current_user.check_password(data.get("old_password")):
        return jsonify({"error": "Old password incorrect"}), 400

    current_user.set_password(data.get("new_password"))
    db.session.commit()
    return jsonify({"message": "Password updated"})


@document_bp.route("/update-role/<user_id>", methods=["PUT"])
@token_required
def update_role(current_user, user_id):
    if not current_user.is_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.json
    role = data.get("role")
    if role not in User.VALID_ROLES:
        return jsonify({"error": "Invalid role"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.role = role
    db.session.commit()
    return jsonify({"message": "Role updated", "user": user.to_dict()})


@document_bp.route("/users/<user_id>/contractors", methods=["POST"])
@token_required
def assign_contractor(current_user, user_id):
    if not current_user.is_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.json
    contractor = data.get("contractor")
    permission = data.get("permission", "view")  # default to "view"

    if not contractor:
        return jsonify({"error": "Contractor name required"}), 400
    if permission not in ["view", "edit"]:
        return jsonify({"error": "Invalid permission"}), 400

    # Check if user exists
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Check for existing contractor entry
    existing = UserContractor.query.filter_by(user_id=user_id, contractor=contractor).first()
    if existing:
        existing.permission = permission  # update permission if different
        db.session.commit()
        return jsonify({"message": f"Updated contractor '{contractor}' to '{permission}'"}), 200

    uc = UserContractor(user_id=user_id, contractor=contractor, permission=permission)
    db.session.add(uc)
    db.session.commit()

    return jsonify({
        "message": f"Contractor '{contractor}' assigned to {user.username} with '{permission}' permission"
    }), 201


@document_bp.route("/users/<user_id>", methods=["PUT"])
@token_required
def update_user(current_user, user_id):
    if not current_user.is_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.json
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if "username" in data:
        user.username = data["username"]
    if "email" in data:
        user.email = data["email"]
    if "role" in data:
        user.role = data["role"]

    db.session.commit()
    return jsonify({"message": "User updated successfully", "user": {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role
    }})


# routes for permissions
@document_bp.route('/permissions', methods=['POST'])
@token_required
def set_permission(current_user):
    """
    Create or update a permission.
    Body: { document_id, user_id, can_view (bool), can_edit (bool) }
    Only admin may change permissions for arbitrary users.
    """
    data = request.json or {}
    document_id = data.get('document_id')
    user_id = data.get('user_id')
    can_view = bool(data.get('can_view', False))
    can_edit = bool(data.get('can_edit', False))

    if not document_id or not user_id:
        return jsonify({'error': 'document_id and user_id required'}), 400

    doc = Document.query.get(document_id)
    if not doc:
        return jsonify({'error': 'Document not found'}), 404

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404

    # Only admin can change permissions for others.
    if not current_user.is_admin():
        return jsonify({'error': 'Admin access required to change permissions'}), 403

    perm = DocumentPermission.query.filter_by(document_id=document_id, user_id=user_id).first()
    if not perm:
        perm = DocumentPermission(
            document_id=document_id,
            user_id=user_id,
            can_view=can_view,
            can_edit=can_edit,
            granted_by=current_user.id
        )
        db.session.add(perm)
    else:
        perm.can_view = can_view
        perm.can_edit = can_edit
        perm.granted_by = current_user.id
        perm.granted_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Permission set', 'permission': perm.to_dict()})


@document_bp.route('/permissions', methods=['DELETE'])
@token_required
def revoke_permission(current_user):
    """
    Body: { document_id, user_id }
    Admin only.
    """
    data = request.json or {}
    document_id = data.get('document_id')
    user_id = data.get('user_id')

    if not document_id or not user_id:
        return jsonify({'error': 'document_id and user_id required'}), 400

    if not current_user.is_admin():
        return jsonify({'error': 'Admin access required to revoke permissions'}), 403

    perm = DocumentPermission.query.filter_by(document_id=document_id, user_id=user_id).first()
    if not perm:
        return jsonify({'error': 'Permission not found'}), 404

    db.session.delete(perm)
    db.session.commit()
    return jsonify({'message': 'Permission revoked'}), 200


@document_bp.route('/<int:document_id>/permissions', methods=['GET'])
@token_required
def list_permissions_for_doc(current_user, document_id):
    """
    Returns permission rows for a document. Admin only.
    """
    doc = Document.query.get(document_id)
    if not doc:
        return jsonify({'error': 'Document not found'}), 404

    if not current_user.is_admin():
        return jsonify({'error': 'Admin access required'}), 403

    perms = DocumentPermission.query.filter_by(document_id=document_id).all()
    return jsonify([p.to_dict() for p in perms])

@document_bp.route("/all-documents", methods=["GET"])
@token_required
def get_all_documents(current_user):
    """
    Admin-only: return all documents for permission management
    """
    if not current_user.is_admin():
        return jsonify({"error": "Admin access required"}), 403

    documents = Document.query.all()
    return jsonify([doc.to_dict() for doc in documents])


@document_bp.route("/folder/address/<int:folder_id>", methods=["GET"])
def get_folder_address(folder_id):
    folder = Folder.query.get(folder_id)
    if not folder:
        return jsonify({"error": "Folder not found"}), 404

    parts = []
    current = folder
    while current:
        parts.insert(0, current.name)  # prepend name
        if current.parent_id is None:
            break
        current = Folder.query.get(current.parent_id)

    address = "/".join(parts) + "/"
    return jsonify({"folder_id": folder_id, "address": address})

@document_bp.route('/<int:document_id>', methods=['GET'])
@token_required
def get_document(current_user, document_id):
    d = Document.query.get(document_id)
    if not d:
        return jsonify({'error': 'Document not found'}), 404

    # Admin always allowed
    if not current_user.is_admin():
        if d.uploaded_by == current_user.id:
            allowed = True
        else:
            perm = DocumentPermission.query.filter_by(document_id=document_id, user_id=current_user.id).first()
            allowed = bool(perm and perm.can_view)
        if not allowed:
            return jsonify({'error': 'Access denied'}), 403

    # return doc metadata (not file bytes). For file download, you can add a separate route that uses send_file and same access-check.
    return jsonify(d.to_dict(include_permissions=current_user.is_admin()))

@document_bp.route("/users/<user_id>/assign-contractors", methods=["POST"])
@token_required
def assign_contractors(current_user, user_id):
    if not current_user.is_admin():
        return jsonify({"error": "Admin only"}), 403

    data = request.json
    contractors = data.get("contractors", [])
    if not isinstance(contractors, list):
        return jsonify({"error": "contractors must be a list"}), 400

    # clear old mappings
    UserContractor.query.filter_by(user_id=user_id).delete()

    for c in contractors:
        db.session.add(UserContractor(user_id=user_id, contractor=c))

    db.session.commit()
    return jsonify({"message": "Contractors assigned"})
@document_bp.route("/all-contractors", methods=["GET"])
@token_required
def all_contractors(current_user):
    contractors = db.session.query(Document.contractor).distinct().all()
    return jsonify([c[0] for c in contractors if c[0]])

# src/routes/document.py

@document_bp.route("/user-contractors", methods=["GET"])
@token_required
def get_user_contractors(current_user):
    """
    Returns all users with their assigned contractors
    """
    users = User.query.all()
    
    result = []
    for u in users:
        contractors = [f"{uc.contractor} ({uc.permission}), " for uc in u.user_contractors]

        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "contractors": contractors
        })
    
    return jsonify(result)

from sqlalchemy import func
from pyserini.search.lucene import LuceneSearcher

@document_bp.route('/check-permission/<int:document_id>', methods=['GET'])
@token_required
def check_permission(current_user, document_id):
    try:
        doc = Document.query.get(document_id)
        if not doc:
            return jsonify({'error': 'Document not found'}), 404

        can_view = False
        can_edit = False

        # --- Permission Logic ---
        if current_user.is_admin():
            can_view = True
            can_edit = True
        else:
            # 🔹 Check contractor assignment + permission
            user_contractor = next(
                (uc for uc in current_user.user_contractors if uc.contractor == doc.contractor),
                None
            )
            if user_contractor:
                can_view = True  # assigned means at least view
                if user_contractor.permission == "edit":
                    can_edit = True

            # 🔹 Check explicit document permissions
            perm = DocumentPermission.query.filter_by(
                user_id=current_user.id, document_id=doc.id
            ).first()
            if perm:
                if perm.can_view:
                    can_view = True
                if perm.can_edit:
                    can_edit = True

            # 🔹 Fallback roles if still no permission
            if not can_view:
                if current_user.is_editor():
                    can_view = True
                    can_edit = True
                elif current_user.is_viewer():
                    can_view = True
                    can_edit = (doc.uploaded_by == current_user.id)
                else:
                    # default: can only access own uploads
                    can_view = (doc.uploaded_by == current_user.id)
                    can_edit = (doc.uploaded_by == current_user.id)

        # --- Compute latest version among same folder_id + filename ---
        latest_version = (
            db.session.query(func.max(Document.version))
            .filter(Document.original_filename == doc.original_filename)
            .filter(Document.folder_id == doc.folder_id)
            .scalar()
        )

        if latest_version is None:
            latest_version = doc.version

        # --- Global rule: old versions are view-only ---
        if doc.version < latest_version:
            can_edit = False
            can_view = True  # force at least view

        return jsonify({
            'document_id': doc.id,
            'can_view': can_view,
            'can_edit': can_edit,
            'latest_version': int(latest_version) if latest_version else None
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/check-permission2/<int:document_id>', methods=['GET'])
@token_required
def check_permission2(current_user, document_id):
    try:
        doc = Document.query.get(document_id)
        if not doc:
            return jsonify({'error': 'Document not found'}), 404

        can_view = False
        can_edit = False

        # --- Permission Logic ---
        if current_user.is_admin():
            can_view = True
            can_edit = True
        else:
            # 🔹 Check contractor assignment + permission
            user_contractor = next(
                (uc for uc in current_user.user_contractors if uc.contractor == doc.contractor),
                None
            )
            if user_contractor:
                can_view = True  # assigned means at least view
                if user_contractor.permission == "edit":
                    can_edit = True

            # 🔹 Check explicit document permissions
            perm = DocumentPermission.query.filter_by(
                user_id=current_user.id, document_id=doc.id
            ).first()
            if perm:
                if perm.can_view:
                    can_view = True
                if perm.can_edit:
                    can_edit = True

            # 🔹 Fallback roles if still no permission
            if not can_view:
                if current_user.is_editor():
                    can_view = True
                    can_edit = True
                elif current_user.is_viewer():
                    can_view = True
                    can_edit = (doc.uploaded_by == current_user.id)
                else:
                    # default: can only access own uploads
                    can_view = (doc.uploaded_by == current_user.id)
                    can_edit = (doc.uploaded_by == current_user.id)

        # --- Compute latest version among same folder_id + filename ---
        latest_version = (
            db.session.query(func.max(Document.version))
            .filter(Document.original_filename == doc.original_filename)
            .filter(Document.folder_id == doc.folder_id)
            .scalar()
        )

        if latest_version is None:
            latest_version = doc.version

        # --- Global rule: old versions are view-only ---
        if doc.version < latest_version:
            can_edit = True
            can_view = True  # force at least view

        return jsonify({
            'document_id': doc.id,
            'can_view': can_view,
            'can_edit': can_edit,
            'latest_version': int(latest_version) if latest_version else None
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500



@document_bp.route("/explorer", methods=["GET"])
@token_required
def get_explorer(current_user):
    folders = Folder.query.all()
    documents = Document.query.all()

    visible_docs = []

    for doc in documents:
        if current_user.is_admin():
            # Admin sees everything
            file_dict = doc.to_dict()
            file_dict["can_edit"] = True
            visible_docs.append(file_dict)
            continue

        # --- Contractor-based access ---
        assigned_contractors = [uc.contractor for uc in current_user.user_contractors]
        if doc.contractor in assigned_contractors:
            file_dict = doc.to_dict()
            file_dict["can_edit"] = True   # contractor access = full rights
            visible_docs.append(file_dict)
            continue

        # --- Permission overrides ---
        perm = DocumentPermission.query.filter_by(
            user_id=current_user.id, document_id=doc.id
        ).first()
        if perm:
            if perm.can_view:
                file_dict = doc.to_dict()
                file_dict["can_edit"] = perm.can_edit
                visible_docs.append(file_dict)
            continue  # skip to next doc after permission check

        # --- Role-based defaults (fallback) ---
        can_view = False
        can_edit = False

        if current_user.is_editor():
            can_view = True
            can_edit = True
        elif current_user.is_viewer():
            can_view = True
            can_edit = (doc.uploaded_by == current_user.id)
        else:
            # normal user only sees their own uploads unless granted
            can_view = (doc.uploaded_by == current_user.id)
            can_edit = (doc.uploaded_by == current_user.id)

        if can_view:
            file_dict = doc.to_dict()
            file_dict["can_edit"] = can_edit
            visible_docs.append(file_dict)

    folder_data = [
        {"id": f.id, "name": f.name, "parent_id": f.parent_id} for f in folders
    ]

    return jsonify({"folders": folder_data, "files": visible_docs})

@document_bp.route("/explorer/filetype-stats", methods=["GET"])
@token_required
def get_filetype_stats(current_user):
    documents = Document.query.all()
    visible_docs = []

    # --- Apply same visibility rules as explorer ---
    for doc in documents:
        if current_user.is_admin():
            visible_docs.append(doc)
            continue

        assigned_contractors = [uc.contractor for uc in current_user.user_contractors]
        if doc.contractor in assigned_contractors:
            visible_docs.append(doc)
            continue

        perm = DocumentPermission.query.filter_by(
            user_id=current_user.id, document_id=doc.id
        ).first()
        if perm and perm.can_view:
            visible_docs.append(doc)
            continue

        if current_user.is_editor():
            visible_docs.append(doc)
        elif current_user.is_viewer():
            if doc.uploaded_by == current_user.id:
                visible_docs.append(doc)
        else:
            if doc.uploaded_by == current_user.id:
                visible_docs.append(doc)

    # --- Deduplicate by (original_filename, folder_id) ---
    unique_docs = {}
    for doc in visible_docs:
        key = (doc.original_filename, doc.folder_id)
        if key not in unique_docs:  # keep first occurrence only
            unique_docs[key] = doc

    # --- Count by file type (extension) ---
    from collections import Counter
    counts = Counter()

    for doc in unique_docs.values():
        ext = (doc.original_filename or "").split(".")[-1].lower()
        if ext:
            counts[ext] += 1
        else:
            counts["unknown"] += 1

    return jsonify(dict(counts))



from flask import request, jsonify
from werkzeug.utils import secure_filename
from azure.storage.blob import BlobServiceClient
import uuid, json, os

# Assuming you initialized your Azure Blob Service client somewhere
# Example:
# blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
# container_client = blob_service_client.get_container_client(AZURE_STORAGE_CONTAINER)

@document_bp.route('/upload', methods=['POST'])
@token_required
def upload_files(current_user):
    """Upload one or multiple files with metadata and version control to Azure Blob"""
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400

        files = request.files.getlist('files')
        metadata_raw = request.form.get('metadata')

        contractor = None
        tags = []
        folder_id = None

        if metadata_raw:
            try:
                metadata = json.loads(metadata_raw)
                contractor = metadata.get("contractor")
                tags = metadata.get("tags", [])
                folder_id = metadata.get("folder_id", None)
            except Exception as e:
                return jsonify({'error': f'Invalid metadata format: {str(e)}'}), 400

        uploaded_files = []

        for file in files:
            if file and file.filename and allowed_file(file.filename):
                upload_status = UploadStatus(
                    filename=file.filename,
                    status='uploading',
                    progress=0,
                    message='Starting upload...'
                )
                db.session.add(upload_status)
                db.session.commit()

                original_filename = secure_filename(file.filename)
                file_extension = original_filename.rsplit('.', 1)[1].lower()
                unique_filename = f"{uuid.uuid4().hex}.{file_extension}"

                try:
                    # ✅ Upload directly to Azure Blob
                    blob_client = container_client.get_blob_client(unique_filename)
                    blob_client.upload_blob(file.stream, overwrite=True)

                    # Blob public / signed URL (depending on your container settings)
                    blob_url = blob_client.url

                    # Update upload status
                    upload_status.status = 'processing'
                    upload_status.progress = 50
                    upload_status.message = 'File saved to Azure, extracting keywords...'
                    db.session.commit()

                    # ---- Version Control ----
                    existing_doc = (
                        Document.query.filter_by(
                            original_filename=original_filename,
                            folder_id = folder_id
                        )
                        .order_by(Document.version.desc())
                        .first()
                    )
                    version = existing_doc.version + 1 if existing_doc else 1

                    # Extract file info (size/type) using werkzeug file object
                    file.stream.seek(0, os.SEEK_END)
                    file_size = file.stream.tell()
                    file.stream.seek(0)

                    file_info = {
                        "file_size": file_size,
                        "file_type": file_extension,
                        "mime_type": file.mimetype
                    }

                    # text extraction
                    text_content = extract_text_from_bytes(file.read(),file_info['mime_type'])

                    contractor_name = contractor.strip() if contractor and contractor.strip() else "unknown"

              

                    if not folder_id:
                        folder_id = None

                    # ✅ Save metadata to DB with Azure blob URL
                    document = Document(
                        filename=unique_filename,
                        original_filename=original_filename,
                        blob_url=blob_url,   # <-- Azure URL here
                        file_size=file_info['file_size'],
                        file_type=file_info['file_type'],
                        mime_type=file_info['mime_type'],
                        processed=False,
                        contractor=contractor,
                        version=version,
                        path=contractor_name,
                        raw_text=text_content,
                        folder_id=folder_id,
                        uploaded_by=current_user.id
                    )
                    db.session.add(document)
                    db.session.commit()
                    foramtter = SearchBack(Document=Document )
                    foramtter.run()
                    # Create embedding
                    

                    

                    # Grant uploader permissions
                    perm = DocumentPermission.query.filter_by(document_id=document.id, user_id=current_user.id).first()
                    if not perm:
                        perm = DocumentPermission(
                            document_id=document.id,
                            user_id=current_user.id,
                            can_view=True,
                            can_edit=True,
                            granted_by=current_user.id
                        )
                        db.session.add(perm)
                        db.session.commit()

                    document.processed = True
                    db.session.commit()

                    # Finalize upload status
                    upload_status.status = 'completed'
                    upload_status.progress = 100
                    upload_status.message = f'Successfully processed {len(tags)} keywords'
                    db.session.commit()

                    uploaded_files.append({
                        'id': document.id,
                        'filename': original_filename,
                        'version': version,
                        'size': file_info['file_size'],
                        'type': file_info['file_type'],
                        'contractor': contractor,
                        'keywords_count': len(tags),
                        'path': contractor_name,
                        'raw_text': text_content,
                        'uploaded_by': current_user.to_dict(),
                        'blob_url': blob_url
                    })

                except Exception as e:
                    upload_status.status = 'failed'
                    upload_status.message = f'Error processing file: {str(e)}'
                    db.session.commit()
                    return jsonify({'error': f'Error processing {file.filename}: {str(e)}'}), 500

        return jsonify({
            'message': f'Successfully uploaded {len(uploaded_files)} files',
            'files': uploaded_files
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500




@document_bp.route('/onlyoffice/callback/<int:file_id>', methods=['POST'])
def onlyoffice_callbacktyyfgh(file_id):
    """
    Handle OnlyOffice Save callback and re-upload updated file to Azure Blob with versioning.
    Expects current user ID from query parameter: ?user_id=123
    """
    upload_status = None
    try:
        # 🔹 Get current user ID from query params
        user_id = request.args.get("user_id")
        if not user_id:
            return jsonify({"error": "No user_id provided"}), 400

        data = request.get_json(force=True, silent=True) or {}
        print(f"📩 OnlyOffice callback received for file_id={file_id}, user_id={user_id}")

        # Status=2 means file is ready to be saved
        if data.get("status") != 2:
            return jsonify({"error": 0})  # OnlyOffice expects 200 OK even if no action

        # URL from OnlyOffice for downloading updated file
        download_url = data.get("url")
        if not download_url:
            return jsonify({"error": 0})

        # Fetch updated file
        response = requests.get(download_url)
        response.raise_for_status()
        updated_content = response.content

        # 🔎 Get existing document info
        document = Document.query.get_or_404(file_id)
        original_filename = document.original_filename
        file_extension = document.file_type
        contractor = document.contractor
        folder_id = document.folder_id

        # Create upload status
        upload_status = UploadStatus(
            filename=original_filename,
            status='uploading',
            progress=0,
            message='Starting upload...'
        )
        db.session.add(upload_status)
        db.session.commit()

        # ---- Version Control ----
        existing_doc = document
        version = existing_doc.version + 1 if existing_doc else 1

        # Generate unique filename
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"

        # ✅ Upload to Azure Blob
        blob_client = container_client.get_blob_client(unique_filename)
        blob_client.upload_blob(updated_content, overwrite=True)
        blob_url = blob_client.url

        upload_status.status = 'processing'
        upload_status.progress = 50
        upload_status.message = 'File saved to Azure, extracting keywords...'
        db.session.commit()

        # Extract file size
        file_size = len(updated_content)

        # 🔎 Extract text content
        text_content = extract_text_from_bytes(updated_content,document.mime_type)
    

        # ✅ Save new version in DB
        new_doc = Document(
            filename=unique_filename,
            original_filename=original_filename,
            blob_url=blob_url,
            file_size=file_size,
            file_type=file_extension,
            mime_type=document.mime_type,
            processed=False,
            contractor=contractor,
            version=version,
            path=document.path,
            raw_text=text_content,
            folder_id=folder_id,
            uploaded_by=user_id  # use user_id from frontend
        )
        db.session.add(new_doc)
        db.session.commit()

       


        # ✅ Copy permissions
        perms = DocumentPermission.query.filter_by(document_id=document.id).all()
        for perm in perms:
            new_perm = DocumentPermission(
                document_id=new_doc.id,
                user_id=perm.user_id,
                can_view=perm.can_view,
                can_edit=perm.can_edit,
                granted_by=user_id
            )
            db.session.add(new_perm)
        db.session.commit()

        # Mark as processed
        new_doc.processed = True
        db.session.commit()

        # Finalize upload status
        upload_status.status = 'completed'
        upload_status.progress = 100
        upload_status.message = f'Successfully processed '
        db.session.commit()

        # ✅ Return success to OnlyOffice
        return jsonify({"error": 0})

    except Exception as e:
        print("❌ OnlyOffice callback error:", str(e))
        # If upload_status exists, mark it as failed
        if upload_status:
            upload_status.status = 'failed'
            upload_status.progress = 100
            upload_status.message = f"Failed: {str(e)}"
            db.session.commit()
        # Return 200 OK to prevent retry from OnlyOffice
        return jsonify({"error": str(e)}), 200

@document_bp.route('/onlyoffice',methods = ['POST'])
def onlyoffice_callback_checkkkkk():
    data = request.get_json(force=True)
    print("OnlyOffice callback data:", data)
    return {"error": 0}  # OnlyOffice expects {"error":0} if success




import requests
from io import BytesIO






@document_bp.route('/search', methods=['POST'])
@token_required
def search_documents(current_user):
    """
    Temporary search endpoint:
    - Just prints query & folder id
    - Returns empty results
    """
    try:
        data = request.get_json()

        query = data.get('query', '').strip()
        folder_id = data.get('folder')

        print(f"🔍 Search Request -> Query: {query}, Folder ID: {folder_id}")
        documents = []
        all_folder_ids = []
        if folder_id:
            ids = [folder_id]
            queue = [folder_id]

            while queue:
                current_id = queue.pop()
                children = Folder.query.filter_by(parent_id=current_id).all()
                for child in children:
                    ids.append(child.id)
                    queue.append(child.id)
            all_folder_ids=ids
            documents = Document.query.filter(Document.folder_id.in_(all_folder_ids)).all()
        else:  # ✅ if folder_id is null → get ALL docs
            documents = Document.query.all()
        print("📄 Files found:")
        for doc in documents:
            print(f"   - ID: {doc.id}, Name: {doc.filename}")
        
        searcher = LuceneSearcher("src/database/search/bm25_index")
        bm25_hits = searcher.search(query, k=2000)
        bm25_results = [(int(hit.docid), hit.score) for hit in bm25_hits]
        doc_ids = [doc_id for doc_id, _ in bm25_results]
        scores = [score for _, score in bm25_results]
        allowed_docs = {doc.id: doc for doc in documents}
        ordered_docs = []
        for doc_id, score in bm25_results:
            if doc_id in allowed_docs:  # only keep if doc is inside allowed set
                doc = allowed_docs[doc_id]
                address = 'root'
                if doc.folder_id:
                    folder = Folder.query.get(doc.folder_id)
                    parts = []
                    current = folder
                    while current:
                        parts.insert(0, current.name)  # prepend name
                        if current.parent_id is None:
                            break
                        current = Folder.query.get(current.parent_id)

                    address = "/".join(parts) + "/"
                ordered_docs.append({
                    "version": doc.version,
                    "name": doc.filename,
                    "original_filename": doc.original_filename,
                    "score": score,
                    'address':address
                })
        print('results of search query',bm25_results)
        
        
        return jsonify({
            'results': ordered_docs,   # always blank for now
            'query': query,
            'folder_id': folder_id
        }), 200

    except Exception as e:
        print("ERROR:", str(e))
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@document_bp.route('/new-search', methods=['POST'])
@token_required
def search_documents_new(current_user):
    """
    Enhanced Search Endpoint:
    1️⃣ Get all docs matching query (via BM25)
    2️⃣ Filter them by filters from frontend
    """
    try:
        data = request.get_json()
        filters = data.get("filter", {})
        query = filters.get("query", "").strip()
        folder_id = filters.get("folderId")
        file_types = filters.get("fileTypes", [])
        file_size_limit = filters.get("fileSize", 50)  # in MB

        print(f"🔍 Search Request -> Query: '{query}', Folder ID: {folder_id}, Filters: {filters}")

        # Step 1️⃣ - Collect allowed documents (all if folderId is None)
        if folder_id:
            ids = [folder_id]
            queue = [folder_id]
            while queue:
                current_id = queue.pop()
                children = Folder.query.filter_by(parent_id=current_id).all()
                for child in children:
                    ids.append(child.id)
                    queue.append(child.id)
            all_folder_ids = ids
            documents = Document.query.filter(Document.folder_id.in_(all_folder_ids)).all()
        else:
            documents = Document.query.all()  # ✅ all files if no folderId

        allowed_docs = {doc.id: doc for doc in documents}

        # Step 2️⃣ - BM25 Search (skip if query empty)
        searcher = LuceneSearcher("src/database/search/bm25_index")
        bm25_hits = searcher.search(query, k=2000) if query else []
        bm25_results = [(int(hit.docid), hit.score) for hit in bm25_hits]

        print(f"📄 Total BM25 Hits: {len(bm25_results)}")

        # Step 3️⃣ - Keep only docs that exist in allowed_docs
        matched_docs = []
        if query:
            for doc_id, score in bm25_results:
                if doc_id in allowed_docs:
                    matched_docs.append((allowed_docs[doc_id], score))
        else:
            # ✅ If no query → all docs (no ranking)
            matched_docs = [(doc, 0.0) for doc in allowed_docs.values()]

        # Step 4️⃣ - Apply filters
        filtered_docs = []
        for doc, score in matched_docs:
            file_size_mb = doc.file_size / (1024 * 1024)

            # ✅ If fileTypes is empty → allow all
            if file_types and doc.file_type.lower() not in [ft.lower() for ft in file_types]:
                continue

            # ✅ File size check (<= limit)
            if file_size_limit and file_size_mb > file_size_limit:
                continue

            filtered_docs.append((doc, score))

        print(f"✅ Filtered Results: {len(filtered_docs)} / {len(matched_docs)} after filters")

        # Step 5️⃣ - Prepare results with folder path + score
        ordered_docs = []
        for doc, score in filtered_docs:
            address = "root"
            if doc.folder_id:
                folder = Folder.query.get(doc.folder_id)
                parts = []
                current = folder
                while current:
                    parts.insert(0, current.name)
                    if current.parent_id is None:
                        break
                    current = Folder.query.get(current.parent_id)
                address = "/".join(parts) + "/"

            ordered_docs.append({
                "id": doc.id,
                "version": doc.version,
                "name": doc.filename,
                "original_filename": doc.original_filename,
                "file_type": doc.file_type,
                "file_size_mb": round(doc.file_size / (1024 * 1024), 2),
                "processed": doc.processed,
                "address": address,
                "score": round(float(score), 4)  # ✅ Include BM25 score
            })

        return jsonify({
            "results": ordered_docs,
            "total_results": len(ordered_docs),
            "query": query,
            "filters": filters
        }), 200

    except Exception as e:
        print("❌ ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@document_bp.route('/past-chat', methods=['POST'])
@token_required
def save_chat(current_user):
    try:
        data = request.get_json()
        chat_data = data.get("chat", [])
        timestamp = data.get("timestamp", datetime.utcnow().isoformat())

        if not chat_data:
            return jsonify({"error": "Chat data missing"}), 400

        new_chat = ChatHistory(
            user_id=current_user.id,
            chat=chat_data,
            timestamp=datetime.fromisoformat(timestamp)
        )
        db.session.add(new_chat)
        db.session.commit()

        return jsonify({"message": "Chat saved successfully"}), 201

    except Exception as e:
        print("❌ Error saving chat:", str(e))
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    

@document_bp.route('/past-chat/latest', methods=['GET'])
@token_required
def get_latest_chats(current_user):
    try:
        # Fetch the latest 5 chat sessions for this user
        chats = (
            ChatHistory.query
            .filter_by(user_id=current_user.id)
            .order_by(ChatHistory.timestamp.desc())
            .limit(5)
            .all()
        )

        results = [
            {
                "id": chat.id,
                "timestamp": chat.timestamp.isoformat(),
                "chat": chat.chat
            }
            for chat in chats
        ]

        return jsonify({"latest_chats": results}), 200

    except Exception as e:
        print("❌ Error fetching latest chats:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

SCOPES = 'https://www.googleapis.com/auth/drive'

@document_bp.route("/google-token")
def get_google_token():
    SERVICE_ACCOUNT_FILE = os.path.join(current_app.root_path, "service_aacount.json")
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    # auth_req = google.auth.transport.requests.Request()
    # creds.refresh(auth_req)
    creds.refresh(Request())
    return jsonify({"access_token": creds.token, "expiry": creds.expiry.isoformat()})


@document_bp.route('/analytics', methods=['GET'])
@token_required
def get_analytics(current_user):
    try:
        folders = Folder.query.all()
        documents = Document.query.all()

        visible_docs = []

        for doc in documents:
            if current_user.is_admin():
                file_dict = doc.to_dict()
                file_dict["can_edit"] = True
                visible_docs.append(file_dict)
                continue

            # Contractor-based access
            assigned_contractors = [uc.contractor for uc in current_user.user_contractors]
            if doc.contractor in assigned_contractors:
                file_dict = doc.to_dict()
                file_dict["can_edit"] = True
                visible_docs.append(file_dict)
                continue

            # Permission overrides
            perm = DocumentPermission.query.filter_by(
                user_id=current_user.id, document_id=doc.id
            ).first()
            if perm:
                if perm.can_view:
                    file_dict = doc.to_dict()
                    file_dict["can_edit"] = perm.can_edit
                    visible_docs.append(file_dict)
                continue

            # Role-based defaults
            can_view = False
            can_edit = False
            if current_user.is_editor():
                can_view = True
                can_edit = True
            elif current_user.is_viewer():
                can_view = True
                can_edit = (doc.uploaded_by == current_user.id)
            else:
                can_view = (doc.uploaded_by == current_user.id)
                can_edit = (doc.uploaded_by == current_user.id)

            if can_view:
                file_dict = doc.to_dict()
                file_dict["can_edit"] = can_edit
                visible_docs.append(file_dict)

        # ---- Analytics based on visible_docs ----
        unique_pairs = set(
            (doc.get("original_filename"), doc.get("folder_id"))
            for doc in visible_docs
        )
        total_files = len(unique_pairs)
        total_storage = sum(doc.get("file_size", 0) for doc in visible_docs)

        # File types distribution
        file_types_data = {}
        for doc in visible_docs:
            ftype = doc.get("file_type", "unknown")
            file_types_data[ftype] = file_types_data.get(ftype, 0) + 1
        file_types_data = [{"type": t, "count": c} for t, c in file_types_data.items()]

        # Recent uploads (last 10, sorted)
        recent_uploads = sorted(
            visible_docs, key=lambda d: d.get("upload_date", ""), reverse=True
        )[:10]

        # Top keywords
      
        # Upload status summary
        upload_statuses = (
            db.session.query(UploadStatus.status, func.count(UploadStatus.id))
            .group_by(UploadStatus.status)
            .all()
        )
        upload_status_data = [
            {"status": s, "count": c} for s, c in upload_statuses
        ]

        return jsonify({
            'total_files': total_files,
            'total_storage': total_storage,
            'file_types': file_types_data,
            'recent_uploads': recent_uploads,
            'top_keywords': '',
            'upload_status': upload_status_data
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@document_bp.route('/files', methods=['GET'])
def get_files():
    """Get only the highest version of each file (grouped by original_filename + folder_id)"""
    try:
        # Query parameters
        file_type = request.args.get('type')
        sort_by = request.args.get('sort', 'upload_date')
        sort_order = request.args.get('order', 'desc')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))

        # Subquery: find max version for each (original_filename, folder_id)
        subquery = (
            db.session.query(
                Document.original_filename,
                Document.folder_id,
                func.max(Document.version).label("max_version")
            )
            .filter(Document.processed == True)
            .group_by(Document.original_filename, Document.folder_id)
            .subquery()
        )

        # Join back to documents table to fetch only highest version
        query = (
            db.session.query(Document)
            .join(subquery,
                  (Document.original_filename == subquery.c.original_filename) &
                  (Document.folder_id == subquery.c.folder_id) &
                  (Document.version == subquery.c.max_version))
        )

        if file_type:
            query = query.filter(Document.file_type == file_type)

        # Sorting
        if sort_order == 'desc':
            query = query.order_by(desc(getattr(Document, sort_by)))
        else:
            query = query.order_by(getattr(Document, sort_by))

        # Paginate
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        files_data = [doc.to_dict() for doc in paginated.items]

        return jsonify({
            'files': files_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': paginated.total,
                'pages': paginated.pages,
                'has_next': paginated.has_next,
                'has_prev': paginated.has_prev
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@document_bp.route('/files/<int:file_id>/versions', methods=['GET'])
def get_file_versions(file_id):
    """Get all versions of a file grouped by (original_filename + folder_id)"""
    try:
        # Get the file first
        document = Document.query.get_or_404(file_id)

        # Fetch all versions for the same (original_filename, folder_id)
        versions = (
            Document.query
            .filter_by(original_filename=document.original_filename,
                       folder_id=document.folder_id,
                       processed=True)
            .order_by(desc(Document.version))
            .all()
        )

        versions_data = [doc.to_dict() for doc in versions]

        return jsonify({
            'file': document.original_filename,
            'contractor': document.contractor,
            'versions': versions_data,
            'total_versions': len(versions_data)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500



@document_bp.route('/files/<int:file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete a file from Azure Blob and database"""
    try:
        # Fetch document
        document = Document.query.get_or_404(file_id)
        print(document)
        # 🔹 Delete blob from Azure (non-fatal if already missing)
        try:
            blob_client = blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=document.filename)
            blob_client.delete_blob(delete_snapshots="include")
            print(f"[INFO] Blob '{document.filename}' deleted from Azure.")
       
        except Exception as e:
            return jsonify({'error': f'Failed to delete blob: {str(e)}'}), 500

        # 🔹 Delete from database
        try:
            # Ensure document object is attached to session

            print('yes we are here ')
            Document.query.filter_by(id=file_id).delete()
            db.session.commit()
            print(f"[INFO] Document ID {file_id} deleted from DB.")
            DocumentPermission.query.filter_by(document_id=file_id).delete()
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Failed to delete DB record: {str(e)}'}), 500

        return jsonify({'message': 'File deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/files2/<int:file_id>', methods=['DELETE'])
def delete_files_by_originalname_and_folder_id(file_id):
    """Delete all files sharing the same original filename and folder_id"""
    try:
        # Fetch the reference document
        document = Document.query.get_or_404(file_id)
        target_original_filename = document.original_filename
        target_folder_id = document.folder_id

        # Find all documents with the same original filename and folder_id
        documents_to_delete = Document.query.filter_by(
            original_filename=target_original_filename,
            folder_id=target_folder_id
        ).all()

        # Delete blobs and records
        for doc in documents_to_delete:
            try:
                blob_client = blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=doc.filename)
                blob_client.delete_blob(delete_snapshots="include")
                print(f"[INFO] Blob '{doc.filename}' deleted from Azure.")
            except Exception as e:
                # Log error but continue deleting other files
                print(f"[WARNING] Failed to delete blob '{doc.filename}': {str(e)}")

            try:
                Document.query.filter_by(id=doc.id).delete()
                db.session.commit()
                DocumentPermission.query.filter_by(document_id=doc.id).delete()
                db.session.commit()
            except Exception as e:
                print(f"[ERROR] Failed to delete DB record ID {doc.id}: {str(e)}")

        db.session.commit()
        return jsonify({'message': f'Deleted {len(documents_to_delete)} files with matching original filename and folder_id.'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500






@document_bp.route('/files/<int:file_id>/download', methods=['GET'])
def download_file(file_id):
    """Download a file from Azure Blob"""
    try:
        document = Document.query.get_or_404(file_id)

        blob_client = blob_service_client.get_blob_client(
            container=CONTAINER_NAME,
            blob=document.filename
        )

        if not blob_client.exists():
            return jsonify({'error': 'File not found in Azure'}), 404

        # Stream blob content
        stream = blob_client.download_blob()
        return Response(
            stream.readall(),
            mimetype="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={document.original_filename}"
            }
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

from flask import jsonify, send_file
from io import BytesIO
from urllib.parse import urlparse
from azure.storage.blob import generate_blob_sas, BlobSasPermissions

import requests

@document_bp.route('/files/<int:file_id>/preview', methods=['GET'])
def preview_file(file_id):
    """
    Preview a file in the browser. For PDFs, DOCX, Excel, etc.
    For PDFs: return SAS URL so frontend can fetch without CORS.
    For DOCX/Excel/Text: stream file from Azure via backend.
    """
    document = Document.query.get_or_404(file_id)

    filename = document.filename
    blob_client = blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=filename)
    stream = blob_client.download_blob()
    file_stream = BytesIO()
    stream.readinto(file_stream)
    file_stream.seek(0)
    return send_file(file_stream, download_name=filename, as_attachment=True)
      

@document_bp.route("/onlyoffice/token", methods=["POST"])
def onlyoffice_token():
    # frontend sends the config JSON in request body
    config = request.get_json(force=True)

    # sign it
    token = jwt.encode(config, JWT_SECRET, algorithm="HS256")
    if isinstance(token, bytes):  # PyJWT <2.0 returns bytes
        token = token.decode("utf-8")

    return jsonify({"token": token})

from flask import Response
import mimetypes

@document_bp.route('/files/<int:file_id>/previewoff', methods=['GET'])
def preview_file22(file_id):
    """
    Generate a SAS URL for OnlyOffice to preview/edit a file.
    """
    document = Document.query.get_or_404(file_id)
    filename = document.filename

    # Generate SAS token
    sas_token = generate_blob_sas(
        account_name=blob_service_client.account_name,
        container_name=CONTAINER_NAME,
        blob_name=filename,
        account_key=AZURE_STORAGE_KEY,  # make sure you load this from env
        permission=BlobSasPermissions(read=True),
        expiry=datetime.utcnow() + timedelta(hours=1)  # SAS valid for 1 hour
    )

    sas_url = f"https://{blob_service_client.account_name}.blob.core.windows.net/{CONTAINER_NAME}/{filename}?{sas_token}"

    return jsonify({
        "fileId": file_id,
        "fileName": filename,
        "sasUrl": sas_url,
        "expiresIn": "1 hour"
    })




# API to update file path
@document_bp.route('/files/<int:file_id>/update', methods=['PUT'])
def update_path(file_id):
    data = request.json
    new_path = data.get("path")

    file = Document.query.get_or_404(file_id)
    if not file:
        return jsonify({"error": "File not found"}), 404

    file.path = new_path
    db.session.commit()
    return jsonify({"message": "Path updated", "file": {"id": file.id, "path": file.path}})


@document_bp.route('/upload-status', methods=['GET'])
def get_upload_status():
    """Get current upload status"""
    try:
        # Get recent upload statuses
        statuses = UploadStatus.query.order_by(desc(UploadStatus.updated_at)).limit(20).all()
        status_data = [status.to_dict() for status in statuses]
        
        return jsonify({'upload_status': status_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@document_bp.route('/storage-details', methods=['GET'])
def get_storage_details():
    """Get detailed storage information"""
    try:
        # Storage by file type
        storage_by_type = db.session.query(
            Document.file_type,
            func.sum(Document.file_size).label('total_size'),
            func.count(Document.id).label('file_count')
        ).group_by(Document.file_type).all()
        
        storage_data = []
        for item in storage_by_type:
            storage_data.append({
                'file_type': item[0],
                'total_size': item[1],
                'file_count': item[2],
                'average_size': item[1] / item[2] if item[2] > 0 else 0
            })
        
        # Total storage
        total_storage = db.session.query(func.sum(Document.file_size)).scalar() or 0
        
        # Largest files
        largest_files = Document.query.order_by(desc(Document.file_size)).limit(10).all()
        largest_files_data = [doc.to_dict() for doc in largest_files]
        
        return jsonify({
            'total_storage': total_storage,
            'storage_by_type': storage_data,
            'largest_files': largest_files_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500






# ======================
# 2. Create Folder
# ======================
@document_bp.route("/folder", methods=["POST"])
def create_folder():
    data = request.get_json()
    name = data.get("name")
    parent_id = data.get("parent_id")

    new_folder = Folder(name=name, parent_id=parent_id)
    db.session.add(new_folder)
    db.session.commit()

    return jsonify({"message": "Folder created", "folder": {
        "id": new_folder.id,
        "name": new_folder.name,
        "parent_id": new_folder.parent_id
    }}), 201


# ======================
# 3. Update Folder (Rename / Move)
# ======================
@document_bp.route("/folder/<int:folder_id>", methods=["PUT"])
def update_folder(folder_id):
    folder = Folder.query.get_or_404(folder_id)
    data = request.get_json()

    if "name" in data:
        folder.name = data["name"]
    if "parent_id" in data:
        folder.parent_id = data["parent_id"]

    db.session.commit()

    return jsonify({"message": "Folder updated", "folder": {
        "id": folder.id,
        "name": folder.name,
        "parent_id": folder.parent_id
    }})


# ======================
# 4. Move File to Another Folder
# ======================
@document_bp.route("/file/<int:file_id>/move", methods=["PUT"])
def move_file(file_id):
    file = Document.query.get_or_404(file_id)
    data = request.get_json()
    new_folder_id = data.get("folder_id")

    if not Folder.query.get(new_folder_id):
        return jsonify({"error": "Target folder not found"}), 404

    file.folder_id = new_folder_id
    db.session.commit()

    return jsonify({"message": "File moved", "file": file.to_dict()})


# ======================
# 5. Get Files in a Folder
# ======================
@document_bp.route("/folder/<int:folder_id>/files", methods=["GET"])
def get_files_in_folder(folder_id):
    files = Document.query.filter_by(folder_id=folder_id).all()
    return jsonify([file.to_dict() for file in files])

def build_folder_tree(folders, parent_id=None):
    """Recursively build folder tree"""
    tree = []
    for folder in folders:
        if folder.parent_id == parent_id:
            children = build_folder_tree(folders, folder.id)
            tree.append({
                "id": folder.id,
                "name": folder.name,
                "children": children
            })
    return tree
from sqlalchemy import select


@document_bp.route("/folders-tree", methods=["GET"])
def get_folders():
    folders = db.session.scalars(select(Folder)).all()
    folder_tree = build_folder_tree(folders)
    return jsonify(folder_tree)