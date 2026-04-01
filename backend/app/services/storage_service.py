"""
app/services/storage_service.py

Cloud storage abstraction.
Supports Cloudinary (primary) with local fallback for dev.
"""
import logging
import os
from typing import Tuple

logger = logging.getLogger(__name__)


class StorageService:

    def __init__(self):
        self.provider = os.getenv("STORAGE_PROVIDER", "local")  # "cloudinary" | "local"
        if self.provider == "cloudinary":
            self._init_cloudinary()

    def _init_cloudinary(self):
        import cloudinary
        cloudinary.config(
            cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"),
            api_key    = os.getenv("CLOUDINARY_API_KEY"),
            api_secret = os.getenv("CLOUDINARY_API_SECRET"),
            secure     = True,
        )

    def upload(self, file_path: str, filename: str) -> Tuple[str, str]:
        """
        Upload a file to cloud storage.

        Returns:
            (public_url, storage_key)
            public_url:   URL to access the file (stored in DB)
            storage_key:  Provider-specific ID for deletion (stored in DB)
        """
        if self.provider == "cloudinary":
            return self._upload_cloudinary(file_path, filename)
        return self._upload_local(file_path, filename)

    def delete(self, storage_key: str) -> None:
        """Delete a file by its storage key."""
        if self.provider == "cloudinary":
            self._delete_cloudinary(storage_key)

    def get_file_bytes(self, storage_key: str) -> bytes:
        """
        Download file bytes for processing (resume parsing).
        """
        if self.provider == "cloudinary":
            return self._download_cloudinary(storage_key)
        # Local: read directly
        with open(storage_key, "rb") as f:
            return f.read()

    # ── Cloudinary ────────────────────────────────────────────────────────────

    def _upload_cloudinary(self, file_path: str, filename: str) -> Tuple[str, str]:
        import cloudinary.uploader
        result = cloudinary.uploader.upload(
            file_path,
            folder="resumes",
            resource_type="raw",        # raw = non-image files (PDF, DOCX)
            public_id=f"resumes/{filename}",
            overwrite=False,
            use_filename=True,
        )
        public_url  = result["secure_url"]
        storage_key = result["public_id"]
        logger.info("Uploaded to Cloudinary", extra={"public_id": storage_key})
        return public_url, storage_key

    def _delete_cloudinary(self, storage_key: str) -> None:
        import cloudinary.uploader
        cloudinary.uploader.destroy(storage_key, resource_type="raw")
        logger.info("Deleted from Cloudinary", extra={"public_id": storage_key})

    def _download_cloudinary(self, storage_key: str) -> bytes:
        import cloudinary
        import httpx
        url = cloudinary.CloudinaryImage(storage_key).build_url(resource_type="raw")
        response = httpx.get(url)
        response.raise_for_status()
        return response.content

    # ── Local fallback (dev only) ─────────────────────────────────────────────

    def _upload_local(self, file_path: str, filename: str) -> Tuple[str, str]:
        """For local dev — file is already saved, just return the path."""
        return file_path, file_path