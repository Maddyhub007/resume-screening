"""
app/api/v1/applications.py

Applications resource endpoints.
"""

import logging
from flask import Blueprint
from app.core.responses import success

logger = logging.getLogger(__name__)

applications_bp = Blueprint("applications", __name__)

@applications_bp.get("/")
def list_applications() -> tuple:
    return success(data=[], message="Applications endpoint ready — full implementation in Phase 2.")

@applications_bp.get("/<resource_id>")
def get_application(resource_id: str) -> tuple:
    return success(
        data={"id": resource_id},
        message="application endpoint ready — full implementation in Phase 2.",
    )
