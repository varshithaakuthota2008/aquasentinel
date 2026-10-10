import os
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from .database import Base, engine, get_db, SessionLocal
from .models import User, WaterReport, MonitoringLocation, Inspection, AdminLog
from .schemas import (
    RegisterRequest, LoginRequest, UserOut, TokenResponse, ReviewRequest,
    DashboardSummary,
)
from .security import hash_password, verify_password, create_access_token
from .dependencies import get_current_user, require_admin, require_active

# Routers
from .routers import locations as locations_router
from .routers import reports as reports_router
from .routers import inspections as inspections_router
from .routers import admin as admin_router
from .routers import uploads as uploads_router
from .routers import notifications as notifications_router
from .routers import analytics as analytics_router
from .routers import measurements as measurements_router
from .routers import assignments as assignments_router
from .routers import field_observations as field_obs_router
from .routers import analyst_notes as analyst_notes_router
from .routers import imports as imports_router
from .routers import iot as iot_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AquaSentinel API",
    version="0.3.0",
    description="Water-quality monitoring and early-warning platform (SDG 6.3)",
)

origins = [
    os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include routers ───────────────────────────────────────────────────────────
app.include_router(locations_router.router,      prefix="/api/v1")
app.include_router(reports_router.router,        prefix="/api/v1")
app.include_router(inspections_router.router,    prefix="/api/v1")
app.include_router(notifications_router.router,  prefix="/api/v1")
app.include_router(analytics_router.router,      prefix="/api/v1")
app.include_router(measurements_router.router,   prefix="/api/v1")
app.include_router(assignments_router.router,    prefix="/api/v1")
app.include_router(field_obs_router.router,      prefix="/api/v1")
app.include_router(analyst_notes_router.router,  prefix="/api/v1")
app.include_router(imports_router.router,        prefix="/api/v1")
app.include_router(iot_router.router,            prefix="/api/v1")
app.include_router(admin_router.router)
app.include_router(uploads_router.router)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["health"])
def health():
    return {
        "status": "ok",
        "service": "AquaSentinel API",
        "version": "0.3.0",
    }

@app.get("/", tags=["health"])
def root():
    return {"status": "AquaSentinel API is running", "version": "0.3.0"}


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=UserOut, status_code=201, tags=["auth"])
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    email = str(body.email).strip().lower()
    if body.password != body.confirm_password:
        raise HTTPException(422, "Passwords do not match.")
    if not any(ch.isdigit() for ch in body.password):
        raise HTTPException(422, "Password must contain at least one number.")
    if not any(not ch.isalnum() for ch in body.password):
        raise HTTPException(422, "Password must contain at least one special character.")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists.")
    official = body.role in ("water_authority", "field_inspector")
    if official and not all([body.department, body.designation, body.employee_id]):
        raise HTTPException(422, "Officials must provide department, designation, and employee ID.")
    user = User(
        full_name=body.full_name.strip(),
        email=email,
        password_hash=hash_password(body.password),
        role=body.role,
        account_status="pending" if official else "active",
        phone=body.phone,
        department=body.department,
        designation=body.designation,
        employee_id=body.employee_id,
        credential_note=body.credential_note,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=TokenResponse, tags=["auth"])
def login(body: LoginRequest, db: Session = Depends(get_db)):
    email = str(body.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password.")
    if user.account_status == "pending":
        raise HTTPException(403, "Your official account is pending administrator verification.")
    if user.account_status == "rejected":
        raise HTTPException(403, f"Your verification was rejected. {user.review_reason or 'Contact the administrator.'}")
    if user.account_status == "revoked":
        raise HTTPException(403, "Access to this account has been revoked.")
    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )


@app.get("/auth/me", response_model=UserOut, tags=["auth"])
def me(user: User = Depends(get_current_user)):
    return user


# ── Admin ─────────────────────────────────────────────────────────────────────

@app.get("/admin/applications", response_model=list[UserOut], tags=["admin"])
def applications(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return list(db.scalars(
        select(User)
        .where(User.role.in_(["water_authority", "field_inspector"]))
        .order_by(User.created_at.desc())
    ))


@app.post("/admin/applications/{user_id}/review", response_model=UserOut, tags=["admin"])
def review_application(
    user_id: int,
    body: ReviewRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user or user.role not in ("water_authority", "field_inspector"):
        raise HTTPException(404, "Official application not found.")
    if user.id == admin.id:
        raise HTTPException(400, "You cannot review your own account.")
    if body.decision == "approve":
        user.account_status = "active"
        user.review_reason = body.reason or "Credentials reviewed and approved."
    elif body.decision == "reject":
        user.account_status = "rejected"
        user.review_reason = body.reason or "Please contact the administrator for details."
    else:
        user.account_status = "revoked"
        user.review_reason = body.reason or "Access revoked by administrator."
    user.reviewed_by = admin.id
    user.reviewed_at = datetime.now(timezone.utc)
    db.add(AdminLog(
        admin_id=admin.id,
        action=f"application_{body.decision}",
        target_user_id=user.id,
        notes=body.reason,
    ))
    db.commit()
    db.refresh(user)
    return user


@app.get("/admin/summary", tags=["admin"])
def admin_summary(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    from .models import Alert as AlertModel
    users = list(db.scalars(select(User)))
    reports = list(db.scalars(select(WaterReport)))
    alerts = list(db.scalars(select(AlertModel)))
    return {
        "total_users": len(users),
        "pending_officials": sum(u.account_status == "pending" and u.role in ("water_authority", "field_inspector") for u in users),
        "approved_officials": sum(u.account_status == "active" and u.role in ("water_authority", "field_inspector") for u in users),
        "citizens": sum(u.role == "citizen" for u in users),
        "analysts": sum(u.role == "water_authority" for u in users),
        "verifiers": sum(u.role == "field_inspector" for u in users),
        "total_reports": len(reports),
        "high_risk_reports": sum(r.risk_category in ("high", "critical") for r in reports),
        "unacknowledged_alerts": sum(not a.is_acknowledged for a in alerts),
    }


@app.get("/api/v1/dashboard/summary", response_model=DashboardSummary, tags=["dashboard"])
def dashboard_summary(user: User = Depends(require_active), db: Session = Depends(get_db)):
    q = select(WaterReport)
    if user.role == "citizen":
        q = q.where(WaterReport.reporter_id == user.id)
    reports = list(db.scalars(q))
    locations_count = db.scalar(select(func.count()).select_from(MonitoringLocation)) or 0
    inspections_count = db.scalar(select(func.count()).select_from(Inspection)) or 0
    return DashboardSummary(
        total_reports=len(reports),
        pending_reports=sum(r.status == "pending_review" for r in reports),
        under_review_reports=sum(r.status == "under_review" for r in reports),
        resolved_reports=sum(r.status == "resolved" for r in reports),
        high_risk_reports=sum(r.risk_category == "high" for r in reports),
        critical_risk_reports=sum(r.risk_category == "critical" for r in reports),
        total_locations=locations_count,
        total_inspections=inspections_count,
    )


# ── Bootstrap admin from env ──────────────────────────────────────────────────

def _create_admin_from_env():
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "")
    if not email or not password:
        return
    db = SessionLocal()
    try:
        if not db.scalar(select(User).where(User.email == email)):
            db.add(User(
                full_name="AquaSentinel Administrator",
                email=email,
                password_hash=hash_password(password),
                role="admin",
                account_status="active",
            ))
            db.commit()
    finally:
        db.close()


_create_admin_from_env()


# ── Public Advisories ─────────────────────────────────────────────────────────

@app.get("/api/v1/advisories", tags=["advisories"])
def list_advisories(db: Session = Depends(get_db)):
    from .models import PublicAdvisory
    rows = list(db.scalars(
        select(PublicAdvisory)
        .where(PublicAdvisory.is_active == True)
        .order_by(PublicAdvisory.created_at.desc())
        .limit(20)
    ))
    return [
        {"id": r.id, "title": r.title, "body": r.body, "severity": r.severity,
         "location_id": r.location_id, "created_at": r.created_at.isoformat()}
        for r in rows
    ]


@app.post("/api/v1/advisories", status_code=201, tags=["advisories"])
def create_advisory(
    title: str,
    body: str,
    severity: str = "info",
    location_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from .models import PublicAdvisory
    a = PublicAdvisory(
        title=title, body=body, severity=severity,
        location_id=location_id, published_by=current_user.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"id": a.id, "title": a.title}


# ── Case Events ───────────────────────────────────────────────────────────────

@app.get("/api/v1/case-events/{report_id}", tags=["case-events"])
def get_case_events(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from .models import CaseEvent, WaterReport as WR
    report = db.get(WR, report_id)
    if not report:
        raise HTTPException(404, "Report not found.")
    if current_user.role == "citizen" and report.reporter_id != current_user.id:
        raise HTTPException(403, "Access denied.")
    events = list(db.scalars(
        select(CaseEvent).where(CaseEvent.report_id == report_id).order_by(CaseEvent.created_at)
    ))
    return [
        {"id": e.id, "from_status": e.from_status, "to_status": e.to_status,
         "comment": e.comment, "actor_id": e.actor_id, "created_at": e.created_at.isoformat()}
        for e in events
    ]
