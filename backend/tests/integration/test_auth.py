
"""
tests/integration/test_auth.py

Integration tests for /api/v1/auth/* endpoints.

Covers:
  POST /auth/login
  POST /auth/register/candidate
  POST /auth/register/recruiter
  GET  /auth/me
"""

import uuid
import pytest

BASE = "/api/v1/auth"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures / payload builders
# ─────────────────────────────────────────────────────────────────────────────

def _candidate_payload(**overrides):
    base = {
        "full_name": "Auth Candidate",
        "email":     f"auth-cand-{uuid.uuid4().hex[:8]}@example.com",
    }
    base.update(overrides)
    return base


def _recruiter_payload(**overrides):
    base = {
        "full_name":    "Auth Recruiter",
        "email":        f"auth-rec-{uuid.uuid4().hex[:8]}@example.com",
        "company_name": "TestCo",
    }
    base.update(overrides)
    return base


def _register_candidate(client, **overrides):
    """Register a fresh candidate and return the response body."""
    r = client.post(
        f"{BASE}/register/candidate",
        json=_candidate_payload(**overrides),
    )
    assert r.status_code == 201, f"Fixture setup failed: {r.get_json()}"
    return r.get_json()


def _register_recruiter(client, **overrides):
    """Register a fresh recruiter and return the response body."""
    r = client.post(
        f"{BASE}/register/recruiter",
        json=_recruiter_payload(**overrides),
    )
    assert r.status_code == 201, f"Fixture setup failed: {r.get_json()}"
    return r.get_json()


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/register/candidate
# ─────────────────────────────────────────────────────────────────────────────

class TestRegisterCandidate:
    def test_returns_201(self, client, db):
        r = client.post(f"{BASE}/register/candidate", json=_candidate_payload())
        assert r.status_code == 201

    def test_success_envelope(self, client, db):
        body = client.post(f"{BASE}/register/candidate", json=_candidate_payload()).get_json()
        assert body["success"] is True

    def test_data_contains_role(self, client, db):
        body = client.post(f"{BASE}/register/candidate", json=_candidate_payload()).get_json()
        assert body["data"]["role"] == "candidate"

    def test_data_contains_user_id(self, client, db):
        body = client.post(f"{BASE}/register/candidate", json=_candidate_payload()).get_json()
        assert "user_id" in body["data"]
        assert body["data"]["user_id"]

    def test_data_user_has_email(self, client, db):
        payload = _candidate_payload()
        body = client.post(f"{BASE}/register/candidate", json=payload).get_json()
        assert body["data"]["user"]["email"] == payload["email"].lower()

    def test_data_user_has_full_name(self, client, db):
        payload = _candidate_payload()
        body = client.post(f"{BASE}/register/candidate", json=payload).get_json()
        assert body["data"]["user"]["full_name"] == payload["full_name"]

    def test_email_stored_lowercase(self, client, db):
        payload = _candidate_payload(email="UPPER@EXAMPLE.COM")
        body = client.post(f"{BASE}/register/candidate", json=payload).get_json()
        assert body["data"]["user"]["email"] == "upper@example.com"

    def test_duplicate_email_returns_409(self, client, db):
        payload = _candidate_payload()
        client.post(f"{BASE}/register/candidate", json=payload)
        r = client.post(f"{BASE}/register/candidate", json=payload)
        assert r.status_code == 409

    def test_duplicate_email_error_code(self, client, db):
        payload = _candidate_payload()
        client.post(f"{BASE}/register/candidate", json=payload)
        body = client.post(f"{BASE}/register/candidate", json=payload).get_json()
        assert body["error"]["error_code"] == "CANDIDATE_EMAIL_CONFLICT"

    def test_missing_email_returns_400(self, client, db):
        r = client.post(f"{BASE}/register/candidate", json={"full_name": "No Email"})
        assert r.status_code == 400

    def test_missing_full_name_returns_400(self, client, db):
        r = client.post(f"{BASE}/register/candidate", json={"email": "noname@example.com"})
        assert r.status_code == 400

    def test_invalid_email_returns_400(self, client, db):
        r = client.post(
            f"{BASE}/register/candidate",
            json=_candidate_payload(email="not-an-email"),
        )
        assert r.status_code == 400

    def test_optional_fields_accepted(self, client, db):
        payload = _candidate_payload(phone="+91-9000000000", location="Mumbai", headline="Dev")
        body = client.post(f"{BASE}/register/candidate", json=payload).get_json()
        assert body["data"]["user"]["phone"] == "+91-9000000000"
        assert body["data"]["user"]["location"] == "Mumbai"


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/register/recruiter
# ─────────────────────────────────────────────────────────────────────────────

class TestRegisterRecruiter:
    def test_returns_201(self, client, db):
        r = client.post(f"{BASE}/register/recruiter", json=_recruiter_payload())
        assert r.status_code == 201

    def test_success_envelope(self, client, db):
        body = client.post(f"{BASE}/register/recruiter", json=_recruiter_payload()).get_json()
        assert body["success"] is True

    def test_data_contains_role(self, client, db):
        body = client.post(f"{BASE}/register/recruiter", json=_recruiter_payload()).get_json()
        assert body["data"]["role"] == "recruiter"

    def test_data_contains_user_id(self, client, db):
        body = client.post(f"{BASE}/register/recruiter", json=_recruiter_payload()).get_json()
        assert body["data"]["user_id"]

    def test_data_user_has_company_name(self, client, db):
        payload = _recruiter_payload(company_name="Acme Corp")
        body = client.post(f"{BASE}/register/recruiter", json=payload).get_json()
        assert body["data"]["user"]["company_name"] == "Acme Corp"

    def test_email_stored_lowercase(self, client, db):
        payload = _recruiter_payload(email="REC@COMPANY.COM")
        body = client.post(f"{BASE}/register/recruiter", json=payload).get_json()
        assert body["data"]["user"]["email"] == "rec@company.com"

    def test_duplicate_email_returns_409(self, client, db):
        payload = _recruiter_payload()
        client.post(f"{BASE}/register/recruiter", json=payload)
        r = client.post(f"{BASE}/register/recruiter", json=payload)
        assert r.status_code == 409

    def test_duplicate_email_error_code(self, client, db):
        payload = _recruiter_payload()
        client.post(f"{BASE}/register/recruiter", json=payload)
        body = client.post(f"{BASE}/register/recruiter", json=payload).get_json()
        assert body["error"]["error_code"] == "RECRUITER_EMAIL_CONFLICT"

    def test_missing_company_name_returns_400(self, client, db):
        payload = {"full_name": "Jane", "email": "jane@co.com"}
        r = client.post(f"{BASE}/register/recruiter", json=payload)
        assert r.status_code == 400

    def test_valid_company_size_accepted(self, client, db):
        payload = _recruiter_payload(company_size="51-200")
        body = client.post(f"{BASE}/register/recruiter", json=payload).get_json()
        assert body["data"]["user"]["company_size"] == "51-200"

    def test_invalid_company_size_returns_400(self, client, db):
        payload = _recruiter_payload(company_size="huge")
        r = client.post(f"{BASE}/register/recruiter", json=payload)
        assert r.status_code == 400

    def test_missing_full_name_returns_400(self, client, db):
        r = client.post(
            f"{BASE}/register/recruiter",
            json={"email": "x@co.com", "company_name": "Co"},
        )
        assert r.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/login
# ─────────────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_candidate_login_returns_200(self, client, db):
        body = _register_candidate(client)
        email = body["data"]["user"]["email"]
        r = client.post(f"{BASE}/login", json={"email": email, "role": "candidate"})
        assert r.status_code == 200

    def test_candidate_login_success_envelope(self, client, db):
        body = _register_candidate(client)
        email = body["data"]["user"]["email"]
        r = client.post(f"{BASE}/login", json={"email": email, "role": "candidate"})
        assert r.get_json()["success"] is True

    def test_candidate_login_returns_role(self, client, db):
        body = _register_candidate(client)
        email = body["data"]["user"]["email"]
        resp = client.post(f"{BASE}/login", json={"email": email, "role": "candidate"}).get_json()
        assert resp["data"]["role"] == "candidate"

    def test_candidate_login_returns_user_id(self, client, db):
        body = _register_candidate(client)
        email = body["data"]["user"]["email"]
        resp = client.post(f"{BASE}/login", json={"email": email, "role": "candidate"}).get_json()
        assert resp["data"]["user_id"] == body["data"]["user_id"]

    def test_candidate_login_case_insensitive(self, client, db):
        body = _register_candidate(client)
        email = body["data"]["user"]["email"].upper()
        r = client.post(f"{BASE}/login", json={"email": email, "role": "candidate"})
        assert r.status_code == 200

    def test_recruiter_login_returns_200(self, client, db):
        body = _register_recruiter(client)
        email = body["data"]["user"]["email"]
        r = client.post(f"{BASE}/login", json={"email": email, "role": "recruiter"})
        assert r.status_code == 200

    def test_recruiter_login_returns_role(self, client, db):
        body = _register_recruiter(client)
        email = body["data"]["user"]["email"]
        resp = client.post(f"{BASE}/login", json={"email": email, "role": "recruiter"}).get_json()
        assert resp["data"]["role"] == "recruiter"

    def test_unknown_email_returns_404(self, client, db):
        r = client.post(
            f"{BASE}/login",
            json={"email": "nobody@nowhere.com", "role": "candidate"},
        )
        assert r.status_code == 404

    def test_unknown_email_error_code(self, client, db):
        body = client.post(
            f"{BASE}/login",
            json={"email": "nobody@nowhere.com", "role": "candidate"},
        ).get_json()
        assert body["error"]["error_code"] == "USER_NOT_FOUND"

    def test_wrong_role_returns_404(self, client, db):
        """A candidate email used with role=recruiter should 404."""
        reg = _register_candidate(client)
        email = reg["data"]["user"]["email"]
        r = client.post(f"{BASE}/login", json={"email": email, "role": "recruiter"})
        assert r.status_code == 404

    def test_missing_role_returns_400(self, client, db):
        r = client.post(f"{BASE}/login", json={"email": "x@example.com"})
        assert r.status_code == 400

    def test_missing_email_returns_400(self, client, db):
        r = client.post(f"{BASE}/login", json={"role": "candidate"})
        assert r.status_code == 400

    def test_invalid_role_returns_400(self, client, db):
        r = client.post(f"{BASE}/login", json={"email": "x@x.com", "role": "admin"})
        assert r.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# GET /auth/me
# ─────────────────────────────────────────────────────────────────────────────

class TestMe:
    def test_valid_candidate_returns_200(self, client, db):
        reg = _register_candidate(client)
        user_id = reg["data"]["user_id"]
        r = client.get(f"{BASE}/me?role=candidate&user_id={user_id}")
        assert r.status_code == 200

    def test_valid_candidate_success_envelope(self, client, db):
        reg = _register_candidate(client)
        user_id = reg["data"]["user_id"]
        body = client.get(f"{BASE}/me?role=candidate&user_id={user_id}").get_json()
        assert body["success"] is True

    def test_valid_candidate_returns_role(self, client, db):
        reg = _register_candidate(client)
        user_id = reg["data"]["user_id"]
        body = client.get(f"{BASE}/me?role=candidate&user_id={user_id}").get_json()
        assert body["data"]["role"] == "candidate"

    def test_valid_candidate_returns_matching_user_id(self, client, db):
        reg = _register_candidate(client)
        user_id = reg["data"]["user_id"]
        body = client.get(f"{BASE}/me?role=candidate&user_id={user_id}").get_json()
        assert body["data"]["user_id"] == user_id

    def test_valid_recruiter_returns_200(self, client, db):
        reg = _register_recruiter(client)
        user_id = reg["data"]["user_id"]
        r = client.get(f"{BASE}/me?role=recruiter&user_id={user_id}")
        assert r.status_code == 200

    def test_valid_recruiter_returns_role(self, client, db):
        reg = _register_recruiter(client)
        user_id = reg["data"]["user_id"]
        body = client.get(f"{BASE}/me?role=recruiter&user_id={user_id}").get_json()
        assert body["data"]["role"] == "recruiter"

    def test_nonexistent_user_id_returns_404(self, client, db):
        r = client.get(f"{BASE}/me?role=candidate&user_id={uuid.uuid4()}")
        assert r.status_code == 404

    def test_nonexistent_user_error_code(self, client, db):
        body = client.get(f"{BASE}/me?role=candidate&user_id={uuid.uuid4()}").get_json()
        assert body["error"]["error_code"] == "USER_NOT_FOUND"

    def test_wrong_role_for_id_returns_404(self, client, db):
        """Candidate ID looked up as recruiter should 404."""
        reg = _register_candidate(client)
        user_id = reg["data"]["user_id"]
        r = client.get(f"{BASE}/me?role=recruiter&user_id={user_id}")
        assert r.status_code == 404

    def test_missing_role_returns_400(self, client, db):
        r = client.get(f"{BASE}/me?user_id={uuid.uuid4()}")
        assert r.status_code == 400

    def test_missing_user_id_returns_400(self, client, db):
        r = client.get(f"{BASE}/me?role=candidate")
        assert r.status_code == 400

    def test_invalid_role_returns_400(self, client, db):
        r = client.get(f"{BASE}/me?role=admin&user_id={uuid.uuid4()}")
        assert r.status_code == 400