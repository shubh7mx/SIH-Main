"""
WebSocket Routes (Alerts Stream & Audit Log Stream)
===================================================
"""

import asyncio
import json
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from apps.api.core.ws_manager import ws_manager, ConnectionRole
from apps.api.core.event_store import event_store
from apps.api.core.log_store import log_store

logger = logging.getLogger("sih26162.ws")
router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/alerts")
async def alerts_websocket(
    websocket: WebSocket,
    role: Optional[str] = Query("operator"),
    severity: Optional[str] = Query(None),
    critical_only: Optional[bool] = Query(False),
):
    """
    Real-time thermal alert WebSocket.
    Events are pushed by the FIRMS worker after agent swarm classification
    and fanned out via `ws_manager.broadcast()`.
    """
    filters = {}
    if severity:
        filters["severity"] = [s.strip() for s in severity.split(",") if s.strip()]
    if critical_only:
        filters["critical_only"] = True

    try:
        conn_role = ConnectionRole(role)
    except ValueError:
        conn_role = ConnectionRole.OPERATOR

    client_id = await ws_manager.connect(websocket, role=conn_role, filters=filters)

    # Initial backlog replay
    try:
        recent = await event_store.list(limit=50)
        await websocket.send_text(
            json.dumps({
                "type": "backlog",
                "count": len(recent),
                "events": recent,
            })
        )
    except Exception as exc:
        logger.warning(f"Error sending backlog to {client_id}: {exc}")

    try:
        while True:
            msg_text = await websocket.receive_text()
            try:
                msg = json.loads(msg_text)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "ts": msg.get("ts")}))
                elif msg.get("type") == "query":
                    filt = msg.get("filter", {})
                    evs = await event_store.list(
                        classification=filt.get("classification"),
                        critical_only=filt.get("critical_only", False),
                        limit=filt.get("limit", 20),
                    )
                    await websocket.send_text(json.dumps({
                        "type": "query_result",
                        "query_id": msg.get("query_id"),
                        "count": len(evs),
                        "events": evs,
                    }))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning(f"WebSocket client error: {exc}")
        await ws_manager.disconnect(websocket)


@router.websocket("/ws/logs")
async def logs_websocket(
    websocket: WebSocket,
    level: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    backlog: int = Query(30, ge=0, le=100),
):
    """
    Real-time streaming of system audit and agent reasoning logs to Mission Control.
    """
    await websocket.accept()
    queue = await log_store.subscribe(maxsize=300)
    try:
        # Replay backlog
        if backlog > 0:
            past = await log_store.list(level=level, source=source, limit=backlog)
            await websocket.send_text(json.dumps({
                "type": "log_backlog",
                "count": len(past),
                "logs": past,
            }))

        # Stream live log entries as they are generated
        while True:
            entry = await queue.get()
            if source and entry.get("source") != source:
                continue
            await websocket.send_text(json.dumps({
                "type": "log",
                "entry": entry,
            }))
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning(f"Log stream error: {exc}")
    finally:
        await log_store.unsubscribe(queue)
