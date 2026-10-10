"""
Field Observation router.
Field Verifiers submit rich on-site observations linked to an InspectionAssignment.
"""
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, FieldObservation, InspectionAssignment, EvidenceAttachment, Notification
from ..schemas import FieldObservationCreate, FieldObservationOut, EvidenceAttachmentOut
from ..dependencies import get_current_user, require_active

router = APIRouter(prefix="/field-observations", tags=["field-observations"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_BYTES = 5 * 1024 * 1024


@router.post("", response_model=FieldObservationOut, status_code=201)
def create_observation(
    body: FieldObservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("field_inspector", "admin"):
        raise HTTPException(403, "Only field verifiers may submit observations.")
    assignment = db.get(InspectionAssignment, body.assignment_id)
    if not assignment:
        raise HTTPException(404, "Assignment not found.")
    if current_user.role == "field_inspector" and assignment.assigned_to != current_user.id:
        raise HTTPException(403, "This assignment is not yours.")
    obs = FieldObservation(**body.model_dump(), verifier_id=current_user.id)
    db.add(obs)
    db.commit()
    db.refresh(obs)
    return obs


@router.get("", response_model=list[FieldObservationOut])
def list_observations(
    assignment_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(FieldObservation).order_by(FieldObservation.created_at.desc())
    if current_user.role == "field_inspector":
        q = q.where(FieldObservation.verifier_id == current_user.id)
    elif current_user.role not in ("water_authority", "admin"):
        raise HTTPException(403, "Access denied.")
    if assignment_id:
        q = q.where(FieldObservation.assignment_id == assignment_id)
    return list(db.scalars(q))


@router.get("/{obs_id}", response_model=FieldObservationOut)
def get_observation(
    obs_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obs = db.get(FieldObservation, obs_id)
    if not obs:
        raise HTTPException(404, "Observation not found.")
    if current_user.role == "field_inspector" and obs.verifier_id != current_user.id:
        raise HTTPException(403, "Access denied.")
    elif current_user.role not in ("field_inspector", "water_authority", "admin"):
        raise HTTPException(403, "Access denied.")
    return obs


@router.patch("/{obs_id}", response_model=FieldObservationOut)
def update_observation(
    obs_id: int,
    body: FieldObservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    obs = db.get(FieldObservation, obs_id)
    if not obs:
        raise HTTPException(404, "Observation not found.")
    if current_user.role == "field_inspector" and obs.verifier_id != current_user.id:
        raise HTTPException(403, "You can only edit your own observations.")
    if obs.status == "submitted" and current_user.role == "field_inspector":
        raise HTTPException(400, "Submitted observations cannot be edited directly. Request a correction through the analyst.")
    for k, v in body.model_dump().items():
        setattr(obs, k, v)
    obs.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obs)
    return obs


@router.post("/{obs_id}/submit", response_model=FieldObservationOut)
def submit_observation(
    obs_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    if current_user.role not in ("field_inspector", "admin"):
        raise HTTPException(403, "Only field verifiers may submit observations.")
    obs = db.get(FieldObservation, obs_id)
    if not obs:
        raise HTTPException(404, "Observation not found.")
    if current_user.role == "field_inspector" and obs.verifier_id != current_user.id:
        raise HTTPException(403, "Access denied.")
    if obs.status == "submitted":
        raise HTTPException(400, "Already submitted.")
    obs.status = "submitted"
    obs.submitted_at = datetime.now(timezone.utc)
    obs.updated_at = datetime.now(timezone.utc)
    # Update assignment status
    assignment = db.get(InspectionAssignment, obs.assignment_id)
    if assignment:
        assignment.status = "submitted"
        assignment.updated_at = datetime.now(timezone.utc)
        # Notify analyst
        db.add(Notification(
            user_id=assignment.assigned_by,
            title=f"Field observation submitted — Assignment #{assignment.id}",
            message=f"The field verifier has submitted their observation for assignment #{assignment.id}. "
                    f"Outcome: {obs.outcome or 'pending review'}.",
            category="info",
            report_id=assignment.report_id,
            dedup_key=f"obs_{obs_id}_submitted_{assignment.assigned_by}",
        ))
    db.commit()
    db.refresh(obs)
    return obs


@router.post("/{obs_id}/evidence", response_model=EvidenceAttachmentOut, status_code=201)
async def upload_evidence(
    obs_id: int,
    description: str = "",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active),
):
    obs = db.get(FieldObservation, obs_id)
    if not obs:
        raise HTTPException(404, "Observation not found.")
    if current_user.role == "field_inspector" and obs.verifier_id != current_user.id:
        raise HTTPException(403, "Access denied.")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only JPEG, PNG, WebP and GIF images are accepted.")
    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(400, "File exceeds 5 MB limit.")
    ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
    filename = f"{uuid.uuid4().hex}.{ext_map[file.content_type]}"
    (UPLOAD_DIR / filename).write_bytes(contents)
    att = EvidenceAttachment(
        observation_id=obs_id,
        filename=filename,
        description=description or None,
        uploaded_by=current_user.id,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


@router.get("/{obs_id}/evidence", response_model=list[EvidenceAttachmentOut])
def list_evidence(
    obs_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obs = db.get(FieldObservation, obs_id)
    if not obs:
        raise HTTPException(404, "Observation not found.")
    return list(db.scalars(
        select(EvidenceAttachment).where(EvidenceAttachment.observation_id == obs_id)
    ))
