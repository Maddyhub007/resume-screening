"""
app/services/storage_service.py

Cloud storage abstraction.
  - STORAGE_PROVIDER=local     → save to disk (dev)
  - STORAGE_PROVIDER=cloudinary → upload to Cloudinary (production)
"""
import logging
import os
import tempfile
from typing import Tuple

logger = logging.getLogger(__name__)


class StorageService:

    def __init__(self):
        self.provider = os.getenv("STORAGE_PROVIDER", "local")
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
        logger.info("Cloudinary storage initialised.")

    # ── Public API ────────────────────────────────────────────────────────────

    def upload(self, file_path: str, filename: str) -> Tuple[str, str]:
        """
        Upload file to storage provider.

        Returns:
            (public_url, storage_key)
            public_url:   URL stored in Resume.file_path
            storage_key:  Provider ID stored in Resume.storage_key (for deletion)
        """
        if self.provider == "cloudinary":
            return self._upload_cloudinary(file_path, filename)
        return self._upload_local(file_path, filename)

    def get_file_bytes(self, file_path_or_key: str) -> bytes:
        """
        Download file bytes for resume parsing.

        In local mode:  reads from disk path.
        In cloud mode:  downloads from Cloudinary URL.
        """
        if self.provider == "cloudinary":
            return self._download_cloudinary(file_path_or_key)
        with open(file_path_or_key, "rb") as f:
            return f.read()

    def delete(self, storage_key: str) -> None:
        """Delete file by storage key."""
        if self.provider == "cloudinary":
            self._delete_cloudinary(storage_key)
        else:
            try:
                if os.path.exists(storage_key):
                    os.remove(storage_key)
            except OSError as exc:
                logger.warning("Failed to delete local file: %s", exc)

    # ── Cloudinary ────────────────────────────────────────────────────────────

    def _upload_cloudinary(self, file_path: str, filename: str) -> Tuple[str, str]:
        import cloudinary.uploader
        import os

        env    = os.getenv("APP_ENV", "development")
        folder = f"resumes/{env}"   # "resumes/development" or "resumes/production"
        result = cloudinary.uploader.upload(
            file_path,
            folder="resumes",
            resource_type="raw",      # raw = non-image (PDF, DOCX)
            use_filename=True,
            unique_filename=True,
            overwrite=False,
        )
        public_url  = result["secure_url"]
        storage_key = result["public_id"]
        logger.info("Uploaded to Cloudinary", extra={"public_id": storage_key})
        return public_url, storage_key

    def _download_cloudinary(self, public_id: str) -> bytes:
        import cloudinary.utils
        import httpx

        url, _ = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type="raw",
            sign_url=True,
        )

        response = httpx.get(url, timeout=30)
        response.raise_for_status()
        return response.content

    def _delete_cloudinary(self, storage_key: str) -> None:
        import cloudinary.uploader
        # storage_key is the Cloudinary public_id e.g. "resumes/abc123.pdf"
        result = cloudinary.uploader.destroy(
            storage_key,
            resource_type="raw",   # ← critical — PDF/DOCX are "raw", not "image"
        )
        if result.get("result") != "ok":
            logger.warning(
                "Cloudinary delete returned non-ok result",
                extra={"storage_key": storage_key, "result": result},
            )
        else:
            logger.info("Deleted from Cloudinary", extra={"public_id": storage_key})

    # ── Local fallback ────────────────────────────────────────────────────────

    def _upload_local(self, file_path: str, filename: str) -> Tuple[str, str]:
        """
        Local dev — file already saved to disk.
        public_url = file_path, storage_key = file_path.
        """
        return file_path, file_path