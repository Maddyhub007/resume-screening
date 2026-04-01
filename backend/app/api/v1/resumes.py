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
            job_nice_to_have_skills=getattr(job, "nice_to_have_skills_list", []) or [],
            job_experience_years=getattr(job, "experience_years", 0.0) or 0.0,
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




# ─────────────────────────────────────────────────────────────────────────────
# Resume Set Active 
# ─────────────────────────────────────────────────────────────────────────────

@resumes_bp.patch("/<resume_id>/set-active")
def set_active_resume(resume_id: str):
    """
    PATCH /api/v1/resumes/<resume_id>/set-active
    Sets this resume as the active one, deactivates all others for this candidate.
    """
    try:
        from app.repositories import ResumeRepository
        from app.core.database import db
        from app.models.resume import Resume
        from app.core.security import get_current_user

        user_id, _ = get_current_user()
        repo   = ResumeRepository()
        resume = repo.get_by_id(resume_id)

        if not resume or getattr(resume, "is_deleted", False):
            return error(f"Resume '{resume_id}' not found.", code="RESUME_NOT_FOUND", status=404)

        # Ownership check
        if str(resume.candidate_id) != str(user_id):
            return error("Access denied.", code="FORBIDDEN", status=403)

        if resume.parse_status.value != "success":
            return error(
                "Only successfully parsed resumes can be set as active.",
                code="RESUME_NOT_PARSED",
                status=422,
            )

        # Deactivate all others atomically
        db.session.query(Resume).filter(
            Resume.candidate_id == user_id,
            Resume.id != resume_id,
            Resume.is_deleted == False,
        ).update({Resume.is_active: False}, synchronize_session=False)
        db.session.flush()

        resume.is_active = True
        db.session.add(resume)
        db.session.commit()

        logger.info("Active resume set", extra={"resume_id": resume_id, "candidate_id": user_id})
        return success(data=serialize_resume(resume), message="Active resume updated.")

    except Exception:
        logger.error("set_active_resume failed", exc_info=True)
        return error("Failed to update active resume.", code="INTERNAL_ERROR", status=500)
    

# ─────────────────────────────────────────────────────────────────────────────
# Generate Summary
# ─────────────────────────────────────────────────────────────────────────────

@resumes_bp.post("/<resume_id>/generate-summary")
def generate_summary(resume_id: str):
    """POST /api/v1/resumes/<resume_id>/generate-summary"""
    from app.core.security import get_current_user
    user_id, _ = get_current_user()

    try:
        from app.repositories import ResumeRepository
        resume = ResumeRepository().get_by_id(resume_id)

        if not resume or getattr(resume, "is_deleted", False):
            return error(f"Resume not found.", code="RESUME_NOT_FOUND", status=404)

        if str(resume.candidate_id) != str(user_id):
            return error("Access denied.", code="FORBIDDEN", status=403)

        svcs = get_services()
        if not svcs.groq.available:
            return error("AI service unavailable.", code="SERVICE_UNAVAILABLE", status=503)

        body = request.get_json(silent=True) or {}
        result = svcs.groq.generate_resume_summary(
            skills=resume.skills_list,
            experience_years=resume.total_experience_years,
            experience=resume.experience_list,
            education=resume.education_list,
            target_role=body.get("target_role", ""),
        )

        # Persist the generated summary
        if result.get("summary"):
            from app.repositories import ResumeRepository as RR
            repo = RR()
            resume.resume_summary = result["summary"]
            repo.save(resume)
            from app.core.database import db
            db.session.commit()

        return success(
            data={"summary": result.get("summary", ""), "resume": serialize_resume(resume)},
            message="Summary generated successfully.",
        )
    except Exception:
        logger.error("generate_summary failed", exc_info=True)
        return error("Failed to generate summary.", code="INTERNAL_ERROR", status=500)
    
    
# ─────────────────────────────────────────────────────────────────────────────
# Rewrite Suggestions
# ─────────────────────────────────────────────────────────────────────────────

@resumes_bp.post("/<resume_id>/rewrite-suggestions")
def rewrite_suggestions(resume_id: str):
    """POST /api/v1/resumes/<resume_id>/rewrite-suggestions  Body: { job_id }"""
    from app.core.security import get_current_user
    user_id, _ = get_current_user()
    body = request.get_json(silent=True) or {}
    job_id = body.get("job_id")

    if not job_id:
        return error("job_id is required.", code="MISSING_PARAM", status=400)

    try:
        from app.repositories import ResumeRepository, JobRepository
        resume = ResumeRepository().get_by_id(resume_id)
        job    = JobRepository().get_by_id(job_id)

        if not resume or str(resume.candidate_id) != str(user_id):
            return error("Resume not found.", code="RESUME_NOT_FOUND", status=404)
        if not job:
            return error("Job not found.", code="JOB_NOT_FOUND", status=404)

        svcs = get_services()
        if not svcs.groq.available:
            return error("AI service unavailable.", code="SERVICE_UNAVAILABLE", status=503)

        # Find missing skills using keyword matcher
        breakdown = svcs.keyword_matcher.get_skill_breakdown(
            resume_skills=resume.skills_list,
            job_required_skills=job.required_skills_list,
            job_nice_to_have_skills=job.nice_to_have_skills_list,
        )
        missing = breakdown.get("missing", [])[:5]  # top 5 missing

        # Get rewrite suggestions for each missing skill
        all_suggestions = []
        for skill in missing[:3]:  # limit Groq calls to 3
            result = svcs.groq.suggest_bullet_rewrites(
                missing_skill=skill,
                existing_experience=resume.experience_list,
                job_title=job.title,
                candidate_skills=resume.skills_list,
            )
            for s in result.get("suggestions", []):
                all_suggestions.append({**s, "for_skill": skill})

        return success(
            data={
                "missing_skills": missing,
                "suggestions":    all_suggestions,
                "job_title":      job.title,
            },
            message=f"Rewrite suggestions generated for {len(missing)} skill gaps.",
        )
    except Exception:
        logger.error("rewrite_suggestions failed", exc_info=True)
        return error("Failed to generate suggestions.", code="INTERNAL_ERROR", status=500)
