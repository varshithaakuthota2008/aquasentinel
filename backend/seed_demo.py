"""
Demo data seed script.
Creates sample monitoring locations and water-quality reports for demonstration.
All generated data is clearly labelled. Run from the backend/ directory.

Usage:
  .\.venv\Scripts\python.exe seed_demo.py --admin-email admin@example.com

WARNING: This adds records to your real aquasentinel.db database.
         Run only for demo/hackathon purposes against a test copy.
"""
import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
import random

from sqlalchemy import select
from app.database import Base, engine, SessionLocal
from app.models import User, MonitoringLocation, WaterReport, Notification
from app.security import hash_password
from app.risk_scoring import calculate_risk

Base.metadata.create_all(bind=engine)

parser = argparse.ArgumentParser(description="Seed AquaSentinel with demo data.")
parser.add_argument("--admin-email", required=True, help="Email of an existing admin account")
args = parser.parse_args()

db = SessionLocal()

admin = db.scalar(select(User).where(User.email == args.admin_email.lower()))
if not admin or admin.role != "admin":
    print(f"ERROR: No admin found with email {args.admin_email}")
    db.close()
    sys.exit(1)

print("Seeding monitoring locations…")
LOCATIONS = [
    {"name": "Mula River — Pune", "source_type": "river", "latitude": 18.5204, "longitude": 73.8567,
     "district": "Pune", "state": "Maharashtra", "description": "DEMO: Urban stretch near industrial zone"},
    {"name": "Bhandardara Reservoir", "source_type": "lake", "latitude": 19.5480, "longitude": 73.7585,
     "district": "Ahmednagar", "state": "Maharashtra", "description": "DEMO: Major water supply reservoir"},
    {"name": "Yerla Borewell Station", "source_type": "borewell", "latitude": 18.4972, "longitude": 73.8631,
     "district": "Pune", "state": "Maharashtra", "description": "DEMO: Groundwater monitoring point"},
    {"name": "Indrayani River — Alandi", "source_type": "river", "latitude": 18.6775, "longitude": 73.8982,
     "district": "Pune", "state": "Maharashtra", "description": "DEMO: Pilgrimage town river monitoring"},
    {"name": "Panshet Dam Outflow", "source_type": "lake", "latitude": 18.3128, "longitude": 73.6672,
     "district": "Pune", "state": "Maharashtra", "description": "DEMO: Dam outflow quality monitoring"},
]

loc_objs = []
for l in LOCATIONS:
    existing = db.scalar(select(MonitoringLocation).where(MonitoringLocation.name == l["name"]))
    if existing:
        loc_objs.append(existing)
        continue
    loc = MonitoringLocation(**l, is_active=True, created_by=admin.id)
    db.add(loc)
    db.flush()
    loc_objs.append(loc)

db.commit()
print(f"  → {len(loc_objs)} locations ready.")

print("Seeding a demo citizen user…")
citizen_email = "demo.citizen@aquasentinel.demo"
citizen = db.scalar(select(User).where(User.email == citizen_email))
if not citizen:
    citizen = User(
        full_name="Demo Citizen",
        email=citizen_email,
        password_hash=hash_password("Demo@citizen1"),
        role="citizen",
        account_status="active",
    )
    db.add(citizen)
    db.commit()
    db.refresh(citizen)
    print(f"  → Created demo citizen: {citizen_email} / Demo@citizen1")
else:
    print(f"  → Demo citizen already exists.")

print("Seeding water quality reports…")
SCENARIOS = [
    {"appearance": "clear",         "odor": "normal",   "visible_waste": False, "suspected_contamination": False, "notes": "DEMO: Routine clear observation"},
    {"appearance": "cloudy",        "odor": "unusual",  "visible_waste": False, "suspected_contamination": False, "notes": "DEMO: Murky water after rainfall"},
    {"appearance": "unusual_color", "odor": "unusual",  "visible_waste": True,  "suspected_contamination": True,  "notes": "DEMO: Orange discoloration near factory discharge"},
    {"appearance": "cloudy",        "odor": "normal",   "visible_waste": True,  "suspected_contamination": False, "notes": "DEMO: Floating debris from upstream"},
    {"appearance": "clear",         "odor": "unusual",  "visible_waste": False, "suspected_contamination": True,  "notes": "DEMO: Strong chemical odor, visually clear"},
]

reports_added = 0
for i, loc in enumerate(loc_objs):
    for j, scenario in enumerate(SCENARIOS):
        days_ago = random.randint(0, 20)
        obs_date = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=random.randint(0, 23))
        report = WaterReport(
            location_id=loc.id,
            reporter_id=citizen.id,
            source_type=loc.source_type,
            latitude=loc.latitude + random.uniform(-0.005, 0.005),
            longitude=loc.longitude + random.uniform(-0.005, 0.005),
            observation_date=obs_date,
            status=random.choice(["pending_review", "under_review", "resolved"]),
            **scenario,
        )
        db.add(report)
        db.flush()

        # Score it
        nearby = [r for r in db.scalars(select(WaterReport).where(
            WaterReport.latitude.between(report.latitude - 0.1, report.latitude + 0.1),
            WaterReport.longitude.between(report.longitude - 0.1, report.longitude + 0.1),
            WaterReport.id != report.id,
        ))]
        result = calculate_risk(report, nearby)
        report.risk_score = result["risk_score"]
        report.risk_category = result["risk_category"]
        report.risk_factors = json.dumps(result["factors"])
        reports_added += 1

db.commit()
print(f"  → {reports_added} demo reports added with risk scores.")

print("\n✓ Demo seed complete.")
print("  All demo data is clearly labelled in the 'notes' field.")
print("  Demo citizen login: demo.citizen@aquasentinel.demo / Demo@citizen1")
print("  Do NOT use this data for real water-safety decisions.")
db.close()
