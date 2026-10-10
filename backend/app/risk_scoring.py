"""
Risk scoring module for AquaSentinel.

IMPORTANT: This is a PRELIMINARY SCREENING ASSESSMENT only.
Results are NOT laboratory-confirmed water-quality measurements.
Unknown or missing data is never treated as a safe result.
"""

import math
from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import WaterReport


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in kilometres between two points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_risk(report: "WaterReport", nearby_reports: "list[WaterReport]") -> dict:
    """
    Compute a rules-based preliminary risk score (0–100).

    Returns a dict with keys:
      risk_score, risk_category, factors, recommended_action, assessed_at
    """
    score = 0.0
    factors: list[str] = []

    # Appearance
    if report.appearance in ("cloudy", "unusual_color", "other"):
        score += 20
        factors.append(f"Unusual water appearance reported: {report.appearance.replace('_', ' ')}")

    # Odor
    if report.odor == "unusual":
        score += 20
        factors.append("Unusual odor detected")
    elif report.odor == "unknown":
        score += 5
        factors.append("Odor status unknown — not treated as safe")

    # Visible waste
    if report.visible_waste:
        score += 25
        factors.append("Visible waste or debris reported")

    # Suspected contamination
    if report.suspected_contamination:
        score += 30
        factors.append("Suspected contamination flagged by reporter")

    # Nearby recent reports (within 10 km, last 14 days)
    if report.latitude is not None and report.longitude is not None:
        now = datetime.now(timezone.utc)
        nearby_count = 0
        for r in nearby_reports:
            if r.id == report.id:
                continue
            if r.latitude is None or r.longitude is None:
                continue
            obs = r.observation_date
            if obs.tzinfo is None:
                obs = obs.replace(tzinfo=timezone.utc)
            age_days = (now - obs).days
            if age_days > 14:
                continue
            dist = _haversine_km(report.latitude, report.longitude, r.latitude, r.longitude)
            if dist <= 10:
                nearby_count += 1
        if nearby_count > 0:
            cluster_boost = min(nearby_count * 10, 20)
            score += cluster_boost
            factors.append(f"{nearby_count} additional recent report(s) from nearby locations")

    # Age penalty — stale data should not be over-trusted but not dismissed
    obs_date = report.observation_date
    if obs_date.tzinfo is None:
        obs_date = obs_date.replace(tzinfo=timezone.utc)
    age_days = (datetime.now(timezone.utc) - obs_date).days
    if age_days > 7:
        score = max(0, score - 5)
        factors.append(f"Observation is {age_days} day(s) old — weight slightly reduced")

    # Floor: unverified reports with contamination flags keep a minimum score
    if report.suspected_contamination or report.visible_waste:
        score = max(score, 25)

    score = min(score, 100.0)

    # Category
    if score < 25:
        category = "low"
        action = "No immediate action required. Continue routine monitoring."
    elif score < 50:
        category = "moderate"
        action = "Notify local water authority. Increase monitoring frequency."
    elif score < 75:
        category = "high"
        action = "Urgent review by water authority. Consider advisory for affected area. Dispatch field inspector."
    else:
        category = "critical"
        action = "Immediate escalation required. Issue precautionary advisory. Laboratory testing recommended."

    return {
        "risk_score": round(score, 1),
        "risk_category": category,
        "factors": factors if factors else ["No significant risk indicators detected in submitted observations"],
        "recommended_action": action,
        "assessed_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": (
            "PRELIMINARY SCREENING ASSESSMENT — NOT A LABORATORY-CONFIRMED WATER-QUALITY RESULT. "
            "This score is calculated from citizen-submitted observations using rule-based logic. "
            "It does not substitute for laboratory analysis or official water-quality certification."
        ),
    }
