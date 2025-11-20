# src/Azure/azure_uploader.py
import os
from typing import Iterable, IO
from azure.storage.blob import BlobServiceClient, ContainerClient, BlobClient
import io

class AzureUploader:
    def __init__(self, connection_string: str, container: str):
        if not connection_string:
            raise RuntimeError("Azure connection string is required")
        self.client = BlobServiceClient.from_connection_string(connection_string)
        self.container_name = container
        self.container: ContainerClient = self.client.get_container_client(container)
        try:
            self.container.create_container()
        except Exception:
            # container may already exist; ignore errors
            pass

    # ---------- Upload helpers ----------
    def upload_bytes(self, remote_path: str, data: bytes):
        """
        Upload raw bytes to remote blob path. Overwrites if exists.
        """
        blob: BlobClient = self.container.get_blob_client(remote_path)
        blob.upload_blob(data, overwrite=True)
        print(f"⬆ Uploaded bytes -> {remote_path}")

    def upload_stream(self, remote_path: str, stream: IO):
        """
        Upload from a file-like object / BytesIO. Caller must rewind stream before calling.
        """
        stream.seek(0)
        blob: BlobClient = self.container.get_blob_client(remote_path)
        blob.upload_blob(stream, overwrite=True)
        print(f"⬆ Uploaded stream -> {remote_path}")

    def upload_file(self, remote_path: str, local_path: str):
        """
        Upload a local file to remote path.
        """
        blob: BlobClient = self.container.get_blob_client(remote_path)
        with open(local_path, "rb") as f:
            blob.upload_blob(f, overwrite=True)
        print(f"⬆ Uploaded file -> {remote_path} from {local_path}")

    def upload_folder(self, local_folder: str, remote_prefix: str):
        """
        Recursively upload a folder to remote_prefix/...
        remote_prefix should not begin with a leading slash.
        """
        local_folder = os.path.abspath(local_folder)
        for root, dirs, files in os.walk(local_folder):
            for fn in files:
                local_path = os.path.join(root, fn)
                rel = os.path.relpath(local_path, local_folder).replace(os.path.sep, "/")
                blob_path = f"{remote_prefix.rstrip('/')}/{rel}"
                self.upload_file(blob_path, local_path)

    # ---------- Download helpers ----------
    def download_as_bytes(self, remote_path: str) -> bytes:
        """
        Download blob to memory and return bytes. Raises if blob not found.
        """
        blob: BlobClient = self.container.get_blob_client(remote_path)
        stream = blob.download_blob()
        data = stream.readall()
        return data

    def download_to_file(self, remote_path: str, local_path: str):
        """
        Download blob and write to a local file path.
        """
        blob: BlobClient = self.container.get_blob_client(remote_path)
        with open(local_path, "wb") as f:
            stream = blob.download_blob()
            stream.download_to_stream(f)
        print(f"⬇ Downloaded blob {remote_path} -> {local_path}")

    # ---------- Helpers ----------
    def list_blobs(self, prefix: str = "") -> Iterable[str]:
        """
        List blob names under a prefix.
        """
        return [b.name for b in self.container.list_blobs(name_starts_with=prefix)]

    def delete_blob(self, remote_path: str):
        try:
            blob: BlobClient = self.container.get_blob_client(remote_path)
            blob.delete_blob()
            print(f"🗑 Deleted blob {remote_path}")
        except Exception as e:
            print(f"⚠ Could not delete blob {remote_path}: {e}")
