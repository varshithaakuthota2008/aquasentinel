"""
Analytics router — all data is computed from real database records.
No hardcoded statistics are ever returned as if they were real results.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from ..database import get_db
from ..models import User, WaterReport, Inspection, MonitoringLocation
from ..dependencies import require_active

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _report_query(
    db: Session,
    user: User,
    date_from: datetime | None,
    date_to: datetime | None,
    source_type: str | None,
    risk_category: str | None,
    location_id: int | None,
):
    q = select(WaterReport)
    if user.role == "citizen":
        q = q.where(WaterReport.reporter_id == user.id)
    if date_from:
        q = q.where(WaterReport.created_at >= date_from)
    if date_to:
        q = q.where(WaterReport.created_at <= date_to)
    if source_type:
        q = q.where(WaterReport.source_type == source_type)
    if risk_category:
        q = q.where(WaterReport.risk_category == risk_category)
    if location_id:
        q = q.where(WaterReport.location_id == location_id)
    return list(db.scalars(q))


@router.get("/overview")
def overview(
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    source_type: str | None = Query(None),
    risk_category: str | None = Query(None),
    location_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    reports = _report_query(db, current_user, date_from, date_to, source_type, risk_category, location_id)
    inspections = list(db.scalars(select(Inspection)))

    by_status = {"pending_review": 0, "under_review": 0, "resolved": 0}
    by_risk   = {"low": 0, "moderate": 0, "high": 0, "critical": 0, "unscored": 0}
    by_source = {}

    for r in reports:
        by_status[r.status] = by_status.get(r.status, 0) + 1
        cat = r.risk_category or "unscored"
        by_risk[cat] = by_risk.get(cat, 0) + 1
        by_source[r.source_type] = by_source.get(r.source_type, 0) + 1

    by_outcome = {}
    for i in inspections:
        by_outcome[i.outcome] = by_outcome.get(i.outcome, 0) + 1

    return {
        "total_reports": len(reports),
        "by_status": by_status,
        "by_risk_category": by_risk,
        "by_source_type": by_source,
        "total_inspections": len(inspections),
        "by_inspection_outcome": by_outcome,
        "note": "All statistics computed from live database records.",
    }


@router.get("/time-series")
def time_series(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Return daily report counts for the last N days."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    q = select(WaterReport).where(WaterReport.created_at >= start)
    if current_user.role == "citizen":
        q = q.where(WaterReport.reporter_id == current_user.id)
    reports = list(db.scalars(q))

    # Build daily buckets
    buckets: dict[str, dict] = {}
    for i in range(days):
        day = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        buckets[day] = {"date": day, "total": 0, "high_risk": 0}

    for r in reports:
        dt = r.created_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        day = dt.strftime("%Y-%m-%d")
        if day in buckets:
            buckets[day]["total"] += 1
            if r.risk_category in ("high", "critical"):
                buckets[day]["high_risk"] += 1

    return {"series": list(buckets.values()), "days": days}


@router.get("/by-category")
def by_category(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    q = select(WaterReport)
    if current_user.role == "citizen":
        q = q.where(WaterReport.reporter_id == current_user.id)
    reports = list(db.scalars(q))
    counts = {"low": 0, "moderate": 0, "high": 0, "critical": 0, "unscored": 0}
    for r in reports:
        key = r.risk_category or "unscored"
        counts[key] = counts.get(key, 0) + 1
    return [{"category": k, "count": v} for k, v in counts.items()]


@router.get("/by-source")
def by_source(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    q = select(WaterReport)
    if current_user.role == "citizen":
        q = q.where(WaterReport.reporter_id == current_user.id)
    reports = list(db.scalars(q))
    counts: dict[str, int] = {}
    for r in reports:
        counts[r.source_type] = counts.get(r.source_type, 0) + 1
    return [{"source_type": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])]


@router.get("/inspections")
def inspection_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role == "citizen":
        raise HTTPException(403, "Inspection analytics are not available to citizens.")
    inspections = list(db.scalars(select(Inspection)))
    by_outcome: dict[str, int] = {}
    for i in inspections:
        by_outcome[i.outcome] = by_outcome.get(i.outcome, 0) + 1
    follow_up_required = sum(1 for i in inspections if i.follow_up_required)
    return {
        "total": len(inspections),
        "by_outcome": [{"outcome": k, "count": v} for k, v in by_outcome.items()],
        "follow_up_required": follow_up_required,
    }
