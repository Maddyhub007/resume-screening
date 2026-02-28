"""
app/api/v1/resumes.py

Resume resource — management, parsing status, AI analysis.

Routes:
  GET    /resumes/              — paginated list (filter by candidate, parse_status)
  GET    /resumes/<id>          — get single resume
  DELETE /resumes/<id>          — soft-delete resume
  POST   /resumes/<id>/analyze  — run full AI analysis (Groq + section quality)
  GET    /resumes/<id>/score-preview  — preview ATS score against a job without saving
"""

import logging

from flask import Blueprint, request

from app.core.responses import error, no_content, success, success_list
from app.schemas.resume import AnalyzeResumeSchema, ResumeQuerySchema

from ._helpers import (
    get_services,
    parse_body,
    parse_query,
    serialize_resume,
)

logger = logging.getLogger(__name__)

resumes_bp = Blueprint("resumes", __name__)


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────

@resumes_bp.get("/")
def list_resumes():
    """
    GET /api/v1/resumes/

    Query params: page, limit, candidate_id, parse_status
    """
    params, err = parse_query(ResumeQuerySchema)
    if err:
        return err

    try:
        from app.repositories import ResumeRepository
        repo = ResumeRepository()

        if params.get("candidate_id"):
            items, total = repo.list_by_candidate(
                candidate_id=params["candidate_id"],
                active_only=False,
                page=params["page"],
                limit=params["limit"],
            )
        else:
            items, total = repo.list_all(
                page=params["page"],
                limit=params["limit"],
                parse_status=params.get("parse_status"),
            )

        return success_list(
            data=[serialize_resume(r) for r in items],
            total=total,
            page=params["page"],
            limit=params["limit"],
            message="Resumes retrieved.",
        )
    except Exception:
        logger.error("list_resumes failed", exc_info=True)
        return error("Failed to retrieve resumes.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# Single resource
# ─────────────────────────────────────────────────────────────────────────────

@resumes_bp.get("/<resume_id>")
def get_resume(resume_id: str):
    """GET /api/v1/resumes/<resume_id>"""
    try:
        from app.repositories import ResumeRepository
        resume = ResumeRepository().get_by_id(resume_id)

        if not resume or getattr(resume, "is_deleted", False):
            return error(
                f"Resume '{resume_id}' not found.",
                code="RESUME_NOT_FOUND",
                status=404,
            )

        return success(data=serialize_resume(resume), message="Resume retrieved.")
    except Exception:
        logger.error("get_resume failed", exc_info=True)
        return error("Failed to retrieve resume.", code="INTERNAL_ERROR", status=500)


@resumes_bp.delete("/<resume_id>")
def delete_resume(resume_id: str):
    """DELETE /api/v1/resumes/<resume_id> — soft-delete."""
    try:
        from app.repositories import ResumeRepository
        repo   = ResumeRepository()
        resume = repo.get_by_id(resume_id)

        if not resume or getattr(resume, "is_deleted", False):
            return error(
                f"Resume '{resume_id}' not found.",
                code="RESUME_NOT_FOUND",
                status=404,
            )

        repo.soft_delete(resume)
        logger.info("Resume deleted", extra={"resume_id": resume_id})
        return no_content()
    except Exception:
        logger.error("delete_resume failed", exc_info=True)
        return error("Failed to delete resume.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# AI Analysis
# ─────────────────────────────────────────────────────────────────────────────

@resumes_bp.post("/<resume_id>/analyze")
def analyze_resume(resume_id: str):
    """
    POST /api/v1/resumes/<resume_id>/analyze

    Runs the full AI analysis pipeline:
      1. Re-parse file if needed (or if force_refresh=True)
      2. Compute section quality score
      3. Call Groq for summary, strengths, issues, role suggestions
      4. Persist results to Resume record
      5. Return structured analysis

    Body (optional): { force_refresh: false }
    """
    data, err = parse_body(AnalyzeResumeSchema)
    if err:
        return err

    try:
        from app.repositories import ResumeRepository
        resume = ResumeRepository().get_by_id(resume_id)

        if not resume or getattr(resume, "is_deleted", False):
            return error(
                f"Resume '{resume_id}' not found.",
                code="RESUME_NOT_FOUND",
                status=404,
            )

        svcs   = get_services()
        result = svcs.resume_analysis.analyse(
            resume=resume,
            force_reparse=data.get("force_refresh", False),
        )

        return success(
            data={
                "resume_id":       result.resume_id,
                "summary":         result.summary,
                "strengths":       result.strengths,
                "issues":          result.issues,
                "role_suggestions":result.role_suggestions,
                "improvement_tips":result.improvement_tips,
                "section_quality": result.section_quality,
                "llm_enhanced":    result.llm_enhanced,
                "parse_error":     result.parse_error,
                "resume":          serialize_resume(resume),
            },
            message="Resume analysis complete." if result.llm_enhanced else
                    "Resume analysis complete (rule-based — Groq unavailable).",
        )
    except Exception:
        logger.error("analyze_resume failed", exc_info=True)
        return error("Failed to analyse resume.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# Score Preview (no persistence)
# ─────────────────────────────────────────────────────────────────────────────

@resumes_bp.get("/<resume_id>/score-preview")
def score_preview(resume_id: str):
    """
    GET /api/v1/resumes/<resume_id>/score-preview?job_id=<job_id>

    Compute ATS score for a resume/job pair WITHOUT saving the result.
    Useful for live UI previews.

    Query params:
      job_id  (required)
    """
    job_id = request.args.get("job_id")
    if not job_id:
        return error("job_id query parameter is required.", code="MISSING_PARAM", status=400)

    try:
        from app.repositories import ResumeRepository, JobRepository

        resume = ResumeRepository().get_by_id(resume_id)
        if not resume or getattr(resume, "is_deleted", False):
            return error(f"Resume '{resume_id}' not found.", code="RESUME_NOT_FOUND", status=404)

        job = JobRepository().get_by_id(job_id)
        if not job or getattr(job, "is_deleted", False):
            return error(f"Job '{job_id}' not found.", code="JOB_NOT_FOUND", status=404)

        svcs   = get_services()
        result = svcs.ats_scorer.score_raw(
            resume_text=getattr(resume, "raw_text", "") or "",
            resume_skills=getattr(resume, "skills_list", []) or [],
            resume_experience=getattr(resume, "experience_list", []) or [],
            resume_education=getattr(resume, "education_list", []) or [],
            resume_experience_years=getattr(resume, "total_experience_years", 0.0) or 0.0,
            job_title=getattr(job, "title", ""),
            job_description=getattr(job, "description", ""),
            job_required_skills=getattr(job, "required_skills_list", []) or [],
            job_nice_to_have=getattr(job, "nice_to_have_skills_list", []) or [],
            required_years=getattr(job, "experience_years", 0.0) or 0.0,
        )

        return success(
            data={
                "resume_id":       resume_id,
                "job_id":          job_id,
                "preview":         True,
                **result,
            },
            message="Score preview computed (not saved).",
        )
    except Exception:
        logger.error("score_preview failed", exc_info=True)
        return error("Failed to compute score preview.", code="INTERNAL_ERROR", status=500)
