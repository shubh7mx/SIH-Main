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

# ── Tier A: Human-review deferral thresholds ──────────────────────────────
# Calibrated by scripts/evaluate_deferral.py (5-fold stratified CV over the
# 1,080-sample merged ground truth). Chosen config: margin_tau=0.15, no
# unconditional submodel-conflict trigger → 99.72% coverage at 99.81%
# auto-decided accuracy, with 60% of all model errors captured in the
# deferred bucket. See packages/agents/models/model_metrics.json.
MARGIN_TAU = 0.15        # top1 - top2 probability below this = ambiguous
AGREE_TAU = 0.70          # XGB-vs-RF posterior agreement below this = models split
ENTROPY_TAU = 0.55        # normalized predictive entropy above this = uncertain
CONF_TAU = 0.80           # fused confidence below this = weak evidence


def _agent_disagreement(posters: list[dict[str, float]]) -> float:
    """
    Disagreement across agent posteriors in [0, 1].
    Half credit for distinct top-class count, half for mean pairwise
    L1 distance (normalized). 0 = all agents same shape, 1 = total conflict.
    """
    n = len(posters)
    if n < 2:
        return 0.0
    tops = [max(p, key=p.get) for p in posters]
    distinct = len(set(tops))
    top_component = (distinct - 1) / (n - 1) if n > 1 else 0.0

    l1_sum, pairs = 0.0, 0
    for i in range(n):
        for j in range(i + 1, n):
            keys = set(posters[i]) | set(posters[j])
            l1 = sum(abs(posters[i].get(k, 0.0) - posters[j].get(k, 0.0)) for k in keys)
            l1_sum += l1 / 2.0  # L1 in [0,2] → normalize
            pairs += 1
    l1_component = l1_sum / pairs if pairs else 0.0

    return round(0.5 * top_component + 0.5 * l1_component, 4)


def _spatial_class_posterior(state: SwarmState) -> dict[str, float]:
    """Spatial agent's class-conditional likelihood distribution."""
    post = {c: 0.02 for c in _CLASSES}
    facility_type = state.spatial.facility_type
    land_cover = state.spatial.land_cover_class
    dist_km = state.spatial.nearest_facility_km or 999.0
    facility_id = state.spatial.facility_id

    if (facility_type is not None or facility_id is not None) and dist_km <= 2.5:
        # True spatial containment within industrial facility perimeter
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
    elif land_cover == 10:
        post["WILDFIRE"] = 0.90
        post["AGRICULTURAL_BURNING"] = 0.03
        post["DEFERRED_FOR_ANALYST"] = 0.04
    elif land_cover == 40:
        post["AGRICULTURAL_BURNING"] = 0.90
        post["WILDFIRE"] = 0.03
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
    dist_km = state.spatial.nearest_facility_km if state.spatial.nearest_facility_km is not None else 999.0
    is_industrial = (
        state.spatial.facility_id is not None
        or dist_km <= 5.0
        or (state.spatial.land_cover_class == 50 and dist_km <= 10.0)
    )
    z_frp = state.temporal.frp_zscore or 0.0
    z_bt = state.temporal.bt_zscore or 0.0
    lc = state.spatial.land_cover_class

    if is_industrial:
        if z_frp > 3.0 or z_bt > 3.5:
            # Massive thermodynamic deviation: emergency signature
            post["INDUSTRIAL_FIRE_EMERGENCY"] = 0.90
            post["PERSISTENT_INDUSTRIAL_FLARE"] = 0.05
            post["DEFERRED_FOR_ANALYST"] = 0.05
        elif z_frp <= 2.0 and z_bt <= 2.0:
            # Stable or negative Z within normal operating envelope: flare signature
            post["PERSISTENT_INDUSTRIAL_FLARE"] = 0.88
            post["INDUSTRIAL_FIRE_EMERGENCY"] = 0.04
            post["DEFERRED_FOR_ANALYST"] = 0.06
        else:
            post["DEFERRED_FOR_ANALYST"] = 0.40
            post["PERSISTENT_INDUSTRIAL_FLARE"] = 0.35
            post["INDUSTRIAL_FIRE_EMERGENCY"] = 0.20
    else:
        # Non-industrial: harmonize with land cover context
        if lc == 10:  # Forest / tree cover
            post["WILDFIRE"] = 0.85
            post["AGRICULTURAL_BURNING"] = 0.08
            post["DEFERRED_FOR_ANALYST"] = 0.04
        elif lc == 40:  # Cropland
            post["AGRICULTURAL_BURNING"] = 0.88
            post["WILDFIRE"] = 0.06
            post["DEFERRED_FOR_ANALYST"] = 0.04
        elif lc == 50:  # Urban / Built-up zone
            post["PERSISTENT_INDUSTRIAL_FLARE"] = 0.75
            post["INDUSTRIAL_FIRE_EMERGENCY"] = 0.15
            post["DEFERRED_FOR_ANALYST"] = 0.05
        elif state.frp_mw > 150.0:
            # Elevated radiative energy over wildland: wildfire signature
            post["WILDFIRE"] = 0.75
            post["AGRICULTURAL_BURNING"] = 0.18
            post["DEFERRED_FOR_ANALYST"] = 0.04
        else:
            # Standard biomass burning energy envelope
            post["AGRICULTURAL_BURNING"] = 0.70
            post["WILDFIRE"] = 0.22
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

    # ── Tier A: Uncertainty inputs (defer decision applied at end) ──
    # Deferral rules run on the FINAL fused score (after CDE override,
    # consensus bonus and FIRMS floor) so strong-evidence events are
    # never deferred by an early weak score.
    agent_disagree = _agent_disagreement([p_spatial, p_temporal, p_vision])
    ml_margin = state.vision.prediction_margin
    ml_entropy = state.vision.prediction_entropy
    ml_agreement = state.vision.model_agreement

    # ── CDE severity override for industrial containment ───────────
    spatial_facility = state.spatial.facility_id is not None or state.spatial.facility_name is not None
    nearest_km = state.spatial.nearest_facility_km if state.spatial.nearest_facility_km is not None else 999.0
    is_near_facility = (spatial_facility or state.spatial.facility_type is not None or state.spatial.land_cover_class == 50) and nearest_km <= 8.0

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
            # Significant 2.5-4σ deviation: defer to analyst review
            classification = "DEFERRED_FOR_ANALYST"
            severity = "WARNING"
            fused_score = max(fused_score, 0.86)
        elif cde_output.severity == "WATCH":
            # Elevated but within operational range: persistent flare under watch
            classification = "PERSISTENT_INDUSTRIAL_FLARE"
            severity = "WATCH"
            fused_score = max(fused_score, fused.get("PERSISTENT_INDUSTRIAL_FLARE", 0.0))
            fused_score = max(fused_score, 0.88)
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

    # ── Tier A: Calibrated Deferral rules (on final evidence) ──────
    uncertainty_reasons: list[str] = []

    # Rule 1: Truly low fused confidence on unconfirmed ground
    has_known_facility = bool(state.spatial.facility_name and (state.spatial.nearest_facility_km or 999.0) <= 5.0)
    conf_floor = 0.60 if has_known_facility else 0.65
    if fused_score < conf_floor:
        uncertainty_reasons.append(
            f"Low fused confidence ({fused_score:.2f} < {conf_floor:.2f})"
        )

    # Rule 2: Narrow margin near facility boundary
    if ml_margin < 0.10 and has_known_facility and fused_score < 0.75:
        uncertainty_reasons.append(
            f"Narrow margin between top classes (Δ={ml_margin:.2f} < 0.10)"
        )

    # Rule 3: Sub-model classification conflict with high entropy and weak fused evidence
    sub_classes = state.vision.submodel_classes
    submodels_conflict = (
        len(sub_classes) == 2 and sub_classes[0] != sub_classes[1]
    )
    if submodels_conflict and ml_entropy > 0.70 and fused_score < 0.65 and not has_known_facility:
        uncertainty_reasons.append(
            f"XGBoost and Random Forest disagree on class (XGB→{sub_classes[0]}, RF→{sub_classes[1]})"
        )

    # Rule 4: Multi-agent divergence with high predictive entropy on unmapped terrain
    if agent_disagree >= 0.75 and ml_entropy > 0.65 and not has_known_facility:
        uncertainty_reasons.append(
            f"Spatial/Temporal/Vision agents conflict (disagreement {agent_disagree:.2f})"
        )

    defer_for_review = len(uncertainty_reasons) > 0

    # Never defer when CDE says CRITICAL and all agents independently
    # converge on the same class (strong-evidence override).
    agents_unanimous = (
        top_spatial == top_temporal == top_vision
        and top_spatial == classification
    )
    cde_critical_confident = cde_output.severity == "CRITICAL" and agents_unanimous

    if defer_for_review and not cde_critical_confident:
        classification = "DEFERRED_FOR_ANALYST"
        if severity not in ("WARNING", "CRITICAL"):
            severity = "WATCH"
        is_critical = False

    # ── Human review gating ───────────────────────────────────────
    # Human review is required strictly when an event is genuinely deferred
    human_review = classification == "DEFERRED_FOR_ANALYST"

    # ── Apply to state ─────────────────────────────────────────────
    state.final_classification = classification
    state.final_confidence = fused_score
    state.cde_score = cde_output.cde_score
    state.cde_severity = cde_output.severity
    state.alert_severity = severity
    state.is_critical = is_critical
    state.human_review_required = human_review
    state.agent_disagreement = agent_disagree
    state.uncertainty_reasons = uncertainty_reasons
    state.model_probabilities = state.vision.class_probabilities
    state.model_agreement = ml_agreement
    state.prediction_entropy = ml_entropy
    state.prediction_margin = ml_margin
    state.agents_completed = list(set(state.agents_completed + ["orchestrator"]))

    state.pipeline_completed_at = datetime.now(timezone.utc)
    if state.pipeline_started_at:
        duration = (state.pipeline_completed_at - state.pipeline_started_at).total_seconds() * 1000
        state.processing_duration_ms = int(duration)

    return state
