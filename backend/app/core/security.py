"""
app/core/security.py

JWT authentication core.

Architecture
───────────
Access token  — short-lived (15 min), sent in Authorization: Bearer <token>
                Stateless; verified purely by signature.

Refresh token — long-lived (7 days), sent in HttpOnly Secure SameSite=Strict
                cookie named 'refresh_token'.
                Stored as a hash in the DB (RefreshToken table) so it can be
                revoked on logout, password change, or suspicious activity.

Token payload
─────────────
{
  "sub":  "<user uuid>",        # subject — immutable user ID
  "role": "candidate"|"recruiter",
  "type": "access"|"refresh",
  "jti":  "<uuid4>",            # JWT ID — used for refresh token lookup
  "iat":  <unix timestamp>,
  "exp":  <unix timestamp>
}

Password hashing
────────────────
Werkzeug's generate_password_hash (scrypt/pbkdf2:sha256) — already a
project dependency.  No extra packages required.

Public API
──────────
  create_tokens(user_id, role)            → (access_token, refresh_token, jti)
  decode_access_token(token)              → payload dict  / raises AuthError
  require_auth(*roles)                    → Flask decorator
  get_current_user()                      → (user_id, role) from g
  hash_password(plain)                    → hashed string
  verify_password(plain, hashed)          → bool
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from functools import wraps
from typing import Callable, Tuple

import jwt
from flask import current_app, g, request

from app.core.responses import error as err_response

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Internal constants
# ─────────────────────────────────────────────────────────────────────────────

_ALGORITHM = "HS256"
_ACCESS_TTL  = timedelta(minutes=15)
_REFRESH_TTL = timedelta(days=7)


# ─────────────────────────────────────────────────────────────────────────────
# Custom exception (never leaks to HTTP — caught by decorators)
# ─────────────────────────────────────────────────────────────────────────────

class AuthError(Exception):
    """Raised when a token cannot be trusted."""

    def __init__(self, message: str, code: str = "INVALID_TOKEN") -> None:
        super().__init__(message)
        self.code = code


# ─────────────────────────────────────────────────────────────────────────────
# Token creation
# ─────────────────────────────────────────────────────────────────────────────

def create_tokens(user_id: str, role: str) -> Tuple[str, str, str]:
    """
    Mint a fresh access + refresh token pair.

    Returns:
        (access_token, refresh_token, jti)

        jti is the refresh token's unique ID — store its hash in RefreshToken
        so it can be revoked later.
    """
    secret = _secret()
    now    = datetime.now(timezone.utc)
    jti    = str(uuid.uuid4())

    access_token = jwt.encode(
        {
            "sub":  user_id,
            "role": role,
            "type": "access",
            "jti":  jti,           # ties access → refresh family
            "iat":  now,
            "exp":  now + _ACCESS_TTL,
        },
        secret,
        algorithm=_ALGORITHM,
    )

    refresh_token = jwt.encode(
        {
            "sub":  user_id,
            "role": role,
            "type": "refresh",
            "jti":  jti,
            "iat":  now,
            "exp":  now + _REFRESH_TTL,
        },
        secret,
        algorithm=_ALGORITHM,
    )

    return access_token, refresh_token, jti


# ─────────────────────────────────────────────────────────────────────────────
# Token decoding
# ─────────────────────────────────────────────────────────────────────────────

def decode_access_token(token: str) -> dict:
    """
    Decode and validate an access token.

    Raises:
        AuthError — expired, malformed, wrong type, or bad signature.
    """
    try:
        payload = jwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AuthError("Access token has expired. Please refresh.", "TOKEN_EXPIRED")
    except jwt.InvalidTokenError as exc:
        raise AuthError(f"Invalid token: {exc}", "INVALID_TOKEN")

    if payload.get("type") != "access":
        raise AuthError("Token type mismatch — access token required.", "INVALID_TOKEN")

    return payload


def decode_refresh_token(token: str) -> dict:
    """
    Decode and validate a refresh token.

    Raises:
        AuthError — expired, malformed, wrong type, or bad signature.
    """
    try:
        payload = jwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AuthError("Refresh token has expired. Please log in again.", "REFRESH_EXPIRED")
    except jwt.InvalidTokenError as exc:
        raise AuthError(f"Invalid refresh token: {exc}", "INVALID_TOKEN")

    if payload.get("type") != "refresh":
        raise AuthError("Token type mismatch — refresh token required.", "INVALID_TOKEN")

    return payload


# ─────────────────────────────────────────────────────────────────────────────
# Flask request helper
# ─────────────────────────────────────────────────────────────────────────────

def _extract_bearer() -> str | None:
    """Pull Bearer token from Authorization header. Returns None if absent."""
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return None


def get_current_user() -> tuple[str, str]:
    """
    Return (user_id, role) set on g by require_auth.

    Call this inside any protected view — never access g.user_id directly.
    """
    return g.user_id, g.user_role


# ─────────────────────────────────────────────────────────────────────────────
# Decorators
# ─────────────────────────────────────────────────────────────────────────────

def require_auth(*roles: str) -> Callable:
    """
    Route decorator — enforces authentication and optional role restriction.

    Usage:
        @bp.get("/my-profile")
        @require_auth("candidate")        # only candidates
        def my_profile(): ...

        @bp.get("/dashboard")
        @require_auth("candidate", "recruiter")   # either role
        def dashboard(): ...

        @bp.get("/admin")
        @require_auth()                   # any valid token, no role check
        def admin(): ...

    On success:
        g.user_id   — the authenticated user's UUID
        g.user_role — 'candidate' | 'recruiter'

    On failure:
        Returns a standard error response (401 or 403) — never raises.
    """
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            token = _extract_bearer()
            if not token:
                return err_response(
                    "Authentication required. Provide Authorization: Bearer <token>.",
                    code="MISSING_TOKEN",
                    status=401,
                )

            try:
                payload = decode_access_token(token)
            except AuthError as exc:
                status = 401 if exc.code in ("TOKEN_EXPIRED", "MISSING_TOKEN") else 403
                return err_response(str(exc), code=exc.code, status=status)

            # Role check
            if roles and payload["role"] not in roles:
                return err_response(
                    f"Access denied. Required role: {' or '.join(roles)}.",
                    code="FORBIDDEN",
                    status=403,
                )

            # Stash on Flask's g so views can call get_current_user()
            g.user_id   = payload["sub"]
            g.user_role = payload["role"]
            g.token_jti = payload.get("jti")

            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_ownership(id_param: str = "candidate_id") -> Callable:
    """
    Decorator that enforces the authenticated user owns the requested resource.

    The user's ID from the JWT must match the URL path parameter named
    `id_param`.  Recruiters bypass this check for recruiter-scoped routes
    by using require_auth("recruiter") directly.

    Usage:
        @bp.get("/<candidate_id>/resumes")
        @require_auth("candidate")
        @require_ownership("candidate_id")
        def list_resumes(candidate_id): ...
    """
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            resource_id = kwargs.get(id_param) or (args[0] if args else None)
            user_id = getattr(g, "user_id", None)

            if not user_id or not resource_id:
                return err_response(
                    "Ownership check failed — missing identity.",
                    code="FORBIDDEN",
                    status=403,
                )

            if str(user_id) != str(resource_id):
                return err_response(
                    "You do not have permission to access this resource.",
                    code="FORBIDDEN",
                    status=403,
                )

            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ─────────────────────────────────────────────────────────────────────────────
# Password utilities
# ─────────────────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """
    Hash a plain-text password using Werkzeug's scrypt (falls back to
    pbkdf2:sha256 on platforms without scrypt support).

    The result is a self-describing string that encodes the algorithm,
    salt, and parameters — safe to store directly in the DB.
    """
    from werkzeug.security import generate_password_hash
    return generate_password_hash(plain, method="scrypt")


def verify_password(plain: str, hashed: str) -> bool:
    """
    Constant-time comparison of a plain-text password against its hash.

    Returns False (not raise) on any error so as not to leak timing info.
    """
    from werkzeug.security import check_password_hash
    try:
        return check_password_hash(hashed, plain)
    except Exception:
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _secret() -> str:
    """Read the JWT signing secret from Flask config. Never hardcoded."""
    secret = current_app.config.get("SECRET_KEY", "")
    if not secret or secret == "dev-secret-change-in-production":
        logger.warning(
            "JWT signing secret is weak or default. "
            "Set SECRET_KEY to a cryptographically random value in production."
        )
    return secret