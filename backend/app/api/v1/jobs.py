"""
app/api/v1/jobs.py

Jobs resource endpoints.
"""

import logging
from flask import Blueprint
from app.core.responses import success

logger = logging.getLogger(__name__)

jobs_bp = Blueprint("jobs", __name__)

@jobs_bp.get("/")
def list_jobs() -> tuple:
    return success(data=[], message="Jobs endpoint ready — full implementation in Phase 2.")

@jobs_bp.get("/<resource_id>")
def get_job(resource_id: str) -> tuple:
    return success(
        data={"id": resource_id},
        message="job endpoint ready — full implementation in Phase 2.",
    )
