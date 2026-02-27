
"""
app/schemas/job.py — Marshmallow schemas for Job endpoints.
"""

from marshmallow import fields, validate

from app.schemas.base import BaseSchema

_JOB_TYPES    = ("full-time", "part-time", "contract", "internship", "freelance")
_JOB_STATUSES = ("active", "closed", "draft", "paused")


class CreateJobSchema(BaseSchema):
    """Validates POST /api/v1/jobs body."""
    title          = fields.String(required=True, validate=validate.Length(min=2, max=300))
    company        = fields.String(required=True, validate=validate.Length(min=1, max=300))
    description    = fields.String(required=True, validate=validate.Length(min=20))

    responsibilities          = fields.List(fields.String(), load_default=[])
    required_skills           = fields.List(fields.String(), load_default=[])
    nice_to_have_skills       = fields.List(fields.String(), load_default=[])
    additional_requirements   = fields.List(fields.String(), load_default=[])

    experience_years = fields.Float(load_default=0.0, validate=validate.Range(min=0, max=50))
    location         = fields.String(load_default="Remote", validate=validate.Length(max=200))
    job_type         = fields.String(load_default="full-time", validate=validate.OneOf(_JOB_TYPES))
    status           = fields.String(load_default="active", validate=validate.OneOf(_JOB_STATUSES))

    salary_min      = fields.Integer(load_default=None, validate=validate.Range(min=0))
    salary_max      = fields.Integer(load_default=None, validate=validate.Range(min=0))
    salary_currency = fields.String(load_default="USD", validate=validate.Length(max=10))

    recruiter_id = fields.String(load_default=None)


class UpdateJobSchema(BaseSchema):
    """Validates PATCH /api/v1/jobs/<id> body — all fields optional."""
    title                   = fields.String(validate=validate.Length(min=2, max=300))
    company                 = fields.String(validate=validate.Length(min=1, max=300))
    description             = fields.String(validate=validate.Length(min=20))
    responsibilities        = fields.List(fields.String())
    required_skills         = fields.List(fields.String())
    nice_to_have_skills     = fields.List(fields.String())
    additional_requirements = fields.List(fields.String())
    experience_years        = fields.Float(validate=validate.Range(min=0, max=50))
    location                = fields.String(validate=validate.Length(max=200))
    job_type                = fields.String(validate=validate.OneOf(_JOB_TYPES))
    status                  = fields.String(validate=validate.OneOf(_JOB_STATUSES))
    salary_min              = fields.Integer(allow_none=True, validate=validate.Range(min=0))
    salary_max              = fields.Integer(allow_none=True, validate=validate.Range(min=0))
    salary_currency         = fields.String(validate=validate.Length(max=10))


class JobQuerySchema(BaseSchema):
    """Validates GET /api/v1/jobs query params."""
    page             = fields.Integer(load_default=1,  validate=validate.Range(min=1))
    limit            = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
    search           = fields.String(load_default=None)
    status           = fields.String(load_default=None, validate=validate.OneOf(_JOB_STATUSES))
    job_type         = fields.String(load_default=None, validate=validate.OneOf(_JOB_TYPES))
    location         = fields.String(load_default=None)
    recruiter_id     = fields.String(load_default=None)
    min_experience   = fields.Float(load_default=None, validate=validate.Range(min=0))
    max_experience   = fields.Float(load_default=None, validate=validate.Range(min=0))


class SmartJobAssistSchema(BaseSchema):
    """Validates POST /api/v1/jobs/assist — smart job creation assistance."""
    description = fields.String(required=True, validate=validate.Length(min=20))
    title       = fields.String(load_default=None)