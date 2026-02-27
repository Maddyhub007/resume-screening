
"""
tests/conftest.py

Pytest fixtures shared across all tests.

Fixtures:
  - app:    Flask test application (testing config, in-memory SQLite).
  - client: Flask test client bound to the test app.
  - db:     Bound SQLAlchemy session — tables created before each test,
            dropped after (full isolation).
  - sample_candidate: A persisted Candidate row.
  - sample_recruiter: A persisted Recruiter row.
  - sample_job:       A persisted Job row.
"""

import io
import json
import os

import pytest
from flask.testing import FlaskClient

from app import create_app
from app.core.database import db as _db


@pytest.fixture(scope="session")
def app():
    """
    Session-scoped Flask app in testing mode.

    Uses in-memory SQLite — completely isolated from dev/prod databases.
    Tables are created once per session.
    """
    os.environ["APP_ENV"] = "testing"
    flask_app = create_app("testing")

    with flask_app.app_context():
        _db.create_all()
        yield flask_app
        _db.drop_all()


@pytest.fixture()
def db(app):
    """
    Function-scoped database fixture.

    Wraps each test in a transaction that is rolled back after the test,
    giving every test a clean slate without recreating tables.
    """
    with app.app_context():
        connection = _db.engine.connect()
        transaction = connection.begin()

        # Bind session to this connection so the test uses the same transaction
        _db.session.configure(bind=connection)

        yield _db

        _db.session.remove()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(app) -> FlaskClient:
    """Flask test client for making HTTP requests in tests."""
    return app.test_client()


@pytest.fixture()
def json_post(client):
    """Helper: POST JSON and return parsed response body."""
    def _post(url: str, body: dict, **kwargs):
        resp = client.post(
            url,
            data=json.dumps(body),
            content_type="application/json",
            **kwargs,
        )
        return resp, resp.get_json()
    return _post


@pytest.fixture()
def json_patch(client):
    """Helper: PATCH JSON and return parsed response body."""
    def _patch(url: str, body: dict, **kwargs):
        resp = client.patch(
            url,
            data=json.dumps(body),
            content_type="application/json",
            **kwargs,
        )
        return resp, resp.get_json()
    return _patch


@pytest.fixture()
def sample_candidate(db, app):
    """Create and return a persisted Candidate."""
    from app.models.candidate import Candidate
    with app.app_context():
        c = Candidate(
            full_name="Jane Doe",
            email="jane.doe@example.com",
            phone="+91-9876543210",
            location="Chennai, India",
            headline="Senior Python Developer",
        )
        c.preferred_roles_list     = ["Backend Engineer", "ML Engineer"]
        c.preferred_locations_list = ["Remote", "Chennai"]
        c.save()
        db.session.commit()
        return c


@pytest.fixture()
def sample_recruiter(db, app):
    """Create and return a persisted Recruiter."""
    from app.models.recruiter import Recruiter
    with app.app_context():
        r = Recruiter(
            full_name="HR Manager",
            email="hr@techcorp.com",
            company_name="TechCorp Pvt Ltd",
            company_size="51-200",
            industry="Software",
        )
        r.save()
        db.session.commit()
        return r


@pytest.fixture()
def sample_job(db, app, sample_recruiter):
    """Create and return a persisted Job."""
    from app.models.job import Job
    with app.app_context():
        j = Job(
            title="Senior Python Developer",
            company="TechCorp Pvt Ltd",
            description=(
                "We are looking for a Senior Python Developer with 5+ years experience "
                "in Flask, FastAPI, and PostgreSQL. Must have strong NLP/ML background."
            ),
            experience_years=5.0,
            location="Remote",
            job_type="full-time",
            recruiter_id=sample_recruiter.id,
        )
        j.required_skills_list = ["Python", "Flask", "PostgreSQL", "Docker", "NLP"]
        j.save()
        db.session.commit()
        return j