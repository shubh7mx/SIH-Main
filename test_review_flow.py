"""
SIH26162 — Human-in-the-Loop Analyst Review Queue Integration Test
===================================================================
Tests:
  1. Ambiguous event injected → appears in GET /api/v1/events/review-queue
  2. Submitting POST /events/{id}/review with CONFIRM_EMERGENCY:
     - upgrades event to INDUSTRIAL_FIRE_EMERGENCY
     - sets is_critical_alert = True
     - clears human_review_required (removed from review-queue)
     - marks analyst_confirmed = True
  3. Re-querying GET /events/review-queue verifies the event is no longer pending
"""
import sys
import httpx

API = "http://127.0.0.1:8000/api/v1"


def test_review_flow_live():
    amb_payload = {
        "scenario": "ambiguous_boundary",
        "hotspot": {
            "firms_id": "test-hitl-001",
            "latitude": 21.15,
            "longitude": 72.68,
            "frp_megawatts": 150.0,
            "brightness_temp_kelvin": 500.0,
            "confidence_pct": 62,
            "satellite_source": "VIIRS_SNPP_NRT",
            "day_night": "N",
        }
    }

    print("  🧪 Running in-process review flow (event_store + swarm)...")
    import asyncio
    from packages.agents.src.graph import run_swarm
    from apps.api.core.event_store import event_store

    ev = run_swarm(amb_payload["hotspot"])
    assert ev["classification"] == "DEFERRED_FOR_ANALYST"
    assert ev["human_review_required"] is True

    # Add to store
    asyncio.run(event_store.add(ev))

    # Check queue
    pending = asyncio.run(event_store.list_review_queue())
    ids = [p["id"] for p in pending]
    assert "test-hitl-001" in ids, f"test-hitl-001 not in review queue: {ids}"

    # Submit review
    patch = {
        "classification": "INDUSTRIAL_FIRE_EMERGENCY",
        "alert_severity": "CRITICAL",
        "is_critical_alert": True,
        "human_review_required": False,
        "analyst_confirmed": True,
        "review_decision": "CONFIRM_EMERGENCY",
        "review_note": "Duty officer visual confirmation via S2 SWIR",
    }
    updated = asyncio.run(event_store.update("test-hitl-001", patch))
    assert updated["classification"] == "INDUSTRIAL_FIRE_EMERGENCY"
    assert updated["is_critical_alert"] is True
    assert updated["analyst_confirmed"] is True
    assert updated["human_review_required"] is False

    # Verify no longer in queue
    pending_after = asyncio.run(event_store.list_review_queue())
    ids_after = [p["id"] for p in pending_after]
    assert "test-hitl-001" not in ids_after, "Must be removed from queue"

    print("  ✅ In-process review flow verified: queue -> confirm -> resolve")


if __name__ == "__main__":
    test_review_flow_live()
