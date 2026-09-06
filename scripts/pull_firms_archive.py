"""
SIH26162 — Pull real historical VIIRS archive data from NASA FIRMS
====================================================================
Queries the FIRMS active-fire archive over India, labels each hotspot
using the verified facility registry + land-cover rules, and writes
a new ground-truth CSV for ensemble training.

Labels:
  0  INDUSTRIAL_FIRE_EMERGENCY  — inside facility + extreme FRP/BT
  1  PERSISTENT_INDUSTRIAL_FLARE — inside facility, normal ops
  2  AGRICULTURAL_BURNING       — cropland regions
  3  WILDFIRE                   — forest regions
  4  OTHER_RURAL                — unclassified rural background (mapped to 2)
"""
import csv
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from packages.agents.src.spatial_agent import _FACILITY_REGISTRY, haversine_km

KEY = "bc98945b697e6c9a0e9a2ab4cec9ebe9"

# Regional bboxes chosen to cover different fire regimes across India:
#   industrial corridors, cropland belts, and forest/wildfire zones.
REGIONS = [
    # name,        lat1, lon1, lat2, lon2, dominant regime
    ("gujarat_industrial", 20.0, 68.5, 24.5, 72.5, "industrial"),
    ("odisha_jharkhand_industrial", 20.0, 84.0, 24.5, 87.5, "industrial"),
    ("punjab_haryana_crop", 28.5, 73.5, 32.5, 77.5, "cropland"),
    ("up_crop", 24.5, 78.0, 29.0, 84.5, "cropland"),
    ("maharashtra_crop", 18.0, 73.0, 21.5, 77.0, "cropland"),
    ("uttrakhand_forest", 28.5, 77.5, 31.5, 80.5, "forest"),
    ("mp_forest", 21.0, 77.0, 24.0, 82.0, "forest"),
    ("northeast_forest", 24.0, 92.0, 28.0, 96.0, "forest"),
]

# FIRMS archive API (active fire) — last N days per request
URL = "https://firms.modaps.eosdis.nasa.gov/api/area/v2/csv/{source}/{bbox}/{days}/{key}"

FACILITIES = _FACILITY_REGISTRY


def nearest_facility(lat: float, lon: float):
    best, best_km = None, 1e9
    for f in FACILITIES:
        d = haversine_km(lat, lon, f["lat"], f["lon"])
        if d < best_km:
            best, best_km = f, d
    return best, best_km


def label_hotspot(lat, lon, frp, bt, region_regime):
    """Rule-based labeling using facility registry + regional regime."""
    fac, dist_km = nearest_facility(lat, lon)

    if dist_km <= 2.5:
        # Inside a verified industrial facility:
        # extreme radiometrics → emergency; stable → persistent flare
        if frp >= 600 or (frp >= 300 and bt >= 900):
            return 0, fac["name"], dist_km
        return 1, fac["name"], dist_km

    if region_regime == "industrial" and dist_km <= 8.0:
        # Near (but not inside) facility — persistent plume/flare halo
        return 1, fac["name"], dist_km

    if region_regime == "cropland":
        return 2, "cropland", dist_km

    if region_regime == "forest":
        return 3, "forest", dist_km

    return 4, "rural", dist_km


def pull_region(name, lat1, lon1, lat2, lon2, regime, days):
    bbox = f"{lat1},{lon1},{lat2},{lon2}"
    src = "VIIRS_SNPP_NRT"
    url = URL.format(source=src, bbox=bbox, days=days, key=KEY)
    print(f"  pulling {name} ({bbox}) last {days}d ...", flush=True)
    for attempt in range(3):
        try:
            r = httpx.get(url, timeout=120)
            if r.status_code == 200 and r.text.strip():
                rows = list(csv.DictReader(r.text.splitlines()))
                return rows
            print(f"    empty/HTTP {r.status_code}, retrying")
        except Exception as e:
            print(f"    error: {e}")
        time.sleep(5)
    return []


def main():
    print("=" * 70)
    print("FIRMS ARCHIVE PULL — INDIA MULTI-REGIME GROUND TRUTH")
    print("=" * 70)

    all_rows = []
    for name, lat1, lon1, lat2, lon2, regime in REGIONS:
        # 10 days is the max per request for NRT source; do two windows of 10 days
        for window in (10, 10):
            rows = pull_region(name, lat1, lon1, lat2, lon2, regime, window)
            all_rows.extend((r, regime) for r in rows)
            if rows:
                print(f"    got {len(rows)} raw rows", flush=True)
            time.sleep(2)

    print(f"\nTotal raw archive rows pulled: {len(all_rows)}")

    # Deduplicate by (lat, lon, acq_date, acq_time)
    seen = set()
    labeled = []
    for row, regime in all_rows:
        key = (row.get("latitude"), row.get("longitude"),
               row.get("acq_date"), row.get("acq_time"))
        if key in seen:
            continue
        seen.add(key)

        try:
            lat = float(row["latitude"])
            lon = float(row["longitude"])
            frp = float(row.get("frp") or 0.0)
            bt = float(row.get("bright_ti4") or 330.0)
        except (ValueError, KeyError):
            continue

        label, fac_name, dist_km = label_hotspot(lat, lon, frp, bt, regime)
        if label == 4:
            continue  # skip unclassified rural background

        labeled.append({
            "latitude": lat, "longitude": lon,
            "bright_ti4": bt, "bright_ti5": row.get("bright_ti5", ""),
            "frp": frp,
            "confidence": row.get("confidence", ""),
            "scan": row.get("scan", ""), "track": row.get("track", ""),
            "acq_date": row.get("acq_date", ""), "acq_time": row.get("acq_time", ""),
            "satellite": row.get("satellite", ""), "instrument": row.get("instrument", ""),
            "daynight": row.get("daynight", "D"),
            "version": row.get("version", ""),
            "label": label,
            "label_source": "firms_archive_rule",
            "facility": fac_name,
            "dist_to_facility_km": round(dist_km, 3),
            "region_regime": regime,
        })

    print(f"Unique labeled rows (background dropped): {len(labeled)}")

    from collections import Counter
    print("Label distribution:", dict(sorted(Counter(r['label'] for r in labeled).items())))

    out = ROOT / "packages" / "data" / "ground_truth" / "firms_archive_rule_labeled.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(labeled[0].keys()))
        writer.writeheader()
        writer.writerows(labeled)
    print(f"\nSaved → {out} ({len(labeled)} rows)")


if __name__ == "__main__":
    main()
