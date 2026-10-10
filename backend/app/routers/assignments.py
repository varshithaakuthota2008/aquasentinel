"""
Inspection Assignment router.

Workflow:
  1. Analyst (water_authority/admin) creates an assignment linking a WaterReport to a field_inspector.
  2. Field inspector sees their assignments, accepts, and updates status.
  3. Analyst reviews submitted observation and records decision.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, InspectionAssignment, WaterReport, Notification
from ..schemas import AssignmentCreate, AssignmentStatusUpdate, AssignmentAnalystReview, AssignmentOut
from ..dependencies import get_current_user, require_active

router = APIRouter(prefix="/assignments", tags=["assignments"])


def _notify_user(db: Session, user_id: int, title: str, message: str,
                 category: str = "info", report_id: int | None = None,
                 dedup_key: str | None = None):
    if dedup_key:
        existing = db.scalar(select(Notification).where(Notification.dedup_key == dedup_key))
        if existing:
            return
    notif = Notification(
        user_id=user_id, title=title, message=message,
        category=category, report_id=report_id, dedup_key=dedup_key,
    )
    db.add(notif)


@router.post("", response_model=AssignmentOut, status_code=201)
def create_assignment(
    body: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Only analysts and administrators may create assignments.")
    report = db.get(WaterReport, body.report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    verifier = db.get(User, body.assigned_to)
    if not verifier or verifier.role != "field_inspector" or verifier.account_status != "active":
        raise HTTPException(400, "Target user is not an active field verifier.")
    assignment = InspectionAssignment(
        **body.model_dump(),
        assigned_by=current_user.id,
        status="new",
    )
    db.add(assignment)
    db.flush()
    _notify_user(
        db, verifier.id,
        f"New inspection assignment — Report #{report.id}",
        f"You have been assigned to inspect report #{report.id} ({report.source_type}). "
        f"Priority: {body.priority}. {body.instructions or ''}",
        category="info",
        report_id=report.id,
        dedup_key=f"assignment_{assignment.id}_new_{verifier.id}",
    )
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("", response_model=list[AssignmentOut])
def list_assignments(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(InspectionAssignment).order_by(InspectionAssignment.created_at.desc())
    if current_user.role == "field_inspector":
        q = q.where(InspectionAssignment.assigned_to == current_user.id)
    elif current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Access denied.")
    if status:
        q = q.where(InspectionAssignment.status == status)
    return list(db.scalars(q))


@router.get("/{assignment_id}", response_model=AssignmentOut)
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = db.get(InspectionAssignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found.")
    if current_user.role == "field_inspector" and a.assigned_to != current_user.id:
        raise HTTPException(403, "Access denied.")
    elif current_user.role not in ("field_inspector", "water_authority", "admin"):
        raise HTTPException(403, "Access denied.")
    return a


@router.patch("/{assignment_id}/status", response_model=AssignmentOut)
def update_assignment_status(
    assignment_id: int,
    body: AssignmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    a = db.get(InspectionAssignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found.")
    if current_user.role == "field_inspector" and a.assigned_to != current_user.id:
        raise HTTPException(403, "You can only update your own assignments.")
    elif current_user.role not in ("field_inspector", "water_authority", "admin"):
        raise HTTPException(403, "Access denied.")
    a.status = body.status
    a.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(a)
    return a


@router.patch("/{assignment_id}/review", response_model=AssignmentOut)
def analyst_review(
    assignment_id: int,
    body: AssignmentAnalystReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Only analysts may review assignments.")
    a = db.get(InspectionAssignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found.")
    a.analyst_decision = body.analyst_decision
    a.analyst_notes = body.analyst_notes
    a.status = "reviewed" if body.analyst_decision == "accepted" else "returned"
    a.updated_at = datetime.now(timezone.utc)
    # Notify the verifier
    label = {"accepted": "Accepted", "corrections_requested": "Corrections requested", "further_testing": "Further testing required"}.get(body.analyst_decision, body.analyst_decision)
    _notify_user(
        db, a.assigned_to,
        f"Inspection review: {label} — Assignment #{a.id}",
        f"The analyst has reviewed your submission. Decision: {label}. "
        f"{body.analyst_notes or ''}",
        category="info" if body.analyst_decision == "accepted" else "warning",
        dedup_key=f"assignment_{a.id}_review_{body.analyst_decision}",
    )
    db.commit()
    db.refresh(a)
    return a
