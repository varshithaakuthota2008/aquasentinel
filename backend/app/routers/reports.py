import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, WaterReport
from ..schemas import ReportCreate, ReportOut, ReportStatusUpdate
from ..risk_scoring import calculate_risk
from ..dependencies import get_current_user, require_active, require_reporter

router = APIRouter(prefix="/reports", tags=["reports"])


def _nearby_reports(db: Session, report: WaterReport) -> list[WaterReport]:
    if report.latitude is None or report.longitude is None:
        return []
    delta = 0.1  # ~11 km bounding box
    return list(db.scalars(
        select(WaterReport).where(
            WaterReport.latitude.between(report.latitude - delta, report.latitude + delta),
            WaterReport.longitude.between(report.longitude - delta, report.longitude + delta),
        )
    ))


def score_and_save(db: Session, report: WaterReport):
    """Compute risk score, persist it, record history, and trigger alerts."""
    from ..routers.notifications import maybe_create_alerts
    from ..models import RiskHistory
    nearby = _nearby_reports(db, report)
    result = calculate_risk(report, nearby)
    report.risk_score = result["risk_score"]
    report.risk_category = result["risk_category"]
    report.risk_factors = json.dumps(result["factors"])
    report.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)
    # Record history snapshot
    db.add(RiskHistory(
        report_id=report.id,
        risk_score=result["risk_score"],
        risk_category=result["risk_category"],
        risk_factors=json.dumps(result["factors"]),
    ))
    db.commit()
    # Trigger notifications for high/critical
    maybe_create_alerts(db, report)
    return result


@router.post("", response_model=ReportOut, status_code=201)
def create_report(
    body: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reporter),
):
    report = WaterReport(
        **body.model_dump(),
        reporter_id=current_user.id,
        status="pending_review",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    score_and_save(db, report)
    return report


@router.get("", response_model=list[ReportOut])
def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = Query(None),
    risk_category: str | None = Query(None),
    source_type: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(WaterReport).order_by(WaterReport.created_at.desc())
    # Citizens only see their own reports
    if current_user.role == "citizen":
        q = q.where(WaterReport.reporter_id == current_user.id)
    # Filters
    if status:
        q = q.where(WaterReport.status == status)
    if risk_category:
        q = q.where(WaterReport.risk_category == risk_category)
    if source_type:
        q = q.where(WaterReport.source_type == source_type)
    q = q.offset(skip).limit(limit)
    return list(db.scalars(q))


@router.get("/count")
def count_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return total count for pagination."""
    from sqlalchemy import func
    q = select(func.count()).select_from(WaterReport)
    if current_user.role == "citizen":
        q = q.where(WaterReport.reporter_id == current_user.id)
    return {"count": db.scalar(q)}


@router.get("/{report_id}", response_model=ReportOut)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.get(WaterReport, report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    if current_user.role == "citizen" and report.reporter_id != current_user.id:
        raise HTTPException(403, "You can only view your own reports.")
    return report


@router.patch("/{report_id}/status", response_model=ReportOut)
def update_status(
    report_id: int,
    body: ReportStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("admin", "water_authority"):
        raise HTTPException(403, "Only administrators and approved water authority officials may update report status.")
    report = db.get(WaterReport, report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    report.status = body.status
    report.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)
    return report


@router.post("/{report_id}/rescore", response_model=ReportOut)
def rescore_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Recalculate risk score for an existing report."""
    if current_user.role not in ("admin", "water_authority"):
        raise HTTPException(403, "Only administrators and water authority officials may trigger rescoring.")
    report = db.get(WaterReport, report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    score_and_save(db, report)
    return report


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role != "admin":
        raise HTTPException(403, "Only administrators may delete reports.")
    report = db.get(WaterReport, report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    db.delete(report)
    db.commit()
