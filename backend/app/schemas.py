from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Literal, Optional
from datetime import datetime

# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)
    role: Literal["citizen", "water_authority", "field_inspector"] = "citizen"
    phone: str | None = Field(default=None, max_length=40)
    department: str | None = Field(default=None, max_length=160)
    designation: str | None = Field(default=None, max_length=160)
    employee_id: str | None = Field(default=None, max_length=100)
    credential_note: str | None = Field(default=None, max_length=2000)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: EmailStr
    role: str
    account_status: str
    phone: str | None = None
    department: str | None = None
    designation: str | None = None
    employee_id: str | None = None
    credential_note: str | None = None
    review_reason: str | None = None
    created_at: datetime | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class ReviewRequest(BaseModel):
    decision: Literal["approve", "reject", "revoke"]
    reason: str | None = Field(default=None, max_length=1000)

# ── Monitoring Locations ───────────────────────────────────────────────────────

class LocationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    source_type: Literal["river", "lake", "pond", "borewell", "tap", "other"]
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    district: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    is_active: bool = True

class LocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None = None
    source_type: str
    latitude: float | None = None
    longitude: float | None = None
    district: str | None = None
    state: str | None = None
    is_active: bool
    created_by: int | None = None
    created_at: datetime

# ── Water Reports ──────────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    location_id: int | None = None
    source_type: Literal["river", "lake", "pond", "borewell", "tap", "other"]
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    observation_date: datetime
    appearance: Literal["clear", "cloudy", "unusual_color", "other"]
    odor: Literal["normal", "unusual", "unknown"]
    visible_waste: bool = False
    suspected_contamination: bool = False
    notes: str | None = Field(default=None, max_length=2000)
    photo_filename: str | None = Field(default=None, max_length=200)

class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    location_id: int | None = None
    reporter_id: int
    source_type: str
    latitude: float | None = None
    longitude: float | None = None
    observation_date: datetime
    appearance: str
    odor: str
    visible_waste: bool
    suspected_contamination: bool
    notes: str | None = None
    photo_filename: str | None = None
    status: str
    risk_score: float | None = None
    risk_category: str | None = None
    risk_factors: str | None = None
    created_at: datetime
    updated_at: datetime

class ReportStatusUpdate(BaseModel):
    status: Literal["pending_review", "under_review", "resolved"]

# ── Risk Assessment ────────────────────────────────────────────────────────────

class RiskAssessmentOut(BaseModel):
    risk_score: float
    risk_category: str
    factors: list[str]
    recommended_action: str
    assessed_at: str
    disclaimer: str

# ── Inspections ───────────────────────────────────────────────────────────────

class InspectionCreate(BaseModel):
    report_id: int
    inspection_notes: str = Field(min_length=10, max_length=5000)
    outcome: Literal["safe", "unsafe", "inconclusive", "requires_lab"]
    follow_up_required: bool = False
    follow_up_notes: str | None = Field(default=None, max_length=2000)
    evidence_photo_filename: str | None = Field(default=None, max_length=200)

class InspectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    report_id: int
    inspector_id: int
    inspection_notes: str
    outcome: str
    follow_up_required: bool
    follow_up_notes: str | None = None
    evidence_photo_filename: str | None = None
    created_at: datetime

# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    admin_id: int
    action: str
    target_user_id: int | None = None
    target_report_id: int | None = None
    notes: str | None = None
    created_at: datetime

class DashboardSummary(BaseModel):
    total_reports: int
    pending_reports: int
    under_review_reports: int
    resolved_reports: int
    high_risk_reports: int
    critical_risk_reports: int
    total_locations: int
    total_inspections: int

# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    report_id: int | None = None
    title: str
    message: str
    category: str
    is_read: bool
    created_at: datetime

class NotificationCount(BaseModel):
    unread: int
    total: int

# ── Risk Config ───────────────────────────────────────────────────────────────

class RiskConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    key: str
    value: str
    description: str | None = None
    updated_at: datetime

class RiskConfigUpdate(BaseModel):
    value: str = Field(max_length=200)

# ── Water Measurements ────────────────────────────────────────────────────────

class MeasurementCreate(BaseModel):
    location_id: int | None = None
    measured_at: datetime
    parameter: str = Field(min_length=1, max_length=80)
    value: float
    unit: str = Field(min_length=1, max_length=40)
    method: str | None = Field(default=None, max_length=200)
    instrument: str | None = Field(default=None, max_length=200)
    data_source: str = Field(min_length=1, max_length=200)
    verification_status: Literal["unverified", "verified", "rejected"] = "unverified"
    reference_min: float | None = None
    reference_max: float | None = None
    reference_standard: str | None = Field(default=None, max_length=200)
    quality_flag: Literal["ok", "suspect", "missing"] | None = None
    notes: str | None = Field(default=None, max_length=2000)

class MeasurementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    location_id: int | None = None
    measured_at: datetime
    parameter: str
    value: float
    unit: str
    method: str | None = None
    instrument: str | None = None
    data_source: str
    verification_status: str
    reference_min: float | None = None
    reference_max: float | None = None
    reference_standard: str | None = None
    quality_flag: str | None = None
    notes: str | None = None
    submitted_by: int | None = None
    created_at: datetime

# ── Risk History ──────────────────────────────────────────────────────────────

class RiskHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    report_id: int
    risk_score: float
    risk_category: str
    risk_factors: str  # JSON string
    assessed_at: datetime

# ── Analytics ─────────────────────────────────────────────────────────────────

class AnalyticsFilters(BaseModel):
    date_from: datetime | None = None
    date_to: datetime | None = None
    source_type: str | None = None
    risk_category: str | None = None
    location_id: int | None = None

# ── Inspection Assignments ────────────────────────────────────────────────────

class AssignmentCreate(BaseModel):
    report_id: int
    assigned_to: int
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    instructions: str | None = Field(default=None, max_length=3000)
    due_date: datetime | None = None

class AssignmentStatusUpdate(BaseModel):
    status: Literal["accepted", "in_progress", "submitted", "returned", "overdue"]

class AssignmentAnalystReview(BaseModel):
    analyst_decision: Literal["accepted", "corrections_requested", "further_testing"]
    analyst_notes: str | None = Field(default=None, max_length=3000)

class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    report_id: int
    assigned_to: int
    assigned_by: int
    priority: str
    instructions: str | None = None
    due_date: datetime | None = None
    status: str
    analyst_notes: str | None = None
    analyst_decision: str | None = None
    linked_inspection_id: int | None = None
    created_at: datetime
    updated_at: datetime

# ── Field Observations ────────────────────────────────────────────────────────

class FieldObservationCreate(BaseModel):
    assignment_id: int
    actual_latitude: float | None = Field(default=None, ge=-90, le=90)
    actual_longitude: float | None = Field(default=None, ge=-180, le=180)
    gps_accuracy_m: float | None = None
    gps_captured_at: datetime | None = None
    location_matches_report: bool | None = None
    location_note: str | None = Field(default=None, max_length=1000)
    problem_observable: bool | None = None
    pollution_sources_visible: bool | None = None
    field_notes: str | None = Field(default=None, max_length=4000)
    ph: float | None = Field(default=None, ge=0, le=14)
    turbidity: float | None = Field(default=None, ge=0)
    dissolved_oxygen: float | None = Field(default=None, ge=0)
    conductivity: float | None = Field(default=None, ge=0)
    temperature: float | None = None
    measurements_collected: bool = False
    sampling_method: str | None = Field(default=None, max_length=200)
    equipment_used: str | None = Field(default=None, max_length=200)
    sample_handling_notes: str | None = Field(default=None, max_length=2000)
    lab_testing_needed: bool = False
    checklist_location_correct: bool | None = None
    checklist_problem_observed: bool | None = None
    checklist_sources_visible: bool | None = None
    checklist_measurements_done: bool | None = None
    checklist_lab_needed: bool | None = None
    checklist_photos_attached: bool | None = None
    checklist_all_fields_complete: bool | None = None
    checklist_notes: str | None = Field(default=None, max_length=2000)
    outcome: Literal["verified", "not_verified", "further_testing"] | None = None
    outcome_notes: str | None = Field(default=None, max_length=2000)

class FieldObservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    assignment_id: int
    verifier_id: int
    actual_latitude: float | None = None
    actual_longitude: float | None = None
    gps_accuracy_m: float | None = None
    gps_captured_at: datetime | None = None
    location_matches_report: bool | None = None
    location_note: str | None = None
    problem_observable: bool | None = None
    pollution_sources_visible: bool | None = None
    field_notes: str | None = None
    ph: float | None = None
    turbidity: float | None = None
    dissolved_oxygen: float | None = None
    conductivity: float | None = None
    temperature: float | None = None
    measurements_collected: bool
    sampling_method: str | None = None
    equipment_used: str | None = None
    sample_handling_notes: str | None = None
    lab_testing_needed: bool
    checklist_location_correct: bool | None = None
    checklist_problem_observed: bool | None = None
    checklist_sources_visible: bool | None = None
    checklist_measurements_done: bool | None = None
    checklist_lab_needed: bool | None = None
    checklist_photos_attached: bool | None = None
    checklist_all_fields_complete: bool | None = None
    checklist_notes: str | None = None
    outcome: str | None = None
    outcome_notes: str | None = None
    status: str
    submitted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

# ── Evidence Attachments ──────────────────────────────────────────────────────

class EvidenceAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    observation_id: int
    filename: str
    description: str | None = None
    uploaded_by: int
    created_at: datetime

# ── Analyst Notes ─────────────────────────────────────────────────────────────

class AnalystNoteCreate(BaseModel):
    report_id: int | None = None
    assignment_id: int | None = None
    note: str = Field(min_length=5, max_length=5000)
    recommendation: str | None = Field(default=None, max_length=200)

class AnalystNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    report_id: int | None = None
    assignment_id: int | None = None
    analyst_id: int
    note: str
    recommendation: str | None = None
    created_at: datetime
