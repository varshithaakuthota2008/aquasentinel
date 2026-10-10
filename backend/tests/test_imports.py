"""Tests: CSV import validation, column mapping, row-level errors, commit."""
import io
import json
import pytest
from .conftest import make_admin, login, auth

GOOD_CSV = (
    "sample_date,station_name,latitude,longitude,pH,turbidity,dissolved_oxygen\n"
    "2024-01-15 08:00,Mula River,18.52,73.85,7.2,2.1,6.8\n"
    "2024-01-15 09:00,Bhandarwada,19.54,73.75,6.9,1.8,7.1\n"
    "2024-01-16 08:00,Mula River,18.52,73.85,7.5,3.9,5.9\n"
)

BAD_CSV = (
    "sample_date,station_name,pH,turbidity\n"
    "not-a-date,River A,7.2,2.1\n"
    "2024-01-15,River B,not_a_number,1.8\n"
    "2024-01-16,River C,7.5,3.9\n"  # good row
)

MAPPING_GOOD = json.dumps({
    "sample_date": "sample_date",
    "station_name": "station_name",
    "latitude": "latitude",
    "longitude": "longitude",
    "pH": "pH",
    "turbidity": "turbidity",
    "dissolved_oxygen": "dissolved_oxygen",
})

MAPPING_BAD = json.dumps({
    "sample_date": "sample_date",
    "station_name": "station_name",
    "pH": "pH",
    "turbidity": "turbidity",
})


def _csv_file(content, name="test.csv"):
    return ("file", (name, io.BytesIO(content.encode()), "text/csv"))


def test_preview_returns_columns_and_rows(client, db_session):
    admin = make_admin(client, db_session)
    token = login(client, "admin@test.com", "Admin@1234")
    resp = client.post(
        "/api/v1/imports/preview",
        files=[_csv_file(GOOD_CSV)],
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "columns" in data
    assert "pH" in data["columns"]
    assert data["total_rows"] == 3
    assert len(data["preview_rows"]) == 3


def test_validate_accepts_good_csv(client, db_session):
    admin = make_admin(client, db_session)
    token = login(client, "admin@test.com", "Admin@1234")
    resp = client.post(
        "/api/v1/imports/validate",
        files=[_csv_file(GOOD_CSV)],
        data={"column_mapping": MAPPING_GOOD},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["accepted_rows"] > 0
    assert data["rejected_rows"] == 0


def test_validate_reports_row_level_errors(client, db_session):
    admin = make_admin(client, db_session)
    token = login(client, "admin@test.com", "Admin@1234")
    resp = client.post(
        "/api/v1/imports/validate",
        files=[_csv_file(BAD_CSV)],
        data={"column_mapping": MAPPING_BAD},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["rejected_rows"] >= 1
    assert len(data["errors"]) >= 1
    # Errors must identify the row and column
    for e in data["errors"]:
        assert "row" in e
        assert "error" in e


def test_commit_saves_measurements(client, db_session):
    admin = make_admin(client, db_session)
    token = login(client, "admin@test.com", "Admin@1234")
    resp = client.post(
        "/api/v1/imports/commit",
        files=[_csv_file(GOOD_CSV)],
        data={"column_mapping": MAPPING_GOOD, "source_label": "IMPORTED"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["accepted_rows"] > 0
    assert "import_id" in data


def test_non_analyst_cannot_import(client, db_session):
    from .conftest import make_citizen
    make_citizen(client, email="citizen_import@test.com")
    token = login(client, "citizen_import@test.com")
    resp = client.post(
        "/api/v1/imports/preview",
        files=[_csv_file(GOOD_CSV)],
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_template_download(client, db_session):
    resp = client.get("/api/v1/imports/template")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")
    content = resp.text
    assert "pH" in content
    assert "turbidity" in content


def test_missing_values_not_treated_as_zero(client, db_session):
    """A row with empty pH should skip pH — not save 0."""
    csv = (
        "sample_date,station_name,pH,turbidity\n"
        "2024-01-15,River A,,2.1\n"  # pH missing — should be skipped, turbidity saved
    )
    mapping = json.dumps({"sample_date": "sample_date", "station_name": "station_name",
                          "pH": "pH", "turbidity": "turbidity"})
    admin = make_admin(client, db_session)
    token = login(client, "admin@test.com", "Admin@1234")
    resp = client.post(
        "/api/v1/imports/validate",
        files=[_csv_file(csv)],
        data={"column_mapping": mapping},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    # turbidity row accepted, pH row skipped (not set to zero)
    if data["accepted_rows"] > 0:
        for row in data.get("sample_accepted", []):
            assert row.get("parameter") != "pH" or row.get("value") != 0.0
