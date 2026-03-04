"""
app/core/middleware.py

Flask middleware hooks registered in create_app().

Responsibilities:
  1. Request ID — generate/propagate a correlation ID on every request.
     The ID is read from the incoming X-Request-ID header if present
     (so frontend/client traces carry through), otherwise a new UUID is minted.
     It is stored in flask.g AND in the logging context variable so every
     log line for this request carries it.

  2. Request logging — log METHOD, path, IP, and User-Agent at request start.

  3. Response logging — log status code and elapsed time at request end.

  4. Error response headers — inject X-Request-ID into every response so
     the client can correlate failed requests in their logs.

Usage (called once in create_app):
    from app.core.middleware import register_middleware
    register_middleware(app)
"""

import logging
import time
import uuid
from app.core.database import db
from flask import Flask, g, request

from app.core.logging import set_request_id

logger = logging.getLogger(__name__)


def register_middleware(app: Flask) -> None:
    """
    Attach all middleware hooks to the Flask application.

    Args:
        app: Configured Flask application instance.
    """

    @app.before_request
    def _before_request() -> None:
        """
        Runs before every request.
        - Assigns a correlation ID to flask.g and the logging context.
        - Records the start time for elapsed-time calculation.
        """
        rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
        g.request_id   = rid
        g.request_start = time.perf_counter()

        # Inject into logging context var so all loggers in this request see it
        set_request_id(rid)

        logger.debug(
            "Request started",
            extra={
                "method":     request.method,
                "path":       request.path,
                "ip":         request.remote_addr,
                "user_agent": request.user_agent.string[:120],
            },
        )

    @app.after_request
    def _after_request(response):
        """
        Runs after every successful request.
        - Injects X-Request-ID into the response headers.
        - Logs status code and elapsed time.
        """
        rid     = getattr(g, "request_id", "-")
        elapsed = time.perf_counter() - getattr(g, "request_start", time.perf_counter())

        response.headers["X-Request-ID"] = rid

        logger.info(
            "Request completed",
            extra={
                "method":      request.method,
                "path":        request.path,
                "status_code": response.status_code,
                "elapsed_ms":  round(elapsed * 1000, 2),
            },
        )
        return response

    @app.teardown_request
<<<<<<< HEAD
    def _shutdown_session(exception=None) -> None:
=======
    def _teardown_request(exception=None) -> None:
        """
        Finalise DB transaction for the request.

        - Commit on success for mutating methods.
        - Roll back on exceptions or failed commits.
        """
        # pylint: disable=import-outside-toplevel
        from app.core.database import db

        if exception:
            db.session.rollback()
            return

        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
                logger.error("Session commit failed; rolled back.", exc_info=True)

    @app.teardown_appcontext
    def _teardown(exception=None) -> None:
>>>>>>> 72a03cbc4dd33a32103e5fd61638c5617d76d049
        """
        Unit-of-work pattern:
        - commit on success
        - rollback on error
        - always remove session
        """
        try:
            if exception:
                db.session.rollback()
            else:
                db.session.commit()
        except Exception:
            db.session.rollback()
<<<<<<< HEAD
            raise
        finally:
            db.session.remove()
=======
            logger.error(
                "Session rolled back due to unhandled exception",
                extra={"exception": str(exception)},
            )
>>>>>>> 72a03cbc4dd33a32103e5fd61638c5617d76d049
