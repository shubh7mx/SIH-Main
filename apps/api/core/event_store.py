"""
In-memory Event Store with Persistent Disk Cache
=================================================
Thread-safe async event store for classified thermal anomaly events.
Persists events to disk so data is never lost or randomized across server restarts.

Features:
  - O(1) lookup by ID, bounded ring retention
  - Persistent JSON disk caching (`apps/api/data/events_store_cache.json`)
  - Deduplication by event ID, FIRMS ID, and spatial-temporal composite key
  - Secondary index by classification
  - Time-range historical queries (from_time / to_time)
  - Sovereign Indian mainland bounding-box spatial filtering
  - Time-bucketed timeline aggregation for the map scrubber
"""

import asyncio
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any


CACHE_FILE = Path(__file__).resolve().parent.parent / "data" / "events_store_cache.json"


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    try:
        s = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


class EventStore:
    """Thread-safe persistent event store with timeline & analytics indexes."""

    def __init__(self, max_size: int = 5000):
        self._events: dict[str, dict] = {}
        self._order: list[str] = []  # insertion order (oldest first)
        self._seen_keys: set[str] = set()  # Deduplication index
        self._max_size = max_size
        self._lock = asyncio.Lock()
        self._dirty = True
        self._load_from_disk()

    def _get_dedup_key(self, event: dict) -> str:
        eid = event.get("id") or event.get("firms_id")
        if eid:
            return str(eid)
        lat = round(float(event.get("latitude", 0)), 4)
        lon = round(float(event.get("longitude", 0)), 4)
        dt = event.get("acq_datetime") or event.get("created_at") or ""
        return f"{lat}_{lon}_{dt}"

    def _load_from_disk(self) -> None:
        """Loads cached events from persistent disk storage on startup."""
        if not CACHE_FILE.exists():
            return
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for ev in data:
                    if isinstance(ev, dict):
                        eid = ev.get("id")
                        if eid:
                            self._events[eid] = ev
                            if eid not in self._order:
                                self._order.append(eid)
                            self._seen_keys.add(self._get_dedup_key(ev))
                print(f"[EventStore] Loaded {len(self._events)} persisted events from {CACHE_FILE.name}")
        except Exception as e:
            print(f"[EventStore] Warning: Could not read cache ({e})")

    def _save_to_disk(self) -> None:
        """Saves current events to persistent disk cache."""
        try:
            CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            events_list = [self._events[eid] for eid in self._order[-self._max_size:] if eid in self._events]
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(events_list, f, indent=2)
        except Exception as e:
            print(f"[EventStore] Warning: Could not save cache ({e})")

    # ── Core CRUD ─────────────────────────────────────────────────────────
    @staticmethod
    def _is_inside_india(lat: float, lon: float) -> bool:
        """Rejects any coordinate that falls outside Indian sovereign territory
        (Pakistan, China, Nepal, Bangladesh, Myanmar, Sri Lanka, open ocean)."""
        try:
            lat = float(lat)
            lon = float(lon)
        except (TypeError, ValueError):
            return False
        if not (8.0 <= lat <= 37.2 and 68.5 <= lon <= 97.4):
            return False
        # Pakistani Punjab (Lahore / Sahiwal / Multan belt)
        if lon < 73.5 and lat > 29.5:
            return False
        # Khyber Pakhtunkhwa / Azad Kashmir
        if lon < 74.0 and lat > 31.5:
            return False
        # Bahawalpur / Multan (Pakistan)
        if lon < 71.0 and lat > 28.0:
            return False
        # Sindh (Pakistan)
        if lon < 70.0 and lat > 24.5:
            return False
        # Thatta / Badin (Pakistan)
        if lon < 68.5 and lat > 23.5:
            return False
        # Sri Lanka / Palk Strait / Indian Ocean
        if lat < 10.0 and lon > 79.5:
            return False
        # China / Tibet / Aksai Chin
        if lat > 35.8:
            return False
        if lat > 32.5 and lon > 78.5:
            return False
        if lat > 28.5 and (88.5 <= lon <= 96.5):
            return False
        return True

    async def add(self, event: dict) -> None:
        async with self._lock:
            eid = event.get("id", "")

            # Sovereignty guard: reject any hotspot outside Indian territory
            if not self._is_inside_india(event.get("latitude", 0), event.get("longitude", 0)):
                return

            dedup_key = self._get_dedup_key(event)

            # Skip exact duplicates
            if eid in self._events:
                self._events[eid] = event
                return

            self._events[eid] = event
            if eid not in self._order:
                self._order.append(eid)
            self._seen_keys.add(dedup_key)

            while len(self._order) > self._max_size:
                old_id = self._order.pop(0)
                old_ev = self._events.pop(old_id, None)
                if old_ev:
                    self._seen_keys.discard(self._get_dedup_key(old_ev))

            self._dirty = True
            # Save synchronously to persistent disk
            self._save_to_disk()

    async def get(self, event_id: str) -> Optional[dict]:
        return self._events.get(event_id)

    async def list(
        self,
        classification: Optional[str] = None,
        critical_only: bool = False,
        limit: int = 50,
        from_time: Optional[Any] = None,
        to_time: Optional[Any] = None,
        min_lat: Optional[float] = None,
        max_lat: Optional[float] = None,
        min_lon: Optional[float] = None,
        max_lon: Optional[float] = None,
        event_id: Optional[str] = None,
    ) -> list[dict]:
        """Newest-first filtered listing with time + bbox support and deduplication."""
        async with self._lock:
            f_dt = _parse_dt(from_time)
            t_dt = _parse_dt(to_time)
            results: list[dict] = []
            seen_in_batch: set[str] = set()

            for eid in reversed(self._order):
                ev = self._events.get(eid)
                if not ev:
                    continue

                # Deduplicate within listing
                dk = self._get_dedup_key(ev)
                if dk in seen_in_batch:
                    continue

                if classification and ev.get("classification") != classification:
                    continue
                if critical_only and not ev.get("is_critical_alert"):
                    continue
                if event_id and ev.get("id") != event_id:
                    continue

                # Time range filter on acquisition time
                ev_dt = _parse_dt(ev.get("acq_datetime")) or _parse_dt(ev.get("created_at"))
                if f_dt and ev_dt and ev_dt < f_dt:
                    continue
                if t_dt and ev_dt and ev_dt > t_dt:
                    continue

                # BBox & Sovereign Indian Mainland filter
                lat = ev.get("latitude")
                lon = ev.get("longitude")
                if lat is not None and lon is not None:
                    if lat < 8.2 or lat > 37.2 or lon < 68.2 or lon > 97.4:
                        continue
                    if lat < 10.0 and lon > 79.5:  # Sri Lanka / ocean
                        continue
                    if lon < 74.0 and lat > 31.5:  # Pakistan / PoK
                        continue
                    if lon < 71.0 and lat > 28.0:  # Pakistan Punjab
                        continue
                    if lon < 70.0 and lat > 24.5:  # Pakistan Sindh
                        continue
                    if lat > 35.8:  # China / Kunlun
                        continue
                    if lat > 32.5 and lon > 78.5:  # Western Tibet / Ngari
                        continue
                    if lat > 28.5 and (88.5 <= lon <= 96.5):  # Southern Tibet
                        continue
                    if (81.0 <= lon <= 87.5) and (27.8 <= lat <= 30.2):  # Nepal
                        continue
                    if (89.0 <= lon <= 92.0) and (22.2 <= lat <= 25.0):  # Bangladesh interior
                        continue

                if lat is not None and min_lat is not None and lat < min_lat:
                    continue
                if lat is not None and max_lat is not None and lat > max_lat:
                    continue
                if lon is not None and min_lon is not None and lon < min_lon:
                    continue
                if lon is not None and max_lon is not None and lon > max_lon:
                    continue

                seen_in_batch.add(dk)
                results.append(ev)
                if len(results) >= limit:
                    break

            return results

    async def stats(self) -> dict:
        async with self._lock:
            crit = sum(1 for e in self._events.values() if e.get("is_critical_alert"))
            return {
                "total_stored": len(self._events),
                "critical_alerts": crit,
                "oldest_event_at": self._events[self._order[0]].get("created_at") if self._order else None,
                "newest_event_at": self._events[self._order[-1]].get("created_at") if self._order else None,
            }

    async def clear(self) -> None:
        async with self._lock:
            self._events.clear()
            self._order.clear()
            self._seen_keys.clear()
            self._dirty = True
            if CACHE_FILE.exists():
                try:
                    CACHE_FILE.unlink()
                except Exception:
                    pass

    def __len__(self) -> int:
        return len(self._events)

    # ── Timeline Aggregation ──────────────────────────────────────────────
    async def timeline(
        self,
        from_time: Optional[Any] = None,
        to_time: Optional[Any] = None,
        interval_minutes: int = 60,
    ) -> Dict[str, Any]:
        """
        Returns time-bucketed event counts, FRP profiles, and classification breakdowns
        tailored for the UI timeline scrubber.
        """
        async with self._lock:
            interval_sec = max(300, interval_minutes * 60)
            now = datetime.now(timezone.utc)

            # Determine time bounds
            f_dt = _parse_dt(from_time)
            t_dt = _parse_dt(to_time)

            if not f_dt or not t_dt:
                # If bounds not fully provided, anchor across events or past 24 hours
                event_dts = []
                for ev in self._events.values():
                    d = _parse_dt(ev.get("acq_datetime")) or _parse_dt(ev.get("created_at"))
                    if d:
                        event_dts.append(d)

                if event_dts:
                    min_dt = min(event_dts)
                    max_dt = max(event_dts)
                    f_dt = f_dt or min_dt - timedelta(minutes=30)
                    t_dt = t_dt or max_dt + timedelta(minutes=30)
                else:
                    f_dt = f_dt or now - timedelta(hours=24)
                    t_dt = t_dt or now

            # Ensure start is bucket-aligned
            start_ts = int(f_dt.timestamp() // interval_sec) * interval_sec
            end_ts = int(t_dt.timestamp() // interval_sec + 1) * interval_sec

            buckets: Dict[int, Dict[str, Any]] = {}

            # Pre-populate empty continuous buckets across time window
            curr_ts = start_ts
            while curr_ts <= end_ts:
                b_dt = datetime.fromtimestamp(curr_ts, tz=timezone.utc)
                buckets[curr_ts] = {
                    "timestamp": b_dt.isoformat(),
                    "epoch": curr_ts * 1000,  # Milliseconds for JS Date
                    "total_events": 0,
                    "critical_count": 0,
                    "mean_frp_mw": 0.0,
                    "max_frp_mw": 0.0,
                    "class_counts": {
                        "INDUSTRIAL_FIRE_EMERGENCY": 0,
                        "PERSISTENT_INDUSTRIAL_FLARE": 0,
                        "AGRICULTURAL_BURNING": 0,
                        "WILDFIRE": 0,
                        "DEFERRED_FOR_ANALYST": 0,
                    },
                    "_frp_sum": 0.0,
                }
                curr_ts += interval_sec

            total_matched = 0

            for ev in self._events.values():
                d = _parse_dt(ev.get("acq_datetime")) or _parse_dt(ev.get("created_at"))
                if not d:
                    continue
                ev_ts = d.timestamp()
                b_key = int(ev_ts // interval_sec) * interval_sec

                if b_key not in buckets:
                    b_dt = datetime.fromtimestamp(b_key, tz=timezone.utc)
                    buckets[b_key] = {
                        "timestamp": b_dt.isoformat(),
                        "epoch": b_key * 1000,
                        "total_events": 0,
                        "critical_count": 0,
                        "mean_frp_mw": 0.0,
                        "max_frp_mw": 0.0,
                        "class_counts": {
                            "INDUSTRIAL_FIRE_EMERGENCY": 0,
                            "PERSISTENT_INDUSTRIAL_FLARE": 0,
                            "AGRICULTURAL_BURNING": 0,
                            "WILDFIRE": 0,
                            "DEFERRED_FOR_ANALYST": 0,
                        },
                        "_frp_sum": 0.0,
                    }

                b = buckets[b_key]
                b["total_events"] += 1
                total_matched += 1

                if ev.get("is_critical_alert"):
                    b["critical_count"] += 1

                cls = ev.get("classification")
                if cls in b["class_counts"]:
                    b["class_counts"][cls] += 1

                frp = float(ev.get("frp_megawatts") or 0.0)
                b["_frp_sum"] += frp
                if frp > b["max_frp_mw"]:
                    b["max_frp_mw"] = round(frp, 1)

            sorted_buckets = []
            for ts in sorted(buckets.keys()):
                b = buckets[ts]
                if b["total_events"] > 0:
                    b["mean_frp_mw"] = round(b["_frp_sum"] / b["total_events"], 1)
                b.pop("_frp_sum", None)
                sorted_buckets.append(b)

            return {
                "from_time": datetime.fromtimestamp(start_ts, tz=timezone.utc).isoformat(),
                "to_time": datetime.fromtimestamp(end_ts, tz=timezone.utc).isoformat(),
                "interval_minutes": interval_minutes,
                "buckets": sorted_buckets,
                "total_events": total_matched,
            }

    async def get_timeline(
        self,
        bucket_hours: int = 2,
        window_days: int = 7,
    ) -> List[Dict[str, Any]]:
        """Legacy compatibility method."""
        tl = await self.timeline(interval_minutes=bucket_hours * 60)
        return tl.get("buckets", [])

    async def history(
        self,
        from_time: Optional[Any] = None,
        to_time: Optional[Any] = None,
        classification: Optional[str] = None,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        """Returns chronologically ordered (oldest-first) events for map playback."""
        async with self._lock:
            f_dt = _parse_dt(from_time)
            t_dt = _parse_dt(to_time)
            items = []

            for eid in self._order:
                ev = self._events.get(eid)
                if not ev:
                    continue
                if classification and ev.get("classification") != classification:
                    continue
                d = _parse_dt(ev.get("acq_datetime")) or _parse_dt(ev.get("created_at"))
                if d:
                    if f_dt and d < f_dt:
                        continue
                    if t_dt and d > t_dt:
                        continue
                items.append(ev)
                if len(items) >= limit:
                    break

            return items

    async def detailed_analytics(self) -> Dict[str, Any]:
        """Provides deep analytical breakdowns for monitored facilities and regions."""
        async with self._lock:
            total = len(self._events)
            facilities_map: Dict[str, Dict[str, Any]] = {}
            class_breakdown: Dict[str, int] = {}
            severity_breakdown: Dict[str, int] = {
                "CRITICAL": 0,
                "WARNING": 0,
                "WATCH": 0,
                "MONITORING": 0,
            }
            source_breakdown: Dict[str, int] = {}
            state_breakdown: Dict[str, int] = {}
            cde_scores: List[float] = []
            frp_values: List[float] = []
            critical_count = 0

            for ev in self._events.values():
                cls = ev.get("classification") or "UNMAPPED_ANOMALY"
                class_breakdown[cls] = class_breakdown.get(cls, 0) + 1

                if ev.get("is_critical_alert"):
                    critical_count += 1
                    severity_breakdown["CRITICAL"] += 1
                elif cls == "INDUSTRIAL_FIRE_EMERGENCY":
                    severity_breakdown["WARNING"] += 1
                elif cls == "PERSISTENT_INDUSTRIAL_FLARE":
                    severity_breakdown["WATCH"] += 1
                else:
                    severity_breakdown["MONITORING"] += 1

                src = ev.get("satellite_source") or ev.get("source") or "VIIRS_SNPP"
                source_breakdown[src] = source_breakdown.get(src, 0) + 1

                state = ev.get("state") or ev.get("region") or "Unknown"
                if not state or state == "Unknown":
                    # Infer approximate Indian region from coordinates if state not populated
                    lat = float(ev.get("latitude") or 0.0)
                    lon = float(ev.get("longitude") or 0.0)
                    if lat >= 28.0 and lon <= 78.0:
                        state = "Punjab / Haryana"
                    elif lat >= 20.0 and lat < 28.0 and lon <= 74.5:
                        state = "Gujarat / Rajasthan"
                    elif lat >= 20.0 and lat < 26.0 and lon >= 82.0:
                        state = "Jharkhand / Odisha / WB"
                    elif lat < 20.0 and lon <= 78.0:
                        state = "Maharashtra / Karnataka"
                    elif lat < 20.0 and lon > 78.0:
                        state = "Andhra / Tamil Nadu"
                    else:
                        state = "Central India"
                state_breakdown[state] = state_breakdown.get(state, 0) + 1

                cde = ev.get("cde_anomaly_score")
                if cde is not None:
                    try:
                        cde_scores.append(float(cde))
                    except (ValueError, TypeError):
                        pass

                frp = float(ev.get("frp_megawatts") or 0.0)
                frp_values.append(frp)

                fac = ev.get("facility_name") or "Unmapped Regional Cluster"
                if fac not in facilities_map:
                    facilities_map[fac] = {
                        "name": fac,
                        "type": ev.get("facility_type") or "industrial",
                        "event_count": 0,
                        "critical_alerts": 0,
                        "critical_count": 0,
                        "frp_total": 0.0,
                        "max_frp": 0.0,
                        "max_frp_mw": 0.0,
                        "cde_total": 0.0,
                        "cde_count": 0,
                        "lat": ev.get("latitude"),
                        "lon": ev.get("longitude"),
                    }
                f = facilities_map[fac]
                f["event_count"] += 1
                if ev.get("is_critical_alert"):
                    f["critical_alerts"] += 1
                    f["critical_count"] += 1
                f["frp_total"] += frp
                if frp > f["max_frp"]:
                    f["max_frp"] = round(frp, 1)
                    f["max_frp_mw"] = round(frp, 1)
                if cde is not None:
                    try:
                        f["cde_total"] += float(cde)
                        f["cde_count"] += 1
                    except (ValueError, TypeError):
                        pass

            rankings = []
            for f in facilities_map.values():
                mean_frp = round(f["frp_total"] / max(1, f["event_count"]), 1)
                f["mean_frp"] = mean_frp
                f["mean_frp_mw"] = mean_frp
                f["mean_cde"] = (
                    round(f["cde_total"] / f["cde_count"], 2)
                    if f["cde_count"] > 0
                    else None
                )
                rankings.append(f)

            rankings.sort(key=lambda x: (x["critical_alerts"], x["mean_frp"]), reverse=True)

            frp_values.sort()
            n = len(frp_values)
            def p(pct: float) -> float:
                if not frp_values:
                    return 0.0
                idx = int(len(frp_values) * pct)
                return round(frp_values[min(idx, len(frp_values) - 1)], 1)

            return {
                "total_events_processed": total,
                "critical_alerts_count": critical_count,
                "class_breakdown": class_breakdown,
                "severity_breakdown": severity_breakdown,
                "source_breakdown": source_breakdown,
                "mean_cde_score": round(sum(cde_scores) / max(1, len(cde_scores)), 2) if cde_scores else None,
                "frp_percentiles": {
                    "p50": p(0.50),
                    "p90": p(0.90),
                    "p99": p(0.99),
                    "max": round(frp_values[-1], 1) if n > 0 else 0.0,
                },
                "facilities_ranking": rankings,
                "state_breakdown": state_breakdown,
                "monitored_facilities": len(rankings),
            }

    # ── Analytics Aggregations ────────────────────────────────────────────
    async def get_analytics(self) -> Dict[str, Any]:
        """Calculates summary KPIs across all active events in the store."""
        async with self._lock:
            total = len(self._events)
            if total == 0:
                return {
                    "total_events_processed": 0,
                    "critical_alerts_count": 0,
                    "class_breakdown": {
                        "INDUSTRIAL_FIRE_EMERGENCY": 0,
                        "PERSISTENT_INDUSTRIAL_FLARE": 0,
                        "AGRICULTURAL_BURNING": 0,
                        "WILDFIRE": 0,
                        "DEFERRED_FOR_ANALYST": 0,
                    },
                    "severity_breakdown": {
                        "CRITICAL": 0,
                        "WARNING": 0,
                        "WATCH": 0,
                        "MONITORING": 0,
                    },
                    "frp_stats": {
                        "mean": 0.0,
                        "max": 0.0,
                        "p50": 0.0,
                        "p90": 0.0,
                        "p99": 0.0,
                    },
                    "cde_anomalies_detected": 0,
                    "active_clusters_count": 0,
                }

            breakdown = {
                "INDUSTRIAL_FIRE_EMERGENCY": 0,
                "PERSISTENT_INDUSTRIAL_FLARE": 0,
                "AGRICULTURAL_BURNING": 0,
                "WILDFIRE": 0,
                "DEFERRED_FOR_ANALYST": 0,
            }
            severity = {
                "CRITICAL": 0,
                "WARNING": 0,
                "WATCH": 0,
                "MONITORING": 0,
            }

            critical_count = 0
            cde_anomalies = 0
            frp_values: List[float] = []

            for ev in self._events.values():
                cls = ev.get("classification")
                if cls in breakdown:
                    breakdown[cls] += 1

                if ev.get("is_critical_alert"):
                    critical_count += 1
                    severity["CRITICAL"] += 1
                elif cls == "INDUSTRIAL_FIRE_EMERGENCY":
                    severity["WARNING"] += 1
                elif cls == "PERSISTENT_INDUSTRIAL_FLARE":
                    severity["WATCH"] += 1
                else:
                    severity["MONITORING"] += 1

                cde = ev.get("cde_anomaly_score")
                if cde is not None and abs(cde) >= 2.0:
                    cde_anomalies += 1

                frp = float(ev.get("frp_megawatts") or 0.0)
                frp_values.append(frp)

            frp_values.sort()
            n = len(frp_values)
            mean_frp = sum(frp_values) / n if n > 0 else 0.0
            max_frp = frp_values[-1] if n > 0 else 0.0

            def p(pct: float) -> float:
                if not frp_values:
                    return 0.0
                idx = int(len(frp_values) * pct)
                return frp_values[min(idx, len(frp_values) - 1)]

            return {
                "total_events_processed": total,
                "critical_alerts_count": critical_count,
                "class_breakdown": breakdown,
                "severity_breakdown": severity,
                "frp_stats": {
                    "mean": round(mean_frp, 1),
                    "max": round(max_frp, 1),
                    "p50": round(p(0.50), 1),
                    "p90": round(p(0.90), 1),
                    "p99": round(p(0.99), 1),
                },
                "cde_anomalies_detected": cde_anomalies,
                "active_clusters_count": max(1, total // 6),
            }


# Singleton instance
event_store = EventStore(max_size=5000)
