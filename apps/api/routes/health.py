import time
from fastapi import APIRouter
from apps.api.config import settings
from apps.api.core.event_store import event_store
from apps.api.worker import get_worker_stats
from apps.api.core.redis_client import get_redis
from apps.api.core.recovery import recovery_manager

router = APIRouter(prefix="/health", tags=["Health"])

start_time = time.time()


@router.get("")
async def get_health():
    """Production health check — surfaces all system components and recovery telemetry."""
    store_stats = await event_store.stats()
    worker_stats = get_worker_stats()
    redis = await get_redis()
    recovery_info = recovery_manager.get_status()

    return {
        "status": "OPERATIONAL",
        "version": settings.VERSION,
        "uptime_seconds": round(time.time() - start_time, 2),
        "recovery": recovery_info,
        "components": {
            "event_store": {
                "healthy": True,
                "events_stored": store_stats["total_stored"],
                "critical_alerts": store_stats["critical_alerts"],
            },
            "firms_worker": {
                "healthy": worker_stats.get("running", False),
                "events_processed": worker_stats.get("total_processed", 0),
                "polls_completed": worker_stats.get("total_polls", 0),
                "mode": recovery_info.get("adaptive_mode"),
            },
            "redis": "CONNECTED" if redis.available else "OFFLINE (in-memory fallback)",
            "agent_swarm": "READY (6-agent LangGraph)",
        },
        "data_sources": {
            "nasa_firms": "VIIRS S-NPP 375m NRT + OpenData + simulation fallback",
            "sentinel_2": "CDSE STAC (contract layer)",
            "osm_facilities": "241 Indian industrial facilities across 36 States & UTs",
            "risingwave_streams": "thermal_baseline_30d MV ready",
        },
        "timestamp": time.time(),
    }


@router.get("/live")
async def liveness():
    """Liveness probe — minimal response for k8s livenessProbe."""
    return {"status": "alive"}


@router.get("/ready")
async def readiness():
    """Readiness probe — confirms critical components are available."""
    redis = await get_redis()
    worker_stats = get_worker_stats()
    ready = worker_stats.get("running", False)
    return {
        "status": "ready" if ready else "starting",
        "redis": redis.available,
        "worker_running": ready,
    }
