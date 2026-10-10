"""Analyst notes — analysts attach notes and recommendations to reports/assignments."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, AnalystNote
from ..schemas import AnalystNoteCreate, AnalystNoteOut
from ..dependencies import require_active

router = APIRouter(prefix="/analyst-notes", tags=["analyst-notes"])


@router.post("", response_model=AnalystNoteOut, status_code=201)
def add_note(
    body: AnalystNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Only analysts may add notes.")
    if not body.report_id and not body.assignment_id:
        raise HTTPException(422, "Provide either report_id or assignment_id.")
    note = AnalystNote(**body.model_dump(), analyst_id=current_user.id)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("", response_model=list[AnalystNoteOut])
def list_notes(
    report_id: int | None = Query(None),
    assignment_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Access denied.")
    q = select(AnalystNote).order_by(AnalystNote.created_at.desc())
    if report_id:
        q = q.where(AnalystNote.report_id == report_id)
    if assignment_id:
        q = q.where(AnalystNote.assignment_id == assignment_id)
    return list(db.scalars(q))
