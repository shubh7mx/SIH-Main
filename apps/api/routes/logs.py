"""
System Audit & Agent Execution Log Routes
"""

from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Query

from apps.api.core.log_store import log_store

router = APIRouter(prefix="/logs", tags=["Audit & Logs"])


@router.get("")
async def list_logs(
    level: Optional[str] = Query(None, description="DEBUG | INFO | WARNING | ERROR | CRITICAL"),
    source: Optional[str] = Query(None, description="Filter by agent/pipeline source"),
    event_id: Optional[str] = Query(None, description="Filter logs for a specific event"),
    limit: int = Query(100, ge=1, le=1000),
    since_seq: Optional[int] = Query(None, description="Polling offset for new logs"),
) -> List[Dict[str, Any]]:
    """Returns structured system and agent execution logs (newest first)."""
    return await log_store.list(
        level=level,
        source=source,
        event_id=event_id,
        limit=limit,
        since_seq=since_seq,
    )


@router.get("/tail")
async def tail_logs(n: int = Query(50, ge=1, le=200)) -> List[Dict[str, Any]]:
    """Returns the last N log entries (fast ring read)."""
    return await log_store.tail(n=n)


@router.get("/stats")
async def log_stats() -> Dict[str, Any]:
    """Returns log volume, breakdown by source and severity level."""
    return await log_store.stats()
