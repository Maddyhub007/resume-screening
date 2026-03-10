"""
app/core/middleware.py

Flask middleware hooks registered in create_app().

FIXES APPLIED:
  BUG #2 — Auto-commit on 2xx responses.

  Previously every route that wrote to the DB called repo.save() (flush only)
  and then returned. Nothing ever committed. Since fixing every individual
  route is error-prone, the cleanest production solution is to commit
  automatically in after_request for any successful (2xx) response.

  The pattern is:
    - after_request: if status 2xx → db.session.commit()
    - teardown_appcontext: if exception → db.session.rollback()

  This means individual routes NEVER need to call commit() themselves —
  they just flush, build their response, and return. The middleware handles
  the transaction boundary.

  EXCEPTION: auth.py's _auth_response() still calls commit() explicitly
  because it needs the user row committed BEFORE generating the JWT (to
  prevent issuing tokens for rows that might not persist). That explicit
  commit is safe — committing an already-committed transaction is a no-op.

Responsibilities:
  1. Request ID — correlation ID on every request.
  2. Request logging — METHOD, path, IP at start.
  3. Response logging — status code + elapsed time.
  4. Auto-commit — commit the session on every 2xx response.
  5. Error rollback — rollback on any unhandled exception.
  6. Response headers — inject X-Request-ID.
"""

import logging
import time
import uuid

from flask import Flask, g, request

from app.core.logging import set_request_id

logger = logging.getLogger(__name__)


def register_middleware(app: Flask) -> None:
    """
    Attach all middleware hooks to the Flask application.
    """

    @app.before_request
    def _before_request() -> None:
        from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
        from app.repositories.candidate import CandidateRepository
        from app.repositories.recruiter import RecruiterRepository

        rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
        g.request_id    = rid
        g.request_start = time.perf_counter()

        set_request_id(rid)

        # ---- AUTH CONTEXT ----
        try:
            verify_jwt_in_request(optional=True)

            identity = get_jwt_identity()
            claims = get_jwt()

            if identity:
                role = claims.get("role")

                if role == "recruiter":
                    repo = RecruiterRepository()
                    g.current_user = repo.get_by_id(identity)

                elif role == "candidate":
                    repo = CandidateRepository()
                    g.current_user = repo.get_by_id(identity)

                else:
                    g.current_user = None
            else:
                g.current_user = None

        except Exception:
            g.current_user = None
        # ----------------------

        

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
        Runs after every successful request handler.

        FIX: Auto-commit the SQLAlchemy session on any 2xx response.

        Why here and not in each route?
          - DRY: a single hook covers all 50+ write endpoints automatically.
          - Safety: if a route forgets to commit, data still persists.
          - Atomicity: the entire request's writes commit together or not at all.

        Why only on 2xx?
          - 4xx responses (validation errors, not found, conflicts) must NOT
            commit — any partial writes from earlier in the request should roll back.
          - 5xx responses roll back in teardown_appcontext.
        """
        from app.core.database import db

        rid     = getattr(g, "request_id", "-")
        elapsed = time.perf_counter() - getattr(g, "request_start", time.perf_counter())

        response.headers["X-Request-ID"] = rid

        # Auto-commit on success
        # Auto-commit on success
        if 200 <= response.status_code < 300:
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
                logger.error(
                    "Auto-commit failed — session rolled back",
                    extra={"path": request.path, "status": response.status_code},
                    exc_info=True,
                )

                # 🔥 CRITICAL FIX: convert response to 500
                response.status_code = 500
                response.set_data(
                    b'{"success": false, "message": "Internal database error."}'
                )
                # Don't re-raise here — the response has already been built.
                # The commit failure will be visible in logs.
        else:
            # Roll back any partial writes on non-2xx responses
            try:
                db.session.rollback()
            except Exception:
                pass  # Rollback failure is non-fatal

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

    @app.teardown_appcontext
    def _teardown(exception=None) -> None:
        """
        Runs when the application context is torn down.

        Roll back any open session if an unhandled exception propagated
        past the route handler (bypassing after_request).
        Also remove the session from the scoped session registry.
        """
        from app.core.database import db

        if exception:
            try:
                db.session.rollback()
            except Exception:
                pass
            logger.error(
                "Session rolled back due to unhandled exception",
                extra={"exception": str(exception)},
            )

        # Always remove the session at the end of the request context.
        # Flask-SQLAlchemy does this automatically, but being explicit
        # prevents any lingering session state between tests.
        try:
            db.session.remove()
        except Exception:
            pass