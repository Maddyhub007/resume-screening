
"""
app/utils/file_helpers.py

File upload validation and management utilities.

Responsibilities:
  - Validate extension and MIME type before saving.
  - Generate safe, unique file paths.
  - Clean up files on failure.
  - Human-readable file size formatting.

Usage:
    from app.utils.file_helpers import validate_upload, save_upload, delete_file

    filepath = save_upload(file_storage, upload_dir)
"""

import logging
import os
import uuid
from pathlib import Path

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from app.core.exceptions import ResumeUploadFailed

logger = logging.getLogger(__name__)

# Allowed MIME types per extension
_ALLOWED_MIME: dict[str, str] = {
    "pdf":  "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def validate_upload(file: FileStorage, allowed_extensions: set[str]) -> str:
    """
    Validate an uploaded FileStorage object.

    Checks:
      - Filename is not empty.
      - Extension is in the allowed set.
      - File has content (non-zero size).

    Args:
        file:               Werkzeug FileStorage from request.files.
        allowed_extensions: Set of lowercase extensions e.g. {"pdf", "docx"}.

    Returns:
        The lowercase extension string (e.g. "pdf").

    Raises:
        ResumeUploadFailed: On any validation failure.
    """
    if not file or not file.filename:
        raise ResumeUploadFailed("No file was provided.")

    original_name = file.filename
    if "." not in original_name:
        raise ResumeUploadFailed(
            f"File '{original_name}' has no extension. "
            f"Allowed: {', '.join(sorted(allowed_extensions))}."
        )

    ext = original_name.rsplit(".", 1)[1].lower()
    if ext not in allowed_extensions:
        raise ResumeUploadFailed(
            f"File type '.{ext}' is not allowed. "
            f"Allowed: {', '.join(sorted(allowed_extensions))}."
        )

    # Peek at file size without reading entire content
    file.stream.seek(0, 2)           # Seek to end
    size_bytes = file.stream.tell()
    file.stream.seek(0)              # Reset to start

    if size_bytes == 0:
        raise ResumeUploadFailed("Uploaded file is empty.")

    return ext


def save_upload(
    file: FileStorage,
    upload_dir: str,
    prefix: str = "",
) -> tuple[str, str]:
    """
    Save an uploaded file to disk with a UUID-based filename.

    Args:
        file:       Werkzeug FileStorage.
        upload_dir: Directory path (created if it doesn't exist).
        prefix:     Optional prefix for the saved filename.

    Returns:
        (filepath, original_filename) — filepath is the absolute path on disk.

    Note:
        Does not validate — call validate_upload() first.
    """
    os.makedirs(upload_dir, exist_ok=True)

    original_name = secure_filename(file.filename or "upload")
    uid           = str(uuid.uuid4())
    ext           = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    safe_name     = f"{prefix}{uid}.{ext}" if ext else f"{prefix}{uid}"
    filepath      = os.path.join(upload_dir, safe_name)

    file.save(filepath)
    logger.info(
        "File saved",
        extra={"path": filepath, "original": original_name, "size_kb": _size_kb(filepath)},
    )
    return filepath, original_name


def delete_file(filepath: str) -> None:
    """
    Delete a file from disk, logging but not raising on failure.

    Args:
        filepath: Absolute path to the file.
    """
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info("File deleted", extra={"path": filepath})
    except OSError as exc:
        logger.warning("Could not delete file", extra={"path": filepath, "error": str(exc)})


def _size_kb(filepath: str) -> int:
    """Return file size in KB, or 0 on error."""
    try:
        return int(os.path.getsize(filepath) / 1024)
    except OSError:
        return 0


def human_readable_size(size_bytes: int) -> str:
    """Convert bytes to human-readable string e.g. '2.4 MB'."""
    for unit in ("B", "KB", "MB", "GB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes //= 1024
    return f"{size_bytes} TB"