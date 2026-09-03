"""
Tactical Copilot & Incident Brief Routes
=========================================
Exposes neutral AI intelligence capabilities (Incident Briefs, Copilot Q&A).
All provider details are strictly encapsulated in core/intelligence.py.
"""

from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from apps.api.core.event_store import event_store
from apps.api.core.intelligence import (
    generate_incident_brief,
    copilot_answer,
    intelligence_status,
)

router = APIRouter(prefix="/intelligence", tags=["Tactical Intelligence"])


class BriefRequest(BaseModel):
    event_id: str


class CopilotQuestion(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)


@router.get("/status")
async def get_status() -> Dict[str, Any]:
    """Returns tactical intelligence engine operational status."""
    return intelligence_status()


@router.post("/brief")
async def make_brief(req: BriefRequest) -> Dict[str, Any]:
    """Generates an analyst tactical incident brief for an event."""
    event = await event_store.get(req.event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {req.event_id} not found")
    brief = await generate_incident_brief(event)
    return {
        "event_id": req.event_id,
        "classification": event.get("classification"),
        "confidence_score": event.get("confidence_score"),
        "facility_name": event.get("facility_name"),
        "brief": brief["text"],
        "mode": brief["mode"],
        "generated_at": brief["generated_at"],
        "latency_ms": brief["latency_ms"],
    }


@router.post("/copilot")
async def ask_copilot(req: CopilotQuestion) -> Dict[str, Any]:
    """
    Answers duty-officer queries grounded in live console events and analytics.
    """
    events = await event_store.list(limit=100)
    analytics = await event_store.stats()
    result = await copilot_answer(req.question, events, analytics)
    return {
        "question": req.question,
        "answer": result["text"],
        "mode": result["mode"],
        "generated_at": result["generated_at"],
        "latency_ms": result["latency_ms"],
        "events_considered": result["events_considered"],
    }
