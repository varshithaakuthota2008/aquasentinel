"""
Test fixtures — uses a separate test.db file, never touches production aquasentinel.db.
Sets DATABASE_URL env var BEFORE any app import so the app's engine points at test.db.
"""
import os
import pytest
from pathlib import Path

# ── Point the app at a test database before importing anything from app ──────
TEST_DB_PATH = Path(__file__).resolve().parent / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db, engine as app_engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create all tables in test.db once per session."""
    Base.metadata.create_all(bind=app_engine)
    yield
    Base.metadata.drop_all(bind=app_engine)
    app_engine.dispose()  # release file lock before deletion
    import time; time.sleep(0.1)
    try:
        if TEST_DB_PATH.exists():
            TEST_DB_PATH.unlink()
    except PermissionError:
        pass  # Windows may still hold the file; next run will overwrite it


@pytest.fixture(scope="function")
def db_session():
    TestSession = sessionmaker(bind=app_engine, autoflush=False, autocommit=False)
    session = TestSession()
    try:
        yield session
    finally:
        session.rollback()
        # Clean up all rows after each test to keep tests isolated
        from app.models import (
            User, WaterReport, MonitoringLocation, Inspection,
            AdminLog, Notification, RiskHistory, WaterMeasurement,
        )
        for model in [Notification, RiskHistory, Inspection, WaterReport,
                      AdminLog, MonitoringLocation, User]:
            session.query(model).delete()
        session.commit()
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ── Helper factories ──────────────────────────────────────────────────────────

def make_citizen(client, email="citizen@test.com", password="Test@1234"):
    r = client.post("/auth/register", json={
        "full_name": "Test Citizen", "email": email,
        "password": password, "confirm_password": password, "role": "citizen",
    })
    assert r.status_code == 201, r.text
    return r.json()


def login(client, email, password="Test@1234"):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def make_official(client, role="water_authority", email="official@test.com", password="Test@1234"):
    r = client.post("/auth/register", json={
        "full_name": "Test Official", "email": email,
        "password": password, "confirm_password": password,
        "role": role,
        "department": "Water Dept",
        "designation": "Officer",
        "employee_id": "EMP001",
    })
    assert r.status_code == 201, r.text
    return r.json()


def make_admin(client, db_session):
    from app.models import User
    from app.security import hash_password
    existing = db_session.scalar(select(User).where(User.email == "admin@test.com"))
    if existing:
        return existing
    admin = User(
        full_name="Admin", email="admin@test.com",
        password_hash=hash_password("Admin@1234"),
        role="admin", account_status="active",
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin
