"""Tests: IoT reading ingestion, alert generation, simulation."""
import pytest
from .conftest import make_admin, make_official, login, auth


def test_analyst_can_ingest_reading(client, db_session):
    admin = make_admin(client, db_session)
    admin_token = login(client, "admin@test.com", "Admin@1234")
    # Approve an analyst
    make_official(client, email="analyst_iot@test.com")
    apps = client.get("/admin/applications", headers=auth(admin_token)).json()
    uid = next(u["id"] for u in apps if u["email"] == "analyst_iot@test.com")
    client.post(f"/admin/applications/{uid}/review", json={"decision": "approve"}, headers=auth(admin_token))
    token = login(client, "analyst_iot@test.com")

    resp = client.post("/api/v1/iot/reading", json={
        "parameter": "pH", "value": 7.2, "unit": "pH",
        "data_source": "LIVE", "instrument": "Hanna HI9814",
    }, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["parameter"] == "pH"


def test_out_of_range_creates_alert(client, db_session):
    admin = make_admin(client, db_session)
    admin_token = login(client, "admin@test.com", "Admin@1234")
    # pH = 10.5 is above WHO max of 8.5
    resp = client.post("/api/v1/iot/reading", json={
        "parameter": "pH", "value": 10.5, "unit": "pH", "data_source": "LIVE",
    }, headers=auth(admin_token))
    assert resp.status_code == 201
    alerts = client.get("/api/v1/iot/alerts", headers=auth(admin_token)).json()
    assert any("pH" in a["title"] for a in alerts)


def test_simulation_admin_only(client, db_session):
    from .conftest import make_citizen
    make_citizen(client, email="citizen_sim@test.com")
    token = login(client, "citizen_sim@test.com")
    resp = client.get("/api/v1/iot/simulate", headers=auth(token))
    assert resp.status_code == 403


def test_citizen_cannot_ingest(client, db_session):
    from .conftest import make_citizen
    make_citizen(client, email="citizen_iot@test.com")
    token = login(client, "citizen_iot@test.com")
    resp = client.post("/api/v1/iot/reading", json={
        "parameter": "pH", "value": 7.0, "unit": "pH", "data_source": "LIVE",
    }, headers=auth(token))
    assert resp.status_code == 403


def test_acknowledge_alert(client, db_session):
    admin = make_admin(client, db_session)
    admin_token = login(client, "admin@test.com", "Admin@1234")
    # Create an out-of-range reading to generate alert
    client.post("/api/v1/iot/reading", json={
        "parameter": "turbidity", "value": 50.0, "unit": "NTU", "data_source": "LIVE",
    }, headers=auth(admin_token))
    alerts = client.get("/api/v1/iot/alerts", headers=auth(admin_token)).json()
    if alerts:
        alert_id = alerts[0]["id"]
        resp = client.patch(f"/api/v1/iot/alerts/{alert_id}/acknowledge", headers=auth(admin_token))
        assert resp.status_code == 200
