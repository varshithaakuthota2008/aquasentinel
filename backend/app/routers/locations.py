from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import MonitoringLocation
from ..schemas import LocationCreate, LocationOut
from ..dependencies import get_current_user, require_active

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=list[LocationOut])
def list_locations(db: Session = Depends(get_db)):
    """Public endpoint — no auth required."""
    return list(db.scalars(
        select(MonitoringLocation)
        .order_by(MonitoringLocation.name)
    ))


@router.get("/{location_id}", response_model=LocationOut)
def get_location(location_id: int, db: Session = Depends(get_db)):
    """Public endpoint."""
    loc = db.get(MonitoringLocation, location_id)
    if not loc:
        raise HTTPException(404, "Location not found.")
    return loc


@router.post("", response_model=LocationOut, status_code=201)
def create_location(
    body: LocationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_active),
):
    if current_user.role not in ("admin", "water_authority"):
        raise HTTPException(403, "Only administrators and water authority officials may add locations.")
    loc = MonitoringLocation(**body.model_dump(), created_by=current_user.id)
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.put("/{location_id}", response_model=LocationOut)
def update_location(
    location_id: int,
    body: LocationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_active),
):
    if current_user.role not in ("admin", "water_authority"):
        raise HTTPException(403, "Only administrators and water authority officials may update locations.")
    loc = db.get(MonitoringLocation, location_id)
    if not loc:
        raise HTTPException(404, "Location not found.")
    for k, v in body.model_dump().items():
        setattr(loc, k, v)
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/{location_id}", status_code=204)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_active),
):
    if current_user.role != "admin":
        raise HTTPException(403, "Only administrators may delete locations.")
    loc = db.get(MonitoringLocation, location_id)
    if not loc:
        raise HTTPException(404, "Location not found.")
    db.delete(loc)
    db.commit()
