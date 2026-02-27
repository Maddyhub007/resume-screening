"""
app/api/v1/candidates.py

Candidates resource endpoints.
"""

import logging
from flask import Blueprint
from app.core.responses import success

logger = logging.getLogger(__name__)

candidates_bp = Blueprint("candidates", __name__)

@candidates_bp.get("/")
def list_candidates() -> tuple:
    return success(data=[], message="Candidates endpoint ready — full implementation in Phase 2.")

@candidates_bp.get("/<resource_id>")
def get_candidate(resource_id: str) -> tuple:
    return success(
        data={"id": resource_id},
        message="candidate endpoint ready — full implementation in Phase 2.",
    )
