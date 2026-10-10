"""Tests: report submission, persistence, risk scoring, access control."""
import pytest
from datetime import datetime, timezone
from .conftest import make_citizen, make_official, make_admin, login, auth

REPORT_BODY = {
    "source_type": "river",
    "latitude": 18.52,
    "longitude": 73.85,
    "observation_date": datetime.now(timezone.utc).isoformat(),
    "appearance": "cloudy",
    "odor": "unusual",
    "visible_waste": True,
    "suspected_contamination": False,
    "notes": "Water looks murky near bridge.",
}


def test_citizen_can_submit_report(client):
    make_citizen(client, email="reporter@test.com")
    token = login(client, "reporter@test.com")
    r = client.post("/api/v1/reports", json=REPORT_BODY, headers=auth(token))
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "pending_review"
    assert data["reporter_id"] is not None


def test_report_gets_risk_score(client):
    make_citizen(client, email="scorer@test.com")
    token = login(client, "scorer@test.com")
    r = client.post("/api/v1/reports", json=REPORT_BODY, headers=auth(token))
    assert r.status_code == 201
    data = r.json()
    assert data["risk_score"] is not None
    assert data["risk_category"] in ("low", "moderate", "high", "critical")


def test_high_risk_report_scores_above_50(client):
    """Cloudy + unusual odor + visible waste should reach high/critical."""
    make_citizen(client, email="highrisk@test.com")
    token = login(client, "highrisk@test.com")
    body = {**REPORT_BODY, "visible_waste": True, "suspected_contamination": True}
    r = client.post("/api/v1/reports", json=body, headers=auth(token))
    assert r.status_code == 201
    assert r.json()["risk_score"] >= 50


def test_clear_water_scores_low(client):
    make_citizen(client, email="lowrisk@test.com")
    token = login(client, "lowrisk@test.com")
    body = {**REPORT_BODY, "appearance": "clear", "odor": "normal",
            "visible_waste": False, "suspected_contamination": False}
    r = client.post("/api/v1/reports", json=body, headers=auth(token))
    assert r.status_code == 201
    assert r.json()["risk_category"] == "low"


def test_citizen_only_sees_own_reports(client):
    make_citizen(client, email="own1@test.com")
    make_citizen(client, email="own2@test.com")
    t1 = login(client, "own1@test.com")
    t2 = login(client, "own2@test.com")
    client.post("/api/v1/reports", json=REPORT_BODY, headers=auth(t1))
    client.post("/api/v1/reports", json=REPORT_BODY, headers=auth(t2))
    r = client.get("/api/v1/reports", headers=auth(t1))
    assert r.status_code == 200
    ids = [rep["reporter_id"] for rep in r.json()]
    me = client.get("/auth/me", headers=auth(t1)).json()["id"]
    assert all(i == me for i in ids)


def test_unauthenticated_cannot_submit(client):
    r = client.post("/api/v1/reports", json=REPORT_BODY)
    assert r.status_code == 401


def test_invalid_coordinates_rejected(client):
    make_citizen(client, email="badcoord@test.com")
    token = login(client, "badcoord@test.com")
    body = {**REPORT_BODY, "latitude": 999, "longitude": 999}
    r = client.post("/api/v1/reports", json=body, headers=auth(token))
    assert r.status_code == 422


def test_missing_coordinates_allowed(client):
    """Coordinates are optional."""
    make_citizen(client, email="nocoord@test.com")
    token = login(client, "nocoord@test.com")
    body = {**REPORT_BODY}
    body.pop("latitude"); body.pop("longitude")
    r = client.post("/api/v1/reports", json=body, headers=auth(token))
    assert r.status_code == 201
    assert r.json()["latitude"] is None
