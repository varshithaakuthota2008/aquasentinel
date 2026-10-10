"""
IoT / simulated sensor ingest endpoint.

POST /api/v1/iot/reading  — accept a single real or simulated reading
GET  /api/v1/iot/simulate — push N simulated readings for demo (admin only)

All simulated readings are labelled data_source="SIMULATED".
"""
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, WaterMeasurement, MonitoringLocation, Alert
from ..dependencies import get_current_user, require_active

router = APIRouter(prefix="/iot", tags=["iot"])

SIMULATED_LABEL = "SIMULATED"
SIMULATED_DISCLAIMER = "Simulated sensor reading for demonstration only. Not from a physical instrument."

PARAM_RANGES = {
    "pH":               (5.5, 9.0, "pH",    6.5, 8.5, "WHO 2017"),
    "turbidity":        (0.5, 8.0, "NTU",   0.0, 4.0, "WHO 2017"),
    "dissolved_oxygen": (2.0, 9.0, "mg/L",  5.0, None, "IS 10500"),
    "conductivity":     (100, 900, "µS/cm", None, 750.0, "WHO 2017"),
    "temperature":      (15,  35,  "°C",    None, 30.0, "IS 10500"),
    "tds":              (50,  600, "mg/L",  None, 500.0, "WHO 2017"),
}


class IoTReading(BaseModel):
    location_id: int | None = None
    parameter: str = Field(min_length=1, max_length=80)
    value: float
    unit: str = Field(min_length=1, max_length=40)
    instrument: str | None = Field(default=None, max_length=200)
    data_source: str = Field(default="LIVE", max_length=100)
    measured_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=1000)


@router.post("/reading", status_code=201)
def ingest_reading(
    body: IoTReading,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Accept a single IoT or manual reading. Authenticated users only."""
    if current_user.role not in ("water_authority", "admin", "field_inspector"):
        raise HTTPException(403, "Only officials may submit IoT readings.")
    if body.location_id:
        if not db.get(MonitoringLocation, body.location_id):
            raise HTTPException(404, "Location not found.")

    PARAM_REFS = {k: v[3:6] for k, v in PARAM_RANGES.items()}
    ref = PARAM_REFS.get(body.parameter, (None, None, None))

    m = WaterMeasurement(
        location_id=body.location_id,
        measured_at=body.measured_at or datetime.now(timezone.utc),
        parameter=body.parameter,
        value=body.value,
        unit=body.unit,
        instrument=body.instrument,
        data_source=body.data_source,
        verification_status="unverified",
        reference_min=ref[0],
        reference_max=ref[1],
        reference_standard=ref[2],
        quality_flag="ok",
        notes=body.notes,
        submitted_by=current_user.id,
    )
    db.add(m)

    # Auto-alert if out of range
    if ref[0] is not None and body.value < ref[0]:
        _maybe_alert(db, body, m, f"{body.parameter} below minimum ({ref[0]})")
    elif ref[1] is not None and body.value > ref[1]:
        _maybe_alert(db, body, m, f"{body.parameter} exceeds maximum ({ref[1]})")

    db.commit()
    db.refresh(m)
    return {"id": m.id, "parameter": m.parameter, "value": m.value, "data_source": m.data_source}


def _maybe_alert(db: Session, body: IoTReading, m: WaterMeasurement, reason: str):
    dedup = f"iot_alert_{body.location_id}_{body.parameter}_{datetime.now(timezone.utc).strftime('%Y%m%d%H')}"
    existing = db.scalar(select(Alert).where(Alert.dedup_key == dedup))
    if existing:
        return
    import json
    db.add(Alert(
        location_id=body.location_id,
        title=f"Out-of-range reading: {body.parameter}",
        message=f"{reason}. Value: {body.value} {body.unit}. Source: {body.data_source}.",
        severity="high",
        trigger_type="threshold",
        trigger_values=json.dumps({"parameter": body.parameter, "value": body.value, "unit": body.unit}),
        dedup_key=dedup,
    ))


@router.get("/simulate")
def simulate_readings(
    count: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Generate simulated sensor readings for demo. Admin only."""
    if current_user.role != "admin":
        raise HTTPException(403, "Only administrators may trigger simulation.")
    locations = list(db.scalars(select(MonitoringLocation).limit(5)))
    if not locations:
        return {"message": "No locations found. Add locations or run seed_demo.py first."}

    added = 0
    for _ in range(count):
        loc = random.choice(locations)
        param = random.choice(list(PARAM_RANGES.keys()))
        lo, hi, unit, ref_min, ref_max, std = PARAM_RANGES[param]
        # Occasionally generate an out-of-range value for demo
        if random.random() < 0.15:
            val = round(random.uniform(hi * 1.05, hi * 1.4), 3) if hi else round(random.uniform(lo * 0.5, lo * 0.8), 3)
        else:
            val = round(random.uniform(lo, hi), 3)
        hours_ago = random.randint(0, 48)
        m = WaterMeasurement(
            location_id=loc.id,
            measured_at=datetime.now(timezone.utc) - timedelta(hours=hours_ago),
            parameter=param,
            value=val,
            unit=unit,
            data_source=SIMULATED_LABEL,
            verification_status="unverified",
            reference_min=ref_min,
            reference_max=ref_max,
            reference_standard=std,
            quality_flag="ok",
            notes=SIMULATED_DISCLAIMER,
            submitted_by=current_user.id,
        )
        db.add(m)
        added += 1

    db.commit()
    return {
        "added": added,
        "disclaimer": SIMULATED_DISCLAIMER,
        "message": f"{added} SIMULATED readings added. Clearly labelled — not from physical sensors.",
    }


@router.get("/alerts")
def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Access denied.")
    alerts = list(db.scalars(select(Alert).order_by(Alert.created_at.desc()).limit(100)))
    return [
        {
            "id": a.id,
            "title": a.title,
            "message": a.message,
            "severity": a.severity,
            "trigger_type": a.trigger_type,
            "location_id": a.location_id,
            "is_acknowledged": a.is_acknowledged,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]


@router.patch("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Access denied.")
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "Alert not found.")
    a.is_acknowledged = True
    a.acknowledged_by = current_user.id
    a.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
