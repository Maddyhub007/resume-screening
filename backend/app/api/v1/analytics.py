"""
app/api/v1/analytics.py

Analytics resource endpoints.
"""

import logging
from flask import Blueprint
from app.core.responses import success

logger = logging.getLogger(__name__)

analytics_bp = Blueprint("analytics", __name__)

@analytics_bp.get("/")
def list_analytics() -> tuple:
    return success(data=[], message="Analytics endpoint ready — full implementation in Phase 2.")

@analytics_bp.get("/<resource_id>")
def get_analytic(resource_id: str) -> tuple:
    return success(
        data={"id": resource_id},
        message="analytic endpoint ready — full implementation in Phase 2.",
    )
