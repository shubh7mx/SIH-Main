"""
System Watermark, Downtime Recovery & Backfill State Manager
============================================================
Tracks system lifecycle, last processed timestamps, downtime duration,
backfill history, and adaptive polling rates to minimize compute/network
costs while ensuring complete data continuity across server restarts.
"""

import json
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, Optional

STATE_FILE = Path(__file__).resolve().parents[3] / "apps" / "api" / "data" / "system_state.json"


class RecoveryManager:
    """
    Manages persistent state across server restarts, calculates downtime gap,
    coordinates multi-day backfills, and computes adaptive polling intervals.
    """

    def __init__(self):
        self._state: Dict[str, Any] = {
            "last_active_at": None,
            "last_firms_acq_at": None,
            "total_restarts": 0,
            "last_backfill_at": None,
            "last_backfill_events_count": 0,
            "downtime_seconds": 0,
            "adaptive_mode": "ACTIVE",
            "backfill_in_progress": False,
        }
        self._load_state()

    def _load_state(self) -> None:
        if STATE_FILE.exists():
            try:
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        self._state.update(data)
            except Exception as exc:
                print(f"[RecoveryManager] Warning reading state: {exc}")

    def save_state(self) -> None:
        try:
            STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(self._state, f, indent=2)
        except Exception as exc:
            print(f"[RecoveryManager] Warning saving state: {exc}")

    def on_startup(self) -> Dict[str, Any]:
        """
        Calculates downtime duration on boot and determines if a backfill is needed.
        """
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        last_active = self._state.get("last_active_at")
        
        downtime_sec = 0
        backfill_needed = False
        day_range_to_backfill = 1

        if last_active:
            try:
                last_dt = datetime.fromisoformat(last_active)
                downtime_sec = max(0, int((now - last_dt).total_seconds()))
                self._state["downtime_seconds"] = downtime_sec
                
                # If server was down for more than 15 minutes, trigger backfill
                if downtime_sec > 900:
                    backfill_needed = True
                    # Estimate day range needed (up to 7 days max for FIRMS NRT)
                    days_missed = math_ceil_days = max(1, min(7, int(downtime_sec // 86400) + 1))
                    day_range_to_backfill = days_missed
            except Exception:
                pass

        self._state["total_restarts"] = int(self._state.get("total_restarts", 0)) + 1
        self._state["last_active_at"] = now_iso
        self.save_state()

        return {
            "downtime_seconds": downtime_sec,
            "downtime_human": f"{downtime_sec // 3600}h {(downtime_sec % 3600) // 60}m {downtime_sec % 60}s",
            "backfill_needed": backfill_needed,
            "day_range": day_range_to_backfill,
            "total_restarts": self._state["total_restarts"],
        }

    def record_activity(self, latest_event_acq: Optional[str] = None) -> None:
        """Records healthy heartbeat and newest ingested FIRMS event timestamp."""
        now_iso = datetime.now(timezone.utc).isoformat()
        self._state["last_active_at"] = now_iso
        if latest_event_acq:
            self._state["last_firms_acq_at"] = latest_event_acq
        self.save_state()

    def record_backfill_complete(self, events_count: int) -> None:
        """Records successful backfill run."""
        self._state["last_backfill_at"] = datetime.now(timezone.utc).isoformat()
        self._state["last_backfill_events_count"] = events_count
        self._state["backfill_in_progress"] = False
        self.save_state()

    def get_adaptive_poll_interval(self) -> int:
        """
        Computes cost-effective adaptive polling interval:
        - During Indian Day Peak (04:30 - 14:30 UTC / 10:00 - 20:00 IST): 300s (5 min)
        - During Off-Peak Night (14:30 - 04:30 UTC): 900s (15 min) - saves 60% EC2 network & CPU
        """
        utc_hour = datetime.now(timezone.utc).hour
        # Peak satellite overpasses in India are Terra/Aqua/SNPP (10:30, 13:30 IST -> 05:00 - 10:00 UTC)
        if 4 <= utc_hour <= 15:
            self._state["adaptive_mode"] = "PEAK_DAY (High-Frequency 5m)"
            return 300
        else:
            self._state["adaptive_mode"] = "OFF_PEAK_NIGHT (Economy 15m)"
            return 900

    def get_status(self) -> Dict[str, Any]:
        return dict(self._state)


recovery_manager = RecoveryManager()
