
"""
app/api/v1

Version 1 API blueprint registration.

All v1 routes are registered here and mounted under /api/v1 in create_app().
Adding a new resource:
  1. Create app/api/v1/your_resource.py with a Blueprint named your_resource_bp.
  2. Import and register it in this file.
  3. Update OpenAPI spec in docs/.
"""

from flask import Blueprint

from .health     import health_bp
from .candidates import candidates_bp
from .recruiters import recruiters_bp
from .jobs       import jobs_bp
from .resumes    import resumes_bp
from .applications import applications_bp
from .scoring    import scoring_bp
from .analytics  import analytics_bp

# Master v1 blueprint — sub-blueprints are registered onto this
api_v1_bp = Blueprint("api_v1", __name__)

# Register all resource blueprints
api_v1_bp.register_blueprint(health_bp)
api_v1_bp.register_blueprint(candidates_bp,   url_prefix="/candidates")
api_v1_bp.register_blueprint(recruiters_bp,   url_prefix="/recruiters")
api_v1_bp.register_blueprint(jobs_bp,         url_prefix="/jobs")
api_v1_bp.register_blueprint(resumes_bp,      url_prefix="/resumes")
api_v1_bp.register_blueprint(applications_bp, url_prefix="/applications")
api_v1_bp.register_blueprint(scoring_bp,      url_prefix="/scores")
api_v1_bp.register_blueprint(analytics_bp,    url_prefix="/analytics")

__all__ = ["api_v1_bp"]