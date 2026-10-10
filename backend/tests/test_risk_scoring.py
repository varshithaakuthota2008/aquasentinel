"""
Unit tests for risk_scoring.py — boundary values, missing fields,
conflicting observations, different risk scenarios.
These tests use plain Python objects, no database or HTTP.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
from app.risk_scoring import calculate_risk, _haversine_km


def _report(**kwargs):
    """Build a minimal mock WaterReport with sensible defaults."""
    m = MagicMock()
    m.id = kwargs.get("id", 1)
    m.appearance = kwargs.get("appearance", "clear")
    m.odor = kwargs.get("odor", "normal")
    m.visible_waste = kwargs.get("visible_waste", False)
    m.suspected_contamination = kwargs.get("suspected_contamination", False)
    m.latitude = kwargs.get("latitude", None)
    m.longitude = kwargs.get("longitude", None)
    m.observation_date = kwargs.get(
        "observation_date",
        datetime.now(timezone.utc)
    )
    return m


# ── Haversine ─────────────────────────────────────────────────────────────────

def test_haversine_same_point():
    assert _haversine_km(18.5, 73.8, 18.5, 73.8) == 0.0

def test_haversine_known_distance():
    # Mumbai to Pune ≈ 118 km
    d = _haversine_km(19.076, 72.877, 18.520, 73.856)
    assert 100 < d < 140


# ── Scoring scenarios ─────────────────────────────────────────────────────────

def test_all_clear_scores_low():
    result = calculate_risk(_report(), [])
    assert result["risk_score"] < 25
    assert result["risk_category"] == "low"

def test_unusual_appearance_adds_score():
    r = _report(appearance="cloudy")
    result = calculate_risk(r, [])
    assert result["risk_score"] >= 20

def test_unusual_odor_adds_score():
    r = _report(odor="unusual")
    result = calculate_risk(r, [])
    assert result["risk_score"] >= 20

def test_unknown_odor_not_treated_as_safe():
    r = _report(odor="unknown")
    result = calculate_risk(r, [])
    assert result["risk_score"] > 0, "Unknown odor must not produce zero score"

def test_visible_waste_adds_score():
    r = _report(visible_waste=True)
    result = calculate_risk(r, [])
    assert result["risk_score"] >= 25

def test_suspected_contamination_adds_score():
    r = _report(suspected_contamination=True)
    result = calculate_risk(r, [])
    assert result["risk_score"] >= 30

def test_all_flags_set_reaches_high_or_critical():
    r = _report(
        appearance="unusual_color", odor="unusual",
        visible_waste=True, suspected_contamination=True
    )
    result = calculate_risk(r, [])
    assert result["risk_score"] >= 50
    assert result["risk_category"] in ("high", "critical")

def test_critical_threshold_is_75():
    r = _report(
        appearance="unusual_color", odor="unusual",
        visible_waste=True, suspected_contamination=True
    )
    result = calculate_risk(r, [])
    if result["risk_score"] >= 75:
        assert result["risk_category"] == "critical"
    else:
        assert result["risk_category"] == "high"

def test_score_capped_at_100():
    r = _report(
        appearance="unusual_color", odor="unusual",
        visible_waste=True, suspected_contamination=True,
        latitude=18.5, longitude=73.8
    )
    # Create 10 nearby recent reports
    nearby = [_report(id=i+2, appearance="cloudy", latitude=18.5, longitude=73.8) for i in range(10)]
    result = calculate_risk(r, nearby)
    assert result["risk_score"] <= 100.0

def test_old_observation_reduces_score():
    old_date = datetime.now(timezone.utc) - timedelta(days=10)
    r = _report(appearance="cloudy", observation_date=old_date)
    result_old = calculate_risk(r, [])
    r_new = _report(appearance="cloudy")
    result_new = calculate_risk(r_new, [])
    assert result_old["risk_score"] <= result_new["risk_score"]

def test_nearby_reports_boost_score():
    r = _report(appearance="cloudy", latitude=18.5, longitude=73.8)
    nearby = [_report(id=2, appearance="cloudy", latitude=18.501, longitude=73.801)]
    without = calculate_risk(_report(appearance="cloudy"), [])
    with_nearby = calculate_risk(r, nearby)
    assert with_nearby["risk_score"] >= without["risk_score"]

def test_contamination_flag_enforces_floor():
    r = _report(suspected_contamination=True)
    result = calculate_risk(r, [])
    assert result["risk_score"] >= 25

def test_factors_list_not_empty():
    r = _report(appearance="cloudy", odor="unusual")
    result = calculate_risk(r, [])
    assert len(result["factors"]) > 0

def test_disclaimer_present():
    r = _report()
    result = calculate_risk(r, [])
    assert "PRELIMINARY" in result["disclaimer"]
    assert "laboratory" in result["disclaimer"].lower()

def test_recommended_action_present():
    r = _report()
    result = calculate_risk(r, [])
    assert len(result["recommended_action"]) > 0

def test_assessed_at_is_iso_string():
    r = _report()
    result = calculate_risk(r, [])
    # Should parse without error
    datetime.fromisoformat(result["assessed_at"])

def test_no_lat_lon_skips_nearby():
    r = _report(appearance="cloudy", latitude=None, longitude=None)
    nearby = [_report(id=2, appearance="cloudy", latitude=18.5, longitude=73.8)]
    result = calculate_risk(r, nearby)
    # Should not raise and nearby should be ignored
    assert result["risk_score"] is not None
