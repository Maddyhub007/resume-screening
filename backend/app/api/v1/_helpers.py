"""
app/api/v1/_helpers.py

Shared utilities used by all route handlers.

Provides:
  - get_services()         — fetch Services dataclass from app.extensions
  - parse_body()           — load + validate JSON body via Marshmallow schema
  - parse_query()          — load + validate query params via Marshmallow schema
  - serialize_candidate()  — ORM → dict for Candidate
  - serialize_recruiter()  — ORM → dict for Recruiter
  - serialize_job()        — ORM → dict for Job
  - serialize_resume()     — ORM → dict for Resume
  - serialize_application()— ORM → dict for Application
  - serialize_ats_score()  — ORM → dict for AtsScore
  - paginate_query()       — (items, total, page, limit) helper

Design:
  - Routes NEVER access g, request, or db directly — always through helpers.
  - All serialisers are pure functions: (orm_object) → dict.
  - Serialisers never raise; missing attributes become None.
"""

import logging
from typing import Any, Type

from flask import current_app, g, request
from marshmallow import Schema, ValidationError

from app.core.responses import error, validation_error

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Service accessor
# ─────────────────────────────────────────────────────────────────────────────

def get_services():
    """
    Return the Services dataclass wired at app startup.

    The service factory stores its output in app.extensions["services"]
    during create_app().  Routes call this to get type-safe access to all
    service instances without importing them directly.
    """
    return current_app.extensions.get("services")


# ─────────────────────────────────────────────────────────────────────────────
# Request parsing
# ─────────────────────────────────────────────────────────────────────────────

def parse_body(schema_class: Type[Schema]) -> tuple[dict | None, tuple | None]:
    """
    Parse and validate the JSON request body.

    Returns:
        (data, None)       on success — data is the deserialised dict.
        (None, error_resp) on failure — error_resp is a Flask response tuple.
    """
    body = request.get_json(silent=True) or {}
    schema = schema_class()
    try:
        data = schema.load(body)
        return data, None
    except ValidationError as exc:
        return None, validation_error(exc.messages)


def parse_query(schema_class: Type[Schema]) -> tuple[dict | None, tuple | None]:
    """
    Parse and validate query string parameters.

    Returns:
        (data, None)       on success.
        (None, error_resp) on failure.
    """
    params = request.args.to_dict(flat=True)
    # Convert comma-separated list params expected by some schemas
    schema = schema_class()
    try:
        data = schema.load(params)
        return data, None
    except ValidationError as exc:
        return None, validation_error(exc.messages)


# ─────────────────────────────────────────────────────────────────────────────
# ORM serialisers
# ─────────────────────────────────────────────────────────────────────────────

def _safe(obj: Any, attr: str, default: Any = None) -> Any:
    """Safe attribute access — never raises AttributeError."""
    try:
        val = getattr(obj, attr, default)
        return val if val is not None else default
    except Exception:
        return default


def serialize_candidate(c) -> dict:
    """Serialise a Candidate ORM object to a JSON-safe dict."""
    return {
        "id":                 _safe(c, "id"),
        "full_name":          _safe(c, "full_name"),
        "email":              _safe(c, "email"),
        "phone":              _safe(c, "phone"),
        "location":           _safe(c, "location"),
        "headline":           _safe(c, "headline"),
        "linkedin_url":       _safe(c, "linkedin_url"),
        "github_url":         _safe(c, "github_url"),
        "portfolio_url":      _safe(c, "portfolio_url"),
        "preferred_roles":    _safe(c, "preferred_roles_list", []),
        "preferred_locations":_safe(c, "preferred_locations_list", []),
        "open_to_work":       _safe(c, "open_to_work", True),
        "is_active":          _safe(c, "is_active", True),
        "created_at":         _ts(c, "created_at"),
        "updated_at":         _ts(c, "updated_at"),
    }


def serialize_recruiter(r) -> dict:
    """Serialise a Recruiter ORM object."""
    return {
        "id":           _safe(r, "id"),
        "full_name":    _safe(r, "full_name"),
        "email":        _safe(r, "email"),
        "company_name": _safe(r, "company_name"),
        "company_size": _safe(r, "company_size"),
        "industry":     _safe(r, "industry"),
        "phone":        _safe(r, "phone"),
        "website_url":  _safe(r, "website_url"),
        "linkedin_url": _safe(r, "linkedin_url"),
        "is_active":    _safe(r, "is_active", True),
        "created_at":   _ts(r, "created_at"),
        "updated_at":   _ts(r, "updated_at"),
    }


def serialize_job(j) -> dict:
    """Serialise a Job ORM object."""
    status = _safe(j, "status")
    job_type = _safe(j, "job_type")
    return {
        "id":                   _safe(j, "id"),
        "recruiter_id":         _safe(j, "recruiter_id"),
        "title":                _safe(j, "title"),
        "company":              _safe(j, "company"),
        "description":          _safe(j, "description"),
        "required_skills":      _safe(j, "required_skills_list", []),
        "nice_to_have_skills":  _safe(j, "nice_to_have_skills_list", []),
        "responsibilities":     _safe(j, "responsibilities_list", []),
        "experience_years":     _safe(j, "experience_years", 0.0),
        "location":             _safe(j, "location"),
        "job_type":             status.value if hasattr(job_type, "value") else job_type,
        "status":               status.value if hasattr(status, "value") else status,
        "salary_min":           _safe(j, "salary_min"),
        "salary_max":           _safe(j, "salary_max"),
        "salary_currency":      _safe(j, "salary_currency", "USD"),
        "quality_score":        _safe(j, "quality_score"),
        "completeness_score":   _safe(j, "completeness_score"),
        "applicant_count":      _safe(j, "applicant_count", 0),
        "created_at":           _ts(j, "created_at"),
        "updated_at":           _ts(j, "updated_at"),
    }


def serialize_resume(r) -> dict:
    """Serialise a Resume ORM object."""
    parse_status = _safe(r, "parse_status")
    return {
        "id":                    _safe(r, "id"),
        "candidate_id":          _safe(r, "candidate_id"),
        "filename":             _safe(r, "filename"),
        "file_size_bytes":       _safe(r, "file_size_bytes"),
        "content_type":          _safe(r, "content_type"),
        "parse_status":          parse_status.value if hasattr(parse_status, "value") else parse_status,
        "parse_error_msg":       _safe(r, "parse_error_msg"),
        "total_experience_years":_safe(r, "total_experience_years", 0.0),
        "skill_count":           _safe(r, "skill_count", 0),
        "skills":                _safe(r, "skills_list", []),
        "education":             _safe(r, "education_list", []),
        "experience":            _safe(r, "experience_list", []),
        "certifications":        _safe(r, "certifications_list", []),
        "projects":              _safe(r, "projects_list", []),
        "summary_text":          _safe(r, "summary_text"),
        "resume_summary":        _safe(r, "resume_summary"),
        "role_suggestions":      _safe(r, "role_suggestions_list", []),
        "improvement_tips":      _safe(r, "improvement_tips_list", []),
        "is_active":             _safe(r, "is_active", True),
        "created_at":            _ts(r, "created_at"),
        "updated_at":            _ts(r, "updated_at"),
    }


def serialize_application(a) -> dict:
    """Serialise an Application ORM object."""
    stage = _safe(a, "stage")
    return {
        "id":               _safe(a, "id"),
        "candidate_id":     _safe(a, "candidate_id"),
        "job_id":           _safe(a, "job_id"),
        "resume_id":        _safe(a, "resume_id"),
        "stage":            stage.value if hasattr(stage, "value") else stage,
        "cover_letter":     _safe(a, "cover_letter"),
        "recruiter_notes":  _safe(a, "recruiter_notes"),
        "rejection_reason": _safe(a, "rejection_reason"),
        "applied_at":       _ts(a, "applied_at"),
        "created_at":       _ts(a, "created_at"),
        "updated_at":       _ts(a, "updated_at"),
    }


def serialize_ats_score(s) -> dict:
    """Serialise an AtsScore ORM object."""
    label = _safe(s, "score_label")
    return {
        "id":                    _safe(s, "id"),
        "resume_id":             _safe(s, "resume_id"),
        "job_id":                _safe(s, "job_id"),
        "application_id":        _safe(s, "application_id"),
        "final_score":           _safe(s, "final_score", 0.0),
        "score_label":           label.value if hasattr(label, "value") else label,
        "semantic_score":        _safe(s, "semantic_score", 0.0),
        "keyword_score":         _safe(s, "keyword_score", 0.0),
        "experience_score":      _safe(s, "experience_score", 0.0),
        "section_quality_score": _safe(s, "section_quality_score", 0.0),
        "semantic_available":    _safe(s, "semantic_available", False),
        "matched_skills":        _safe(s, "matched_skills_list", []),
        "missing_skills":        _safe(s, "missing_skills_list", []),
        "extra_skills":          _safe(s, "extra_skills_list", []),
        "improvement_tips":      _safe(s, "improvement_tips_list", []),
        "summary_text":          _safe(s, "summary_text"),
        "hiring_recommendation": _safe(s, "hiring_recommendation"),
        "weights_used":          _safe(s, "weights_used_dict", {}),
        "created_at":            _ts(s, "created_at"),
        "updated_at":            _ts(s, "updated_at"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _ts(obj: Any, attr: str) -> str | None:
    """Return ISO-8601 string for a datetime attribute, or None."""
    try:
        val = getattr(obj, attr, None)
        return val.isoformat() if val else None
    except Exception:
        return None
