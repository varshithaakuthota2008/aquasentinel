"""
Full demo seed script for AquaSentinel.
Creates demo accounts, locations, measurements, reports, assignments and advisories.
All DEMO/SIMULATED data is clearly labelled.

Usage (from backend/ directory):
    python seed_demo_full.py

WARNING: Adds records to aquasentinel.db. Run on a clean or dev database only.
"""
import json
import random
import sys
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from app.database import Base, engine, SessionLocal
from app.models import (
    User, MonitoringLocation, WaterReport, WaterMeasurement,
    InspectionAssignment, PublicAdvisory, AdminLog, CaseEvent,
)
from app.security import hash_password
from app.risk_scoring import calculate_risk

Base.metadata.create_all(bind=engine)
db = SessionLocal()

DEMO_NOTE = "DEMO DATA — not from a real instrument or laboratory. Do not use for safety decisions."

# ── Helpers ───────────────────────────────────────────────────────────────────

def upsert_user(email, full_name, role, password, status="active", **kwargs):
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        print(f"  User exists: {email}")
        return existing
    u = User(
        full_name=full_name, email=email,
        password_hash=hash_password(password),
        role=role, account_status=status, **kwargs,
    )
    db.add(u); db.flush()
    print(f"  Created: {email} ({role})")
    return u


def upsert_location(name, source_type, lat, lon, district, state):
    existing = db.scalar(select(MonitoringLocation).where(MonitoringLocation.name == name))
    if existing:
        return existing
    loc = MonitoringLocation(
        name=name, source_type=source_type, latitude=lat, longitude=lon,
        district=district, state=state, is_active=True,
        description=f"DEMO monitoring station — {name}",
    )
    db.add(loc); db.flush()
    return loc


# ── Users ─────────────────────────────────────────────────────────────────────
print("Creating demo users…")
admin = upsert_user(
    "admin@aquasentinel.demo", "AquaSentinel Admin", "admin",
    "Admin@demo1", department="IT Operations", designation="System Administrator", employee_id="ADM001",
)
analyst = upsert_user(
    "analyst@aquasentinel.demo", "Dr. Priya Sharma", "water_authority",
    "Analyst@demo1", status="active",
    department="Water Quality Lab", designation="Senior Water Analyst", employee_id="WA002",
)
verifier = upsert_user(
    "verifier@aquasentinel.demo", "Ravi Kumar", "field_inspector",
    "Verifier@demo1", status="active",
    department="Field Operations", designation="Field Verifier", employee_id="FV003",
)
citizen = upsert_user(
    "citizen@aquasentinel.demo", "Sunita Patel", "citizen",
    "Citizen@demo1",
)
db.commit()

# ── Locations ─────────────────────────────────────────────────────────────────
print("Creating monitoring locations…")
locations = [
    upsert_location("Mula River — Pune Bridge",      "river",    18.5204, 73.8567, "Pune",       "Maharashtra"),
    upsert_location("Bhandardara Reservoir",          "lake",     19.5480, 73.7585, "Ahmednagar", "Maharashtra"),
    upsert_location("Yerla Borewell Station",         "borewell", 18.4972, 73.8631, "Pune",       "Maharashtra"),
    upsert_location("Indrayani River — Alandi",       "river",    18.6775, 73.8982, "Pune",       "Maharashtra"),
    upsert_location("Panshet Dam Outflow",            "lake",     18.3128, 73.6672, "Pune",       "Maharashtra"),
]
db.commit()

# ── Measurements ──────────────────────────────────────────────────────────────
print("Creating demo measurements…")
PARAMS = [
    ("pH",               7.2,  0.4,  "pH",    6.5,  8.5,  "WHO 2017"),
    ("turbidity",        2.8,  1.2,  "NTU",   0.0,  4.0,  "WHO 2017"),
    ("dissolved_oxygen", 6.8,  0.8,  "mg/L",  5.0,  None, "IS 10500"),
    ("conductivity",     380,  80,   "µS/cm", None, 750,  "WHO 2017"),
    ("temperature",      24.5, 2.0,  "°C",    None, 30.0, "IS 10500"),
    ("tds",              190,  40,   "mg/L",  None, 500,  "WHO 2017"),
]

meas_added = 0
for loc in locations:
    for days_ago in range(30):
        dt = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=random.randint(6,10))
        for param, base, spread, unit, rmin, rmax, std in PARAMS:
            val = round(base + random.uniform(-spread, spread), 3)
            # Occasionally inject an anomaly for demo
            if days_ago < 3 and param in ("turbidity", "pH") and random.random() < 0.2:
                val = round(rmax * 1.25 if rmax else base * 1.5, 3) if rmax else round(rmin * 0.7 if rmin else base * 0.5, 3)
            db.add(WaterMeasurement(
                location_id=loc.id,
                measured_at=dt,
                parameter=param, value=val, unit=unit,
                data_source="DEMO",
                verification_status="unverified",
                reference_min=rmin, reference_max=rmax,
                reference_standard=std,
                quality_flag="ok",
                notes=DEMO_NOTE,
                submitted_by=admin.id,
            ))
            meas_added += 1

db.commit()
print(f"  Added {meas_added} demo measurements.")

# ── Citizen reports ───────────────────────────────────────────────────────────
print("Creating citizen reports…")
SCENARIOS = [
    {"appearance":"unusual_color","odor":"unusual","visible_waste":True, "suspected_contamination":True,
     "notes":"DEMO: Orange discoloration near factory outlet. Strong chemical smell."},
    {"appearance":"cloudy",       "odor":"unusual","visible_waste":False,"suspected_contamination":False,
     "notes":"DEMO: River looks murky after yesterday's heavy rain."},
    {"appearance":"clear",        "odor":"normal", "visible_waste":False,"suspected_contamination":False,
     "notes":"DEMO: Routine observation — water looks clear."},
]

report_objs = []
for i, (loc, scenario) in enumerate(zip(locations[:3], SCENARIOS)):
    days_ago = i * 2
    r = WaterReport(
        location_id=loc.id,
        reporter_id=citizen.id,
        source_type=loc.source_type,
        latitude=loc.latitude + random.uniform(-0.003, 0.003),
        longitude=loc.longitude + random.uniform(-0.003, 0.003),
        observation_date=datetime.now(timezone.utc) - timedelta(days=days_ago),
        status="pending_review",
        **scenario,
    )
    db.add(r); db.flush()
    nearby = list(db.scalars(select(WaterReport).where(WaterReport.id != r.id)))
    result = calculate_risk(r, nearby)
    r.risk_score    = result["risk_score"]
    r.risk_category = result["risk_category"]
    r.risk_factors  = json.dumps(result["factors"])
    # Add case event
    db.add(CaseEvent(report_id=r.id, actor_id=citizen.id, from_status=None, to_status="pending_review",
                     comment="Report submitted by citizen (DEMO)"))
    report_objs.append(r)

db.commit()
print(f"  Added {len(report_objs)} demo reports.")

# ── Inspection assignment for high-risk report ────────────────────────────────
high_risk = next((r for r in report_objs if r.risk_category in ("high","critical")), report_objs[0])
existing_assign = db.scalar(select(InspectionAssignment).where(InspectionAssignment.report_id == high_risk.id))
if not existing_assign:
    assignment = InspectionAssignment(
        report_id=high_risk.id,
        assigned_to=verifier.id,
        assigned_by=analyst.id,
        priority="high",
        instructions="DEMO: Visit site and collect pH, turbidity and DO samples. Photograph the discharge point.",
        due_date=datetime.now(timezone.utc) + timedelta(days=2),
        status="new",
    )
    db.add(assignment)
    high_risk.status = "under_review"
    db.add(CaseEvent(report_id=high_risk.id, actor_id=analyst.id,
                     from_status="pending_review", to_status="under_review",
                     comment="Inspection assigned to field verifier (DEMO)"))
    db.commit()
    print(f"  Inspection assignment created for report #{high_risk.id}.")

# ── Public advisory ───────────────────────────────────────────────────────────
from app.models import PublicAdvisory
existing_adv = db.scalar(select(PublicAdvisory).where(PublicAdvisory.title.like("DEMO%")))
if not existing_adv:
    db.add(PublicAdvisory(
        title="DEMO: Water Quality Advisory — Mula River Area",
        body="Preliminary observations indicate elevated turbidity near the Mula River bridge. "
             "Residents are advised to use treated water until further notice. "
             "This is a DEMO advisory for demonstration purposes only.",
        severity="warning",
        location_id=locations[0].id,
        published_by=admin.id,
        is_active=True,
    ))
    db.commit()
    print("  Demo public advisory created.")

print("\n✓ Demo seed complete.")
print("\nDemo login credentials:")
print("  Admin:    admin@aquasentinel.demo    / Admin@demo1")
print("  Analyst:  analyst@aquasentinel.demo  / Analyst@demo1")
print("  Verifier: verifier@aquasentinel.demo / Verifier@demo1")
print("  Citizen:  citizen@aquasentinel.demo  / Citizen@demo1")
print("\nAll demo data is clearly labelled DEMO/SIMULATED.")
print("Do NOT use for real water-safety decisions.")
db.close()
