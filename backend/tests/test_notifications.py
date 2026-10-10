"""Tests: notification creation on high-risk reports, dedup, mark-read."""
import pytest
from datetime import datetime, timezone
from .conftest import make_citizen, make_official, make_admin, login, auth

REPORT_HIGH = {
    "source_type": "river",
    "latitude": 18.52, "longitude": 73.85,
    "observation_date": datetime.now(timezone.utc).isoformat(),
    "appearance": "unusual_color", "odor": "unusual",
    "visible_waste": True, "suspected_contamination": True,
}

REPORT_LOW = {
    "source_type": "tap",
    "observation_date": datetime.now(timezone.utc).isoformat(),
    "appearance": "clear", "odor": "normal",
    "visible_waste": False, "suspected_contamination": False,
}


def test_high_risk_generates_notifications_for_officials(client, db_session):
    """A high/critical risk report should create notifications for officials."""
    admin = make_admin(client, db_session)
    admin_token = login(client, "admin@test.com", "Admin@1234")

    # Register + approve an official
    make_official(client, email="notif_official@test.com")
    apps = client.get("/admin/applications", headers=auth(admin_token)).json()
    uid = next(u["id"] for u in apps if u["email"] == "notif_official@test.com")
    client.post(f"/admin/applications/{uid}/review",
                json={"decision": "approve"}, headers=auth(admin_token))

    official_token = login(client, "notif_official@test.com")

    # Citizen submits high-risk report
    make_citizen(client, email="notif_citizen@test.com")
    citizen_token = login(client, "notif_citizen@test.com")
    r = client.post("/api/v1/reports", json=REPORT_HIGH, headers=auth(citizen_token))
    assert r.status_code == 201

    # Official should have at least one notification
    notifs = client.get("/api/v1/notifications", headers=auth(official_token)).json()
    assert len(notifs) >= 1
    assert any(n["report_id"] == r.json()["id"] for n in notifs)


def test_low_risk_no_notification(client, db_session):
    admin = make_admin(client, db_session)
    admin_token = login(client, "admin@test.com", "Admin@1234")

    make_citizen(client, email="low_reporter@test.com")
    token = login(client, "low_reporter@test.com")
    r = client.post("/api/v1/reports", json=REPORT_LOW, headers=auth(token))
    # Check admin has no new notifications from this low-risk report
    notifs = client.get("/api/v1/notifications", headers=auth(admin_token)).json()
    # Admin should only see notifications for high-risk reports in this test scope
    high_notifs = [n for n in notifs if n["report_id"] == r.json()["id"]]
    assert len(high_notifs) == 0


def test_notification_deduplication(client, db_session):
    """Same event should not create two notifications for same user."""
    admin = make_admin(client, db_session)
    admin_token = login(client, "admin@test.com", "Admin@1234")

    make_citizen(client, email="dedup_reporter@test.com")
    citizen_token = login(client, "dedup_reporter@test.com")
    r = client.post("/api/v1/reports", json=REPORT_HIGH, headers=auth(citizen_token))
    report_id = r.json()["id"]

    # Trigger rescore (would re-run maybe_create_alerts)
    client.post(f"/api/v1/reports/{report_id}/rescore", headers=auth(admin_token))

    notifs = client.get("/api/v1/notifications", headers=auth(admin_token)).json()
    count = sum(1 for n in notifs if n["report_id"] == report_id)
    assert count == 1, "Deduplication failed — duplicate notifications created"


def test_mark_notification_read(client, db_session):
    admin = make_admin(client, db_session)
    admin_token = login(client, "admin@test.com", "Admin@1234")

    make_citizen(client, email="mark_reporter@test.com")
    token = login(client, "mark_reporter@test.com")
    client.post("/api/v1/reports", json=REPORT_HIGH, headers=auth(token))

    notifs = client.get("/api/v1/notifications", headers=auth(admin_token)).json()
    if notifs:
        nid = notifs[0]["id"]
        r = client.patch(f"/api/v1/notifications/{nid}/read", headers=auth(admin_token))
        assert r.status_code == 200
        assert r.json()["is_read"] is True


def test_notification_count_endpoint(client, db_session):
    admin = make_admin(client, db_session)
    admin_token = login(client, "admin@test.com", "Admin@1234")

    r = client.get("/api/v1/notifications/count", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert "unread" in data
    assert "total" in data
