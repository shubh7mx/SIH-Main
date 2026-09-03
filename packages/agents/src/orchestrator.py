"""
Agent 1 — ORCHESTRATOR (Bayesian Weighted Fusion)
==================================================
The meta-agent that combines all specialized agent scores into a final
classification, applies the CDE (Co-location Disambiguation Engine), and
routes the event to the Dispatcher.

Fusion rule (Bayesian weighted ensemble):
  P(class_i) = Σ(α_j * P_agent_j(class_i)) / Σ(α_j)

Weights:
  - Spatial : 0.30
  - Temporal: 0.30
  - Vision  : 0.35 (if cloud-free; else redistributed)
  - CDE     : 0.05 (applied as final override)
"""

from __future__ import annotations
from datetime import datetime, timezone
from packages.agents.src.state import (
    SwarmState, ThermalClass, AlertSeverity,
)
from packages.agents.src.cde import (
    CoDisambiguationEngine, FacilityBaseline, CDEInput
)


# ── Baseline lookup table (matches Temporal agent profiles) ───────────────────
_BASELINE_TABLE = {
    "refinery":         FacilityBaseline("f", "Refinery", "refinery", 140.0, 18.0, 815.0, 9.0, 0, 0.95),
    "chemical":         FacilityBaseline("f", "Chemical", "chemical", 95.0, 12.0, 760.0, 8.0, 0, 0.80),
    "metal_works":      FacilityBaseline("f", "Metal Works", "metal_works", 210.0, 24.0, 880.0, 11.0, 0, 0.92),
    "cement":           FacilityBaseline("f", "Cement", "cement", 175.0, 22.0, 860.0, 10.0, 0, 0.75),
    "gas_processing":   FacilityBaseline("f", "Gas", "gas_processing", 125.0, 15.0, 795.0, 8.5, 0, 0.90),
    "power_plant":      FacilityBaseline("f", "Power Plant", "power_plant", 320.0, 35.0, 720.0, 7.0, 0, 0.98),
    "flare":            FacilityBaseline("f", "Flare", "flare", 85.0, 9.0, 920.0, 12.0, 0, 0.99),
    "industrial_other": FacilityBaseline("f", "Other Industrial", "industrial_other", 110.0, 14.0, 780.0, 9.0, 0, 0.85),
}


def orchestrator_node(state: SwarmState) -> SwarmState:
    """
    Agent 1: Orchestrator + Bayesian Fusion node for LangGraph.

    Combines agent scores with weighted ensemble, applies CDE final override,
    and prepares the event for the Dispatcher.
    """
    # ── Bayesian Weighted Fusion ─────────────────────────────────────
    w_spatial = 0.30
    w_temporal = 0.30
    w_vision = 0.35 if state.vision.cloud_free else 0.0

    # If vision unavailable, redistribute to spatial+temporal (0.45/0.55)
    if not state.vision.cloud_free:
        w_spatial = 0.45
        w_temporal = 0.55

    # Normalize
    total_w = w_spatial + w_temporal + w_vision
    w_s = w_spatial / total_w
    w_t = w_temporal / total_w
    w_v = w_vision / total_w

    fused_score = (
        w_s * state.spatial.score +
        w_t * state.temporal.score +
        w_v * state.vision.score
    )

    # ── CDE Final Override ───────────────────────────────────────────
    # Apply CDE (Co-location Disambiguation Engine) to disambiguate
    facility_type = state.spatial.facility_type or "industrial_other"
    baseline = _BASELINE_TABLE.get(facility_type, _BASELINE_TABLE["industrial_other"])
    cde_engine = CoDisambiguationEngine(baseline)

    cde_input = CDEInput(
        frp_mw=state.frp_mw,
        brightness_temp_k=state.brightness_temp_k,
        day_night=state.day_night,
        hotspots_per_day=state.temporal.observation_count or 4,
    )
    cde_output = cde_engine.evaluate(cde_input)

    # ── Classification Decision Tree ────────────────────────────────
    spatial_facility = state.spatial.facility_id is not None
    nearest_km = state.spatial.nearest_facility_km if state.spatial.nearest_facility_km is not None else 999.0
    land_cover = state.spatial.land_cover_class

    # Industrial fires are confirmed only when facility is within 5km
    is_near_facility = spatial_facility and nearest_km <= 5.0

    # PRIORITY 1: Near an industrial facility -> classify by CDE severity
    if is_near_facility:
        if cde_output.severity == "CRITICAL":
            classification: ThermalClass = "INDUSTRIAL_FIRE_EMERGENCY"
            severity: AlertSeverity = "CRITICAL"
            is_critical = True
        elif cde_output.severity == "WARNING":
            classification = "DEFERRED_FOR_ANALYST"
            severity = "WARNING"
            is_critical = False
        elif cde_output.severity == "WATCH":
            classification = "DEFERRED_FOR_ANALYST"
            severity = "WATCH"
            is_critical = False
        else:  # NORMAL
            classification = "PERSISTENT_INDUSTRIAL_FLARE"
            severity = "INFO"
            is_critical = False

    # PRIORITY 2: No facility -> classify by land cover
    elif land_cover == 40:
        classification = "AGRICULTURAL_BURNING"
        severity = "INFO"
        is_critical = False
    elif land_cover == 10:
        classification = "WILDFIRE"
        severity = "WARNING"
        is_critical = False
    elif land_cover in (20, 30, 60):
        # Shrubland/grassland/bare -> likely agricultural or controlled burn
        classification = "AGRICULTURAL_BURNING"
        severity = "INFO"
        is_critical = False
    else:
        classification = "UNKNOWN"
        severity = "INFO"
        is_critical = False

    # ── Apply to state ───────────────────────────────────────────────
    state.final_classification = classification
    state.final_confidence = fused_score
    state.cde_score = cde_output.score
    state.cde_severity = cde_output.severity
    state.alert_severity = severity
    state.is_critical = is_critical
    state.human_review_required = human_review
    state.agents_completed = list(set(state.agents_completed + ["orchestrator"]))

    state.pipeline_completed_at = datetime.now(timezone.utc)
    if state.pipeline_started_at:
        duration = (state.pipeline_completed_at - state.pipeline_started_at).total_seconds() * 1000
        state.processing_duration_ms = int(duration)

    return state
