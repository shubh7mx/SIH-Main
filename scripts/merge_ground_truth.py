"""
SIH26162 — Merge LANCE archive ground truth with hand-verified dataset
=======================================================================
Enriches the new 746 LANCE archive samples with REAL derived features:
  - persistence_count_30d: actual detection count per location cluster
    within the archive window (authentic temporal persistence signal)
  - dist_to_industrial_m / dist_to_power_m: haversine to registry facilities
  - dist_to_cropland_m / dist_to_forest_m: geographic zone membership
Then merges with the existing 333 hand-verified samples and writes
the combined training CSV used by train_honest_ensemble.py.
"""
from __future__ import annotations
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from packages.agents.src.spatial_agent import _FACILITY_REGISTRY, haversine_km

GT = ROOT / "packages" / "data" / "ground_truth"

FOREST_ZONES = [
    (28.5, 77.5, 32.0, 80.5), (30.0, 74.0, 34.0, 76.5),
    (21.0, 76.5, 24.0, 82.0), (24.0, 92.0, 28.5, 96.5),
    (10.5, 76.0, 15.5, 77.5),
]
CROP_ZONES = [
    (27.5, 73.5, 32.5, 77.0), (24.5, 78.0, 29.5, 84.5),
    (17.5, 73.0, 21.5, 78.5), (20.0, 74.5, 24.0, 78.0),
    (10.0, 76.0, 12.5, 80.0),
]

POWER_PLANTS = [f for f in _FACILITY_REGISTRY if f["type"] == "power_plant"]
INDUSTRIAL = [f for f in _FACILITY_REGISTRY if f["type"] != "power_plant"]


def min_km(lat, lon, facs):
    return min(haversine_km(lat, lon, f["lat"], f["lon"]) for f in facs)


def in_zones(lat, lon, zones):
    return any(z[0] <= lat <= z[2] and z[1] <= lon <= z[3] for z in zones)


def main():
    # ── 1. Load new LANCE archive samples ────────────────────────────
    new = pd.read_csv(GT / "firms_lance_archive_labeled.csv")
    print(f"LANCE archive samples: {len(new)}")

    # ── 2. Compute REAL persistence per location cluster ─────────────
    # Cluster at ~0.02° (~2km): count detections at same site.
    # A persistent flare appears in many overpasses across the 7-day
    # window; a crop burn appears once or twice.
    new["lat_c"] = new["latitude"].round(2)
    new["lon_c"] = new["longitude"].round(2)
    cluster_counts = new.groupby(["lat_c", "lon_c"]).size().to_dict()
    new["persistence_count_30d"] = [
        float(cluster_counts[(r.lat_c, r.lon_c)]) for r in new.itertuples()
    ]
    pers_by_label = new.groupby("label")["persistence_count_30d"].mean().to_dict()
    print("Mean persistence by label:", {int(k): round(v, 1) for k, v in pers_by_label.items()})

    # ── 3. Real distances from registry + zone membership ────────────
    new["dist_to_industrial_m"] = [
        min_km(r.latitude, r.longitude, INDUSTRIAL) * 1000 for r in new.itertuples()
    ]
    new["dist_to_power_m"] = [
        min_km(r.latitude, r.longitude, POWER_PLANTS) * 1000 for r in new.itertuples()
    ]
    new["dist_to_mining_m"] = [
        min_km(r.latitude, r.longitude,
               [f for f in _FACILITY_REGISTRY if f["type"] == "metal_works"]) * 1000
        for r in new.itertuples()
    ]
    new["dist_to_cropland_m"] = [
        200.0 if in_zones(r.latitude, r.longitude, CROP_ZONES) else 25000.0
        for r in new.itertuples()
    ]
    new["dist_to_forest_m"] = [
        300.0 if in_zones(r.latitude, r.longitude, FOREST_ZONES) else 30000.0
        for r in new.itertuples()
    ]
    new["confidence_score"] = new["confidence"] / 100.0

    # Harmonize columns with the existing dataset
    new["label_name"] = new["label"].map({
        0: "INDUSTRIAL_FIRE_EMERGENCY",
        1: "PERSISTENT_INDUSTRIAL_FLARE",
        2: "AGRICULTURAL_BURNING",
        3: "WILDFIRE",
    })
    new["source"] = "lance_archive"

    # ── 4. Load existing hand-verified set ───────────────────────────
    dfs = []
    for name in ["real_plus_aug.csv", "firms_north_labeled_v2.csv"]:
        p = GT / name
        if p.exists():
            dfs.append(pd.read_csv(p))
    existing = pd.concat(dfs, ignore_index=True).drop_duplicates(
        subset=["latitude", "longitude", "acq_date", "acq_time"]
    )
    existing["source"] = existing.get("source", "hand_verified")
    print(f"Hand-verified (deduped): {len(existing)}")

    # ── 5. Merge: keep hand-verified label when both cover a sample ──
    key = ["latitude", "longitude", "acq_date", "acq_time"]
    merged = pd.concat(
        [existing, new], ignore_index=True, sort=False
    ).drop_duplicates(subset=key, keep="first")  # hand-verified wins

    # Drop unlabeled rows
    merged = merged[merged["label"].notna()]
    merged["label"] = merged["label"].astype(int)
    merged = merged[merged["label"].isin([0, 1, 2, 3, 4])]

    print(f"\nMERGED TOTAL: {len(merged)}")
    dist = dict(sorted(Counter(merged['label']).items()))
    print("Label distribution:", dist)
    print("  0=INDUSTRIAL_FIRE_EMERGENCY, 1=FLARE, 2=AGRI, 3=WILDFIRE, 4=other(open land)")
    print("By source:", merged["source"].value_counts().to_dict())

    out = GT / "merged_ground_truth.csv"
    merged.to_csv(out, index=False)
    print(f"\nSaved → {out}")


if __name__ == "__main__":
    main()
