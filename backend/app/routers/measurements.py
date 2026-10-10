"""
Water measurement router.

Measurements (lab / IoT) are strictly separated from citizen observations (WaterReport).
Data is never fabricated — demo data is clearly labelled with data_source="demo".
Water is never labelled safe/unsafe without applicable standards.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, WaterMeasurement, MonitoringLocation
from ..schemas import MeasurementCreate, MeasurementOut
from ..dependencies import get_current_user, require_active

router = APIRouter(prefix="/measurements", tags=["measurements"])

DEMO_DISCLAIMER = (
    "DEMONSTRATION DATA ONLY — not from a real instrument or laboratory. "
    "Do not use for safety decisions."
)


@router.get("", response_model=list[MeasurementOut])
def list_measurements(
    location_id: int | None = Query(None),
    parameter: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(WaterMeasurement).order_by(WaterMeasurement.measured_at.desc())
    if location_id:
        q = q.where(WaterMeasurement.location_id == location_id)
    if parameter:
        q = q.where(WaterMeasurement.parameter == parameter)
    q = q.offset(skip).limit(limit)
    return list(db.scalars(q))


@router.get("/{measurement_id}", response_model=MeasurementOut)
def get_measurement(
    measurement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = db.get(WaterMeasurement, measurement_id)
    if not m:
        raise HTTPException(404, "Measurement not found.")
    return m


@router.post("", response_model=MeasurementOut, status_code=201)
def create_measurement(
    body: MeasurementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("admin", "water_authority", "field_inspector"):
        raise HTTPException(403, "Only officials may submit measurements.")
    if body.location_id:
        if not db.get(MonitoringLocation, body.location_id):
            raise HTTPException(404, "Monitoring location not found.")
    m = WaterMeasurement(**body.model_dump(), submitted_by=current_user.id)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.get("/demo/seed")
def seed_demo_measurements(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """
    Creates clearly-labelled demo measurement records for UI demonstration.
    Only available to admin. Data source is explicitly 'demo'.
    """
    if current_user.role != "admin":
        raise HTTPException(403, "Only administrators may seed demo data.")
    from datetime import datetime, timezone, timedelta
    import random

    locations = list(db.scalars(select(MonitoringLocation).limit(3)))
    if not locations:
        return {"message": "No monitoring locations found. Add locations first."}

    params = [
        ("pH", 7.2, "pH units", 6.5, 8.5, "WHO 2017 Drinking Water Guidelines"),
        ("turbidity", 3.5, "NTU", 0.0, 4.0, "WHO 2017 Drinking Water Guidelines"),
        ("dissolved_oxygen", 6.8, "mg/L", 5.0, None, "IS 10500:2012"),
        ("conductivity", 420.0, "µS/cm", None, 750.0, "WHO 2017"),
    ]

    added = 0
    for loc in locations:
        for i in range(7):
            dt = datetime.now(timezone.utc) - timedelta(days=i)
            for param, base_val, unit, ref_min, ref_max, std in params:
                val = round(base_val + random.uniform(-0.3, 0.3), 3)
                m = WaterMeasurement(
                    location_id=loc.id,
                    measured_at=dt,
                    parameter=param,
                    value=val,
                    unit=unit,
                    data_source="demo",
                    verification_status="unverified",
                    reference_min=ref_min,
                    reference_max=ref_max,
                    reference_standard=std,
                    quality_flag="ok",
                    notes=DEMO_DISCLAIMER,
                    submitted_by=current_user.id,
                )
                db.add(m)
                added += 1
    db.commit()
    return {
        "message": f"Added {added} demo measurement records.",
        "disclaimer": DEMO_DISCLAIMER,
    }
