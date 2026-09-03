"""
System Audit & Agent Log Store
==============================
Thread-safe structured log store for the multi-agent pipeline:
FIRMS polling, spatial/temporal/vision/orchestrator/dispersion/dispatcher
agent executions, alert dispatches, and system lifecycle events.
Streamable to the console via WebSocket.
"""

import asyncio
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

LOG_LEVELS = {"DEBUG": 10, "INFO": 20, "WARNING": 30, "ERROR": 40, "CRITICAL": 50}

VALID_SOURCES = {
    "SYSTEM",
    "FIRMS_POLLER",
    "INGESTION",
    "SPATIAL_AGENT",
    "TEMPORAL_AGENT",
    "VISION_AGENT",
    "ORCHESTRATOR",
    "DISPERSION_AGENT",
    "DISPATCHER",
    "INTELLIGENCE",
    "WEBSOCKET",
}


class LogStore:
    """Bounded ring-buffer log store with filtering + streaming hooks."""

    def __init__(self, max_size: int = 4000):
        self._logs: deque = deque(maxlen=max_size)
        self._lock = asyncio.Lock()
        self._subscribers: List[asyncio.Queue] = []
        self._sub_lock = asyncio.Lock()
        self._seq = 0

    async def add(
        self,
        level: str,
        source: str,
        message: str,
        event_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        level = level.upper() if level.upper() in LOG_LEVELS else "INFO"
        source = source if source in VALID_SOURCES else "SYSTEM"
        async with self._lock:
            self._seq += 1
            entry = {
                "id": f"log-{self._seq}-{uuid.uuid4().hex[:8]}",
                "seq": self._seq,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": level,
                "source": source,
                "message": message,
                "event_id": event_id,
                "metadata": metadata or {},
            }
            self._logs.append(entry)
        # Fan out to WebSocket subscribers (drop stale subscribers silently)
        await self._fanout(entry)
        return entry

    async def _fanout(self, entry: Dict[str, Any]) -> None:
        async with self._sub_lock:
            dead = []
            for q in self._subscribers:
                try:
                    q.put_nowait(entry)
                except asyncio.QueueFull:
                    dead.append(q)
            for q in dead:
                self._subscribers.remove(q)

    async def subscribe(self, maxsize: int = 500) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=maxsize)
        async with self._sub_lock:
            self._subscribers.append(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue) -> None:
        async with self._sub_lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    async def list(
        self,
        level: Optional[str] = None,
        source: Optional[str] = None,
        event_id: Optional[str] = None,
        limit: int = 200,
        since_seq: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        async with self._lock:
            min_level = LOG_LEVELS.get((level or "").upper(), 0)
            results: List[Dict[str, Any]] = []
            # newest first
            for entry in reversed(self._logs):
                if since_seq is not None and entry["seq"] <= since_seq:
                    continue
                if min_level and LOG_LEVELS.get(entry["level"], 0) < min_level:
                    continue
                if source and entry["source"] != source:
                    continue
                if event_id and entry.get("event_id") != event_id:
                    continue
                results.append(entry)
                if len(results) >= limit:
                    break
            return results

    async def tail(self, n: int = 50) -> List[Dict[str, Any]]:
        async with self._lock:
            if n >= len(self._logs):
                return list(reversed(self._logs))
            return list(reversed(self._logs))[:n]

    async def stats(self) -> Dict[str, Any]:
        async with self._lock:
            total = len(self._logs)
            by_level: Dict[str, int] = {}
            by_source: Dict[str, int] = {}
            error_count = 0
            for e in self._logs:
                by_level[e["level"]] = by_level.get(e["level"], 0) + 1
                by_source[e["source"]] = by_source.get(e["source"], 0) + 1
                if e["level"] in ("ERROR", "CRITICAL"):
                    error_count += 1
            return {
                "total_logs": total,
                "error_count": error_count,
                "by_level": by_level,
                "by_source": by_source,
                "newest_seq": self._seq,
            }


# Global singleton
log_store = LogStore(max_size=4000)
