
"""
app/schemas/auth.py

Marshmallow schemas for /api/v1/auth/* endpoints.

Schemas:
  LoginSchema             — POST /auth/login
  RegisterCandidateSchema — POST /auth/register/candidate
  RegisterRecruiterSchema — POST /auth/register/recruiter
  MeQuerySchema           — GET  /auth/me (query params)
"""

from marshmallow import fields, validate

from app.schemas.base import BaseSchema

_VALID_ROLES = ("candidate", "recruiter")


class LoginSchema(BaseSchema):
    """
    Validates POST /api/v1/auth/login.

    Fields:
        email — case-insensitive; normalised to lowercase in the view layer
        role  — 'candidate' | 'recruiter'
    """

    email = fields.Email(
        required=True,
        error_messages={
            "required": "Email is required.",
            "invalid":  "Enter a valid email address.",
        },
    )
    role = fields.String(
        required=True,
        validate=validate.OneOf(_VALID_ROLES, error="role must be 'candidate' or 'recruiter'."),
        error_messages={"required": "role is required."},
    )


class RegisterCandidateSchema(BaseSchema):
    """
    Validates POST /api/v1/auth/register/candidate.

    Required : full_name, email
    Optional : phone, location, headline, open_to_work,
               preferred_roles, preferred_locations,
               linkedin_url, github_url, portfolio_url

    Mirrors CreateCandidateSchema but lives in auth to keep the auth contract
    self-contained and independently evolvable.
    """

    full_name = fields.String(
        required=True,
        validate=validate.Length(min=1, max=200),
        error_messages={"required": "full_name is required."},
    )
    email = fields.Email(
        required=True,
        error_messages={
            "required": "Email is required.",
            "invalid":  "Enter a valid email address.",
        },
    )
    phone        = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=30))
    location     = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=200))
    headline     = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=300))
    open_to_work        = fields.Boolean(load_default=True)
    preferred_roles     = fields.List(fields.String(), load_default=[])
    preferred_locations = fields.List(fields.String(), load_default=[])
    linkedin_url  = fields.Url(load_default=None, allow_none=True)
    github_url    = fields.Url(load_default=None, allow_none=True)
    portfolio_url = fields.Url(load_default=None, allow_none=True)


class RegisterRecruiterSchema(BaseSchema):
    """
    Validates POST /api/v1/auth/register/recruiter.

    Required : full_name, email, company_name
    Optional : company_size, industry, phone, website_url, linkedin_url
    """

    full_name = fields.String(
        required=True,
        validate=validate.Length(min=1, max=200),
        error_messages={"required": "full_name is required."},
    )
    email = fields.Email(
        required=True,
        error_messages={
            "required": "Email is required.",
            "invalid":  "Enter a valid email address.",
        },
    )
    company_name = fields.String(
        required=True,
        validate=validate.Length(min=1, max=300),
        error_messages={"required": "company_name is required."},
    )
    company_size = fields.String(
        load_default=None,
        allow_none=True,
        validate=validate.OneOf(
            ["1-10", "11-50", "51-200", "201-500", "500+"],
            error="company_size must be one of: 1-10, 11-50, 51-200, 201-500, 500+.",
        ),
    )
    industry     = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=100))
    phone        = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=30))
    website_url  = fields.Url(load_default=None, allow_none=True)
    linkedin_url = fields.Url(load_default=None, allow_none=True)


class MeQuerySchema(BaseSchema):
    """
    Validates GET /api/v1/auth/me query string.

    Both params are required — the frontend always has them when it has a
    persisted Zustand session to validate.
    """

    role = fields.String(
        required=True,
        validate=validate.OneOf(_VALID_ROLES, error="role must be 'candidate' or 'recruiter'."),
        error_messages={"required": "Query param 'role' is required."},
    )
    user_id = fields.String(
        required=True,
        validate=validate.Length(min=1),
        error_messages={"required": "Query param 'user_id' is required."},
    )