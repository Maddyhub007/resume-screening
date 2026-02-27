
"""
tests/unit/test_responses.py

Tests for the response envelope helpers.
"""

import json

import pytest


def test_success_response_shape(app):
    with app.app_context():
        from app.core.responses import success
        resp, status = success(data={"id": "1"}, message="OK")
        body = json.loads(resp.data)
        assert status == 200
        assert body["success"] is True
        assert body["message"] == "OK"
        assert body["data"]["id"] == "1"


def test_success_list_pagination_meta(app):
    with app.app_context():
        from app.core.responses import success_list
        resp, status = success_list(data=[1, 2, 3], total=50, page=2, limit=10)
        body = json.loads(resp.data)
        meta = body["meta"]
        assert meta["total"] == 50
        assert meta["page"] == 2
        assert meta["total_pages"] == 5
        assert meta["has_next"] is True
        assert meta["has_prev"] is True


def test_created_returns_201(app):
    with app.app_context():
        from app.core.responses import created
        resp, status = created(data={"id": "abc"})
        assert status == 201


def test_error_response_shape(app):
    with app.app_context():
        from app.core.responses import error
        resp, status = error("Not found.", code="NOT_FOUND", status=404)
        body = json.loads(resp.data)
        assert status == 404
        assert body["success"] is False
        assert body["error"]["error_code"] == "NOT_FOUND"


def test_validation_error_includes_errors_dict(app):
    with app.app_context():
        from app.core.responses import validation_error
        resp, status = validation_error({"email": ["Not a valid email."]})
        body = json.loads(resp.data)
        assert status == 400
        assert "errors" in body["error"]["details"]