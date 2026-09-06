"""
Events Routes (Timeline + Historical Playback + Filtering)
"""

from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException

from apps.api.core.event_store import event_store
from apps.api.models.schemas import ThermalClassification

router = APIRouter(prefix="/events", tags=["Thermal Events"])


@router.get("")
async def list_events(
    classification: Optional[str] = None,
    critical_only: bool = False,
    limit: int = Query(50, ge=1, le=1000),
    from_time: Optional[str] = Query(None, description="ISO timestamp start filter"),
    to_time: Optional[str] = Query(None, description="ISO timestamp end filter"),
    min_lat: Optional[float] = Query(None, ge=-90, le=90),
    max_lat: Optional[float] = Query(None, ge=-90, le=90),
    min_lon: Optional[float] = Query(None, ge=-180, le=180),
    max_lon: Optional[float] = Query(None, ge=-180, le=180),
):
    """
    Returns classified thermal events from the in-memory event store.
    Ordered newest-first. Supports time-range and spatial bounding-box filters.
    """
    return await event_store.list(
        classification=classification,
        critical_only=critical_only,
        limit=limit,
        from_time=from_time,
        to_time=to_time,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
    )


@router.get("/timeline")
async def get_timeline(
    from_time: Optional[str] = Query(None, description="Start ISO (defaults to -24h)"),
    to_time: Optional[str] = Query(None, description="End ISO (defaults to now)"),
    interval_minutes: int = Query(60, ge=5, le=1440, description="Bucket interval"),
):
    """
    Returns time-bucketed event counts and FRP profiles for the map timeline scrubber.
    """
    return await event_store.timeline(
        from_time=from_time,
        to_time=to_time,
        interval_minutes=interval_minutes,
    )


@router.get("/history")
async def get_history(
    from_time: Optional[str] = Query(None, description="Start ISO"),
    to_time: Optional[str] = Query(None, description="End ISO"),
    classification: Optional[str] = None,
    limit: int = Query(200, ge=1, le=2000),
):
    """
    Returns chronological (oldest-first) events for timeline animation playback.
    """
    return await event_store.history(
        from_time=from_time,
        to_time=to_time,
        classification=classification,
        limit=limit,
    )


@router.post("/inject")
async def inject_event(payload: dict):
    """
    Live Interactive Injection Engine (for evaluator/judge testing & live demo).
    Simulates a newly detected satellite thermal anomaly passing through
    the multi-agent swarm pipeline, CDE baseline engine, and WebSocket broadcaster.
    """
    import sys
    from datetime import datetime, timezone
    from pathlib import Path

    ROOT = Path(__file__).resolve().parents[3]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    from packages.agents.src.graph import run_swarm
    from apps.api.main import process_event

    scenario = payload.get("scenario", "jamnagar_emergency")

    # Scenarios curated for live judge demonstration
    scenarios = {
        "jamnagar_emergency": {
            "firms_id": f"sim-jam-{int(datetime.now().timestamp())}",
            "latitude": 22.368,
            "longitude": 69.832,
            "frp_megawatts": payload.get("frp_megawatts", 892.0),
            "brightness_temp_kelvin": payload.get("brightness_temp_kelvin", 942.5),
            "confidence_pct": 99,
            "satellite_source": payload.get("satellite_source", "VIIRS_SNPP_NRT"),
            "day_night": "N",
            "acq_datetime": datetime.now(timezone.utc).isoformat(),
        },
        "haldia_flare": {
            "firms_id": f"sim-hal-{int(datetime.now().timestamp())}",
            "latitude": 22.031,
            "longitude": 88.082,
            "frp_megawatts": payload.get("frp_megawatts", 145.0),
            "brightness_temp_kelvin": payload.get("brightness_temp_kelvin", 780.0),
            "confidence_pct": 92,
            "satellite_source": "VIIRS_NOAA20_NRT",
            "day_night": "N",
            "acq_datetime": datetime.now(timezone.utc).isoformat(),
        },
        "punjab_stubble": {
            "firms_id": f"sim-pb-{int(datetime.now().timestamp())}",
            "latitude": 30.342,
            "longitude": 75.832,
            "frp_megawatts": payload.get("frp_megawatts", 48.0),
            "brightness_temp_kelvin": payload.get("brightness_temp_kelvin", 372.0),
            "confidence_pct": 88,
            "satellite_source": "VIIRS_SNPP_NRT",
            "day_night": "D",
            "acq_datetime": datetime.now(timezone.utc).isoformat(),
        },
        "uttarakhand_wildfire": {
            "firms_id": f"sim-uk-{int(datetime.now().timestamp())}",
            "latitude": 30.082,
            "longitude": 79.241,
            "frp_megawatts": payload.get("frp_megawatts", 75.0),
            "brightness_temp_kelvin": payload.get("brightness_temp_kelvin", 418.0),
            "confidence_pct": 90,
            "satellite_source": "VIIRS_SNPP_NRT",
            "day_night": "D",
            "acq_datetime": datetime.now(timezone.utc).isoformat(),
        },
        "custom": {
            "firms_id": f"sim-custom-{int(datetime.now().timestamp())}",
            "latitude": float(payload.get("latitude", 22.368)),
            "longitude": float(payload.get("longitude", 69.832)),
            "frp_megawatts": float(payload.get("frp_megawatts", 500.0)),
            "brightness_temp_kelvin": float(payload.get("brightness_temp_kelvin", 800.0)),
            "confidence_pct": int(payload.get("confidence_pct", 95)),
            "satellite_source": payload.get("satellite_source", "VIIRS_SNPP_NRT"),
            "day_night": payload.get("day_night", "N"),
            "acq_datetime": datetime.now(timezone.utc).isoformat(),
        }
    }

    selected = scenarios.get(scenario, scenarios["jamnagar_emergency"])

    # Run multi-agent swarm pipeline
    classified = run_swarm(selected)

    # Process and broadcast through WebSocket
    await process_event(classified)

    return {
        "status": "success",
        "scenario": scenario,
        "event": classified,
        "message": f"Event {classified.get('id')} injected and broadcast via WebSocket to live map",
    }



@router.get("/{event_id}")
async def get_event(event_id: str):
    """Returns a single classified event by ID."""
    event = await event_store.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return event
