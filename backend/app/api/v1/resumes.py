"""
app/api/v1/resumes.py

Resumes resource endpoints.
"""

import logging
from flask import Blueprint
from app.core.responses import success

logger = logging.getLogger(__name__)

resumes_bp = Blueprint("resumes", __name__)

@resumes_bp.get("/")
def list_resumes() -> tuple:
    return success(data=[], message="Resumes endpoint ready — full implementation in Phase 2.")

@resumes_bp.get("/<resource_id>")
def get_resume(resource_id: str) -> tuple:
    return success(
        data={"id": resource_id},
        message="resume endpoint ready — full implementation in Phase 2.",
    )
