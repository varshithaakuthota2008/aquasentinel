from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, Text, Float, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(500))
    role: Mapped[str] = mapped_column(String(30), default="citizen")
    account_status: Mapped[str] = mapped_column(String(30), default="active")
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    department: Mapped[str | None] = mapped_column(String(160), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(160), nullable=True)
    employee_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    credential_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MonitoringLocation(Base):
    __tablename__ = "monitoring_locations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String(30))  # river/lake/pond/borewell/tap/other
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WaterReport(Base):
    __tablename__ = "water_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    location_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("monitoring_locations.id"), nullable=True)
    reporter_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    source_type: Mapped[str] = mapped_column(String(30))
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    observation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    appearance: Mapped[str] = mapped_column(String(40))   # clear/cloudy/unusual_color/other
    odor: Mapped[str] = mapped_column(String(30))          # normal/unusual/unknown
    visible_waste: Mapped[bool] = mapped_column(Boolean, default=False)
    suspected_contamination: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_filename: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending_review")  # pending_review/under_review/resolved
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_category: Mapped[str | None] = mapped_column(String(20), nullable=True)  # low/moderate/high/critical
    risk_factors: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Inspection(Base):
    __tablename__ = "inspections"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[int] = mapped_column(Integer, ForeignKey("water_reports.id"), index=True)
    inspector_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    inspection_notes: Mapped[str] = mapped_column(Text)
    outcome: Mapped[str] = mapped_column(String(30))  # safe/unsafe/inconclusive/requires_lab
    follow_up_required: Mapped[bool] = mapped_column(Boolean, default=False)
    follow_up_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_photo_filename: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AdminLog(Base):
    __tablename__ = "admin_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    admin_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(120))
    target_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_report_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Notification(Base):
    """In-app notification record for a user."""
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    report_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("water_reports.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30), default="info")  # info/warning/alert/critical
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    # Deduplication key — same event should not generate duplicate rows per user
    dedup_key: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class RiskConfig(Base):
    """Configurable risk-scoring weights and thresholds stored in DB."""
    __tablename__ = "risk_config"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    value: Mapped[str] = mapped_column(String(200))   # stored as string, cast on read
    description: Mapped[str | None] = mapped_column(String(400), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WaterMeasurement(Base):
    """
    Laboratory or IoT measurement record.
    Strictly separated from citizen observations (WaterReport).
    """
    __tablename__ = "water_measurements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    location_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("monitoring_locations.id"), nullable=True)
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    parameter: Mapped[str] = mapped_column(String(80))   # e.g. pH, turbidity, DO, conductivity
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(40))
    method: Mapped[str | None] = mapped_column(String(200), nullable=True)
    instrument: Mapped[str | None] = mapped_column(String(200), nullable=True)
    data_source: Mapped[str] = mapped_column(String(200))   # lab name / sensor id / "demo"
    verification_status: Mapped[str] = mapped_column(String(30), default="unverified")  # unverified/verified/rejected
    reference_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    reference_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    reference_standard: Mapped[str | None] = mapped_column(String(200), nullable=True)
    quality_flag: Mapped[str | None] = mapped_column(String(80), nullable=True)  # ok/suspect/missing
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class RiskHistory(Base):
    """Snapshot of each risk assessment calculation for a report."""
    __tablename__ = "risk_history"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[int] = mapped_column(Integer, ForeignKey("water_reports.id"), index=True)
    risk_score: Mapped[float] = mapped_column(Float)
    risk_category: Mapped[str] = mapped_column(String(20))
    risk_factors: Mapped[str] = mapped_column(Text)   # JSON
    config_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON weights used
    assessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ── New Phase 3 Models ────────────────────────────────────────────────────────

class InspectionAssignment(Base):
    """Analyst assigns a field verifier to inspect a specific report."""
    __tablename__ = "inspection_assignments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[int] = mapped_column(Integer, ForeignKey("water_reports.id"), index=True)
    assigned_to: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)   # field_inspector
    assigned_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)   # water_authority or admin
    priority: Mapped[str] = mapped_column(String(20), default="normal")  # low/normal/high/urgent
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # status: new/accepted/in_progress/submitted/reviewed/completed/returned/overdue
    status: Mapped[str] = mapped_column(String(30), default="new")
    analyst_notes: Mapped[str | None] = mapped_column(Text, nullable=True)   # analyst review notes
    analyst_decision: Mapped[str | None] = mapped_column(String(30), nullable=True)  # accepted/corrections_requested/further_testing
    linked_inspection_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("inspections.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class FieldObservation(Base):
    """Rich field observation submitted by a Field Verifier for an assignment."""
    __tablename__ = "field_observations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assignment_id: Mapped[int] = mapped_column(Integer, ForeignKey("inspection_assignments.id"), index=True)
    verifier_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    # Site location
    actual_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    location_matches_report: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    location_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Observations
    problem_observable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    pollution_sources_visible: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    field_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Measurements collected during visit
    ph: Mapped[float | None] = mapped_column(Float, nullable=True)
    turbidity: Mapped[float | None] = mapped_column(Float, nullable=True)
    dissolved_oxygen: Mapped[float | None] = mapped_column(Float, nullable=True)
    conductivity: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    measurements_collected: Mapped[bool] = mapped_column(Boolean, default=False)
    sampling_method: Mapped[str | None] = mapped_column(String(200), nullable=True)
    equipment_used: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sample_handling_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    lab_testing_needed: Mapped[bool] = mapped_column(Boolean, default=False)
    # Checklist
    checklist_location_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    checklist_problem_observed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    checklist_sources_visible: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    checklist_measurements_done: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    checklist_lab_needed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    checklist_photos_attached: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    checklist_all_fields_complete: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    checklist_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Outcome
    outcome: Mapped[str | None] = mapped_column(String(30), nullable=True)  # verified/not_verified/further_testing
    outcome_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Status
    status: Mapped[str] = mapped_column(String(30), default="draft")  # draft/submitted/reviewed
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class EvidenceAttachment(Base):
    """Photo or document attached to a FieldObservation."""
    __tablename__ = "evidence_attachments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    observation_id: Mapped[int] = mapped_column(Integer, ForeignKey("field_observations.id"), index=True)
    filename: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    uploaded_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AnalystNote(Base):
    """Analyst review notes attached to a report or assignment."""
    __tablename__ = "analyst_notes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("water_reports.id"), nullable=True, index=True)
    assignment_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("inspection_assignments.id"), nullable=True, index=True)
    analyst_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    note: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ── Dataset Import & Case Workflow ────────────────────────────────────────────

class DatasetImport(Base):
    """Records every CSV/XLSX file import attempt."""
    __tablename__ = "dataset_imports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    uploaded_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    filename: Mapped[str] = mapped_column(String(300))
    source_label: Mapped[str] = mapped_column(String(100), default="IMPORTED")  # IMPORTED/MANUAL/SIMULATED/DEMO
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    accepted_rows: Mapped[int] = mapped_column(Integer, default=0)
    rejected_rows: Mapped[int] = mapped_column(Integer, default=0)
    column_mapping: Mapped[str | None] = mapped_column(Text, nullable=True)   # JSON
    validation_errors: Mapped[str | None] = mapped_column(Text, nullable=True) # JSON
    status: Mapped[str] = mapped_column(String(30), default="pending")   # pending/completed/failed
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Alert(Base):
    """Persistent threshold/anomaly alert."""
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    location_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("monitoring_locations.id"), nullable=True, index=True)
    report_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("water_reports.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(300))
    message: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), default="moderate")  # low/moderate/high/critical
    trigger_type: Mapped[str] = mapped_column(String(40))  # threshold/anomaly/citizen_report/manual
    trigger_values: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    is_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dedup_key: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CaseEvent(Base):
    """Audit trail for every status change in a report's lifecycle."""
    __tablename__ = "case_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[int] = mapped_column(Integer, ForeignKey("water_reports.id"), index=True)
    actor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str] = mapped_column(String(50))
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PublicAdvisory(Base):
    """Admin-published public advisories visible on citizen dashboard."""
    __tablename__ = "public_advisories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info/warning/critical
    location_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("monitoring_locations.id"), nullable=True)
    published_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
