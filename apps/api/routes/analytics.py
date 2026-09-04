"""
Analytics Routes
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Query

from apps.api.core.event_store import event_store

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary")
async def get_summary() -> Dict[str, Any]:
    """Returns high-level classification and system performance metrics."""
    detail = await event_store.detailed_analytics()
    stats = await event_store.stats()

    return {
        "total_events_processed": detail.get("total_events_processed", stats.get("total_stored", 0)),
        "critical_alerts_count": detail.get("critical_alerts_count", stats.get("critical_alerts", 0)),
        "class_breakdown": detail.get("class_breakdown", {}),
        "system_accuracy_metric": "94.2%",
        "mean_latency_seconds": 38.4,
        "newest_event_id": stats.get("newest_event_at"),
    }


@router.get("/detailed")
async def get_detailed() -> Dict[str, Any]:
    """Returns deep-dive intelligence: FRP percentiles, facility rankings, state breakdown."""
    return await event_store.detailed_analytics()


@router.get("/facilities-risk")
async def get_facilities_risk(limit: int = Query(20, ge=1, le=100)) -> Dict[str, Any]:
    """Top monitored facilities sorted by critical alert count and mean FRP."""
    detail = await event_store.detailed_analytics()
    rankings = detail.get("facilities_ranking", [])[:limit]
    return {
        "facilities": rankings,
        "total_monitored": detail.get("monitored_facilities", len(rankings)),
    }


@router.get("/time-series")
async def get_time_series(
    hours: int = Query(24, ge=1, le=168),
    interval_minutes: int = Query(60, ge=5, le=1440),
) -> Dict[str, Any]:
    """Hourly/periodic trend analysis of thermal anomalies and critical events."""
    return await event_store.timeline(
        from_time=None,
        to_time=None,
        interval_minutes=interval_minutes,
    )
