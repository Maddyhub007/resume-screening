
"""
app/api/v1/health.py

Health check endpoints.

Endpoints:
  GET /api/v1/health          — Liveness probe (always 200 if app is up).
  GET /api/v1/health/ready    — Readiness probe (200 only if DB is reachable).

These are called by:
  - Render health checks (keeps the free-tier instance from spinning down)
  - Frontend to detect backend availability
  - Load balancers / uptime monitors

Design:
  - /health MUST respond even when DB is down (liveness ≠ readiness).
  - /health/ready performs an actual DB ping — returns 503 if unreachable.
"""

import logging
from datetime import datetime, timezone

from flask import Blueprint, current_app
from sqlalchemy import text

from app.core.database import db
from app.core.responses import error, success

logger = logging.getLogger(__name__)

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def liveness() -> tuple:
    """
    Liveness probe — confirms the Flask process is alive.

    Returns 200 as long as the application is running.
    Does NOT check database connectivity.
    """
    return success(
        data={
            "status":    "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "app":       current_app.config.get("APP_NAME", "ATS Platform"),
            "version":   current_app.config.get("API_VERSION", "v1"),
        },
        message="Service is running.",
    )


@health_bp.get("/health/ready")
def readiness() -> tuple:
    """
    Readiness probe — confirms the app can serve requests.

    Checks:
      - Database is reachable (executes 'SELECT 1').

    Returns:
      200 if all checks pass.
      503 if any check fails (app should not receive traffic).
    """
    checks: dict = {}
    all_ok = True

    # ── Database ping ─────────────────────────────────────────────────────────
    try:
        db.session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        logger.error("Readiness DB check failed", extra={"error": str(exc)})
        checks["database"] = f"error: {str(exc)}"
        all_ok = False

    if all_ok:
        return success(
            data={"status": "ready", "checks": checks},
            message="Service is ready.",
        )

    return error(
        message="Service not ready. Some dependencies are unavailable.",
        code="SERVICE_UNAVAILABLE",
        status=503,
        details={"checks": checks},
    )