"""
app/api/v1/resume_builder.py

Resume Builder resource — AI-powered resume generation and management.

Follows the exact same blueprint pattern as every other resource in this project:
  - Blueprint imported in app/api/v1/__init__.py
  - Routes use parse_body() / parse_query() for validation
  - All responses via app.core.responses helpers
  - require_auth("candidate") enforces ownership
  - get_services() accesses the service layer

Routes:
  GET  /resume-builder/templates          — list all templates (no auth required)
  GET  /resume-builder/jobs               — paginated active jobs for target selection
  POST /resume-builder/generate           — generate new ATS-optimised draft
  POST /resume-builder/refine             — run one more optimisation iteration
  POST /resume-builder/predict-score      — live ATS preview for editor content
  POST /resume-builder/save-draft         — finalize draft → create Resume record
  GET  /resume-builder/drafts             — list candidate's drafts
  GET  /resume-builder/drafts/<draft_id>  — get single draft with full content
  POST /resume-builder/drafts/<draft_id>/feedback  — store recruiter outcome (learning hook)

Error codes:
  BUILDER_CANDIDATE_NOT_FOUND
  BUILDER_JOB_NOT_FOUND
  BUILDER_DRAFT_NOT_FOUND
  BUILDER_DRAFT_ACCESS_DENIED
  BUILDER_MAX_ITERATIONS
  BUILDER_ALREADY_FINALIZED
  BUILDER_GENERATION_FAILED
  SERVICE_UNAVAILABLE
"""

import logging

from flask import Blueprint, g

from app.core.responses import created, error, success, success_list
from app.core.security import require_auth
from app.schemas.resume_builder import (
    DraftListQuerySchema,
    FeedbackSchema,
    GenerateSchema,
    PredictScoreSchema,
    RefineSchema,
    SaveDraftSchema,
)

from ._helpers import get_services, parse_body, parse_query

logger = logging.getLogger(__name__)

resume_builder_bp = Blueprint("resume_builder", __name__)


# ─────────────────────────────────────────────────────────────────────────────
# GET /resume-builder/templates  — no auth (public reference data)
# ─────────────────────────────────────────────────────────────────────────────

@resume_builder_bp.get("/templates")
def list_templates():
    """
    GET /api/v1/resume-builder/templates

    Returns all available templates. No authentication required.
    Candidates use this to populate the template picker.

    Response:
      { success: true, data: [{id, name, description, layout,
        section_order, tone, accent_color, font_family, best_for}] }
    """
    from app.services.builder.template_registry import list_templates as _list
    templates = _list()
    return success(
        data=templates,
        message=f"{len(templates)} templates available.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /resume-builder/jobs  — show active jobs for the candidate to target
# ─────────────────────────────────────────────────────────────────────────────

@resume_builder_bp.get("/jobs")
@require_auth("candidate")
def list_target_jobs():
    """
    GET /api/v1/resume-builder/jobs
        ?search=&location=&job_type=&page=1&limit=20

    Returns active jobs for the candidate to select as their resume target.
    Reuses JobRepository.list_active() — no new DB query logic needed.
    """
    from app.repositories import JobRepository
    from app.schemas.base import BaseSchema
    from marshmallow import fields, validate

    # Inline minimal query schema to avoid a new schema file
    class _Query(BaseSchema):
        page     = fields.Integer(load_default=1,  validate=validate.Range(min=1))
        limit    = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
        search   = fields.String(load_default=None)
        location = fields.String(load_default=None)
        job_type = fields.String(load_default=None)

    params, err = parse_query(_Query)
    if err:
        return err

    jobs, total = JobRepository().list_active(
        page=params["page"],
        limit=params["limit"],
        search=params.get("search"),
        location=params.get("location"),
        job_type=params.get("job_type"),
    )

    data = [
        {
            "id":               j.id,
            "title":            j.title,
            "company":          j.company,
            "location":         j.location,
            "job_type":         j.job_type.value if hasattr(j.job_type, "value") else j.job_type,
            "experience_years": j.experience_years,
            "required_skills":  j.required_skills_list[:10],
            "salary_min":       j.salary_min,
            "salary_max":       j.salary_max,
        }
        for j in jobs
    ]

    return success_list(
        data=data,
        total=total,
        page=params["page"],
        limit=params["limit"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /resume-builder/generate
# ─────────────────────────────────────────────────────────────────────────────

@resume_builder_bp.post("/generate")
@require_auth("candidate")
def generate_resume():
    """
    POST /api/v1/resume-builder/generate

    Generate a new ATS-optimised resume draft for the authenticated candidate.

    Request body:
      {
        "job_id":      "uuid",          -- required
        "user_prompt": "I am...",       -- optional (max 2000 chars)
        "template_id": "modern"         -- optional, default "modern"
      }

    The candidate's profile and all previously uploaded resumes are loaded
    automatically — no need to resend that data.

    Response:
      {
        "success": true,
        "data": {
          "draft_id":      "uuid",
          "content":       { summary, skills[], experience[], ... },
          "ats_preview":   { final_score, label, keyword_score, ... },
          "template":      { id, name, section_order, ... },
          "job_title":     "Senior Backend Engineer",
          "job_id":        "uuid",
          "iteration_count": 1,
          "llm_used":      true
        }
      }
    """
    svcs = get_services()
    if not svcs or not svcs.resume_builder:
        return error("Resume builder unavailable.", code="SERVICE_UNAVAILABLE", status=503)

    data, err = parse_body(GenerateSchema)
    if err:
        return err

    result = svcs.resume_builder.generate(
        candidate_id=g.user_id,
        job_id=data["job_id"],
        user_prompt=data.get("user_prompt", ""),
        template_id=data.get("template_id", "modern"),
    )

    if result.error:
        if "not found" in result.error.lower():
            code = (
                "BUILDER_JOB_NOT_FOUND"
                if "job" in result.error.lower()
                else "BUILDER_CANDIDATE_NOT_FOUND"
            )
            return error(result.error, code=code, status=404)
        return error(result.error, code="BUILDER_GENERATION_FAILED", status=500)

    return created(
        data=_serialise_build_result(result),
        message=(
            f"Draft generated for '{result.job_title}'. "
            f"Predicted ATS score: {result.ats_preview.final_score:.0%} ({result.ats_preview.label})."
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /resume-builder/refine
# ─────────────────────────────────────────────────────────────────────────────

@resume_builder_bp.post("/refine")
@require_auth("candidate")
def refine_resume():
    """
    POST /api/v1/resume-builder/refine

    Run one additional ATS optimisation iteration on an existing draft.
    Maximum 2 total iterations per draft.

    Request body:
      { "draft_id": "uuid" }

    Response: same shape as /generate.
    """
    svcs = get_services()
    if not svcs or not svcs.resume_builder:
        return error("Resume builder unavailable.", code="SERVICE_UNAVAILABLE", status=503)

    data, err = parse_body(RefineSchema)
    if err:
        return err

    result = svcs.resume_builder.refine(
        draft_id=data["draft_id"],
        candidate_id=g.user_id,
    )

    if result.error:
        if "not found" in result.error.lower():
            return error(result.error, code="BUILDER_DRAFT_NOT_FOUND", status=404)
        if "access denied" in result.error.lower():
            return error(result.error, code="BUILDER_DRAFT_ACCESS_DENIED", status=403)
        if "maximum" in result.error.lower():
            return error(result.error, code="BUILDER_MAX_ITERATIONS", status=422)
        if "finalized" in result.error.lower():
            return error(result.error, code="BUILDER_ALREADY_FINALIZED", status=422)
        return error(result.error, code="BUILDER_GENERATION_FAILED", status=500)

    return success(
        data=_serialise_build_result(result),
        message=(
            f"Draft refined (iteration {result.iteration_count}). "
            f"Score: {result.ats_preview.final_score:.0%} ({result.ats_preview.label})."
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /resume-builder/predict-score
# ─────────────────────────────────────────────────────────────────────────────

@resume_builder_bp.post("/predict-score")
@require_auth("candidate")
def predict_score():
    """
    POST /api/v1/resume-builder/predict-score

    Real-time ATS preview for editor content. No draft row is modified.
    Called on every keystroke / debounce in the live editor.

    Request body:
      {
        "job_id":  "uuid",
        "content": { summary, skills[], experience[], ... }
      }

    Response:
      { "data": { final_score, label, keyword_score, semantic_score,
                  experience_score, section_quality_score,
                  matched_skills[], missing_skills[] } }
    """
    svcs = get_services()
    if not svcs or not svcs.resume_builder:
        return error("Resume builder unavailable.", code="SERVICE_UNAVAILABLE", status=503)

    data, err = parse_body(PredictScoreSchema)
    if err:
        return err

    preview = svcs.resume_builder.predict_score(
        content=data["content"],
        job_id=data["job_id"],
    )

    return success(data=_serialise_preview(preview))


# ─────────────────────────────────────────────────────────────────────────────
# POST /resume-builder/save-draft
# ─────────────────────────────────────────────────────────────────────────────

@resume_builder_bp.post("/save-draft")
@require_auth("candidate")
def save_draft():
    """
    POST /api/v1/resume-builder/save-draft

    Finalize a draft: creates a Resume record + persists a real ATS score.

    The candidate may supply edited content. If omitted, the server uses
    the last generated content from the draft as-is.

    Request body:
      {
        "draft_id": "uuid",
        "content":  { ... }   -- optional; edited by candidate in UI
      }

    Response:
      {
        "data": {
          "resume_id":   "uuid",
          "draft_id":    "uuid",
          "final_score": 0.84,
          "score_label": "excellent",
          "ats_score_id": "uuid"
        }
      }
    """
    svcs = get_services()
    if not svcs or not svcs.resume_builder:
        return error("Resume builder unavailable.", code="SERVICE_UNAVAILABLE", status=503)

    data, err = parse_body(SaveDraftSchema)
    if err:
        return err

    # Convert validated nested dict back to plain dict for the service
    edited = dict(data["content"]) if data.get("content") else None

    result = svcs.resume_builder.save_draft(
        draft_id=data["draft_id"],
        candidate_id=g.user_id,
        edited_content=edited,
    )

    if result.error:
        if "not found" in result.error.lower():
            return error(result.error, code="BUILDER_DRAFT_NOT_FOUND", status=404)
        if "access denied" in result.error.lower():
            return error(result.error, code="BUILDER_DRAFT_ACCESS_DENIED", status=403)
        if "finalized" in result.error.lower():
            return error(result.error, code="BUILDER_ALREADY_FINALIZED", status=422)
        return error(result.error, code="BUILDER_GENERATION_FAILED", status=500)

    return created(
        data={
            "resume_id":    result.resume_id,
            "draft_id":     result.draft_id,
            "final_score":  result.final_score,
            "score_label":  result.score_label,
            "ats_score_id": result.ats_score_id,
        },
        message=(
            f"Resume saved successfully. "
            f"Final ATS score: {result.final_score:.0%} ({result.score_label})."
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /resume-builder/drafts
# ─────────────────────────────────────────────────────────────────────────────

@resume_builder_bp.get("/drafts")
@require_auth("candidate")
def list_drafts():
    """
    GET /api/v1/resume-builder/drafts
        ?status=draft|refined|finalized&page=1&limit=20

    List all drafts for the authenticated candidate (compact view).
    """
    svcs = get_services()
    if not svcs or not svcs.resume_builder:
        return error("Resume builder unavailable.", code="SERVICE_UNAVAILABLE", status=503)

    params, err = parse_query(DraftListQuerySchema)
    if err:
        return err

    from app.repositories.resume_draft import ResumeDraftRepository
    repo = ResumeDraftRepository()
    drafts, total = repo.list_by_candidate(
        candidate_id=g.user_id,
        status=params.get("status"),
        page=params["page"],
        limit=params["limit"],
    )

    return success_list(
        data=[d.to_dict_list() for d in drafts],
        total=total,
        page=params["page"],
        limit=params["limit"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /resume-builder/drafts/<draft_id>
# ─────────────────────────────────────────────────────────────────────────────

@resume_builder_bp.get("/drafts/<draft_id>")
@require_auth("candidate")
def get_draft(draft_id: str):
    """
    GET /api/v1/resume-builder/drafts/<draft_id>

    Returns the full draft including generated_content JSON.
    """
    from app.repositories.resume_draft import ResumeDraftRepository
    draft = ResumeDraftRepository().get_by_id(draft_id)

    if not draft or draft.is_deleted:
        return error(f"Draft '{draft_id}' not found.", code="BUILDER_DRAFT_NOT_FOUND", status=404)
    if draft.candidate_id != g.user_id:
        return error("Access denied.", code="BUILDER_DRAFT_ACCESS_DENIED", status=403)

    return success(data=draft.to_dict())


# ─────────────────────────────────────────────────────────────────────────────
# POST /resume-builder/drafts/<draft_id>/feedback  (learning hook)
# ─────────────────────────────────────────────────────────────────────────────

@resume_builder_bp.post("/drafts/<draft_id>/feedback")
@require_auth("candidate")
def record_feedback(draft_id: str):
    """
    POST /api/v1/resume-builder/drafts/<draft_id>/feedback

    Store recruiter outcome feedback on a finalized draft.

    This is the LEARNING HOOK endpoint. Data written here is never read
    by the current scoring engine — it is stored for future adaptive
    weighting without requiring model retraining.

    Request body:
      {
        "shortlisted":     true,
        "interview_stage": "technical",   -- optional
        "hired":           false          -- optional
      }

    Response: 200 OK with updated draft summary.
    """
    from app.repositories.resume_draft import ResumeDraftRepository
    repo = ResumeDraftRepository()

    draft = repo.get_by_id(draft_id)
    if not draft or draft.is_deleted:
        return error(f"Draft '{draft_id}' not found.", code="BUILDER_DRAFT_NOT_FOUND", status=404)
    if draft.candidate_id != g.user_id:
        return error("Access denied.", code="BUILDER_DRAFT_ACCESS_DENIED", status=403)

    data, err = parse_body(FeedbackSchema)
    if err:
        return err

    repo.record_feedback(draft_id, data)
    # No explicit commit — after_request middleware commits all 2xx writes atomically.

    return success(message="Feedback recorded. Thank you — this improves future recommendations.")


# ─────────────────────────────────────────────────────────────────────────────
# Private serialisation helpers
# ─────────────────────────────────────────────────────────────────────────────

def _serialise_preview(preview) -> dict:
    return {
        "final_score":           preview.final_score,
        "label":                 preview.label,
        "keyword_score":         preview.keyword_score,
        "semantic_score":        preview.semantic_score,
        "experience_score":      preview.experience_score,
        "section_quality_score": preview.section_quality_score,
        "matched_skills":        preview.matched_skills,
        "missing_skills":        preview.missing_skills,
    }


def _serialise_build_result(result) -> dict:
    return {
        "draft_id":       result.draft_id,
        "content":        result.content,
        "ats_preview":    _serialise_preview(result.ats_preview),
        "template":       result.template,
        "job_id":         result.job_id,
        "job_title":      result.job_title,
        "iteration_count": result.iteration_count,
        "llm_used":       result.llm_used,
    }
