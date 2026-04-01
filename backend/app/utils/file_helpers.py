"""
app/utils/file_helpers.py

File upload validation and management utilities.

FIXES APPLIED:
  FH-01 — human_readable_size() used `//=` (integer floor division-assignment)
           instead of `/=` (float division) when stepping down size units.
           With `//=`, dividing 1500 bytes down to KB gave 1 instead of 1.46,
           and sizes between 1 KB and 1 MB were reported as 0 KB. Fixed to `/=`.

  FH-02 — _ALLOWED_MIME dict was defined but never consulted in validate_upload().
           Only the file extension was checked; the MIME type in
           FileStorage.content_type was completely ignored. This allowed a
           renamed `.exe` file with extension `.pdf` to pass validation.
           Fixed: validate_upload() now cross-checks content_type against
           _ALLOWED_MIME when the value is present and non-empty.

  FH-03 — No explicit file size check in validate_upload(). Flask's
           MAX_CONTENT_LENGTH rejects oversized requests at the WSGI layer,
           but only after the full body has been read. validate_upload() should
           also guard against 0-byte files and optionally cap via app config.

  FH-04 — save_upload() returned only the file path string. Callers
           (_helpers.py candidate upload) needed the size in KB separately,
           leading to a second os.path.getsize() call. save_upload() now
           returns a (file_path, size_kb) tuple to avoid the redundant stat.
"""

import logging
import os
import uuid
from pathlib import Path
from typing import Tuple

from flask import current_app
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from app.core.exceptions import ResumeUploadFailed

logger = logging.getLogger(__name__)

# Allowed MIME types per extension
_ALLOWED_MIME: dict[str, str] = {
    "pdf":  "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def validate_upload(
    file: FileStorage,
    allowed_extensions: set[str],
    max_size_mb: int | None = None,
) -> str:
    """
    Validate an uploaded FileStorage object.

    Checks:
      - Filename is not empty.
      - Extension is in the allowed set.
      - MIME type matches the expected type for the extension (FIX FH-02).
      - File has content (non-zero size) (FIX FH-03).
      - File does not exceed max_size_mb if specified (FIX FH-03).

    Args:
        file:               Werkzeug FileStorage from request.files.
        allowed_extensions: Set of lowercase extensions e.g. {"pdf", "docx"}.
        max_size_mb:        Optional size cap in MB. Defaults to
                            app.config["MAX_UPLOAD_MB"] when available.

    Returns:
        The lowercase extension string (e.g. "pdf").

    Raises:
        ResumeUploadFailed: On any validation failure.
    """
    if not file or not file.filename:
        raise ResumeUploadFailed("No file was provided.")

    original_name = file.filename
    ext = Path(original_name).suffix.lstrip(".").lower()

    if not ext or ext not in allowed_extensions:
        raise ResumeUploadFailed(
            f"File type '.{ext}' is not allowed. "
            f"Accepted types: {', '.join(sorted(allowed_extensions))}."
        )

    # FIX FH-02: cross-check content_type against the known MIME for this extension.
    # Previously _ALLOWED_MIME was defined but never consulted here.
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    expected_mime = _ALLOWED_MIME.get(ext)
    if expected_mime and content_type and content_type != expected_mime:
        logger.warning(
            "MIME type mismatch for upload: filename=%s ext=%s "
            "content_type=%s expected=%s",
            original_name, ext, content_type, expected_mime,
        )
        raise ResumeUploadFailed(
            f"File content does not match the declared extension '.{ext}'. "
            f"Expected MIME type '{expected_mime}', got '{content_type}'."
        )

    # FIX FH-03: check file size.
    # Seek to end to get size without fully reading into memory.
    file.stream.seek(0, 2)          # seek to end
    size_bytes = file.stream.tell()
    file.stream.seek(0)             # rewind for the actual save

    if size_bytes == 0:
        raise ResumeUploadFailed("Uploaded file is empty (0 bytes).")

    # Resolve the size cap: caller arg → app config → no cap
    cap_mb = max_size_mb
    if cap_mb is None:
        try:
            cap_mb = current_app.config.get("MAX_UPLOAD_MB")
        except RuntimeError:
            cap_mb = None  # outside app context (e.g. tests)

    if cap_mb and size_bytes > cap_mb * 1024 * 1024:
        raise ResumeUploadFailed(
            f"File exceeds the maximum upload size of {cap_mb} MB "
            f"(got {size_bytes / (1024 * 1024):.1f} MB)."
        )

    return ext


def save_upload(
    file: FileStorage,
    upload_dir: str,
    prefix: str = "",
) -> Tuple[str, int]:
    """
    Save a validated FileStorage to disk under a unique filename.

    FIX FH-04: Returns a (file_path, size_kb) tuple instead of just the path.
    Callers previously called os.path.getsize() separately; this avoids the
    redundant stat syscall.

    Args:
        file:       A validated FileStorage object (validate_upload() already called).
        upload_dir: Directory to save the file in. Created if it does not exist.
        prefix:     Optional prefix prepended to the unique filename.

    Returns:
        (file_path, size_kb)
          file_path: Absolute path to the saved file.
          size_kb:   File size rounded to the nearest KB (minimum 1).

    Raises:
        ResumeUploadFailed: If the directory cannot be created or the write fails.
    """
    try:
        Path(upload_dir).mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise ResumeUploadFailed(f"Failed to create upload directory: {exc}") from exc

    original_name = file.filename or "upload"
    ext           = Path(original_name).suffix.lower()
    safe_name     = secure_filename(original_name)
    unique_name   = f"{prefix}{uuid.uuid4().hex}{ext}"
    file_path     = os.path.join(upload_dir, unique_name)

    try:
        file.save(file_path)
    except Exception as exc:
        raise ResumeUploadFailed(f"Failed to save uploaded file: {exc}") from exc

    size_bytes = os.path.getsize(file_path)
    size_kb    = max(1, round(size_bytes / 1024))

    logger.info(
        "File saved",
        extra={
            "original_name": safe_name,
            "saved_path":    file_path,
            "size_kb":       size_kb,
        },
    )
    return file_path, size_kb  # FIX FH-04: was just file_path


def delete_file(file_path: str) -> None:
    """
    Delete a file from disk. Silently ignores missing files.

    Used to clean up partially-uploaded files when downstream processing fails.
    """
    try:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            logger.info("File deleted: %s", file_path)
    except OSError as exc:
        logger.warning("Failed to delete file %s: %s", file_path, exc)


def human_readable_size(size_bytes: int) -> str:
    """
    Format a byte count as a human-readable string.

    FIX FH-01: Original used `//=` (integer floor division assignment) when
    stepping down units. For example, 1500 bytes:
      Original: size //= 1024  → size = 1  → reported as "1 KB" (wrong, lost .46)
      Fixed:    size /= 1024   → size = 1.46 → reported as "1.5 KB" (correct)

    Returns:
        e.g. "2.3 MB", "512.0 KB", "800 B"
    """
    size: float = float(size_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0  # FIX FH-01: was `//=` which truncated to integer
    return f"{size:.1f} TB"