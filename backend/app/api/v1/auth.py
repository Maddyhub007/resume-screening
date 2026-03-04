"""
app/api/v1/auth.py

Authentication resource — JWT-based login, registration and token lifecycle.

Routes
──────
  POST  /auth/register/candidate  — create candidate account, return tokens
  POST  /auth/register/recruiter  — create recruiter account, return tokens
  POST  /auth/login               — verify credentials, return tokens
  POST  /auth/refresh             — rotate refresh token, return new access token
  POST  /auth/logout              — revoke refresh token (current device)
  POST  /auth/logout-all          — revoke all refresh tokens for this user
  GET   /auth/me                  — return current user profile from JWT
  POST  /auth/change-password     — update password (requires current password)

Token delivery
──────────────
  Access token  → JSON response body  { data.access_token }
  Refresh token → HttpOnly Secure SameSite=Strict cookie  'refresh_token'

  The access token is short-lived (15 min).  The frontend keeps it in memory
  (never localStorage).  On expiry it calls POST /auth/refresh which reads the
  cookie, validates the stored refresh token, issues a new pair, and rotates
  the cookie.

Error codes
───────────
  CANDIDATE_EMAIL_CONFLICT  409  email already registered as candidate
  RECRUITER_EMAIL_CONFLICT  409  email already registered as recruiter
  INVALID_CREDENTIALS       401  wrong email or password (deliberately vague)
  MISSING_TOKEN             401  Authorization header absent
  TOKEN_EXPIRED             401  access token exp passed; client should refresh
  REFRESH_EXPIRED           401  refresh token expired; full login required
  INVALID_TOKEN             403  bad signature, wrong type, tampered payload
  FORBIDDEN                 403  authenticated but wrong role
  TOKEN_REUSED              401  refresh token already used or revoked
  VALIDATION_ERROR          400  request body failed schema validation
  INTERNAL_ERROR            500  unexpected server error
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta

from flask import Blueprint, g, make_response, request

from app.core.responses import created, error, success
from app.core.security import (
    create_tokens,
    decode_refresh_token,
    get_current_user,
    hash_password,
    require_auth,
    verify_password,
    AuthError,
)
from app.schemas.auth import (
    ChangePasswordSchema,
    LoginSchema,
    RegisterCandidateSchema,
    RegisterRecruiterSchema,
)

from ._helpers import parse_body, serialize_candidate, serialize_recruiter

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)

# Refresh token cookie settings — centralised so they're consistent across
# set, rotate, and clear operations.
_COOKIE_NAME     = "refresh_token"
_COOKIE_MAX_AGE  = 7 * 24 * 60 * 60   # 7 days in seconds
_COOKIE_SECURE   = True                # HTTPS only; overridden to False in tests
_COOKIE_HTTPONLY = True
_COOKIE_SAMESITE = "Strict"


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _cookie_secure() -> bool:
    """Return False in testing so cookies work over plain HTTP."""
    from flask import current_app
    return not current_app.config.get("TESTING", False)


def _set_refresh_cookie(response, refresh_token: str) -> None:
    """Attach the refresh token as a hardened HttpOnly cookie."""
    response.set_cookie(
        _COOKIE_NAME,
        refresh_token,
        max_age=_COOKIE_MAX_AGE,
        httponly=_COOKIE_HTTPONLY,
        secure=_cookie_secure(),
        samesite=_COOKIE_SAMESITE,
        path="/api/v1/auth",   # scope cookie to auth routes only
    )


def _clear_refresh_cookie(response) -> None:
    """Expire the refresh cookie immediately."""
    response.set_cookie(
        _COOKIE_NAME,
        "",
        max_age=0,
        httponly=_COOKIE_HTTPONLY,
        secure=_cookie_secure(),
        samesite=_COOKIE_SAMESITE,
        path="/api/v1/auth",
    )


def _store_refresh_token(jti: str, raw_refresh: str, user_id: str, role: str) -> None:
    """Persist a hashed refresh token to the DB."""
    from app.models.refresh_token import RefreshToken

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    rt = RefreshToken.create(
        jti=jti,
        raw_token=raw_refresh,
        user_id=user_id,
        role=role,
        expires_at=expires_at,
    )
    rt.save()


def _auth_response(user_dict: dict, role: str, status: int = 200):
    """
    Build the standard auth success response.

    Returns a Flask Response object (not a tuple) so we can attach the
    refresh cookie before returning.
    """
    from app.core.security import create_tokens

    user_id       = user_dict["id"]
    access, refresh, jti = create_tokens(user_id, role)

    _store_refresh_token(jti, refresh, user_id, role)

    body = {
        "success": True,
        "message": "Authentication successful.",
        "data": {
            "access_token": access,
            "token_type":   "Bearer",
            "expires_in":   15 * 60,     # seconds
            "role":         role,
            "user":         user_dict,
        },
    }

    from flask import jsonify
    response = make_response(jsonify(body), status)
    _set_refresh_cookie(response, refresh)
    return response


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/register/candidate
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.post("/register/candidate")
def register_candidate():
    """
    POST /api/v1/auth/register/candidate

    Body: { full_name, email, password, phone?, location?, headline?,
            open_to_work?, preferred_roles?, preferred_locations?,
            linkedin_url?, github_url?, portfolio_url? }

    Returns: 201 + access token in body + refresh token in HttpOnly cookie.
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
                f"An account for '{email}' already exists.",
                code="CANDIDATE_EMAIL_CONFLICT",
                status=409,
            )

        candidate                           = Candidate()
        candidate.id                        = str(uuid.uuid4())
        candidate.full_name                 = data["full_name"]
        candidate.email                     = email
        candidate.password_hash             = hash_password(data["password"])
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
        logger.info("Candidate registered", extra={"candidate_id": candidate.id})

        return _auth_response(serialize_candidate(candidate), "candidate", status=201)

    except Exception:
        logger.error("register_candidate failed", exc_info=True)
        return error("Registration failed. Please try again.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/register/recruiter
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.post("/register/recruiter")
def register_recruiter():
    """
    POST /api/v1/auth/register/recruiter

    Body: { full_name, email, password, company_name, company_size?,
            industry?, phone?, website_url?, linkedin_url? }

    Returns: 201 + access token in body + refresh token in HttpOnly cookie.
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
                f"An account for '{email}' already exists.",
                code="RECRUITER_EMAIL_CONFLICT",
                status=409,
            )

        recruiter              = Recruiter()
        recruiter.id           = str(uuid.uuid4())
        recruiter.full_name    = data["full_name"]
        recruiter.email        = email
        recruiter.password_hash = hash_password(data["password"])
        recruiter.company_name = data["company_name"]
        recruiter.company_size = data.get("company_size")
        recruiter.industry     = data.get("industry")
        recruiter.phone        = data.get("phone")
        recruiter.website_url  = data.get("website_url")
        recruiter.linkedin_url = data.get("linkedin_url")

        repo.save(recruiter)
        logger.info("Recruiter registered", extra={"recruiter_id": recruiter.id})

        return _auth_response(serialize_recruiter(recruiter), "recruiter", status=201)

    except Exception:
        logger.error("register_recruiter failed", exc_info=True)
        return error("Registration failed. Please try again.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/login
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.post("/login")
def login():
    """
    POST /api/v1/auth/login

    Body: { email, password, role }

    Deliberately vague on failure to prevent user enumeration:
    both 'email not found' and 'wrong password' return INVALID_CREDENTIALS 401.
    """
    data, err = parse_body(LoginSchema)
    if err:
        return err

    email    = data["email"].lower().strip()
    password = data["password"]
    role     = data["role"]

    _INVALID = lambda: error(  # noqa: E731
        "Invalid email or password.",
        code="INVALID_CREDENTIALS",
        status=401,
    )

    try:
        if role == "candidate":
            from app.repositories import CandidateRepository
            user = CandidateRepository().get_by_email(email)
            if not user or not getattr(user, "is_active", True):
                return _INVALID()
            if not verify_password(password, getattr(user, "password_hash", "") or ""):
                return _INVALID()

            logger.info("Candidate login", extra={"candidate_id": user.id})
            return _auth_response(serialize_candidate(user), "candidate")

        else:  # recruiter
            from app.repositories import RecruiterRepository
            user = RecruiterRepository().get_by_email(email)
            if not user or not getattr(user, "is_active", True):
                return _INVALID()
            if not verify_password(password, getattr(user, "password_hash", "") or ""):
                return _INVALID()

            logger.info("Recruiter login", extra={"recruiter_id": user.id})
            return _auth_response(serialize_recruiter(user), "recruiter")

    except Exception:
        logger.error("login failed", exc_info=True)
        return error("Login failed. Please try again.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/refresh
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.post("/refresh")
def refresh():
    """
    POST /api/v1/auth/refresh

    Reads the 'refresh_token' HttpOnly cookie.
    Validates the JWT signature and checks the DB record is not revoked.
    Issues a new access + refresh token pair (rotation).
    The old refresh token is revoked immediately after the new one is issued.

    This endpoint is intentionally not protected by require_auth — it is the
    mechanism used to obtain a new access token after expiry.
    """
    raw_refresh = request.cookies.get(_COOKIE_NAME)
    if not raw_refresh:
        return error(
            "Refresh token cookie missing. Please log in again.",
            code="MISSING_TOKEN",
            status=401,
        )

    try:
        payload = decode_refresh_token(raw_refresh)
    except AuthError as exc:
        resp = make_response(
            *error(str(exc), code=exc.code, status=401)
        )
        _clear_refresh_cookie(resp)
        return resp

    jti     = payload["jti"]
    user_id = payload["sub"]
    role    = payload["role"]

    # DB check: must exist and not be revoked
    from app.models.refresh_token import RefreshToken
    stored = RefreshToken.get_by_jti(jti)

    if not stored or not stored.is_valid():
        # Token reuse or revoked — nuke the cookie and force re-login
        resp = make_response(
            *error(
                "Refresh token is invalid or has been revoked. Please log in again.",
                code="TOKEN_REUSED",
                status=401,
            )
        )
        _clear_refresh_cookie(resp)
        # If stored exists but was already revoked, this may indicate a
        # token theft — revoke ALL tokens for this user as a precaution.
        if stored and stored.revoked:
            RefreshToken.revoke_all_for_user(user_id)
            logger.warning(
                "Possible refresh token theft detected — all tokens revoked.",
                extra={"user_id": user_id, "role": role},
            )
        return resp

    # Revoke old token, issue new pair
    try:
        stored.revoke()

        if role == "candidate":
            from app.repositories import CandidateRepository
            user = CandidateRepository().get_by_id(user_id)
            if not user or not getattr(user, "is_active", True):
                return error("Account not found.", code="USER_NOT_FOUND", status=404)
            user_dict = serialize_candidate(user)
        else:
            from app.repositories import RecruiterRepository
            user = RecruiterRepository().get_by_id(user_id)
            if not user or not getattr(user, "is_active", True):
                return error("Account not found.", code="USER_NOT_FOUND", status=404)
            user_dict = serialize_recruiter(user)

        return _auth_response(user_dict, role)

    except Exception:
        logger.error("refresh failed", exc_info=True)
        return error("Token refresh failed. Please log in again.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/logout
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.post("/logout")
@require_auth()
def logout():
    """
    POST /api/v1/auth/logout

    Revokes the current refresh token (current device only).
    Clears the refresh cookie.
    The access token will expire naturally within 15 minutes.

    Requires: Authorization: Bearer <access_token>
    """
    raw_refresh = request.cookies.get(_COOKIE_NAME)

    if raw_refresh:
        from app.models.refresh_token import RefreshToken
        stored = RefreshToken.get_by_hash(raw_refresh)
        if stored and not stored.revoked:
            stored.revoke()

    resp = make_response(*success(data=None, message="Logged out successfully."))
    _clear_refresh_cookie(resp)
    logger.info("User logged out", extra={"user_id": g.user_id, "role": g.user_role})
    return resp


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/logout-all
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.post("/logout-all")
@require_auth()
def logout_all():
    """
    POST /api/v1/auth/logout-all

    Revokes ALL refresh tokens for the authenticated user across every device.
    Use this for 'sign out everywhere' or after a password change.

    Requires: Authorization: Bearer <access_token>
    """
    user_id, role = get_current_user()

    try:
        from app.models.refresh_token import RefreshToken
        count = RefreshToken.revoke_all_for_user(user_id)
        logger.info("All tokens revoked", extra={"user_id": user_id, "count": count})

        resp = make_response(
            *success(
                data={"revoked_sessions": count},
                message=f"Signed out from {count} device(s).",
            )
        )
        _clear_refresh_cookie(resp)
        return resp

    except Exception:
        logger.error("logout_all failed", exc_info=True)
        return error("Logout failed. Please try again.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# GET /auth/me
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.get("/me")
@require_auth()
def me():
    """
    GET /api/v1/auth/me

    Returns the current user's profile using the identity from the JWT.
    No query params needed — identity comes from the access token.

    Requires: Authorization: Bearer <access_token>
    """
    user_id, role = get_current_user()

    try:
        if role == "candidate":
            from app.repositories import CandidateRepository
            user = CandidateRepository().get_by_id(user_id)
            if not user or not getattr(user, "is_active", True):
                return error("Account not found.", code="USER_NOT_FOUND", status=404)
            return success(
                data={"role": "candidate", "user": serialize_candidate(user)},
                message="Profile retrieved.",
            )
        else:
            from app.repositories import RecruiterRepository
            user = RecruiterRepository().get_by_id(user_id)
            if not user or not getattr(user, "is_active", True):
                return error("Account not found.", code="USER_NOT_FOUND", status=404)
            return success(
                data={"role": "recruiter", "user": serialize_recruiter(user)},
                message="Profile retrieved.",
            )

    except Exception:
        logger.error("me failed", exc_info=True)
        return error("Failed to retrieve profile.", code="INTERNAL_ERROR", status=500)


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/change-password
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.post("/change-password")
@require_auth()
def change_password():
    """
    POST /api/v1/auth/change-password

    Body: { current_password, new_password }

    Re-authenticates with current_password before applying the change.
    Revokes ALL existing refresh tokens after a successful change so that
    any stolen sessions are invalidated.

    Requires: Authorization: Bearer <access_token>
    """
    data, err = parse_body(ChangePasswordSchema)
    if err:
        return err

    user_id, role = get_current_user()

    try:
        if role == "candidate":
            from app.repositories import CandidateRepository
            repo = CandidateRepository()
            user = repo.get_by_id(user_id)
        else:
            from app.repositories import RecruiterRepository
            repo = RecruiterRepository()
            user = repo.get_by_id(user_id)

        if not user:
            return error("Account not found.", code="USER_NOT_FOUND", status=404)

        # Re-authenticate
        current_hash = getattr(user, "password_hash", "") or ""
        if not verify_password(data["current_password"], current_hash):
            return error(
                "Current password is incorrect.",
                code="INVALID_CREDENTIALS",
                status=401,
            )

        # Prevent reuse of same password
        if verify_password(data["new_password"], current_hash):
            return error(
                "New password must differ from the current password.",
                code="VALIDATION_ERROR",
                status=400,
            )

        user.password_hash = hash_password(data["new_password"])
        repo.save(user)

        # Revoke all existing sessions — force re-login on all devices
        from app.models.refresh_token import RefreshToken
        RefreshToken.revoke_all_for_user(user_id)

        logger.info("Password changed", extra={"user_id": user_id, "role": role})

        resp = make_response(
            *success(data=None, message="Password changed. Please log in again.")
        )
        _clear_refresh_cookie(resp)
        return resp

    except Exception:
        logger.error("change_password failed", exc_info=True)
        return error("Password change failed. Please try again.", code="INTERNAL_ERROR", status=500)