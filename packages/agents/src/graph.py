"""
SIH26162 Multi-Agent Swarm — LangGraph 1.2 State Graph
======================================================
Assembles the complete 6-agent state machine as a pure-Python DAG.
Each hotspot from the FIRMS pipeline flows through this graph to produce
a classified, graded, and dispatched event.

Architecture:
┌──────────────────────────────────────────────────────────────────────────┐
│  Orchestrator (meta)    Spatial    Temporal    Vision    Dispersion  │
│       ▲                    │           │          │            │       │
│       └────────────────────┴───────────┴──────────┴────────────┘       │
│                           Fan-in from all agents                        │
└──────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    Dispatcher (Alert Routing)

Usage:
    from packages.agents.src.graph import run_swarm
    result = run_swarm(hotspot_dict)
"""

import sys
from datetime import datetime, timezone
from typing import Any

from packages.agents.src.state import SwarmState, ThermalClass
from packages.agents.src.spatial_agent import spatial_pipeline
from packages.agents.src.temporal_agent import temporal_pipeline
from packages.agents.src.vision_agent import vision_pipeline
from packages.agents.src.dispersion_agent import dispersion_pipeline
from packages.agents.src.orchestrator import orchestrator_node
from packages.agents.src.dispatcher import AlertDispatcher


def build_state(hotspot: dict) -> SwarmState:
    """Builds an initial SwarmState from a FIRMS hotspot dict."""
    acq_dt = hotspot.get("acq_datetime")
    if isinstance(acq_dt, str):
        try:
            acq_dt = datetime.fromisoformat(acq_dt.replace("Z", "+00:00"))
        except Exception:
            acq_dt = datetime.now(timezone.utc)

    return SwarmState(
        hotspot_id=hotspot.get("firms_id", hotspot.get("id", "unknown")),
        firms_id=hotspot.get("firms_id", ""),
        latitude=hotspot.get("latitude", 0.0),
        longitude=hotspot.get("longitude", 0.0),
        frp_mw=float(hotspot.get("frp_megawatts", hotspot.get("frp_mw", 0.0))),
        brightness_temp_k=float(hotspot.get("brightness_temp_kelvin", hotspot.get("brightness_temp_k", 0.0))),
        confidence_pct=int(hotspot.get("confidence_pct", 80)),
        satellite_source=hotspot.get("satellite_source", "VIIRS_SNPP_NRT"),
        day_night=hotspot.get("day_night", "D"),
        acq_datetime=acq_dt,
        h3_index=hotspot.get("h3_index", ""),
        pipeline_started_at=datetime.now(timezone.utc),
        agents_completed=[],
    )


def run_swarm(hotspot: dict) -> dict:
    """
    Executes the full 6-agent swarm pipeline synchronously.

    In production (LangGraph 1.2), this is compiled as:
        workflow = StateGraph(SwarmState)
        workflow.add_node("spatial", spatial_pipeline)
        workflow.add_node("temporal", temporal_pipeline)
        workflow.add_node("vision", vision_pipeline)
        workflow.add_node("orchestrator", orchestrator_node)
        workflow.add_node("dispersion", dispersion_pipeline)
        workflow.add_edge("spatial", "orchestrator")
        workflow.add_edge("temporal", "orchestrator")
        workflow.add_edge("vision", "orchestrator")
        workflow.add_edge("orchestrator", "dispersion")
        app = workflow.compile()

    Pipeline flow:
      1. Spatial Agent   → PostGIS OSM lookup, H3 indexing, WorldCover
      2. Temporal Agent → RisingWave baseline Z-score, TPI, diurnal anomaly
      3. Vision Agent   → Sentinel-2 SWIR, cloud cover detection
      4. Orchestrator   → Bayesian fusion + CDE Z-score override
      5. Dispersion Agent → Gaussian puff plume + population hazard zones
      6. Dispatcher     → 4-tier alert routing, channel dispatch

    Returns:
      dict: Classified event with full agent reasoning, ready for FastAPI / WebSocket.
    """
    # ── Step 1: Build initial state ─────────────────────────────────────
    state: SwarmState = build_state(hotspot)
    state.agents_completed = []

    # ── Step 2: Agent 2 — Spatial ─────────────────────────────────────
    try:
        state = spatial_pipeline(state)
        state.agents_completed.append("spatial")
    except Exception as e:
        state.errors.append(f"spatial_agent: {e}")

    # ── Step 3: Agent 3 — Temporal ───────────────────────────────────
    try:
        state = temporal_pipeline(state)
        state.agents_completed.append("temporal")
    except Exception as e:
        state.errors.append(f"temporal_agent: {e}")

    # ── Step 4: Agent 4 — Vision ─────────────────────────────────────
    try:
        state = vision_pipeline(state)
        state.agents_completed.append("vision")
    except Exception as e:
        state.errors.append(f"vision_agent: {e}")

    # ── Step 5: Agent 1 — Orchestrator (Bayesian fusion + CDE) ─────────
    try:
        state = orchestrator_node(state)
        state.agents_completed.append("orchestrator")
    except Exception as e:
        state.errors.append(f"orchestrator: {e}")

    # ── Step 6: Agent 5 — Dispersion ─────────────────────────────────
    try:
        state = dispersion_pipeline(state)
        state.agents_completed.append("dispersion")
    except Exception as e:
        state.errors.append(f"dispersion_agent: {e}")

    # ── Step 7: Agent 6 — Dispatcher ────────────────────────────────
    try:
        dispatcher = AlertDispatcher()
        severity = dispatcher.gate(state)
        dispatch_result = dispatcher.dispatch(state, severity)
        state.agents_completed.append("dispatcher")
    except Exception as e:
        state.errors.append(f"dispatcher: {e}")
        dispatch_result = {"error": str(e)}

    # ── Return classification dict ────────────────────────────────────
    result = state.to_classification_dict()
    result["_internal"] = {
        "agents_completed": state.agents_completed,
        "errors": state.errors,
        "dispatch_result": dispatch_result,
    }
    return result


async def run_swarm_async(hotspot: dict) -> dict:
    """
    Async wrapper for environments where LangGraph 1.2 async compilation is used.
    Currently delegates to the sync version.
    """
    return run_swarm(hotspot)


def run_batch(hotspots: list[dict]) -> list[dict]:
    """
    Processes a batch of FIRMS hotspots through the swarm pipeline.
    In production, this would be parallelized via asyncio.gather or a job queue.
    """
    return [run_swarm(h) for h in hotspots]
