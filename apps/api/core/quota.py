# -*- coding: utf-8 -*-
"""Token and daily request quota tracker for OpenRouter Free Tier (1,000 req/24h cap)."""
import time
import json
import logging
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger("sih26162.quota")
QUOTA_FILE = Path(__file__).resolve().parent.parent / "data" / "openrouter_usage_tracker.json"
DAILY_LIMIT = 1000

def _load_tracker() -> Dict[str, Any]:
    if QUOTA_FILE.exists():
        try:
            with open(QUOTA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"window_start": time.time(), "requests_made": 0, "total_all_time": 0}

def _save_tracker(data: Dict[str, Any]):
    try:
        QUOTA_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(QUOTA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not save quota tracker: {e}")

def record_openrouter_call() -> Dict[str, Any]:
    """Records 1 outbound OpenRouter API call in a rolling 24-hour window."""
    now = time.time()
    t = _load_tracker()
    
    # Reset 24-hour window if > 86400s
    if (now - t.get("window_start", 0)) > 86400:
        t["window_start"] = now
        t["requests_made"] = 0

    t["requests_made"] = t.get("requests_made", 0) + 1
    t["total_all_time"] = t.get("total_all_time", 0) + 1
    _save_tracker(t)
    return {
        "requests_made_today": t["requests_made"],
        "daily_limit": DAILY_LIMIT,
        "remaining_today": max(0, DAILY_LIMIT - t["requests_made"]),
        "window_resets_in_hours": round((86400 - (now - t["window_start"])) / 3600, 1)
    }

def get_quota_status() -> Dict[str, Any]:
    now = time.time()
    t = _load_tracker()
    if (now - t.get("window_start", 0)) > 86400:
        t["window_start"] = now
        t["requests_made"] = 0
    return {
        "requests_made_today": t.get("requests_made", 0),
        "daily_limit": DAILY_LIMIT,
        "remaining_today": max(0, DAILY_LIMIT - t.get("requests_made", 0)),
        "percent_used": round((t.get("requests_made", 0) / DAILY_LIMIT) * 100, 2),
        "window_resets_in_hours": round((86400 - (now - t.get("window_start", now))) / 3600, 1)
    }
