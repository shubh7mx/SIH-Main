"""
WebSocket Connection Manager
===========================
Manages active WebSocket connections, broadcasts classified events,
and handles per-client message queues.
"""

from __future__ import annotations
import asyncio
import json
import time
import uuid
from typing import Optional
from dataclasses import dataclass, field
from fastapi import WebSocket, WebSocketDisconnect
from enum import Enum


class ConnectionRole(str, Enum):
    OPERATOR = "operator"
    ANALYST = "analyst"
    ADMIN = "admin"


@dataclass
class WSClient:
    """Represents a single connected WebSocket client."""
    client_id: str
    websocket: WebSocket
    role: ConnectionRole = ConnectionRole.OPERATOR
    filters: dict = field(default_factory=dict)
    connected_at: float = field(default_factory=time.time)
    last_ping: float = field(default_factory=time.time)
    events_received: int = 0


class WSConnectionManager:
    """
    Manages all active WebSocket connections for the thermal alert stream.

    Features:
      - Per-client filtering (by severity, facility, classification)
      - Heartbeat/ping-pong to detect stale connections
      - Broadcast fanout with sub-100ms latency
      - Graceful disconnect handling
    """

    CHANNEL = "thermal:alerts"

    def __init__(self):
        self._clients: dict[str, WSClient] = {}
        self._lock = asyncio.Lock()
        self._ping_task: Optional[asyncio.Task] = None
        self._running = False

    # ── Connection lifecycle ──────────────────────────────────────────────

    async def connect(self, websocket: WebSocket, role: ConnectionRole = ConnectionRole.OPERATOR, filters: Optional[dict] = None) -> str:
        """Accepts a WebSocket and registers it. Returns client_id."""
        requested_subprotocols = websocket.headers.get("sec-websocket-protocol", "").split(",")
        requested = [s.strip() for s in requested_subprotocols if s.strip()]
        if "v1" in requested:
            await websocket.accept(subprotocol="v1")
        else:
            await websocket.accept()

        client_id = str(uuid.uuid4())[:12]
        client = WSClient(
            client_id=client_id,
            websocket=websocket,
            role=role,
            filters=filters or {},
        )

        async with self._lock:
            self._clients[client_id] = client

        # Send connection acknowledgement
        await websocket.send_json({
            "type": "connected",
            "client_id": client_id,
            "role": role,
            "filters": client.filters,
            "timestamp": time.time(),
            "message": "SIH26162 Thermal Alert Stream connected",
            "stats": self._get_stats(),
        })

        return client_id

    async def disconnect(self, client_id: str):
        """Removes a client from the registry."""
        async with self._lock:
            self._clients.pop(client_id, None)

    # ── Broadcast ───────────────────────────────────────────────────────

    async def broadcast(self, event: dict, severity_filter: Optional[str] = None):
        """
        Broadcasts a classified event to all connected clients whose filters match.
        Sub-100ms fanout using asyncio.gather.
        """
        async with self._lock:
            clients = list(self._clients.values())

        if not clients:
            return

        # Filter clients who want this event
        tasks = []
        for client in clients:
            if self._matches_filter(client, event):
                tasks.append(self._send_safe(client, event))

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            # Clean up disconnected clients
            async with self._lock:
                for i, (client, result) in enumerate(zip(clients, results)):
                    if isinstance(result, WebSocketDisconnect):
                        self._clients.pop(client.client_id, None)

    async def _matches_filter(self, client: WSClient, event: dict) -> bool:
        """Checks if an event matches a client's subscription filters."""
        filters = client.filters

        # Severity filter
        if filters.get("severity"):
            if event.get("alert_severity") not in filters["severity"]:
                return False

        # Classification filter
        if filters.get("classification"):
            if event.get("classification") not in filters["classification"]:
                return False

        # Critical-only filter
        if filters.get("critical_only"):
            if not event.get("is_critical_alert"):
                return False

        # Facility filter
        if filters.get("facility_id"):
            if event.get("facility_id") != filters["facility_id"]:
                return False

        return True

    async def _send_safe(self, client: WSClient, event: dict):
        """Sends to client, returns True on success, raises on disconnect."""
        try:
            await client.websocket.send_json(event)
            client.events_received += 1
            return True
        except Exception as exc:
            await self.disconnect(client.client_id)
            return exc  # Will be filtered by gather

    # ── Health & stats ──────────────────────────────────────────────────

    def _get_stats(self) -> dict:
        return {
            "total_clients": len(self._clients),
            "role_breakdown": {
                role.value: sum(1 for c in self._clients.values() if c.role == role)
                for role in ConnectionRole
            },
        }

    async def get_stats(self) -> dict:
        async with self._lock:
            stats = self._get_stats()
        stats["uptime_seconds"] = time.time() - min(
            c.connected_at for c in self._clients.values()
        ) if self._clients else 0
        return stats

    # ── Ping/pong heartbeat ────────────────────────────────────────────

    async def start_heartbeat(self, interval: float = 30.0):
        """Pings all clients every `interval` seconds to detect stale connections."""
        self._running = True
        while self._running:
            await asyncio.sleep(interval)
            async with self._lock:
                stale = [
                    c for c in self._clients.values()
                    if time.time() - c.last_ping > interval * 3
                ]
                for c in stale:
                    self._clients.pop(c.client_id, None)
                    try:
                        await c.websocket.close(code=4001, reason="Heartbeat timeout")
                    except Exception:
                        pass


# Global singleton
ws_manager = WSConnectionManager()
