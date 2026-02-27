"""
app/api/v1/scoring.py

Scoring resource endpoints.
"""

import logging
from flask import Blueprint
from app.core.responses import success

logger = logging.getLogger(__name__)

scoring_bp = Blueprint("scoring", __name__)

@scoring_bp.get("/")
def list_scoring() -> tuple:
    return success(data=[], message="Scoring endpoint ready — full implementation in Phase 2.")

@scoring_bp.get("/<resource_id>")
def get_scoring(resource_id: str) -> tuple:
    return success(
        data={"id": resource_id},
        message="scoring endpoint ready — full implementation in Phase 2.",
    )
