"""
app/api/v1/candidates.py

Candidates resource — REST endpoints for candidate profiles.

Routes:
  GET    /candidates/              — paginated list with filters
  POST   /candidates/              — create candidate profile
  GET    /candidates/<id>          — get single candidate (with resumes)
  PATCH  /candidates/<id>          — update profile fields
  DELETE /candidates/<id>          — soft-delete candidate
  POST   /candidates/<id>/resumes  — upload resume file (multipart/form-data)
  GET    /candidates/<id>/resumes  — list all resumes for candidate
  POST   /candidates/<id>/recommendations — job recommendations for candidate
"""

import logging
import os
import uuid

from flask import Blueprint, current_app, request

from app.core.responses import created, error, no_content, success, success_list
from app.schemas.candidate import CandidateQuerySchema, CreateCandidateSchema, UpdateCandidateSchema

from ._helpers import (
    get_services,
    parse_body,
    parse_query,
    serialize_candidate,
    serialize_resume,
)

logger = logging.getLogger(__name__)

candidates_bp = Blueprint("candidates", __name__)

# ─────────────────────────────────────────────────────────────────────────────
# List + Create
# ─────────────────────────────────────────────────────────────────────────────

@candidates_bp.get("/")
def list_candidates():
    """
    GET /api/v1/candidates/

    Query params: page, limit, search, open_to_work, location
    """
    params, err = parse_query(CandidateQuerySchema)
    if err:
        return err


    # Access repo directly through service factory repos
    try:
        from app.repositories import CandidateRepository
        repo = CandidateRepository()
        items, total = repo.list_active(
            page=params["page"],
            limit=params["limit"],
            search=params.get("search"),
            open_to_work=params.get("open_to_work"),
            location=params.get("location"),
        )
        return success_list(
            data=[serialize_candidate(c) for c in items],
            total=total,
            page=params["page"],
            limit=params["limit"],
            message="Candidates retrieved.",
        )
    except Exception as exc:
        logger.error("list_candidates failed", exc_info=True)
        return error("Failed to retrieve candidates.", code="INTERNAL_ERROR", status=500)


@candidates_bp.post("/")
def create_candidate():
    """
    POST /api/v1/candidates/

    Body: { full_name, email, phone?, location?, headline?, ... }
    """
    data, err = parse_body(CreateCandidateSchema)
    if err:
        return err

    try:
        from app.repositories import CandidateRepository
        from app.models.candidate import Candidate

        repo = CandidateRepository()

        if repo.email_exists(data["email"]):
            return error(
                f"A candidate with email '{data['email']}' already exists.",
                code="CANDIDATE_EMAIL_CONFLICT",
                status=409,
            )

        candidate = Candidate()
        candidate.id       = str(uuid.uuid4())
        candidate.full_name = data["full_name"]
        candidate.email     = data["email"].lower().strip()
        candidate.phone     = data.get("phone")
        candidate.location  = data.get("location")
        candidate.headline  = data.get("headline")
        candidate.linkedin_url  = data.get("linkedin_url")
        candidate.github_url    = data.get("github_url")
        candidate.portfolio_url = data.get("portfolio_url")
        candidate.open_to_work  = data.get("open_to_work", True)
        candidate.preferred_roles_list     = data.get("preferred_roles", [])
        candidate.preferred_locations_list = data.get("preferred_locations", [])

        repo.save(candidate)

        logger.info("Candidate created", extra={"candidate_id": candidate.id})
        return created(
            data=serialize_candidate(candidate),
            message="Candidate profile created successfully.",
        )
    except Exception as exc:
        logger.error("create_candidate failed", exc_info=True)
        return error("Failed to create candidate.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# Single resource
# ─────────────────────────────────────────────────────────────────────────────

@candidates_bp.get("/<candidate_id>")
def get_candidate(candidate_id: str):
    """
    GET /api/v1/candidates/<candidate_id>

    Returns candidate profile with their resumes embedded.
    """
    try:
        from app.repositories import CandidateRepository
        repo = CandidateRepository()
        candidate = repo.get_with_resumes(candidate_id)

        if not candidate or candidate.is_deleted:
            return error(
                f"Candidate '{candidate_id}' not found.",
                code="CANDIDATE_NOT_FOUND",
                status=404,
            )

        data = serialize_candidate(candidate)
        # Embed active resumes
        active_resumes = [
            r for r in (getattr(candidate, "resumes", []) or [])
            if not getattr(r, "is_deleted", False)
        ]
        data["resumes"] = [serialize_resume(r) for r in active_resumes]

        return success(data=data, message="Candidate retrieved.")
    except Exception:
        logger.error("get_candidate failed", exc_info=True)
        return error("Failed to retrieve candidate.", code="INTERNAL_ERROR", status=500)


@candidates_bp.patch("/<candidate_id>")
def update_candidate(candidate_id: str):
    """
    PATCH /api/v1/candidates/<candidate_id>

    Partial update — only provided fields are changed.
    """
    data, err = parse_body(UpdateCandidateSchema)
    if err:
        return err

    try:
        from app.repositories import CandidateRepository
        repo = CandidateRepository()
        candidate = repo.get_by_id(candidate_id)

        if not candidate or getattr(candidate, "is_deleted", False):
            return error(
                f"Candidate '{candidate_id}' not found.",
                code="CANDIDATE_NOT_FOUND",
                status=404,
            )

        _UPDATEABLE = (
            "full_name", "phone", "location", "headline",
            "linkedin_url", "github_url", "portfolio_url", "open_to_work",
        )
        for field in _UPDATEABLE:
            if field in data:
                setattr(candidate, field, data[field])

        if "preferred_roles" in data:
            candidate.preferred_roles_list = data["preferred_roles"]
        if "preferred_locations" in data:
            candidate.preferred_locations_list = data["preferred_locations"]

        repo.save(candidate)

        logger.info("Candidate updated", extra={"candidate_id": candidate_id})
        return success(data=serialize_candidate(candidate), message="Candidate updated.")
    except Exception:
        logger.error("update_candidate failed", exc_info=True)
        return error("Failed to update candidate.", code="INTERNAL_ERROR", status=500)


@candidates_bp.delete("/<candidate_id>")
def delete_candidate(candidate_id: str):
    """
    DELETE /api/v1/candidates/<candidate_id>

    Soft-deletes the candidate (sets is_deleted=True).
    """
    try:
        from app.repositories import CandidateRepository
        repo = CandidateRepository()
        candidate = repo.get_by_id(candidate_id)

        if not candidate or getattr(candidate, "is_deleted", False):
            return error(
                f"Candidate '{candidate_id}' not found.",
                code="CANDIDATE_NOT_FOUND",
                status=404,
            )

        repo.soft_delete(candidate)
        logger.info("Candidate deleted", extra={"candidate_id": candidate_id})
        return no_content()
    except Exception:
        logger.error("delete_candidate failed", exc_info=True)
        return error("Failed to delete candidate.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# Resume sub-resource
# ─────────────────────────────────────────────────────────────────────────────

@candidates_bp.get("/<candidate_id>/resumes")
def list_candidate_resumes(candidate_id: str):
    """
    GET /api/v1/candidates/<candidate_id>/resumes

    Query params: page, limit
    """
    page  = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 100)

    try:
        from app.repositories import CandidateRepository, ResumeRepository
        if not CandidateRepository().get_by_id(candidate_id):
            return error(f"Candidate '{candidate_id}' not found.", code="CANDIDATE_NOT_FOUND", status=404)

        items, total = ResumeRepository().list_by_candidate(
            candidate_id, active_only=False, page=page, limit=limit
        )
        return success_list(
            data=[serialize_resume(r) for r in items],
            total=total, page=page, limit=limit,
            message="Resumes retrieved.",
        )
    except Exception:
        logger.error("list_candidate_resumes failed", exc_info=True)
        return error("Failed to retrieve resumes.", code="INTERNAL_ERROR", status=500)


@candidates_bp.post("/<candidate_id>/resumes")
def upload_resume(candidate_id: str):
    """
    POST /api/v1/candidates/<candidate_id>/resumes

    Content-Type: multipart/form-data
    Field:  file  — PDF or DOCX resume file
    """
    # ── 1. Validate candidate exists ─────────────────────────────────────────
    try:
        from app.repositories import CandidateRepository
        if not CandidateRepository().get_by_id(candidate_id):
            return error(
                f"Candidate '{candidate_id}' not found.",
                code="CANDIDATE_NOT_FOUND",
                status=404,
            )
    except Exception:
        logger.error("upload_resume: candidate lookup failed", exc_info=True)
        return error("Failed to verify candidate.", code="INTERNAL_ERROR", status=500)

    # ── 2. Validate uploaded file ─────────────────────────────────────────────
    if "file" not in request.files:
        return error("No file field in request.", code="NO_FILE_UPLOADED", status=400)

    file = request.files["file"]
    if not file or not file.filename:
        return error("Empty file uploaded.", code="EMPTY_FILE", status=400)

    filename     = file.filename.lower()
    allowed_exts = {".pdf", ".docx"}
    ext          = os.path.splitext(filename)[1]
    if ext not in allowed_exts:
        return error(
            f"Unsupported file type '{ext}'. Allowed: PDF, DOCX.",
            code="UNSUPPORTED_FILE_TYPE",
            status=415,
        )

    # ── 3. Persist file ───────────────────────────────────────────────────────
    upload_dir = current_app.config.get("UPLOAD_FOLDER", "/tmp/uploads")
    os.makedirs(upload_dir, exist_ok=True)

    resume_id    = str(uuid.uuid4())
    safe_name    = f"{resume_id}{ext}"
    file_path    = os.path.join(upload_dir, safe_name)

    try:
        file.save(file_path)
        file_bytes = os.path.getsize(file_path)
    except OSError as exc:
        logger.error("Failed to save resume file", exc_info=True)
        return error("Failed to save uploaded file.", code="UPLOAD_FAILED", status=500)

    # ── 4. Create Resume record ───────────────────────────────────────────────
    try:
        from app.models.resume import Resume
        from app.models.enums import ParseStatus
        from app.repositories import ResumeRepository

        resume = Resume()
        resume.id            = resume_id
        resume.candidate_id  = candidate_id
        resume.file_name     = file.filename
        resume.file_path     = file_path
        resume.file_size_bytes = file_bytes
        resume.content_type  = file.content_type or f"application/{ext.lstrip('.')}"
        resume.parse_status  = ParseStatus.PENDING
        resume.is_active     = True

        repo = ResumeRepository()
        repo.save(resume)
    except Exception:
        logger.error("Failed to create Resume record", exc_info=True)
        # Clean up saved file
        try:
            os.unlink(file_path)
        except OSError:
            pass
        return error("Failed to register resume.", code="INTERNAL_ERROR", status=500)

    # ── 5. Trigger parse (synchronous in web context) ─────────────────────────
    try:
        svcs = get_services()
        parse_result = svcs.resume_parser.parse(file_path)

        if parse_result.success:
            from app.models.enums import ParseStatus
            resume.parse_status             = ParseStatus.SUCCESS
            resume.skills_list              = parse_result.skills
            resume.education_list           = parse_result.education
            resume.experience_list          = parse_result.experience
            resume.certifications_list      = parse_result.certifications
            resume.projects_list            = parse_result.projects
            resume.summary_text             = parse_result.summary_text
            resume.raw_text                 = parse_result.raw_text
            resume.total_experience_years   = parse_result.experience_years
            resume.skill_count              = len(parse_result.skills)
            repo.save(resume)
            logger.info("Resume parsed successfully", extra={"resume_id": resume_id})
        else:
            from app.models.enums import ParseStatus
            resume.parse_status    = ParseStatus.FAILED
            resume.parse_error_msg = parse_result.parse_error
            repo.save(resume)
            logger.warning(
                "Resume parse failed",
                extra={"resume_id": resume_id, "error": parse_result.parse_error},
            )
    except Exception:
        logger.error("Resume parse error (non-fatal)", exc_info=True)

    return created(
        data=serialize_resume(resume),
        message="Resume uploaded successfully. Parsing complete." if getattr(resume, "parse_status", None) and
                resume.parse_status.value == "success" else "Resume uploaded. Parsing in progress.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Job Recommendations sub-resource
# ─────────────────────────────────────────────────────────────────────────────

@candidates_bp.post("/<candidate_id>/recommendations")
def get_job_recommendations(candidate_id: str):
    """
    POST /api/v1/candidates/<candidate_id>/recommendations

    Returns ranked job recommendations for the candidate's active resume.

    Body (optional): { top_n, min_score, location, job_type }
    """
    body = request.get_json(silent=True) or {}
    top_n     = int(body.get("top_n", 10))
    min_score = float(body.get("min_score", 0.0))
    location  = body.get("location")
    job_type  = body.get("job_type")

    top_n = min(max(top_n, 1), 50)
    min_score = min(max(min_score, 0.0), 1.0)

    try:
        from app.repositories import CandidateRepository, ResumeRepository
        candidate = CandidateRepository().get_by_id(candidate_id)
        if not candidate:
            return error(f"Candidate '{candidate_id}' not found.", code="CANDIDATE_NOT_FOUND", status=404)

        resume = ResumeRepository().get_active_resume(candidate_id)
        if not resume:
            return error(
                "No parsed resume found for this candidate. Upload a resume first.",
                code="NO_ACTIVE_RESUME",
                status=404,
            )

        svcs = get_services()
        recommendations = svcs.job_recommendations.recommend(
            resume=resume,
            top_n=top_n,
            min_score=min_score,
            location=location,
            job_type=job_type,
        )

        return success(
            data=[r.__dict__ for r in recommendations],
            message=f"{len(recommendations)} job recommendations retrieved.",
        )
    except Exception:
        logger.error("get_job_recommendations failed", exc_info=True)
        return error("Failed to retrieve job recommendations.", code="INTERNAL_ERROR", status=500)
