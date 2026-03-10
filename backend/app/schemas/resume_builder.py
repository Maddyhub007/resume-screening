"""
app/schemas/resume_builder.py

Marshmallow validation schemas for the Resume Builder API.

Follows the same BaseSchema pattern as all other schemas in this project.
All schemas use EXCLUDE for unknown fields (inherited from BaseSchema).
"""

from marshmallow import ValidationError as MarshmallowValidationError
from marshmallow import fields, validate, validates_schema

from app.schemas.base import BaseSchema
from app.services.builder.template_registry import valid_template_ids


# ── Query schemas ─────────────────────────────────────────────────────────────

class DraftListQuerySchema(BaseSchema):
    """Validates GET /resume-builder/drafts query params."""
    page   = fields.Integer(load_default=1,  validate=validate.Range(min=1))
    limit  = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
    status = fields.String(load_default=None, validate=validate.OneOf(
        ["draft", "refined", "finalized"]
    ))


# ── Request body schemas ──────────────────────────────────────────────────────

class GenerateSchema(BaseSchema):
    """Validates POST /resume-builder/generate."""
    job_id      = fields.String(required=True, metadata={"description": "Target job UUID"})
    user_prompt = fields.String(load_default="", validate=validate.Length(max=2000))
    template_id = fields.String(load_default="modern")

    @validates_schema
    def validate_template(self, data, **kwargs):
        tid = data.get("template_id", "modern")
        valid = valid_template_ids()
        if tid not in valid:
            raise MarshmallowValidationError(
                f"template_id must be one of: {', '.join(valid)}",
                field_name="template_id",
            )


class RefineSchema(BaseSchema):
    """Validates POST /resume-builder/refine."""
    draft_id = fields.String(required=True, metadata={"description": "ResumeDraft UUID"})


class PredictScoreSchema(BaseSchema):
    """Validates POST /resume-builder/predict-score."""
    job_id  = fields.String(required=True)
    content = fields.Dict(required=True)


# ── Save draft — nested content schemas ──────────────────────────────────────

class ExperienceEntrySchema(BaseSchema):
    role          = fields.String(load_default="")
    company       = fields.String(load_default="")
    date_range    = fields.String(load_default="")
    impact_points = fields.List(fields.String(), load_default=[])


class EducationEntrySchema(BaseSchema):
    degree      = fields.String(load_default="")
    institution = fields.String(load_default="")
    year        = fields.String(load_default="")
    gpa         = fields.String(load_default="")


class ProjectEntrySchema(BaseSchema):
    name        = fields.String(load_default="")
    description = fields.String(load_default="")
    tech_used   = fields.List(fields.String(), load_default=[])


class DraftContentSchema(BaseSchema):
    """Full editable resume content returned to / submitted by the UI."""
    summary        = fields.String(load_default="")
    skills         = fields.List(fields.String(), load_default=[])
    experience     = fields.List(fields.Nested(ExperienceEntrySchema), load_default=[])
    education      = fields.List(fields.Nested(EducationEntrySchema),  load_default=[])
    certifications = fields.List(fields.String(), load_default=[])
    projects       = fields.List(fields.Nested(ProjectEntrySchema),    load_default=[])


class SaveDraftSchema(BaseSchema):
    """Validates POST /resume-builder/save-draft."""
    draft_id = fields.String(required=True)
    # Optional edited content — if absent, server uses draft.content_dict as-is
    content  = fields.Nested(DraftContentSchema, load_default=None)


# ── Feedback (learning hook) ──────────────────────────────────────────────────

class FeedbackSchema(BaseSchema):
    """Validates POST /resume-builder/drafts/<id>/feedback."""
    shortlisted     = fields.Boolean(required=True)
    interview_stage = fields.String(load_default="", validate=validate.Length(max=100))
    hired           = fields.Boolean(load_default=False)
