"""
app/api/v1/auth.py

Authentication blueprint — identity lookup and account creation by role.

Design:
  This platform has NO passwords and NO JWT tokens.  Auth is pure identity
  selection: the browser stores { role, userId, userName } in Zustand
  (localStorage).  All API routes are open — there is nothing to sign or
  verify server-side.

  The auth blueprint exists to give the frontend a clean, explicit contract
  for the login/register flow rather than having it call the generic
  candidates/recruiters CRUD endpoints directly.  This also means we can
  add real auth later (e.g. passwords, OAuth) by replacing only this file.

Routes:
  POST /api/v1/auth/login                  — look up existing user by email + role
  POST /api/v1/auth/register/candidate     — create new Candidate account
  POST /api/v1/auth/register/recruiter     — create new Recruiter account
  GET  /api/v1/auth/me                     — re-validate stored session on page load

Response shape (success):
  {
    "success": true,
    "message": "...",
    "data": {
      "role":    "candidate" | "recruiter",
      "user_id": "<uuid>",
      "user":    { ...full candidate or recruiter object... }
    }
  }

Error codes:
  USER_NOT_FOUND           404  Email not registered for the given role
  CANDIDATE_EMAIL_CONFLICT 409  Email already registered as a candidate
  RECRUITER_EMAIL_CONFLICT 409  Email already registered as a recruiter
  VALIDATION_ERROR         400  Bad / missing request fields
  INTERNAL_ERROR           500  Unexpected server error
"""

import logging
import uuid

from flask import Blueprint

from app.core.responses import created, error, success
from app.schemas.auth import (
    LoginSchema,
    MeQuerySchema,
    RegisterCandidateSchema,
    RegisterRecruiterSchema,
)
from ._helpers import (
    parse_body,
    parse_query,
    serialize_candidate,
    serialize_recruiter,
)

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helper
# ─────────────────────────────────────────────────────────────────────────────

def _auth_payload(role: str, user_id: str, user: dict) -> dict:
    """
    Build the standard auth response payload.

    Every successful auth response returns exactly this shape so the
    frontend Zustand store can consume it without any role branching.
    """
    return {
        "role":    role,
        "user_id": user_id,
        "user":    user,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/login
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.post("/login")
def login():
    """
    POST /api/v1/auth/login

    Look up an existing user by email + role.  No password — pure identity
    selection.  Uses get_by_email() for an exact case-insensitive DB lookup
    rather than the list search used by the generic CRUD endpoints, so there
    is no pagination edge-case risk.

    Body:
      email  (string, required) — the registered email address
      role   (string, required) — "candidate" or "recruiter"

    Returns:
      200  { role, user_id, user }   — user found
      404  USER_NOT_FOUND            — no account for this email + role
      400  VALIDATION_ERROR          — invalid body
      500  INTERNAL_ERROR            — database failure
    """
    data, err = parse_body(LoginSchema)
    if err:
        return err

    email: str = data["email"].lower().strip()
    role: str  = data["role"]

    try:
        if role == "candidate":
            from app.repositories import CandidateRepository
            user = CandidateRepository().get_by_email(email)

            if not user or not getattr(user, "is_active", True):
                return error(
                    f"No candidate account found for '{email}'.",
                    code="USER_NOT_FOUND",
                    status=404,
                )

            serialized = serialize_candidate(user)
            logger.info("Candidate login", extra={"candidate_id": user.id})
            return success(
                data=_auth_payload("candidate", user.id, serialized),
                message="Login successful.",
            )

        else:  # role == "recruiter"
            from app.repositories import RecruiterRepository
            user = RecruiterRepository().get_by_email(email)

            if not user or not getattr(user, "is_active", True):
                return error(
                    f"No recruiter account found for '{email}'.",
                    code="USER_NOT_FOUND",
                    status=404,
                )

            serialized = serialize_recruiter(user)
            logger.info("Recruiter login", extra={"recruiter_id": user.id})
            return success(
                data=_auth_payload("recruiter", user.id, serialized),
                message="Login successful.",
            )

    except Exception:
        logger.error("login failed", exc_info=True)
        return error(
            "Login failed due to a server error.",
            code="INTERNAL_ERROR",
            status=500,
        )


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/register/candidate
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.post("/register/candidate")
def register_candidate():
    """
    POST /api/v1/auth/register/candidate

    Create a new Candidate account.

    Body:
      full_name           (string,   required)
      email               (string,   required)
      phone               (string,   optional)
      location            (string,   optional)
      headline            (string,   optional)
      open_to_work        (boolean,  optional, default: true)
      preferred_roles     (string[], optional)
      preferred_locations (string[], optional)
      linkedin_url        (url,      optional)
      github_url          (url,      optional)
      portfolio_url       (url,      optional)

    Returns:
      201  { role, user_id, user }        — created
      409  CANDIDATE_EMAIL_CONFLICT       — email already registered
      400  VALIDATION_ERROR               — invalid body
      500  INTERNAL_ERROR                 — database failure
    """
    data, err = parse_body(RegisterCandidateSchema)
    if err:
        return err

    try:
        from app.repositories import CandidateRepository
        from app.models.candidate import Candidate

        repo  = CandidateRepository()
        email = data["email"].lower().strip()

        if repo.email_exists(email):
            return error(
                f"A candidate account with email '{email}' already exists.",
                code="CANDIDATE_EMAIL_CONFLICT",
                status=409,
            )

        candidate                           = Candidate()
        candidate.id                        = str(uuid.uuid4())
        candidate.full_name                 = data["full_name"]
        candidate.email                     = email
        candidate.phone                     = data.get("phone")
        candidate.location                  = data.get("location")
        candidate.headline                  = data.get("headline")
        candidate.open_to_work              = data.get("open_to_work", True)
        candidate.preferred_roles_list      = data.get("preferred_roles", [])
        candidate.preferred_locations_list  = data.get("preferred_locations", [])
        candidate.linkedin_url              = data.get("linkedin_url")
        candidate.github_url                = data.get("github_url")
        candidate.portfolio_url             = data.get("portfolio_url")

        repo.save(candidate)

        serialized = serialize_candidate(candidate)
        logger.info("Candidate registered", extra={"candidate_id": candidate.id})
        return created(
            data=_auth_payload("candidate", candidate.id, serialized),
            message="Candidate account created successfully.",
        )

    except Exception:
        logger.error("register_candidate failed", exc_info=True)
        return error(
            "Registration failed due to a server error.",
            code="INTERNAL_ERROR",
            status=500,
        )


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/register/recruiter
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.post("/register/recruiter")
def register_recruiter():
    """
    POST /api/v1/auth/register/recruiter

    Create a new Recruiter account.

    Body:
      full_name    (string, required)
      email        (string, required)
      company_name (string, required)
      company_size (string, optional) — "1-10"|"11-50"|"51-200"|"201-500"|"500+"
      industry     (string, optional)
      phone        (string, optional)
      website_url  (url,    optional)
      linkedin_url (url,    optional)

    Returns:
      201  { role, user_id, user }        — created
      409  RECRUITER_EMAIL_CONFLICT       — email already registered
      400  VALIDATION_ERROR               — invalid body
      500  INTERNAL_ERROR                 — database failure
    """
    data, err = parse_body(RegisterRecruiterSchema)
    if err:
        return err

    try:
        from app.repositories import RecruiterRepository
        from app.models.recruiter import Recruiter

        repo  = RecruiterRepository()
        email = data["email"].lower().strip()

        if repo.email_exists(email):
            return error(
                f"A recruiter account with email '{email}' already exists.",
                code="RECRUITER_EMAIL_CONFLICT",
                status=409,
            )

        recruiter              = Recruiter()
        recruiter.id           = str(uuid.uuid4())
        recruiter.full_name    = data["full_name"]
        recruiter.email        = email
        recruiter.company_name = data["company_name"]
        recruiter.company_size = data.get("company_size")
        recruiter.industry     = data.get("industry")
        recruiter.phone        = data.get("phone")
        recruiter.website_url  = data.get("website_url")
        recruiter.linkedin_url = data.get("linkedin_url")

        repo.save(recruiter)

        serialized = serialize_recruiter(recruiter)
        logger.info("Recruiter registered", extra={"recruiter_id": recruiter.id})
        return created(
            data=_auth_payload("recruiter", recruiter.id, serialized),
            message="Recruiter account created successfully.",
        )

    except Exception:
        logger.error("register_recruiter failed", exc_info=True)
        return error(
            "Registration failed due to a server error.",
            code="INTERNAL_ERROR",
            status=500,
        )


# ─────────────────────────────────────────────────────────────────────────────
# GET /auth/me
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.get("/me")
def me():
    """
    GET /api/v1/auth/me?role=<role>&user_id=<uuid>

    Re-validate the Zustand-persisted session on page load.  The client
    stores { role, userId } in localStorage.  On app boot it calls this
    endpoint to confirm the account still exists and is active before
    trusting the stored state.  If this returns 404 the client should
    clear its Zustand store and redirect to /login.

    Query params:
      role    (string, required) — "candidate" or "recruiter"
      user_id (string, required) — the UUID stored in Zustand

    Returns:
      200  { role, user_id, user }   — account valid, session confirmed
      404  USER_NOT_FOUND            — account deleted or deactivated
      400  VALIDATION_ERROR          — missing or invalid query params
      500  INTERNAL_ERROR            — database failure
    """
    params, err = parse_query(MeQuerySchema)
    if err:
        return err

    role:    str = params["role"]
    user_id: str = params["user_id"]

    try:
        if role == "candidate":
            from app.repositories import CandidateRepository
            user = CandidateRepository().get_by_id(user_id)

            if not user or not getattr(user, "is_active", True):
                return error(
                    "Candidate account not found or has been deactivated.",
                    code="USER_NOT_FOUND",
                    status=404,
                )

            return success(
                data=_auth_payload("candidate", user.id, serialize_candidate(user)),
                message="Session valid.",
            )

        else:  # role == "recruiter"
            from app.repositories import RecruiterRepository
            user = RecruiterRepository().get_by_id(user_id)

            if not user or not getattr(user, "is_active", True):
                return error(
                    "Recruiter account not found or has been deactivated.",
                    code="USER_NOT_FOUND",
                    status=404,
                )

            return success(
                data=_auth_payload("recruiter", user.id, serialize_recruiter(user)),
                message="Session valid.",
            )

    except Exception:
        logger.error("me failed", exc_info=True)
        return error(
            "Session check failed due to a server error.",
            code="INTERNAL_ERROR",
            status=500,
        )