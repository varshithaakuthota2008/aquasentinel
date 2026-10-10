"""
CSV / XLSX import router.

Workflow:
  POST /api/v1/imports/preview   — upload file, return column names + first 10 rows
  POST /api/v1/imports/validate  — validate with column mapping, return row-level errors
  POST /api/v1/imports/commit    — save valid rows to water_measurements + dataset_imports
  GET  /api/v1/imports           — import history
  GET  /api/v1/imports/template  — download sample CSV template
"""
import io
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DatasetImport, MonitoringLocation, WaterMeasurement, User
from ..dependencies import require_active
from ..schemas import MeasurementOut

router = APIRouter(prefix="/imports", tags=["imports"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Canonical parameter names and their accepted aliases
PARAM_ALIASES: dict[str, list[str]] = {
    "sample_date":        ["date", "sample_date", "sample date", "collection_date", "datetime", "timestamp"],
    "station_id":         ["station_id", "station id", "site_id", "site id", "location_id"],
    "station_name":       ["station_name", "station name", "site_name", "site name", "location", "location_name"],
    "latitude":           ["latitude", "lat", "y"],
    "longitude":          ["longitude", "lon", "lng", "long", "x"],
    "pH":                 ["ph", "pH"],
    "turbidity":          ["turbidity", "ntu", "turbidity_ntu"],
    "tds":                ["tds", "total_dissolved_solids", "total dissolved solids"],
    "temperature":        ["temperature", "temp", "temp_c", "temperature_c"],
    "dissolved_oxygen":   ["dissolved_oxygen", "do", "do_mgl", "dissolved oxygen"],
    "conductivity":       ["conductivity", "ec", "electrical_conductivity"],
    "nitrate":            ["nitrate", "no3", "nitrate_mgl"],
    "source":             ["source", "data_source", "sample_source"],
    "notes":              ["notes", "remarks", "comment", "comments"],
}

PARAM_UNITS = {
    "pH": "pH", "turbidity": "NTU", "tds": "mg/L",
    "temperature": "°C", "dissolved_oxygen": "mg/L",
    "conductivity": "µS/cm", "nitrate": "mg/L",
}

PARAM_REFS = {
    "pH":               (6.5, 8.5, "WHO 2017"),
    "turbidity":        (0.0, 4.0, "WHO 2017"),
    "tds":              (None, 500.0, "WHO 2017"),
    "temperature":      (None, 30.0, "IS 10500"),
    "dissolved_oxygen": (5.0, None,  "IS 10500"),
    "conductivity":     (None, 750.0, "WHO 2017"),
    "nitrate":          (None, 10.0, "WHO 2017"),
}


def _auto_map(columns: list[str]) -> dict[str, str]:
    """Return {csv_col: canonical_param} for auto-detected columns."""
    mapping: dict[str, str] = {}
    for col in columns:
        key = col.strip().lower()
        for canonical, aliases in PARAM_ALIASES.items():
            if key in [a.lower() for a in aliases]:
                mapping[col] = canonical
                break
    return mapping


def _read_file(content: bytes, filename: str) -> pd.DataFrame:
    fn = filename.lower()
    if fn.endswith(".csv"):
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                return pd.read_csv(io.BytesIO(content), encoding=enc, dtype=str)
            except Exception:
                continue
        raise HTTPException(400, "Could not parse CSV — check encoding.")
    elif fn.endswith(".xlsx") or fn.endswith(".xls"):
        try:
            return pd.read_excel(io.BytesIO(content), dtype=str)
        except Exception as e:
            raise HTTPException(400, f"Could not parse Excel file: {e}")
    else:
        raise HTTPException(400, "Only CSV and XLSX/XLS files are accepted.")


def _validate_rows(df: pd.DataFrame, mapping: dict[str, str]) -> tuple[list[dict], list[dict]]:
    """
    Returns (valid_rows, errors).
    Each error: {row: int, column: str, error: str}
    Each valid row: parsed dict ready to create WaterMeasurement rows.
    """
    rev = {v: k for k, v in mapping.items()}   # canonical → csv_col
    valid: list[dict] = []
    errors: list[dict] = []

    for i, row in df.iterrows():
        row_num = int(i) + 2  # 1-based, +1 for header
        row_errors: list[dict] = []
        parsed: dict[str, Any] = {}

        # Date
        date_col = rev.get("sample_date")
        if date_col and date_col in row and pd.notna(row[date_col]) and str(row[date_col]).strip():
            try:
                parsed["measured_at"] = pd.to_datetime(str(row[date_col])).replace(tzinfo=timezone.utc)
            except Exception:
                row_errors.append({"row": row_num, "column": date_col, "error": "Cannot parse date"})
        else:
            parsed["measured_at"] = datetime.now(timezone.utc)

        # Coordinates
        for field in ("latitude", "longitude"):
            col = rev.get(field)
            if col and col in row and pd.notna(row[col]) and str(row[col]).strip():
                try:
                    val = float(str(row[col]).strip())
                    if field == "latitude"  and not (-90  <= val <= 90):  raise ValueError
                    if field == "longitude" and not (-180 <= val <= 180): raise ValueError
                    parsed[field] = val
                except ValueError:
                    row_errors.append({"row": row_num, "column": col, "error": f"Invalid {field}"})

        # Station / source info
        parsed["station_name"] = None
        parsed["station_id_raw"] = None
        for field in ("station_name", "station_id"):
            col = rev.get(field)
            if col and col in row and pd.notna(row[col]):
                parsed[field] = str(row[col]).strip()

        src_col = rev.get("source")
        parsed["data_source"] = "IMPORTED"
        if src_col and src_col in row and pd.notna(row[src_col]):
            parsed["data_source"] = str(row[src_col]).strip()

        notes_col = rev.get("notes")
        parsed["notes"] = None
        if notes_col and notes_col in row and pd.notna(row[notes_col]):
            parsed["notes"] = str(row[notes_col]).strip()

        # Numeric parameters
        numeric_params: list[tuple[str, str]] = []
        for param in ("pH", "turbidity", "tds", "temperature", "dissolved_oxygen", "conductivity", "nitrate"):
            col = rev.get(param)
            if not col or col not in row:
                continue
            raw = str(row[col]).strip() if pd.notna(row[col]) else ""
            if not raw:
                continue  # missing ≠ zero — skip silently
            try:
                val = float(raw)
                if np.isnan(val):
                    continue
                numeric_params.append((param, val))
            except ValueError:
                row_errors.append({"row": row_num, "column": col, "error": f"'{raw}' is not a number"})

        if row_errors:
            errors.extend(row_errors)
            continue

        if not numeric_params:
            errors.append({"row": row_num, "column": "—", "error": "No numeric measurements found in row"})
            continue

        # Expand: one WaterMeasurement per (row, parameter)
        for param, val in numeric_params:
            ref = PARAM_REFS.get(param, (None, None, None))
            parsed_copy = {**parsed,
                "parameter": param,
                "value": val,
                "unit": PARAM_UNITS.get(param, ""),
                "reference_min": ref[0],
                "reference_max": ref[1],
                "reference_standard": ref[2],
                "quality_flag": "ok",
                "verification_status": "unverified",
            }
            valid.append(parsed_copy)

    return valid, errors


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/template")
def download_template():
    csv_content = (
        "sample_date,station_id,station_name,latitude,longitude,"
        "pH,turbidity,tds,temperature,dissolved_oxygen,conductivity,nitrate,source,notes\n"
        "2024-01-15 08:00,ST001,Mula River Pune,18.5204,73.8567,"
        "7.2,2.1,180,24.5,6.8,320,4.5,IMPORTED,Morning sample\n"
        "2024-01-15 09:00,ST002,Bhandardara Reservoir,19.548,73.758,"
        "6.9,1.8,160,22.0,7.1,290,3.2,IMPORTED,\n"
        "2024-01-16 08:00,ST001,Mula River Pune,18.5204,73.8567,"
        "7.5,3.9,210,25.0,5.9,360,6.1,IMPORTED,After rainfall\n"
    )
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=aquasentinel_template.csv"},
    )


@router.post("/preview")
async def preview_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Only analysts and administrators may import data.")
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "File exceeds 20 MB limit.")
    df = _read_file(content, file.filename or "upload.csv")
    columns = list(df.columns)
    auto_map = _auto_map(columns)
    preview_rows = df.head(10).replace({np.nan: None}).to_dict(orient="records")
    return {
        "filename": file.filename,
        "total_rows": len(df),
        "columns": columns,
        "auto_mapping": auto_map,
        "preview_rows": preview_rows,
        "available_params": list(PARAM_ALIASES.keys()),
    }


@router.post("/validate")
async def validate_file(
    file: UploadFile = File(...),
    column_mapping: str = Form(...),   # JSON string
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Only analysts and administrators may import data.")
    content = await file.read()
    try:
        mapping: dict[str, str] = json.loads(column_mapping)
    except Exception:
        raise HTTPException(422, "column_mapping must be valid JSON.")
    df = _read_file(content, file.filename or "upload.csv")
    valid_rows, errors = _validate_rows(df, mapping)
    return {
        "total_rows": len(df),
        "accepted_rows": len(valid_rows),
        "rejected_rows": len(errors),
        "errors": errors[:200],   # cap output
        "sample_accepted": valid_rows[:5],
    }


@router.post("/commit", status_code=201)
async def commit_import(
    file: UploadFile = File(...),
    column_mapping: str = Form(...),
    source_label: str = Form("IMPORTED"),
    location_id: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Only analysts and administrators may import data.")
    content = await file.read()
    try:
        mapping: dict[str, str] = json.loads(column_mapping)
    except Exception:
        raise HTTPException(422, "column_mapping must be valid JSON.")
    df = _read_file(content, file.filename or "upload.csv")
    valid_rows, errors = _validate_rows(df, mapping)

    loc_id: int | None = None
    if location_id.strip():
        try:
            loc_id = int(location_id)
        except ValueError:
            pass

    saved = 0
    for row in valid_rows:
        m = WaterMeasurement(
            location_id=loc_id,
            measured_at=row["measured_at"],
            parameter=row["parameter"],
            value=row["value"],
            unit=row["unit"],
            data_source=source_label,
            verification_status="unverified",
            reference_min=row.get("reference_min"),
            reference_max=row.get("reference_max"),
            reference_standard=row.get("reference_standard"),
            quality_flag=row.get("quality_flag", "ok"),
            notes=row.get("notes"),
            submitted_by=current_user.id,
        )
        db.add(m)
        saved += 1

    # Record import history
    import_rec = DatasetImport(
        uploaded_by=current_user.id,
        filename=file.filename or "upload",
        source_label=source_label,
        total_rows=len(df),
        accepted_rows=saved,
        rejected_rows=len(errors),
        column_mapping=json.dumps(mapping),
        validation_errors=json.dumps(errors[:50]),
        status="completed",
    )
    db.add(import_rec)
    db.commit()
    db.refresh(import_rec)

    return {
        "import_id": import_rec.id,
        "total_rows": len(df),
        "accepted_rows": saved,
        "rejected_rows": len(errors),
        "errors": errors[:50],
        "message": f"Import complete. {saved} measurement records saved.",
    }


@router.get("")
def list_imports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Access denied.")
    from sqlalchemy import select
    rows = list(db.scalars(
        select(DatasetImport).order_by(DatasetImport.created_at.desc()).limit(50)
    ))
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "source_label": r.source_label,
            "total_rows": r.total_rows,
            "accepted_rows": r.accepted_rows,
            "rejected_rows": r.rejected_rows,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
