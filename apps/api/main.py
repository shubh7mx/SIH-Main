"""
SIH26162 — Thermal Intelligence API (Phase 3 Production)
FastAPI 0.115+ · Pydantic v2 · Python 3.11+
National Technical Research Organisation (NTRO)
"""

import asyncio
import time
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Load .env from project root BEFORE any settings/module reads env vars
from dotenv import load_dotenv
_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / ".env")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, FileResponse

from apps.api.config import settings
from apps.api.core.redis_client import get_redis
from apps.api.core.ws_manager import ws_manager, ConnectionRole
from apps.api.core.event_store import event_store
from apps.api.core.log_store import log_store
from apps.api.models.schemas import (
    HotspotEvent, FacilityItem, SystemStatus,
    ThermalClassification, AlertSeverity,
)
from apps.api.routes import health, events, facilities, analytics, logs, copilot, ws
from apps.api.worker import start_worker, stop_worker

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sih26162")


# ─── Background event processor ────────────────────────────────────────────────
async def process_event(event: dict):
    """
    Processes a single classified event through the full pipeline:
      1. Store in event store
      2. Log decision trace to log store
      3. Broadcast via WebSocket to all connected clients
      4. Publish to Redis fanout channel
    """
    try:
        # 1. Store event
        await event_store.add(event)

        # 2. Log entry in audit trail
        cls = event.get("classification", "UNKNOWN")
        conf = (event.get("confidence_score") or 0) * 100
        frp = event.get("frp_megawatts", 0)
        fac = event.get("facility_name") or "open terrain"
        is_crit = event.get("is_critical_alert", False)
        level = "CRITICAL" if is_crit else ("WARNING" if conf > 80 else "INFO")

        await log_store.add(
            level=level,
            source="ORCHESTRATOR",
            message=f"Event {event.get('id', '?')} classified as {cls} ({conf:.0f}% conf, {frp:.0f} MW) near {fac}",
            event_id=event.get("id"),
            metadata={
                "classification": cls,
                "confidence_score": event.get("confidence_score"),
                "cde_anomaly_score": event.get("cde_anomaly_score"),
                "frp_megawatts": frp,
                "is_critical": is_crit,
            },
        )

        # 3. Broadcast to WebSocket clients
        await ws_manager.broadcast(event)

        # 4. Publish to Redis for cross-instance fanout
        redis = await get_redis()
        if redis.available:
            await redis.publish_event("events", event)

    except Exception as exc:
        logger.error(f"Error processing event {event.get('id', '?')}: {exc}")
        await log_store.add(
            level="ERROR",
            source="SYSTEM",
            message=f"Failed to process event {event.get('id', '?')}: {exc}",
            event_id=event.get("id"),
        )


# ─── Lifespan ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting SIH26162 Thermal Intelligence API...")
    await log_store.add("INFO", "SYSTEM", "SIH26162 Thermal Intelligence API starting up")

    # Connect Redis
    redis = await get_redis()
    logger.info(f"Redis: {'CONNECTED' if redis.available else 'OFFLINE (mock mode)'}")

    # Start background FIRMS worker
    worker_task = asyncio.create_task(start_worker(process_event))
    logger.info("Background FIRMS worker: STARTED")
    await log_store.add("INFO", "FIRMS_POLLER", "NASA FIRMS background worker initialized and running")

    # Start WebSocket heartbeat
    heartbeat_task = asyncio.create_task(ws_manager.start_heartbeat(30.0))

    yield  # App is running

    # Shutdown
    logger.info("Shutting down SIH26162 API...")
    await stop_worker()
    heartbeat_task.cancel()
    worker_task.cancel()
    await redis.disconnect()
    logger.info("Shutdown complete.")


# ─── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="""
## SIH26162 — Thermal Intelligence API (Phase 3 Production)

**Problem:** AI-Based Detection and Classification of Industrial Fires and Persistent
Thermal Sources Using NASA FIRMS, OSM & Satellite Data

**Sponsoring Organisation:** NTRO

### Architecture
- **Phase 1:** Real-time FIRMS ingestion pipeline
- **Phase 2:** 6-agent LangGraph swarm (Spatial / Temporal / Vision / Dispersion / Orchestrator / Dispatcher)
- **Phase 3:** FastAPI + WebSocket + Event Store + Timeline Scrubber + Tactical Copilot
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Configuration with Explicit Whitelist for Local and Production Domains
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://26162.vlkn.qzz.io",
    "http://26162.vlkn.qzz.io",
    "https://26162.codepegst.xyz",
    "http://26162.codepegst.xyz",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|.*\.vlkn\.qzz\.io|.*\.qzz\.io|.*\.codepegst\.xyz)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root — serve the standalone demo console
@app.get("/", include_in_schema=False)
async def root():
    demo_path = Path(__file__).parent.parent.parent / "demo.html"
    if demo_path.exists():
        return FileResponse(demo_path, media_type="text/html")
    return RedirectResponse(url="/docs")

@app.get("/api/v1", include_in_schema=False)
async def api_root():
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "status": "OPERATIONAL",
        "components": {
            "event_store": "in-memory (5000 event capacity)",
            "websocket_alerts": "/api/v1/ws/alerts",
            "websocket_logs": "/api/v1/ws/logs",
            "redis": "connected" if (await get_redis()).available else "offline",
        },
        "endpoints": {
            "health": "/api/v1/health",
            "events": "/api/v1/events",
            "timeline": "/api/v1/events/timeline",
            "history": "/api/v1/events/history",
            "stats": "/api/v1/stats",
            "facilities": "/api/v1/facilities",
            "analytics": "/api/v1/analytics/summary",
            "logs": "/api/v1/logs",
            "intelligence_brief": "/api/v1/intelligence/brief",
            "intelligence_copilot": "/api/v1/intelligence/copilot",
            "docs": "/docs",
        },
    }

# ─── REST & WebSocket Routes ────────────────────────────────────────────────
app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(events.router, prefix=settings.API_PREFIX)
app.include_router(facilities.router, prefix=settings.API_PREFIX)
app.include_router(analytics.router, prefix=settings.API_PREFIX)
app.include_router(logs.router, prefix=settings.API_PREFIX)
app.include_router(copilot.router, prefix=settings.API_PREFIX)
app.include_router(ws.router, prefix=settings.API_PREFIX)


# ─── Stats Endpoint ────────────────────────────────────────────────────────
@app.get(f"{settings.API_PREFIX}/stats")
async def get_stats():
    """Real-time event store statistics."""
    store_stats = await event_store.stats()
    ws_stats = await ws_manager.get_stats()
    log_stats_val = await log_store.stats()
    redis = await get_redis()
    return {
        "events": store_stats,
        "websocket": ws_stats,
        "logs": log_stats_val,
        "redis": "connected" if redis.available else "offline",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
