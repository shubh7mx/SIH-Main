"""
Agent 3 — TEMPORAL ANALYZER
============================
Computes 30-day rolling FRP/BT baseline Z-scores, Temporal Persistence Index (TPI),
and diurnal anomaly scores for each hotspot.

In production, this queries RisingWave 2.x materialized views for the H3 cell's
rolling statistics. For Phase 2 demo, it uses the historical baseline seeder profiles.
"""

import math
from typing import Optional
from packages.agents.src.state import SwarmState, TemporalScores


# ── Baseline profiles by facility type ─────────────────────────────────────────
# These match the HistoricalBaselineSeeder profiles in packages/ingestion
BASELINE_PROFILES = {
    "refinery":         {"frp_mean": 140.0, "frp_std": 18.0, "bt_mean": 815.0, "bt_std": 9.0, "day_night_ratio": 0.95},
    "chemical":         {"frp_mean": 95.0,  "frp_std": 12.0, "bt_mean": 760.0, "bt_std": 8.0, "day_night_ratio": 0.80},
    "metal_works":      {"frp_mean": 210.0, "frp_std": 24.0, "bt_mean": 880.0, "bt_std": 11.0, "day_night_ratio": 0.92},
    "cement":           {"frp_mean": 175.0, "frp_std": 22.0, "bt_mean": 860.0, "bt_std": 10.0, "day_night_ratio": 0.75},
    "gas_processing":   {"frp_mean": 125.0, "frp_std": 15.0, "bt_mean": 795.0, "bt_std": 8.5, "day_night_ratio": 0.90},
    "power_plant":     {"frp_mean": 320.0, "frp_std": 35.0, "bt_mean": 720.0, "bt_std": 7.0, "day_night_ratio": 0.98},
    "flare":            {"frp_mean": 85.0,  "frp_std": 9.0,  "bt_mean": 920.0, "bt_std": 12.0, "day_night_ratio": 0.99},
    "industrial_other": {"frp_mean": 110.0, "frp_std": 14.0, "bt_mean": 780.0, "bt_std": 9.0, "day_night_ratio": 0.85},
}


def temporal_pipeline(state: SwarmState) -> SwarmState:
    """
    Agent 3: Temporal Analyzer node for LangGraph.

    Computes:
      - FRP Z-score vs 30-day facility baseline
      - BT Z-score vs 30-day facility baseline
      - Diurnal anomaly (day vs night behavior vs baseline)
      - TPI = σ_BT / μ_BT (Temporal Persistence Index)
      - Temporal confidence score (0.0–1.0)

    Returns updated state with temporal scores.
    """
    facility_type = state.spatial.facility_type or "industrial_other"

    # Get baseline profile for this facility type
    profile = BASELINE_PROFILES.get(facility_type, BASELINE_PROFILES["industrial_other"])
    frp_mean = profile["frp_mean"]
    frp_std = profile["frp_std"]
    bt_mean = profile["bt_mean"]
    bt_std = profile["bt_std"]
    day_night_ratio = profile["day_night_ratio"]

    # ── Z-score computation ────────────────────────────────────────────────────
    z_frp = (state.frp_mw - frp_mean) / frp_std if frp_std > 0 else 0.0
    z_bt = (state.brightness_temp_k - bt_mean) / bt_std if bt_std > 0 else 0.0

    # ── Diurnal anomaly ───────────────────────────────────────────────────────
    # A nighttime observation at a refinery is NOT anomalous (24/7 operations)
    # A nighttime observation at a cement kiln IS anomalous (daytime only)
    is_night = state.day_night == "N"
    expected_night_activity = day_night_ratio

    if is_night:
        # High expected activity at night means night observation is normal
        diurnal_anomaly = 1.0 - expected_night_activity
    else:
        # Daytime is always normal
        diurnal_anomaly = 0.0

    # But a VERY high FRP at night is always anomalous regardless
    if is_night and state.frp_mw > frp_mean * 2.5:
        diurnal_anomaly = max(diurnal_anomaly, 0.9)

    # ── TPI: Temporal Persistence Index ──────────────────────────────────────
    # High TPI = persistent source (flare). Low TPI = transient (fire that burnt out)
    tpi = bt_std / bt_mean if bt_mean > 0 else 0.0

    # ── Temporal score (0.0–1.0) ───────────────────────────────────────────
    # Rule: catastrophic temporal spike = z > 4.0
    z_combined = abs(z_frp) * 0.7 + abs(z_bt) * 0.3
    if z_combined > 5.0:
        temporal_score = 0.99  # Extremely anomalous
    elif z_combined > 3.0:
        temporal_score = 0.90
    elif z_combined > 2.0:
        temporal_score = 0.75
    elif z_combined > 1.0:
        temporal_score = 0.55
    else:
        temporal_score = 0.30  # Within normal range

    # Adjust: known industrial facilities get higher baseline trust
    if state.spatial.facility_id and z_combined < 1.5:
        temporal_score = min(0.95, temporal_score + 0.10)

    state.temporal = TemporalScores(
        frp_zscore=round(z_frp, 3),
        bt_zscore=round(z_bt, 3),
        diurnal_anomaly=round(diurnal_anomaly, 3),
        tpi=round(tpi, 4),
        baseline_frp_mean=round(frp_mean, 1),
        baseline_frp_std=round(frp_std, 1),
        baseline_bt_mean=round(bt_mean, 1),
        baseline_bt_std=round(bt_std, 1),
        observation_count=2,  # daily hotspot count in H3 cell (1 overpass = 1 detection in FIRMS)
        score=round(temporal_score, 3),
    )
    return state
