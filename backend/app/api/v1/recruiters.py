"""
app/api/v1/recruiters.py

Recruiter resource — profile management and analytics.

Routes:
  GET    /recruiters/              — paginated list
  POST   /recruiters/              — create recruiter account
  GET    /recruiters/<id>          — get single recruiter
  PATCH  /recruiters/<id>          — update profile
  DELETE /recruiters/<id>          — soft-delete
  GET    /recruiters/<id>/jobs     — recruiter's job postings
  GET    /recruiters/<id>/analytics — dashboard metrics
  GET    /recruiters/<id>/pipeline  — pipeline funnel breakdown
"""

import logging
import uuid

from flask import Blueprint, request

from app.core.responses import created, error, no_content, success, success_list
from app.schemas.recruiter import CreateRecruiterSchema, RecruiterQuerySchema, UpdateRecruiterSchema

from ._helpers import (
    get_services,
    parse_body,
    parse_query,
    serialize_job,
    serialize_recruiter,
)

logger = logging.getLogger(__name__)

recruiters_bp = Blueprint("recruiters", __name__)


# ─────────────────────────────────────────────────────────────────────────────
# List + Create
# ─────────────────────────────────────────────────────────────────────────────

@recruiters_bp.get("/")
def list_recruiters():
    """
    GET /api/v1/recruiters/

    Query params: page, limit, search, company_name
    """
    params, err = parse_query(RecruiterQuerySchema)
    if err:
        return err

    try:
        from app.repositories import RecruiterRepository
        repo  = RecruiterRepository()
        items, total = repo.list_active(
            page=params["page"],
            limit=params["limit"],
            search=params.get("search"),
            company_name=params.get("company_name"),
        )
        return success_list(
            data=[serialize_recruiter(r) for r in items],
            total=total,
            page=params["page"],
            limit=params["limit"],
            message="Recruiters retrieved.",
        )
    except Exception:
        logger.error("list_recruiters failed", exc_info=True)
        return error("Failed to retrieve recruiters.", code="INTERNAL_ERROR", status=500)


@recruiters_bp.post("/")
def create_recruiter():
    """
    POST /api/v1/recruiters/

    Body: { full_name, email, company_name, company_size?, industry?, ... }
    """
    data, err = parse_body(CreateRecruiterSchema)
    if err:
        return err

    try:
        from app.repositories import RecruiterRepository
        from app.models.recruiter import Recruiter

        repo = RecruiterRepository()
        if repo.email_exists(data["email"]):
            return error(
                f"A recruiter with email '{data['email']}' already exists.",
                code="RECRUITER_EMAIL_CONFLICT",
                status=409,
            )

        recruiter = Recruiter()
        recruiter.id           = str(uuid.uuid4())
        recruiter.full_name    = data["full_name"]
        recruiter.email        = data["email"].lower().strip()
        recruiter.company_name = data["company_name"]
        recruiter.company_size = data.get("company_size")
        recruiter.industry     = data.get("industry")
        recruiter.phone        = data.get("phone")
        recruiter.website_url  = data.get("website_url")
        recruiter.linkedin_url = data.get("linkedin_url")

        repo.save(recruiter)

        logger.info("Recruiter created", extra={"recruiter_id": recruiter.id})
        return created(
            data=serialize_recruiter(recruiter),
            message="Recruiter account created successfully.",
        )
    except Exception:
        logger.error("create_recruiter failed", exc_info=True)
        return error("Failed to create recruiter.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# Single resource
# ─────────────────────────────────────────────────────────────────────────────

@recruiters_bp.get("/<recruiter_id>")
def get_recruiter(recruiter_id: str):
    """GET /api/v1/recruiters/<recruiter_id>"""
    try:
        from app.repositories import RecruiterRepository
        recruiter = RecruiterRepository().get_by_id(recruiter_id)

        if not recruiter or getattr(recruiter, "is_deleted", False):
            return error(
                f"Recruiter '{recruiter_id}' not found.",
                code="RECRUITER_NOT_FOUND",
                status=404,
            )

        return success(data=serialize_recruiter(recruiter), message="Recruiter retrieved.")
    except Exception:
        logger.error("get_recruiter failed", exc_info=True)
        return error("Failed to retrieve recruiter.", code="INTERNAL_ERROR", status=500)


@recruiters_bp.patch("/<recruiter_id>")
def update_recruiter(recruiter_id: str):
    """PATCH /api/v1/recruiters/<recruiter_id>"""
    data, err = parse_body(UpdateRecruiterSchema)
    if err:
        return err

    try:
        from app.repositories import RecruiterRepository
        repo      = RecruiterRepository()
        recruiter = repo.get_by_id(recruiter_id)

        if not recruiter or getattr(recruiter, "is_deleted", False):
            return error(
                f"Recruiter '{recruiter_id}' not found.",
                code="RECRUITER_NOT_FOUND",
                status=404,
            )

        _UPDATEABLE = (
            "full_name", "company_name", "company_size",
            "industry", "phone", "website_url", "linkedin_url",
        )
        for field in _UPDATEABLE:
            if field in data:
                setattr(recruiter, field, data[field])

        repo.save(recruiter)
        logger.info("Recruiter updated", extra={"recruiter_id": recruiter_id})
        return success(data=serialize_recruiter(recruiter), message="Recruiter updated.")
    except Exception:
        logger.error("update_recruiter failed", exc_info=True)
        return error("Failed to update recruiter.", code="INTERNAL_ERROR", status=500)


@recruiters_bp.delete("/<recruiter_id>")
def delete_recruiter(recruiter_id: str):
    """DELETE /api/v1/recruiters/<recruiter_id> — soft-delete."""
    try:
        from app.repositories import RecruiterRepository
        repo      = RecruiterRepository()
        recruiter = repo.get_by_id(recruiter_id)

        if not recruiter or getattr(recruiter, "is_deleted", False):
            return error(
                f"Recruiter '{recruiter_id}' not found.",
                code="RECRUITER_NOT_FOUND",
                status=404,
            )

        repo.soft_delete(recruiter)
        logger.info("Recruiter deleted", extra={"recruiter_id": recruiter_id})
        return no_content()
    except Exception:
        logger.error("delete_recruiter failed", exc_info=True)
        return error("Failed to delete recruiter.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# Jobs sub-resource
# ─────────────────────────────────────────────────────────────────────────────

@recruiters_bp.get("/<recruiter_id>/jobs")
def list_recruiter_jobs(recruiter_id: str):
    """
    GET /api/v1/recruiters/<recruiter_id>/jobs

    Query params: page, limit, status
    """
    page   = int(request.args.get("page", 1))
    limit  = min(int(request.args.get("limit", 20)), 100)
    status = request.args.get("status")

    try:
        from app.repositories import RecruiterRepository, JobRepository

        if not RecruiterRepository().get_by_id(recruiter_id):
            return error(f"Recruiter '{recruiter_id}' not found.", code="RECRUITER_NOT_FOUND", status=404)

        items, total = JobRepository().list_by_recruiter(
            recruiter_id=recruiter_id,
            status=status,
            page=page,
            limit=limit,
        )
        return success_list(
            data=[serialize_job(j) for j in items],
            total=total, page=page, limit=limit,
            message="Jobs retrieved.",
        )
    except Exception:
        logger.error("list_recruiter_jobs failed", exc_info=True)
        return error("Failed to retrieve jobs.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# Analytics sub-resources
# ─────────────────────────────────────────────────────────────────────────────

@recruiters_bp.get("/<recruiter_id>/analytics")
def get_recruiter_analytics(recruiter_id: str):
    """
    GET /api/v1/recruiters/<recruiter_id>/analytics

    Returns full dashboard: job counts, pipeline funnel, score distribution,
    top jobs by applicants, in-demand skills.
    """
    try:
        from app.repositories import RecruiterRepository
        if not RecruiterRepository().get_by_id(recruiter_id):
            return error(f"Recruiter '{recruiter_id}' not found.", code="RECRUITER_NOT_FOUND", status=404)

        svcs      = get_services()
        dashboard = svcs.recruiter_analytics.get_dashboard(recruiter_id)

        return success(
            data=dashboard.__dict__ if hasattr(dashboard, "__dict__") else dashboard,
            message="Analytics dashboard retrieved.",
        )
    except Exception:
        logger.error("get_recruiter_analytics failed", exc_info=True)
        return error("Failed to retrieve analytics.", code="INTERNAL_ERROR", status=500)


@recruiters_bp.get("/<recruiter_id>/pipeline")
def get_recruiter_pipeline(recruiter_id: str):
    """
    GET /api/v1/recruiters/<recruiter_id>/pipeline

    Returns stage-by-stage application counts across all of recruiter's jobs.
    """
    try:
        from app.repositories import RecruiterRepository
        if not RecruiterRepository().get_by_id(recruiter_id):
            return error(f"Recruiter '{recruiter_id}' not found.", code="RECRUITER_NOT_FOUND", status=404)

        svcs     = get_services()
        pipeline = svcs.recruiter_analytics.get_pipeline(recruiter_id)

        return success(
            data=pipeline.__dict__ if hasattr(pipeline, "__dict__") else pipeline,
            message="Pipeline breakdown retrieved.",
        )
    except Exception:
        logger.error("get_recruiter_pipeline failed", exc_info=True)
        return error("Failed to retrieve pipeline.", code="INTERNAL_ERROR", status=500)
