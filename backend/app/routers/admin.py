"""
Admin router — all endpoints require admin role.
Covers: user management, approvals, station overview, audit logs, system settings.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from ..database import get_db
from ..models import (
    User, WaterReport, AdminLog, Alert,
    MonitoringLocation, RiskConfig, WaterMeasurement,
)
from ..schemas import UserOut, AdminLogOut
from ..dependencies import require_admin, require_active

router = APIRouter(prefix="/admin", tags=["admin"])

# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return list(db.scalars(select(User).order_by(User.created_at.desc())))


@router.get("/pending", response_model=list[UserOut])
def list_pending(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return list(db.scalars(
        select(User)
        .where(User.role.in_(["water_authority", "field_inspector"]),
               User.account_status == "pending")
        .order_by(User.created_at.desc())
    ))


@router.get("/verifiers", response_model=list[UserOut])
def list_verifiers(db: Session = Depends(get_db), current_user: User = Depends(require_active)):
    if current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Access denied.")
    return list(db.scalars(
        select(User)
        .where(User.role == "field_inspector", User.account_status == "active")
        .order_by(User.full_name)
    ))


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    status: str = Body(..., embed=True),   # "active" | "revoked" | "rejected"
    reason: str = Body("", embed=True),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Activate, suspend, or revoke any non-admin account."""
    if status not in ("active", "revoked", "rejected"):
        raise HTTPException(422, "status must be active, revoked, or rejected.")
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found.")
    if target.role == "admin":
        raise HTTPException(400, "Administrator accounts cannot be modified via this endpoint.")
    if target.id == current_admin.id:
        raise HTTPException(400, "You cannot change your own account status.")
    # Prevent removing last admin
    if status != "active" and target.role == "admin":
        raise HTTPException(400, "Cannot suspend the last administrator.")
    old_status = target.account_status
    target.account_status = status
    target.reviewed_by = current_admin.id
    target.reviewed_at = datetime.now(timezone.utc)
    if reason:
        target.review_reason = reason
    db.add(AdminLog(
        admin_id=current_admin.id,
        action=f"status_change_{status}",
        target_user_id=target.id,
        notes=f"Changed from {old_status} to {status}. {reason}".strip(),
    ))
    db.commit()
    db.refresh(target)
    return UserOut.model_validate(target)


# ── Approvals ─────────────────────────────────────────────────────────────────
# (review endpoint lives in main.py at /admin/applications/{id}/review)
# This endpoint is an alias for convenience:

@router.get("/reports-all")
def list_all_reports(db: Session = Depends(get_db), current_user: User = Depends(require_active)):
    if current_user.role not in ("admin", "water_authority"):
        raise HTTPException(403, "Access denied.")
    return list(db.scalars(select(WaterReport).order_by(WaterReport.created_at.desc())))


# ── Stations ──────────────────────────────────────────────────────────────────

@router.get("/stations")
def list_stations(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    stations = list(db.scalars(select(MonitoringLocation).order_by(MonitoringLocation.name)))
    # Attach latest measurement timestamp per station
    result = []
    for s in stations:
        latest = db.scalar(
            select(WaterMeasurement.measured_at)
            .where(WaterMeasurement.location_id == s.id)
            .order_by(WaterMeasurement.measured_at.desc())
            .limit(1)
        )
        meas_count = db.scalar(
            select(func.count()).select_from(WaterMeasurement)
            .where(WaterMeasurement.location_id == s.id)
        ) or 0
        result.append({
            "id": s.id,
            "name": s.name,
            "source_type": s.source_type,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "district": s.district,
            "state": s.state,
            "is_active": s.is_active,
            "description": s.description,
            "created_at": s.created_at.isoformat(),
            "latest_measurement": latest.isoformat() if latest else None,
            "measurement_count": meas_count,
        })
    return result


@router.patch("/stations/{station_id}/status")
def toggle_station_status(
    station_id: int,
    is_active: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    station = db.get(MonitoringLocation, station_id)
    if not station:
        raise HTTPException(404, "Station not found.")
    station.is_active = is_active
    db.add(AdminLog(
        admin_id=current_admin.id,
        action="station_" + ("activated" if is_active else "deactivated"),
        notes=f"Station '{station.name}' (#{station_id})",
    ))
    db.commit()
    return {"id": station.id, "name": station.name, "is_active": station.is_active}


@router.post("/stations", status_code=201)
def create_station(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    required = {"name", "source_type"}
    missing = required - body.keys()
    if missing:
        raise HTTPException(422, f"Missing required fields: {missing}")
    lat = body.get("latitude")
    lon = body.get("longitude")
    if lat is not None and not (-90 <= float(lat) <= 90):
        raise HTTPException(422, "Latitude must be between -90 and 90.")
    if lon is not None and not (-180 <= float(lon) <= 180):
        raise HTTPException(422, "Longitude must be between -180 and 180.")
    station = MonitoringLocation(
        name=str(body["name"]).strip(),
        source_type=str(body["source_type"]),
        description=body.get("description"),
        latitude=float(lat) if lat is not None else None,
        longitude=float(lon) if lon is not None else None,
        district=body.get("district"),
        state=body.get("state"),
        is_active=bool(body.get("is_active", True)),
        created_by=current_admin.id,
    )
    db.add(station)
    db.add(AdminLog(
        admin_id=current_admin.id,
        action="station_created",
        notes=f"Created station '{station.name}'",
    ))
    db.commit()
    db.refresh(station)
    return {"id": station.id, "name": station.name, "source_type": station.source_type}


@router.put("/stations/{station_id}")
def update_station(
    station_id: int,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    station = db.get(MonitoringLocation, station_id)
    if not station:
        raise HTTPException(404, "Station not found.")
    for field in ("name", "description", "source_type", "latitude", "longitude", "district", "state", "is_active"):
        if field in body:
            setattr(station, field, body[field])
    db.add(AdminLog(
        admin_id=current_admin.id,
        action="station_updated",
        notes=f"Updated station '{station.name}' (#{station_id})",
    ))
    db.commit()
    db.refresh(station)
    return {"id": station.id, "name": station.name}


# ── Logs ──────────────────────────────────────────────────────────────────────

@router.get("/logs", response_model=list[AdminLogOut])
def get_logs(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return list(db.scalars(select(AdminLog).order_by(AdminLog.created_at.desc()).limit(500)))


# ── Summary ───────────────────────────────────────────────────────────────────

@router.get("/summary")
def admin_full_summary(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    users   = list(db.scalars(select(User)))
    reports = list(db.scalars(select(WaterReport)))
    alerts  = list(db.scalars(select(Alert)))
    stations= list(db.scalars(select(MonitoringLocation)))
    recent_logs = list(db.scalars(
        select(AdminLog).order_by(AdminLog.created_at.desc()).limit(5)
    ))
    return {
        "total_users":           len(users),
        "citizens":              sum(u.role == "citizen" for u in users),
        "analysts":              sum(u.role == "water_authority" for u in users),
        "verifiers":             sum(u.role == "field_inspector" for u in users),
        "admins":                sum(u.role == "admin" for u in users),
        "pending_approvals":     sum(u.account_status == "pending" and u.role in ("water_authority","field_inspector") for u in users),
        "active_officials":      sum(u.account_status == "active" and u.role in ("water_authority","field_inspector") for u in users),
        "suspended_accounts":    sum(u.account_status in ("rejected","revoked") for u in users),
        "total_stations":        len(stations),
        "active_stations":       sum(s.is_active for s in stations),
        "total_reports":         len(reports),
        "high_risk":             sum(r.risk_category in ("high","critical") for r in reports),
        "unacknowledged_alerts": sum(not a.is_acknowledged for a in alerts),
        "recent_activity": [
            {
                "action": log.action,
                "target_user_id": log.target_user_id,
                "notes": log.notes,
                "created_at": log.created_at.isoformat(),
            }
            for log in recent_logs
        ],
    }


# ── System Settings ───────────────────────────────────────────────────────────

SETTING_DESCRIPTIONS = {
    "platform_name":       "AquaSentinel — display name shown in the UI",
    "default_timezone":    "Timezone for display (e.g. Asia/Kolkata)",
    "risk_score_high":     "Minimum risk score to classify as High (default: 50)",
    "risk_score_critical": "Minimum risk score to classify as Critical (default: 75)",
    "alert_threshold_ph_min":       "pH minimum threshold for auto-alert",
    "alert_threshold_ph_max":       "pH maximum threshold for auto-alert",
    "alert_threshold_turbidity":    "Turbidity NTU maximum for auto-alert",
    "alert_threshold_tds":          "TDS mg/L maximum for auto-alert",
    "notification_email_enabled":   "Set to 'true' to enable email notifications (requires SMTP config)",
    "notification_email_from":      "Sender email address for notifications",
}

DEFAULT_SETTINGS = {
    "platform_name":              "AquaSentinel",
    "default_timezone":           "Asia/Kolkata",
    "risk_score_high":            "50",
    "risk_score_critical":        "75",
    "alert_threshold_ph_min":     "6.5",
    "alert_threshold_ph_max":     "8.5",
    "alert_threshold_turbidity":  "4.0",
    "alert_threshold_tds":        "500",
    "notification_email_enabled": "false",
    "notification_email_from":    "",
}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    stored = {r.key: r.value for r in db.scalars(select(RiskConfig))}
    result = {}
    for key, default in DEFAULT_SETTINGS.items():
        result[key] = {
            "value": stored.get(key, default),
            "description": SETTING_DESCRIPTIONS.get(key, ""),
            "is_default": key not in stored,
        }
    return result


@router.patch("/settings")
def update_settings(
    updates: dict = Body(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    allowed = set(DEFAULT_SETTINGS.keys())
    invalid = set(updates.keys()) - allowed
    if invalid:
        raise HTTPException(422, f"Unknown setting keys: {invalid}")
    for key, value in updates.items():
        existing = db.scalar(select(RiskConfig).where(RiskConfig.key == key))
        if existing:
            existing.value = str(value)
            existing.updated_at = datetime.now(timezone.utc)
        else:
            db.add(RiskConfig(
                key=key, value=str(value),
                description=SETTING_DESCRIPTIONS.get(key, ""),
            ))
    db.add(AdminLog(
        admin_id=current_admin.id,
        action="settings_updated",
        notes=f"Updated settings: {list(updates.keys())}",
    ))
    db.commit()
    return {"updated": list(updates.keys()), "message": "Settings saved."}
