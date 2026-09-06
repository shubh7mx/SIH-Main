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
import os
import time
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

    # Auto-broadcast dedup: suppress identical facility Telegram blasts
    # within this window (seconds) so reseeding / demo injections never spam.
    TELEGRAM_DEDUP_WINDOW_S = 15 * 60  # 15 minutes per facility

    # In-memory dedup cache: {facility_key: last_sent_timestamp}
    _telegram_dedup_cache: dict[str, float] = {}

    @classmethod
    def _telegram_dedup(cls, facility_key: str) -> bool:
        """Returns True if this facility alert should be SUPPRESSED (recently sent)."""
        now = time.time()
        last = cls._telegram_dedup_cache.get(facility_key, 0)
        if now - last < cls.TELEGRAM_DEDUP_WINDOW_S:
            return True  # suppress duplicate
        cls._telegram_dedup_cache[facility_key] = now
        # Prune stale entries to bound memory
        if len(cls._telegram_dedup_cache) > 500:
            cls._telegram_dedup_cache = {
                k: v for k, v in cls._telegram_dedup_cache.items()
                if now - v < cls.TELEGRAM_DEDUP_WINDOW_S
            }
        return False

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
            "analyst_queue": state.human_review_required,
            "uncertainty_reasons": state.uncertainty_reasons,
            "results": dispatched,
        }

    def _send_channel(self, state: SwarmState, severity: str, channel: str) -> dict:
        """
        Sends alert to a specific channel.
        In production, replaces print stubs with real API calls.
        """
        msg = self._format_message(state, severity)

        if channel == "telegram":
            return self._telegram_send(state, severity)

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

    def _telegram_send(self, state: SwarmState, severity: str) -> dict:
        """
        Sends a single, richly-formatted responder-ready alert card to the
        NTRO Telegram emergency channel. Deduplicates repeated facility alerts
        within a 15-minute window so batch reseed / demo injections never spam.
        """
        import os
        import httpx

        # Auto-broadcast only for genuinely CRITICAL incidents; WARNING/WATCH
        # are dashboard-only (analysts see them in the UI; channel stays clean).
        if severity != "CRITICAL":
            return {"channel": "telegram", "status": "suppressed", "note": f"{severity} alerts are dashboard-only (no Telegram spam)"}

        facility_key = f"{state.spatial.facility_name or 'unknown'}@{state.latitude:.3f},{state.longitude:.3f}"
        if self._telegram_dedup(facility_key):
            return {"channel": "telegram", "status": "deduplicated", "note": "suppressed: facility alerted within dedup window"}

        token = os.environ.get("TELEGRAM_BOT_TOKEN")
        chat_id = os.environ.get("TELEGRAM_CHAT_ID")
        if not (token and chat_id and token != "mock"):
            print(f"[Telegram] {self._format_message(state, severity)[:120]}...")
            return {"channel": "telegram", "status": "sent", "note": "simulated (offline / no credentials)"}

        card = self._build_rich_card(state, severity)
        try:
            resp = httpx.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": card, "parse_mode": "Markdown", "disable_web_page_preview": False},
                timeout=5.0,
            )
            if resp.status_code == 200:
                return {"channel": "telegram", "status": "sent", "note": "live Telegram alert card delivered"}
            print(f"[Telegram] send failed: {resp.status_code} {resp.text[:300]}")
            return {"channel": "telegram", "status": "error", "note": f"HTTP {resp.status_code}"}
        except Exception as e:
            print(f"[Telegram error] {e}")
            return {"channel": "telegram", "status": "error", "note": str(e)}

    def _esc_md(self, value) -> str:
        """Escape Telegram Markdown-reserved characters in dynamic strings."""
        s = str(value if value is not None else "")
        for ch in ["*", "_", "`", "[", "]"]:
            s = s.replace(ch, "")
        return s

    def _build_rich_card(self, state: SwarmState, severity: str) -> str:
        """
        Composes a single, beautifully laid-out, responder-focused emergency card:
        header, satellite imagery link, Google Maps pinpoint, facility registry,
        radiometric telemetry, CDE deviation, plume/hazard, and actionable SOP.
        """
        SEV_ICON = {"CRITICAL": "🚨", "WARNING": "⚠️", "WATCH": "👁️", "INFO": "ℹ️"}
        icon = SEV_ICON.get(severity, "🚨")
        lat = state.latitude
        lon = state.longitude
        maps_link = f"https://www.google.com/maps?q={lat:.5f},{lon:.5f}&z=14"
        satellite_link = f"https://www.google.com/maps/@{lat:.5f},{lon:.5f},2500m/data=!3m1!1e3"
        wind_kmh = state.dispersion.wind_speed_ms * 3.6
        pop5 = state.dispersion.hazard_5km_pop
        pop10 = state.dispersion.hazard_10km_pop
        # Pretty satellite name (VIIRS_SNPP_NRT → VIIRS S-NPP)
        sat = (state.satellite_source or "VIIRS").replace("_NRT", "").replace("_", " ")
        if "SNPP" in sat: sat = sat.replace("SNPP", "S-NPP")
        if "NOAA20" in sat: sat = sat.replace("NOAA20", "NOAA-20")
        pass_time = "Night" if (state.day_night or "D") == "N" else "Day"
        action = (state.dispersion.recommended_action or "").strip() or "Initiate immediate site assessment and Level-1 industrial-fire SOP; coordinate with district authorities."

        # Confidence: prefer fused model confidence; fall back to FIRMS detection
        # confidence so the card never ships a misleading 0%.
        conf_pct = state.final_confidence * 100
        if conf_pct <= 0 and state.confidence_pct > 0:
            conf_pct = float(state.confidence_pct)
        cde_disp = f"+{state.cde_score:.1f}σ" if state.cde_score else "N/A (normal ops)"

        lines = [
            f"{icon} *{severity.upper()} · SIH26162 THERMAL INTELLIGENCE ALERT*",
            f"*Classification:* {str(state.final_classification).replace('_', ' ').title()}",
            f"*Confidence:* {conf_pct:.0f}%  ·  *CDE Deviation:* {cde_disp}",
            "",
            f"🏭 *Facility:* {self._esc_md(state.spatial.facility_name or 'Unknown Facility')}",
            f"   ├─ *Type:* {self._esc_md(state.spatial.facility_type or 'Industrial')}",
            f"   └─ *Operator:* {self._esc_md(state.spatial.operator or 'Unknown')}",
            f"📍 *Coordinates:* {lat:.4f}°N, {lon:.4f}°E",
            f"🛰️ *Source:* {sat}  ·  {pass_time} Pass",
            "",
            "*── RADIOMETRIC TELEMETRY ──*",
            f"🔥 *FRP:* {state.frp_mw:.0f} MW",
            f"🌡️ *Brightness Temp:* {state.brightness_temp_k:.0f} K ({state.brightness_temp_k - 273.15:.0f}°C)",
            "",
        ]

        if state.dispersion.wind_speed_ms > 0:
            lines += [
                "*── PLUME & HAZARD ──*",
                f"💨 *Wind:* {state.dispersion.wind_direction_deg:.0f}° @ {wind_kmh:.1f} km/h",
                f"🛡️ *5km Zone:* ~{pop5:,} residents  ·  *10km Advisory:* ~{pop10:,}",
                "",
            ]

        lines += [
            "*── RESPONSE LINKS ──*",
            f"🗺️ [Open in Google Maps]({maps_link})",
            f"🛰️ [View Live Satellite Imagery]({satellite_link})",
            "",
            f"✅ *Action:* {self._esc_md(action)}",
            f"🆔 *Incident ID:* `{self._esc_md(state.hotspot_id)}`",
        ]
        return "\n".join(lines)

    def _format_message(self, state: SwarmState, severity: str) -> str:
        facility = state.spatial.facility_name or "Unknown Facility"
        location = f"{state.latitude:.4f}N, {state.longitude:.4f}E"
        frp = state.frp_mw
        cde = state.cde_score
        reasons_line = ""
        if state.uncertainty_reasons:
            reasons_line = f"\nUncertainty: {'; '.join(state.uncertainty_reasons[:2])}"
        return (
            f"[SIH26162] {severity} ALERT\n"
            f"Facility: {facility}\n"
            f"Location: {location}\n"
            f"FRP: {frp:.0f} MW | BT: {state.brightness_temp_k:.0f} K\n"
            f"CDE Score: +{cde:.1f}σ deviation{reasons_line}\n"
            f"Action: {state.dispersion.recommended_action[:80]}"
        )
