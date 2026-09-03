"""
Agent 6 — ALERT DISPATCHER
===========================
4-tier alert gating and multi-channel alert dispatch.

Tier 1: GEOSPATIAL  — Within OSM industrial polygon?
Tier 2: FINGERPRINT — CDE_score > 0.9 (5σ+ deviation)
Tier 3: MULTI-SENSOR — Sentinel-2/SAR cross-validation available?
Tier 4: HUMAN HITL   — Duty Officer confirms/rejects

Channels: Telegram, SMS (Twilio), Webhook, WebSocket (FastAPI push)
"""

from __future__ import annotations
import json
from typing import Optional
from packages.agents.src.state import SwarmState, AlertSeverity


class AlertDispatcher:
    """
    Implements the 4-tier alert gating and routes classified events to
    the appropriate notification channels.

    In production, this connects to:
      - Telegram Bot API (python-telegram-bot 21.x)
      - Twilio SMS API
      - FastAPI WebSocket broadcast
      - NTRO NDMA webhook endpoint
    """

    # ── Alert gate thresholds ────────────────────────────────────────────────
    CRITICAL_CONFIDENCE = 0.85
    WARNING_CONFIDENCE = 0.70
    WATCH_CONFIDENCE = 0.55

    # CDE severity → alert severity mapping
    SEVERITY_MAP = {
        "CRITICAL": "CRITICAL",
        "WARNING": "WARNING",
        "WATCH": "WATCH",
        "NORMAL": "INFO",
    }

    def gate(self, state: SwarmState) -> AlertSeverity:
        """
        4-tier alert gating.
        Returns the appropriate alert severity tier.
        """
        cde = state.cde_score
        conf = state.final_confidence
        spatial_facility = state.spatial.facility_id is not None

        # ── Tier 1: Geospatial filter ─────────────────────────────────
        if not spatial_facility:
            return "INFO"  # Agricultural / wildfire track

        # ── Tier 2: CDE Fingerprint score ────────────────────────────
        if cde >= 4.0 or (cde >= 2.5 and conf >= self.CRITICAL_CONFIDENCE):
            return "CRITICAL"

        if cde >= 2.0 or conf >= self.WARNING_CONFIDENCE:
            return "WARNING"

        # ── Tier 3: Multi-sensor confirmation ──────────────────────────
        if state.vision.cloud_free and state.vision.score >= 0.7:
            # Vision agent confirms industrial fire
            if conf >= self.CRITICAL_CONFIDENCE:
                return "CRITICAL"
            elif conf >= self.WARNING_CONFIDENCE:
                return "WARNING"

        # ── Tier 4: Human-in-the-loop ───────────────────────────────
        if state.human_review_required:
            return "WATCH"

        return "INFO"

    def dispatch(self, state: SwarmState, severity: AlertSeverity) -> dict:
        """
        Dispatches the alert to all configured channels.
        Returns a summary of dispatched channels.
        """
        if severity == "INFO":
            channels = []
        elif severity == "WATCH":
            channels = ["webhook", "websocket"]
        elif severity == "WARNING":
            channels = ["webhook", "websocket", "telegram"]
        else:  # CRITICAL
            channels = ["webhook", "websocket", "telegram", "sms"]

        dispatched = []
        for channel in channels:
            result = self._send_channel(state, severity, channel)
            dispatched.append(result)

        return {
            "severity": severity,
            "channels_requested": channels,
            "channels_dispatched": [d["channel"] for d in dispatched if d["status"] == "sent"],
            "results": dispatched,
        }

    def _send_channel(self, state: SwarmState, severity: str, channel: str) -> dict:
        """
        Sends alert to a specific channel.
        In production, replaces print stubs with real API calls.
        """
        msg = self._format_message(state, severity)

        if channel == "telegram":
            # Production: await bot.send_message(chat_id=NTRO_CHANNEL_ID, text=msg)
            print(f"[Telegram] {msg[:120]}...")
            return {"channel": "telegram", "status": "sent", "note": "mock (requires BOT_TOKEN)"}

        elif channel == "sms":
            # Production: twilio.messages.create(to=+91..., body=msg)
            print(f"[SMS] Alert #{state.hotspot_id}: {severity}")
            return {"channel": "sms", "status": "sent", "note": "mock (requires TWILIO_SID)"}

        elif channel == "webhook":
            # Production: httpx.post(NDMA_WEBHOOK_URL, json=state.to_classification_dict())
            print(f"[Webhook] POST to NDMA: {state.hotspot_id} ({severity})")
            return {"channel": "webhook", "status": "sent", "note": "mock (requires WEBHOOK_URL)"}

        elif channel == "websocket":
            # Production: via FastAPI WebSocket broadcast (handled by apps/api)
            return {"channel": "websocket", "status": "pending", "note": "routed via FastAPI WS"}

        return {"channel": channel, "status": "skipped"}

    def _format_message(self, state: SwarmState, severity: str) -> str:
        facility = state.spatial.facility_name or "Unknown Facility"
        location = f"{state.latitude:.4f}N, {state.longitude:.4f}E"
        frp = state.frp_mw
        cde = state.cde_score
        return (
            f"[SIH26162] {severity} ALERT\n"
            f"Facility: {facility}\n"
            f"Location: {location}\n"
            f"FRP: {frp:.0f} MW | BT: {state.brightness_temp_k:.0f} K\n"
            f"CDE Score: +{cde:.1f}σ deviation\n"
            f"Action: {state.dispersion.recommended_action[:80]}"
        )
