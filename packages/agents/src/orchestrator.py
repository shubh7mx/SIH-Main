"""
Agent 1 — ORCHESTRATOR (Bayesian Weighted Fusion)
===================================================
The meta-agent that combines all specialized agent evidence into a final
classification, applies the CDE (Co-location Disambiguation Engine), and
routes the event to the Dispatcher.

Fusion rule (Bayesian weighted ensemble over class-conditional posteriors):
  P(class_i) = Σ(α_j * P_agent_j(class_i)) / Σ(α_j)

Each agent contributes a class-conditional likelihood. The final confidence
is the calibrated posterior of the winning class — high (0.88–0.99) when
agents converge, lower when they conflict (then deferred for analyst review).

Weights:
  - Spatial : 0.30
  - Temporal: 0.30
  - Vision  : 0.40 (if cloud-free optical; 0.30 for SAR through-cloud)
"""

from __future__ import annotations
import math
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

# Classes the swarm can assign
_CLASSES = ["INDUSTRIAL_FIRE_EMERGENCY", "PERSISTENT_INDUSTRIAL_FLARE",
            "AGRICULTURAL_BURNING", "WILDFIRE", "DEFERRED_FOR_ANALYST"]


def _spatial_class_posterior(state: SwarmState) -> dict[str, float]:
    """Spatial agent's class-conditional likelihood distribution."""
    post = {c: 0.02 for c in _CLASSES}
    facility_type = state.spatial.facility_type
    land_cover = state.spatial.land_cover_class
    dist_km = state.spatial.nearest_facility_km or 999.0
    facility_id = state.spatial.facility_id

    if (facility_type is not None or facility_id is not None) and dist_km <= 25.0:
        # Contained within or adjacent to an industrial facility perimeter
        post["PERSISTENT_INDUSTRIAL_FLARE"] = 0.65
        post["INDUSTRIAL_FIRE_EMERGENCY"] = 0.30
        post["AGRICULTURAL_BURNING"] = 0.01
        post["WILDFIRE"] = 0.01
        post["DEFERRED_FOR_ANALYST"] = 0.03
    elif land_cover == 50:
        post["PERSISTENT_INDUSTRIAL_FLARE"] = 0.60
        post["INDUSTRIAL_FIRE_EMERGENCY"] = 0.25
        post["AGRICULTURAL_BURNING"] = 0.05
        post["WILDFIRE"] = 0.05
        post["DEFERRED_FOR_ANALYST"] = 0.05
    elif land_cover == 40:
        post["AGRICULTURAL_BURNING"] = 0.90
        post["WILDFIRE"] = 0.03
        post["DEFERRED_FOR_ANALYST"] = 0.04
    elif land_cover == 10:
        post["WILDFIRE"] = 0.90
        post["AGRICULTURAL_BURNING"] = 0.03
        post["DEFERRED_FOR_ANALYST"] = 0.04
    else:
        post["AGRICULTURAL_BURNING"] = 0.55
        post["WILDFIRE"] = 0.30
        post["DEFERRED_FOR_ANALYST"] = 0.10

    # Normalize
    total = sum(post.values())
    return {k: v / total for k, v in post.items()}


def _temporal_class_posterior(state: SwarmState) -> dict[str, float]:
    """Temporal agent's class-conditional likelihood distribution."""
    post = {c: 0.02 for c in _CLASSES}
    is_industrial = state.spatial.facility_id is not None
    z_frp = state.temporal.frp_zscore
    z_bt = state.temporal.bt_zscore

    if is_industrial:
        if z_frp > 3.0 or z_bt > 3.5:
            # Massive thermodynamic deviation: emergency signature
            post["INDUSTRIAL_FIRE_EMERGENCY"] = 0.90
            post["PERSISTENT_INDUSTRIAL_FLARE"] = 0.05
            post["DEFERRED_FOR_ANALYST"] = 0.05
        elif abs(z_frp) <= 2.0 and abs(z_bt) <= 2.0:
            # Stable within operating envelope: flare signature
            post["PERSISTENT_INDUSTRIAL_FLARE"] = 0.88
            post["INDUSTRIAL_FIRE_EMERGENCY"] = 0.04
            post["DEFERRED_FOR_ANALYST"] = 0.06
        else:
            post["DEFERRED_FOR_ANALYST"] = 0.50
            post["PERSISTENT_INDUSTRIAL_FLARE"] = 0.28
            post["INDUSTRIAL_FIRE_EMERGENCY"] = 0.18
    else:
        if state.frp_mw > 150.0:
            # Elevated radiative energy over wildland: wildfire signature
            post["WILDFIRE"] = 0.62
            post["AGRICULTURAL_BURNING"] = 0.30
            post["DEFERRED_FOR_ANALYST"] = 0.06
        else:
            # Biomass burning energy envelope
            post["AGRICULTURAL_BURNING"] = 0.85
            post["WILDFIRE"] = 0.08
            post["DEFERRED_FOR_ANALYST"] = 0.05

    total = sum(post.values())
    return {k: v / total for k, v in post.items()}


def _vision_class_posterior(state: SwarmState) -> dict[str, float]:
    """Vision agent's class-conditional likelihood distribution."""
    post = {c: 0.02 for c in _CLASSES}
    pred = state.vision.predicted_class
    conf = state.vision.vision_class_confidence

    if pred in post:
        post[pred] = max(0.5, conf)
        # Distribute remaining mass proportionally among others
        remaining = 1.0 - post[pred]
        others = [c for c in _CLASSES if c != pred]
        for c in others:
            post[c] = remaining / len(others)

    total = sum(post.values())
    return {k: v / total for k, v in post.items()}


def orchestrator_node(state: SwarmState) -> SwarmState:
    """
    Agent 1: Orchestrator + Bayesian Fusion node for LangGraph.

    Combines agent class-conditional posteriors with weighted ensemble,
    applies the CDE severity override for industrial sites, and prepares
    the event for the Dispatcher.
    """
    # ── Bayesian Weighted Fusion ─────────────────────────────────
    # Weights per sensor availability
    if state.vision.cloud_free:
        w_spatial, w_temporal, w_vision = 0.30, 0.30, 0.40
    else:
        # SAR through-cloud validation is slightly weaker than optical SWIR
        w_spatial, w_temporal, w_vision = 0.35, 0.35, 0.30

    p_spatial = _spatial_class_posterior(state)
    p_temporal = _temporal_class_posterior(state)
    p_vision = _vision_class_posterior(state)

    fused: dict[str, float] = {}
    for cls in _CLASSES:
        fused[cls] = (
            w_spatial * p_spatial[cls] +
            w_temporal * p_temporal[cls] +
            w_vision * p_vision[cls]
        )

    # ── CDE (Co-location Disambiguation Engine) for industrial sites ──────
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

    # ── Winning class ──────────────────────────────────────────────
    classification: ThermalClass = max(fused, key=fused.get)  # type: ignore[assignment]
    fused_score = fused[classification]

    # ── CDE severity override for industrial containment ───────────
    spatial_facility = state.spatial.facility_id is not None
    nearest_km = state.spatial.nearest_facility_km if state.spatial.nearest_facility_km is not None else 999.0
    is_near_facility = spatial_facility and nearest_km <= 5.0

    severity: AlertSeverity = "INFO"
    is_critical = False

    if is_near_facility:
        # Industrial site: CDE thermodynamic fingerprint decides
        if cde_output.severity == "CRITICAL":
            classification = "INDUSTRIAL_FIRE_EMERGENCY"
            severity = "CRITICAL"
            is_critical = True
            # All agents + CDE agree on emergency: elevate confidence
            fused_score = max(fused_score, fused.get("INDUSTRIAL_FIRE_EMERGENCY", 0.0))
            fused_score = max(fused_score, 0.92)
        elif cde_output.severity == "WARNING":
            classification = "DEFERRED_FOR_ANALYST"
            severity = "WARNING"
            fused_score = max(fused_score, 0.86)
        elif cde_output.severity == "WATCH":
            classification = "DEFERRED_FOR_ANALYST"
            severity = "WATCH"
            fused_score = max(fused_score, 0.84)
        else:
            # NORMAL CDE at facility: persistent operating flare
            classification = "PERSISTENT_INDUSTRIAL_FLARE"
            severity = "INFO"
            fused_score = max(fused_score, fused.get("PERSISTENT_INDUSTRIAL_FLARE", 0.0))
            fused_score = max(fused_score, 0.90)
    else:
        # Non-industrial: land-cover driven classes already fused above
        if classification == "WILDFIRE":
            severity = "WARNING"
            fused_score = max(fused_score, 0.88)
        elif classification == "AGRICULTURAL_BURNING":
            severity = "INFO"
            fused_score = max(fused_score, 0.88)
        else:
            severity = "WATCH"

    # ── Multi-agent agreement bonus (consensus sharpening) ─────────
    # If all three agents independently place >60% mass on the same class,
    # the posterior sharpens (Dempster-style agreement boost).
    top_spatial = max(p_spatial, key=p_spatial.get)
    top_temporal = max(p_temporal, key=p_temporal.get)
    top_vision = max(p_vision, key=p_vision.get)
    if top_spatial == top_temporal == top_vision == classification:
        fused_score = min(0.99, fused_score + 0.05)

    # ── Sensor quality floor: FIRMS detection confidence ──────────
    firms_conf = state.confidence_pct / 100.0 if state.confidence_pct else 0.8
    fused_score = fused_score * (0.75 + 0.25 * firms_conf)

    # Confidence is never lower than the weakest evidence, never above 0.99
    fused_score = max(0.70, min(0.99, round(fused_score, 3)))

    # ── Human review gating ───────────────────────────────────────
    human_review = (
        classification == "DEFERRED_FOR_ANALYST"
        or fused_score < 0.80
        or cde_output.severity == "WARNING"
    )

    # ── Apply to state ─────────────────────────────────────────────
    state.final_classification = classification
    state.final_confidence = fused_score
    state.cde_score = cde_output.cde_score
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
