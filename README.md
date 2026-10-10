# AquaSentinel — Water Quality Monitoring Platform

**Team Garuda · TS-015 · SDG 6: Clean Water and Sanitation (Target 6.3)**

An AI-powered water-quality monitoring and early-warning system with four role-based dashboards, CSV/IoT data import, explainable risk scoring, interactive maps and a full inspection workflow.

---

## Quick Start (Windows PowerShell)

### Prerequisites

- Python 3.11+ with a `.venv` already created in `backend/`
- Node.js 18+

---

### Step 1 — Install Python dependencies

```powershell
cd "c:\Users\Varshitha Akuthota\OneDrive\Desktop\aquasentinel-starter\backend"
.\.venv\Scripts\pip install -r requirements.txt
```

### Step 2 — Create your admin account (first time only)

```powershell
cd "c:\Users\Varshitha Akuthota\OneDrive\Desktop\aquasentinel-starter\backend"
.\.venv\Scripts\python.exe create_admin.py
```

Follow the prompts — enter email, name, and a password with at least one number and one symbol.

### Step 3 — Seed demo data (optional, for hackathon demo)

```powershell
cd "c:\Users\Varshitha Akuthota\OneDrive\Desktop\aquasentinel-starter\backend"
.\.venv\Scripts\python.exe seed_demo_full.py
```

This creates demo accounts, 5 monitoring locations, 900 measurements, 3 citizen reports and a public advisory. All data is labelled DEMO.

**Demo credentials after seeding:**

| Role | Email | Password |
|---|---|---|
| Administrator | admin@aquasentinel.demo | Admin@demo1 |
| Water Analyst | analyst@aquasentinel.demo | Analyst@demo1 |
| Field Verifier | verifier@aquasentinel.demo | Verifier@demo1 |
| Citizen | citizen@aquasentinel.demo | Citizen@demo1 |

### Step 4 — Start the backend

```powershell
cd "c:\Users\Varshitha Akuthota\OneDrive\Desktop\aquasentinel-starter\backend"
.\.venv\Scripts\uvicorn app.main:app --reload
```

Backend runs at: **http://127.0.0.1:8000**  
API docs: **http://127.0.0.1:8000/docs**  
Health check: **http://127.0.0.1:8000/health**

### Step 5 — Install frontend dependencies (first time)

```powershell
cd "c:\Users\Varshitha Akuthota\OneDrive\Desktop\aquasentinel-starter\frontend"
npm install
```

### Step 6 — Start the frontend

```powershell
cd "c:\Users\Varshitha Akuthota\OneDrive\Desktop\aquasentinel-starter\frontend"
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## Run Tests

```powershell
cd "c:\Users\Varshitha Akuthota\OneDrive\Desktop\aquasentinel-starter\backend"
.\.venv\Scripts\python.exe -m pytest tests/ -v
```

**62 tests — all pass.**

---

## Environment Variables

Copy `.env.example` to `.env` in the `backend/` directory and set a real secret key:

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env`:

```
SECRET_KEY=replace-with-a-long-random-secret-at-least-32-chars
DATABASE_URL=sqlite:///./aquasentinel.db
ACCESS_TOKEN_MINUTES=60
FRONTEND_ORIGIN=http://localhost:5173

# Optional — auto-create admin on startup
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

---

## Demo Walkthrough (Acceptance Criteria)

1. **Login** → go to http://localhost:5173, select the Citizen role card, sign in with `citizen@aquasentinel.demo / Citizen@demo1`
2. **Submit a report** → click "Submit Report", fill in the form, pick a location on the map, submit → get a tracking ID like `AQ-00004`
3. **Login as Analyst** → `analyst@aquasentinel.demo / Analyst@demo1` → Water Analyst Dashboard
4. **Import CSV** → sidebar → Import Data → download the template or upload `sample_water_quality.csv` from the project root → map columns → validate → import
5. **View monitoring** → sidebar → Monitoring → select pH or turbidity → see trend charts and station comparison
6. **Run IoT simulation** → (login as admin) → Monitoring page → Run Simulation button → 20 labelled SIMULATED readings added
7. **View map** → Analyst Dashboard → Map tab → coloured risk markers, popup with details
8. **Assign inspection** → Analyst Dashboard → Reports tab → click Assign on a high-risk report → set priority, due date, instructions → create
9. **Login as Field Verifier** → `verifier@aquasentinel.demo / Verifier@demo1` → see the assigned inspection → Accept
10. **Submit observation** → sidebar → Submit Observation → capture GPS, fill measurements, complete checklist, choose outcome, save draft → Submit Final
11. **Analyst reviews** → Analyst Dashboard → Assignments tab → open submitted assignment → Accept or Request Corrections
12. **Public advisory** → login as Citizen → Dashboard → see the advisory banner published by the admin
13. **Admin audit** → login as Admin → Activity Log tab → see all approval and review actions

---

## Architecture

```
aquasentinel-starter/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, auth, CORS, all route wiring
│   │   ├── models.py            # 16 SQLAlchemy models
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── dependencies.py      # Shared auth dependencies
│   │   ├── risk_scoring.py      # Explainable rules-based risk engine
│   │   ├── security.py          # JWT + Argon2 password hashing
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   └── routers/
│   │       ├── reports.py       # Water quality reports + risk scoring
│   │       ├── locations.py     # Monitoring locations
│   │       ├── measurements.py  # Lab/IoT measurements
│   │       ├── imports.py       # CSV/XLSX upload, preview, validate, commit
│   │       ├── iot.py           # IoT ingest, simulation, alerts
│   │       ├── assignments.py   # Inspection assignments
│   │       ├── field_observations.py  # Field verifier observations
│   │       ├── analyst_notes.py # Analyst notes
│   │       ├── inspections.py   # Inspections
│   │       ├── analytics.py     # Dashboard analytics
│   │       ├── notifications.py # In-app notifications
│   │       ├── uploads.py       # Secure photo uploads
│   │       └── admin.py         # Admin user management
│   ├── tests/                   # 62 passing tests
│   ├── seed_demo_full.py        # Full demo data seeder
│   ├── create_admin.py          # Interactive admin setup
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.jsx           # 4-role selector + credentials
│       │   ├── RegisterPage.jsx        # Water Analyst / Field Verifier / Citizen
│       │   ├── AdminDashboard.jsx      # Applications, users, alerts, audit log
│       │   ├── WaterAnalystDashboard.jsx  # 6 tabs: overview, reports, measurements, map, analytics, assignments
│       │   ├── FieldVerifierDashboard.jsx # Assignment list, accept, GPS directions
│       │   ├── CitizenDashboard.jsx    # Advisories, tracking IDs, status timeline
│       │   ├── CSVImportPage.jsx       # Full 4-step import wizard
│       │   ├── MonitoringPage.jsx      # Multi-param charts, station comparison, alerts
│       │   ├── InspectionAssignmentPage.jsx
│       │   ├── FieldObservationPage.jsx   # GPS, measurements, checklist, photo, submit
│       │   └── AssignmentReviewPage.jsx   # Analyst review + decision
│       ├── components/
│       │   ├── MapView.jsx       # Leaflet/OSM, coloured risk markers, legend
│       │   ├── NotificationBell.jsx  # Live badge + dropdown panel
│       │   ├── Sidebar.jsx       # Role-based navigation
│       │   └── ...
│       └── api.js               # Centralised API client for all endpoints
└── sample_water_quality.csv     # Sample import file with 16 rows
```

---

## Database Models

| Model | Purpose |
|---|---|
| User | Auth, roles, employee profiles |
| MonitoringLocation | Water source coordinates |
| WaterReport | Citizen observations |
| WaterMeasurement | Lab/IoT/imported measurements |
| DatasetImport | Import history |
| InspectionAssignment | Analyst → Verifier assignments |
| FieldObservation | On-site measurements + checklist |
| EvidenceAttachment | Photos linked to observations |
| Inspection | Legacy inspection records |
| AnalystNote | Analyst notes per report/assignment |
| Notification | In-app notifications |
| Alert | Threshold/anomaly alerts |
| CaseEvent | Status change audit trail |
| PublicAdvisory | Citizen-visible advisories |
| RiskHistory | Risk score snapshots |
| AdminLog | Admin action audit |

All tables are auto-created on startup via `Base.metadata.create_all()`. No migration tool required for SQLite development.

---

## Features Implemented

- ✅ 4-role login with role-selector UI (permissions enforced server-side)
- ✅ JWT authentication + Argon2 password hashing
- ✅ Official registration → pending → admin approval workflow
- ✅ Administrator dashboard: applications, user management, alerts, audit log
- ✅ Water Analyst dashboard: 6 tabs, risk distribution, high-risk queue
- ✅ CSV/XLSX import wizard: preview, auto column-mapping, row-level validation, commit
- ✅ IoT reading ingest endpoint with threshold auto-alerts
- ✅ IoT simulation (admin-only, clearly labelled SIMULATED)
- ✅ Monitoring page: multi-parameter trend charts, station comparison, reference lines
- ✅ Explainable rules-based risk scoring (0–100, Low/Moderate/High/Critical)
- ✅ Risk history snapshots
- ✅ Inspection assignment workflow (analyst → verifier)
- ✅ Field observation form: GPS capture, checklist, measurements, photo upload, submit
- ✅ Analyst review: Accept / Request Corrections / Further Testing
- ✅ Citizen dashboard: public advisories, tracking IDs, status timeline
- ✅ In-app notification bell with unread badge
- ✅ Leaflet/OpenStreetMap interactive map with risk-coloured markers
- ✅ Analytics page with Recharts
- ✅ 62 automated tests (auth, admin, reports, risk scoring, notifications, imports, IoT)
- ✅ Demo seed script with 4 roles, 5 locations, 900 measurements, reports, advisory
- ✅ Sample CSV file for import demo

## Known Limitations

- SQLite is for development only — switch to PostgreSQL for production via `DATABASE_URL`
- Bundle size is large (~970 KB) — add Vite `manualChunks` for production
- Email/SMS alerts: stub exists in `notifications.py`, wire `fastapi-mail` when SMTP is available
- IoT device registration: metadata model not yet implemented — readings accepted without device auth
