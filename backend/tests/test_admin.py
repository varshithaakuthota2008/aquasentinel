"""Tests: admin approval, rejection, access revocation, access control."""
import pytest
from .conftest import make_citizen, make_official, make_admin, login, auth


def test_admin_can_approve_official(client, db_session):
    admin = make_admin(client, db_session)
    official = make_official(client, email="approve@test.com")
    admin_token = login(client, "admin@test.com", "Admin@1234")

    r = client.post(
        f"/admin/applications/{official['id']}/review",
        json={"decision": "approve", "reason": "Credentials OK"},
        headers=auth(admin_token),
    )
    assert r.status_code == 200
    assert r.json()["account_status"] == "active"


def test_approved_official_can_login(client, db_session):
    admin = make_admin(client, db_session)
    make_official(client, email="approved@test.com")
    admin_token = login(client, "admin@test.com", "Admin@1234")

    # find the user id
    apps = client.get("/admin/applications", headers=auth(admin_token)).json()
    uid = next(u["id"] for u in apps if u["email"] == "approved@test.com")
    client.post(f"/admin/applications/{uid}/review", json={"decision": "approve"}, headers=auth(admin_token))

    r = client.post("/auth/login", json={"email": "approved@test.com", "password": "Test@1234"})
    assert r.status_code == 200


def test_admin_can_reject_official(client, db_session):
    admin = make_admin(client, db_session)
    official = make_official(client, email="reject@test.com")
    admin_token = login(client, "admin@test.com", "Admin@1234")

    r = client.post(
        f"/admin/applications/{official['id']}/review",
        json={"decision": "reject", "reason": "Unverified"},
        headers=auth(admin_token),
    )
    assert r.status_code == 200
    assert r.json()["account_status"] == "rejected"


def test_rejected_official_cannot_login(client, db_session):
    admin = make_admin(client, db_session)
    official = make_official(client, email="rejectlogin@test.com")
    admin_token = login(client, "admin@test.com", "Admin@1234")
    client.post(f"/admin/applications/{official['id']}/review",
                json={"decision": "reject"}, headers=auth(admin_token))

    r = client.post("/auth/login", json={"email": "rejectlogin@test.com", "password": "Test@1234"})
    assert r.status_code == 403


def test_nonadmin_cannot_access_admin_endpoints(client):
    make_citizen(client, email="citizen_noadmin@test.com")
    token = login(client, "citizen_noadmin@test.com")
    r = client.get("/admin/applications", headers=auth(token))
    assert r.status_code == 403


def test_admin_summary_returns_counts(client, db_session):
    admin = make_admin(client, db_session)
    admin_token = login(client, "admin@test.com", "Admin@1234")
    r = client.get("/admin/summary", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert "total_users" in data
    assert "total_reports" in data
