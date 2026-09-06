"""
SIH26162 — Download real VIIRS C2 active-fire shapefiles from NASA LANCE
==========================================================================
No API key required for static archive files. Pulls 24h/48h/7d windows
for S-NPP, NOAA-20, NOAA-21 over South Asia, extracts CSV attribute tables,
and labels by facility-registry + regional fire-regime rules.
"""
import csv
import io
import sys
import time
import zipfile
from collections import Counter
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from packages.agents.src.spatial_agent import _FACILITY_REGISTRY, haversine_km

BASE = "https://firms.modaps.eosdis.nasa.gov/data/active_fire"
FILES = [
    ("SUOMI_VIIRS_C2_South_Asia_24h.zip", "suomi-npp-viirs-c2/shapes/zips"),
    ("SUOMI_VIIRS_C2_South_Asia_48h.zip", "suomi-npp-viirs-c2/shapes/zips"),
    ("SUOMI_VIIRS_C2_South_Asia_7d.zip",  "suomi-npp-viirs-c2/shapes/zips"),
    ("J1_VIIRS_C2_South_Asia_24h.zip", "noaa-20-viirs-c2/shapes/zips"),
    ("J1_VIIRS_C2_South_Asia_48h.zip", "noaa-20-viirs-c2/shapes/zips"),
    ("J1_VIIRS_C2_South_Asia_7d.zip",  "noaa-20-viirs-c2/shapes/zips"),
    ("J2_VIIRS_C2_South_Asia_24h.zip", "noaa-21-viirs-c2/shapes/zips"),
    ("J2_VIIRS_C2_South_Asia_48h.zip", "noaa-21-viirs-c2/shapes/zips"),
    ("J2_VIIRS_C2_South_Asia_7d.zip",  "noaa-21-viirs-c2/shapes/zips"),
]

# India-only filter (project coverage)
INDIA = (6.0, 68.0, 38.0, 97.5)  # lat1, lon1, lat2, lon2


def nearest_facility(lat, lon):
    best, best_km = None, 1e9
    for f in _FACILITY_REGISTRY:
        d = haversine_km(lat, lon, f["lat"], f["lon"])
        if d < best_km:
            best, best_km = f, d
    return best, best_km


def parse_shapefile_zip(zf: zipfile.ZipFile):
    """Extract attribute records from a shapefile zip via dbf parsing."""
    import struct

    dbf_name = next((n for n in zf.namelist() if n.lower().endswith(".dbf")), None)
    if not dbf_name:
        return []

    data = zf.read(dbf_name)
    # DBF header
    num_records = struct.unpack("<I", data[4:8])[0]
    header_size = struct.unpack("<H", data[8:10])[0]
    record_size = struct.unpack("<H", data[10:12])[0]

    # Parse field descriptors
    fields = []
    offset = 32
    while offset < header_size and data[offset] != 0x0D:
        raw = data[offset:offset + 32]
        fname = raw[0:11].split(b"\x00")[0].decode("ascii", "ignore").strip()
        ftype = chr(raw[11])
        flen = raw[16]
        fields.append((fname, ftype, flen))
        offset += 32

    rows = []
    for i in range(num_records):
        rec_start = header_size + i * record_size
        rec = data[rec_start:rec_start + record_size]
        if not rec or rec[0:1] == b"\x2A":  # deleted
            continue
        row = {}
        pos = 1  # skip deletion flag
        for fname, ftype, flen in fields:
            raw_val = rec[pos:pos + flen].decode("ascii", "ignore").strip()
            row[fname] = raw_val
            pos += flen
        rows.append(row)
    return rows


def parse_confidence(raw):
    """VIIRS C2 confidence is categorical: l/n/h or low/nominal/high."""
    s = str(raw).strip().lower()
    if s in ("l", "low"):
        return 50.0
    if s in ("h", "high"):
        return 90.0
    if s in ("n", "nominal"):
        return 70.0
    try:
        return float(s)
    except ValueError:
        return 70.0


# Geographic fire-regime zones (real-world stratification, disclosed in provenance)
FOREST_ZONES = [
    (28.5, 77.5, 32.0, 80.5),   # Uttarakhand / Himachal Himalaya
    (30.0, 74.0, 34.0, 76.5),   # J&K forest
    (21.0, 76.5, 24.0, 82.0),   # Central India (MP/Chhattisgarh)
    (24.0, 92.0, 28.5, 96.5),   # NE hills (Assam/Meghalaya/Mizoram)
    (10.5, 76.0, 15.5, 77.5),   # Western Ghats south
]
CROP_ZONES = [
    (27.5, 73.5, 32.5, 77.0),   # Punjab / Haryana
    (24.5, 78.0, 29.5, 84.5),   # UP plains
    (17.5, 73.0, 21.5, 78.5),   # Maharashtra / Deccan
    (20.0, 74.5, 24.0, 78.0),   # MP Malwa
    (10.0, 76.0, 12.5, 80.0),   # Tamil Nadu / delta
]


def in_zones(lat, lon, zones):
    return any(z[0] <= lat <= z[2] and z[1] <= lon <= z[3] for z in zones)


def label_row(lat, lon, frp, bt, confidence):
    """Facility registry + fire-regime geography → 4-class label.
    Tier 1: facility containment (strong registry-verified labels).
    Tier 2: geographic stratification + radiometrics for agri/wildfire.
    Ambiguous samples (no zone match) are DROPPED, not guessed."""
    fac, dist_km = nearest_facility(lat, lon)

    # Tier 1 — industrial (strong: registry-verified containment)
    if dist_km <= 2.5:
        if frp >= 600 or (frp >= 300 and bt >= 900):
            return 0, fac["name"], dist_km       # INDUSTRIAL_FIRE_EMERGENCY
        return 1, fac["name"], dist_km           # PERSISTENT_INDUSTRIAL_FLARE

    # Tier 2 — wildfire zones: strong FRP in verified forest belts
    if in_zones(lat, lon, FOREST_ZONES) and frp >= 15.0:
        return 3, "forest", dist_km             # WILDFIRE

    # Tier 2 — crop zones: moderate FRP in agricultural plains
    if in_zones(lat, lon, CROP_ZONES) and frp < 300.0 and confidence >= 50.0:
        return 2, "cropland", dist_km           # AGRICULTURAL_BURNING

    # Outside any verified zone → drop (don't guess)
    return None, None, dist_km


def main():
    print("=" * 70)
    print("VIIRS C2 ARCHIVE PULL (LANCE static files, no key)")
    print("=" * 70)

    all_labeled = []
    seen = set()

    for fname, path in FILES:
        url = f"{BASE}/{path}/{fname}"
        print(f"\n→ {fname}")
        try:
            r = httpx.get(url, timeout=180, follow_redirects=True)
            if r.status_code != 200 or len(r.content) < 1000:
                print(f"   SKIP (HTTP {r.status_code}, {len(r.content)} bytes)")
                continue
            with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
                rows = parse_shapefile_zip(zf)
            print(f"   {len(rows)} records parsed")
        except Exception as e:
            print(f"   ERROR: {str(e)[:100]}")
            continue

        kept = 0
        for row in rows:
            try:
                lat = float(row.get("LATITUDE", 0))
                lon = float(row.get("LONGITUDE", 0))
                frp = float(row.get("FRP", 0) or 0)
                bt = float(row.get("BRIGHT_TI4", 0) or 330)
                conf = parse_confidence(row.get("CONFIDENCE", 80))
                acq_date = row.get("ACQ_DATE", "")
                acq_time = row.get("ACQ_TIME", "")
                sat = row.get("SATELLITE", "")
                dn = row.get("DAYNIGHT", "D")
            except ValueError:
                continue

            # India bbox filter
            if not (INDIA[0] <= lat <= INDIA[2] and INDIA[1] <= lon <= INDIA[3]):
                continue

            key = (round(lat, 5), round(lon, 5), acq_date, acq_time)
            if key in seen:
                continue
            seen.add(key)

            label, fac_name, dist_km = label_row(lat, lon, frp, bt, conf)
            if label is None:
                continue

            all_labeled.append({
                "latitude": lat, "longitude": lon,
                "bright_ti4": bt,
                "bright_ti5": float(row.get("BRIGHT_TI5", 0) or 0),
                "frp": frp,
                "confidence": conf,
                "scan": row.get("SCAN", ""), "track": row.get("TRACK", ""),
                "acq_date": acq_date, "acq_time": acq_time,
                "satellite": sat, "instrument": row.get("INSTRUMENT", "VIIRS"),
                "daynight": dn,
                "version": row.get("VERSION", "2.0"),
                "label": label,
                "label_source": "lance_archive_rule",
                "facility": fac_name or "none",
                "dist_to_facility_km": round(dist_km, 3),
            })
            kept += 1
        print(f"   kept (labeled, India, dedup): {kept}")
        time.sleep(1)

    print("\n" + "=" * 70)
    print(f"TOTAL unique labeled samples: {len(all_labeled)}")
    print("Label distribution:", dict(sorted(Counter(r['label'] for r in all_labeled).items())))

    out = ROOT / "packages" / "data" / "ground_truth" / "firms_lance_archive_labeled.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(all_labeled[0].keys()))
        w.writeheader()
        w.writerows(all_labeled)
    print(f"Saved → {out}")


if __name__ == "__main__":
    main()
