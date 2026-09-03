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


@router.post("/reseed")
async def reseed_events():
    """
    Clears current in-memory events and reseeds with 200 high-fidelity
    Indian mainland agricultural, industrial, and forest hotspots.
    """
    import sys
    from pathlib import Path

    ROOT = Path(__file__).resolve().parents[3]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    from packages.ingestion.src.firms_poller import FIRMSPoller
    from packages.agents.src.swarm import run_swarm
    from apps.api.main import process_event

    await event_store.clear()
    poller = FIRMSPoller()
    hotspots = poller.generate_simulated_hotspots(count=200)

    added = 0
    for h in hotspots:
        try:
            classified = run_swarm(h)
            await process_event(classified)
            added += 1
        except Exception:
            continue

    return {"status": "ok", "reseeded_count": added}


@router.get("/{event_id}")
async def get_event(event_id: str):
    """Returns a single classified event by ID."""
    event = await event_store.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return event
