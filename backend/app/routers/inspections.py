from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, Inspection, WaterReport
from ..schemas import InspectionCreate, InspectionOut
from ..dependencies import get_current_user, require_inspector

router = APIRouter(prefix="/inspections", tags=["inspections"])


@router.post("", response_model=InspectionOut, status_code=201)
def create_inspection(
    body: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_inspector),
):
    report = db.get(WaterReport, body.report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    insp = Inspection(**body.model_dump(), inspector_id=current_user.id)
    db.add(insp)
    db.commit()
    db.refresh(insp)
    return insp


@router.get("", response_model=list[InspectionOut])
def list_inspections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Inspection).order_by(Inspection.created_at.desc())
    if current_user.role == "field_inspector":
        q = q.where(Inspection.inspector_id == current_user.id)
    elif current_user.role not in ("admin", "water_authority"):
        raise HTTPException(403, "Access denied.")
    return list(db.scalars(q))


@router.get("/{inspection_id}", response_model=InspectionOut)
def get_inspection(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    insp = db.get(Inspection, inspection_id)
    if not insp:
        raise HTTPException(404, "Inspection not found.")
    if current_user.role == "field_inspector" and insp.inspector_id != current_user.id:
        raise HTTPException(403, "You can only view your own inspections.")
    elif current_user.role not in ("admin", "water_authority", "field_inspector"):
        raise HTTPException(403, "Access denied.")
    return insp


@router.patch("/{inspection_id}", response_model=InspectionOut)
def update_inspection(
    inspection_id: int,
    body: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    insp = db.get(Inspection, inspection_id)
    if not insp:
        raise HTTPException(404, "Inspection not found.")
    if current_user.role == "field_inspector" and insp.inspector_id != current_user.id:
        raise HTTPException(403, "You can only edit your own inspections.")
    elif current_user.role not in ("admin", "field_inspector"):
        raise HTTPException(403, "Access denied.")
    for k, v in body.model_dump().items():
        setattr(insp, k, v)
    db.commit()
    db.refresh(insp)
    return insp
