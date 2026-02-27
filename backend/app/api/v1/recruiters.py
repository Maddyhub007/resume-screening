"""
app/api/v1/recruiters.py

Recruiters resource endpoints.
"""

import logging
from flask import Blueprint
from app.core.responses import success

logger = logging.getLogger(__name__)

recruiters_bp = Blueprint("recruiters", __name__)

@recruiters_bp.get("/")
def list_recruiters() -> tuple:
    return success(data=[], message="Recruiters endpoint ready — full implementation in Phase 2.")

@recruiters_bp.get("/<resource_id>")
def get_recruiter(resource_id: str) -> tuple:
    return success(
        data={"id": resource_id},
        message="recruiter endpoint ready — full implementation in Phase 2.",
    )
