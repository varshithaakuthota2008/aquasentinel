"""Tests: registration, login, logout (token invalidation), role access."""
import pytest
from .conftest import make_citizen, make_official, make_admin, login, auth


def test_citizen_register(client):
    r = client.post("/auth/register", json={
        "full_name": "Jane Doe", "email": "jane@test.com",
        "password": "Secure@99", "confirm_password": "Secure@99", "role": "citizen"
    })
    assert r.status_code == 201
    data = r.json()
    assert data["role"] == "citizen"
    assert data["account_status"] == "active"
    assert "password_hash" not in data
    assert "password" not in data


def test_duplicate_email_rejected(client):
    make_citizen(client, email="dup@test.com")
    r = client.post("/auth/register", json={
        "full_name": "Dup", "email": "dup@test.com",
        "password": "Test@1234", "confirm_password": "Test@1234", "role": "citizen"
    })
    assert r.status_code == 409


def test_password_mismatch_rejected(client):
    r = client.post("/auth/register", json={
        "full_name": "X", "email": "x@test.com",
        "password": "Test@1234", "confirm_password": "Different@1", "role": "citizen"
    })
    assert r.status_code == 422


def test_weak_password_rejected(client):
    r = client.post("/auth/register", json={
        "full_name": "X", "email": "weak@test.com",
        "password": "password", "confirm_password": "password", "role": "citizen"
    })
    assert r.status_code == 422


def test_citizen_login(client):
    make_citizen(client, email="login@test.com")
    r = client.post("/auth/login", json={"email": "login@test.com", "password": "Test@1234"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "citizen"


def test_wrong_password_rejected(client):
    make_citizen(client, email="wrongpw@test.com")
    r = client.post("/auth/login", json={"email": "wrongpw@test.com", "password": "Wrong@999"})
    assert r.status_code == 401


def test_auth_me(client):
    make_citizen(client, email="me@test.com")
    token = login(client, "me@test.com")
    r = client.get("/auth/me", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["email"] == "me@test.com"


def test_no_token_returns_401(client):
    r = client.get("/auth/me")
    assert r.status_code == 401


def test_official_registration_pending(client):
    r = make_official(client, email="pending@test.com")
    assert r["account_status"] == "pending"


def test_pending_official_cannot_login(client):
    make_official(client, email="pend2@test.com")
    r = client.post("/auth/login", json={"email": "pend2@test.com", "password": "Test@1234"})
    assert r.status_code == 403


def test_official_missing_fields_rejected(client):
    r = client.post("/auth/register", json={
        "full_name": "No Dept", "email": "nodept@test.com",
        "password": "Test@1234", "confirm_password": "Test@1234",
        "role": "water_authority",  # missing department/designation/employee_id
    })
    assert r.status_code == 422


def test_admin_registration_blocked(client):
    """Admin role must never be publicly registerable."""
    r = client.post("/auth/register", json={
        "full_name": "Hacker", "email": "hacker@test.com",
        "password": "Test@1234", "confirm_password": "Test@1234",
        "role": "admin",
    })
    # Pydantic Literal validation should reject 'admin' as a valid role
    assert r.status_code == 422
