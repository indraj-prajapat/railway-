import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# project url = https://kllsaulptloxajsaffou.supabase.co
# anon = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsbHNhdWxwdGxveGFqc2FmZm91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NDU1MjEsImV4cCI6MjA3MzIyMTUyMX0.d7piw68JsHBI6yXHYdg2-Cpcw5qRsmp7hYJn-dPWIIo
import urllib.parse
from flask import Flask, send_from_directory
from flask_cors import CORS
from src.extensions import db
from src.routes.user import user_bp
from src.routes.document import document_bp

# config.py or inside your app setup
BASE_DIR = os.path.abspath(os.path.dirname(__file__))  # project root
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

# make sure the folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['SECRET_KEY'] = 'fb43f9b6895372533458cc712a3094fe7a05ae4516fcf6aae88222b07c1f75e7'
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 16MB max file size

# Enable CORS for all routes
CORS(app)

app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(document_bp, url_prefix='/api/documents')







# --- Connection Parameters ---
server = os.getenv("AZURE_SERVER")
database = os.getenv("AZURE_DATABASE")
username = os.getenv("AZURE_USERNAME")
password = os.getenv("AZURE_PASSWORD")
driver = "ODBC Driver 18 for SQL Server"

# --- Construct the *full* ODBC connection string ---
# This string includes ALL required parameters for pyodbc
full_conn_str = (
    f"Driver={driver};"
    f"Server={server};"
    f"Database={database};"
    f"Uid={username};"
    f"Pwd={password};"
    f"Encrypt=yes;"
    f"TrustServerCertificate=no;" # Essential for secure Azure connection
    f"Connection Timeout=30;"
)

# --- URL-encode the *entire* string ---
# This ensures characters like '{', '}', '@', etc., are handled correctly
quoted_conn_str = urllib.parse.quote_plus(full_conn_str)

# --- Set the SQLALCHEMY_DATABASE_URI ---
# Use the minimal URI format 'mssql+pyodbc:///?odbc_connect=' 
# and append the fully encoded string
app.config['SQLALCHEMY_DATABASE_URI'] = f"mssql+pyodbc:///?odbc_connect={quoted_conn_str}"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Import all models to ensure they are registered
from src.models.document import *
from src.models.user import User   # import User model


# ----------------- Default Admin Seeder -----------------
def create_default_admin():
    if not User.query.filter_by(email="admin@mail").first():
        admin_user = User(
            username="adminn",
            email="admin@mail",
            role="admin"
        )
        admin_user.set_password("admin@2025")
        db.session.add(admin_user)
        db.session.commit()
        print("✅ Default admin user created: email=admin | password=admin@2025")
    else:
        print("ℹ️ Default admin user already exists")


with app.app_context():
    db.create_all()
    create_default_admin()   # <-- runs only once


# @app.route('/', defaults={'path': ''})
# @app.route('/<path:path>')
# def serve(path):
#     static_folder_path = app.static_folder
#     if static_folder_path is None:
#         return "Static folder not configured", 404

#     if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
#         return send_from_directory(static_folder_path, path)
#     else:
#         index_path = os.path.join(static_folder_path, 'index.html')
#         if os.path.exists(index_path):
#             return send_from_directory(static_folder_path, 'index.html')
#         else:
#             return "index.html not found", 404


@app.route('/')
def index():
    return "<center><h1>Welcome to the Document Management System API</h1></center>"


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
