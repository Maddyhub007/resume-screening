
"""
tests/unit/test_exceptions.py

Tests for the exception hierarchy and to_dict() serialisation.
"""

from app.core.exceptions import (
    AppError,
    CandidateNotFound,
    JobNotFound,
    ResumeNotFound,
    ResumeParseFailed,
    ValidationError,
)


def test_app_error_defaults():
    exc = AppError()
    assert exc.status_code == 500
    assert exc.error_code == "INTERNAL_ERROR"
    assert "error_code" in exc.to_dict()


def test_validation_error_with_field():
    exc = ValidationError("Email is required.", field="email")
    d = exc.to_dict()
    assert d["error_code"] == "VALIDATION_ERROR"
    assert d["details"]["field"] == "email"
    assert exc.status_code == 400


def test_resume_not_found():
    exc = ResumeNotFound("abc-123")
    assert exc.status_code == 404
    assert "abc-123" in exc.message
    assert exc.to_dict()["details"]["resume_id"] == "abc-123"


def test_job_not_found():
    exc = JobNotFound("job-xyz")
    assert exc.status_code == 404
    assert exc.error_code == "JOB_NOT_FOUND"


def test_resume_parse_failed():
    exc = ResumeParseFailed("File is corrupted.")
    assert exc.status_code == 422
    assert "corrupted" in exc.message


def test_candidate_not_found():
    exc = CandidateNotFound("cand-001")
    assert exc.status_code == 404
    assert exc.to_dict()["details"]["candidate_id"] == "cand-001"