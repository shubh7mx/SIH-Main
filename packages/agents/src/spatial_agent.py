"""
Agent 2 — SPATIAL PIPELINE
===========================
Queries PostGIS 3.6 for OSM facility containment, ESA WorldCover land
classification, HDBSCAN cluster size, and H3 resolution.

This agent runs AFTER the FIRMS ingestion pipeline has written hotspots to PostGIS.
"""

import os
import math
from typing import Optional, Tuple
from packages.agents.src.state import SwarmState, SpatialScores

try:
    import h3 as _h3
except ImportError:
    _h3 = None


# ── WorldCover class labels (ESA WorldCover 2021) ──────────────────────────────
WORLDCOVER_LABELS = {
    10: ("Tree cover", "forest"),
    20: ("Shrubland", "scrub"),
    30: ("Grassland", "grassland"),
    40: ("Cropland", "agricultural"),
    50: ("Urban/Built-up", "industrial"),
    60: ("Bare/Sparse vegetation", "barren"),
    70: ("Snow/Ice", "snow"),
    80: ("Permanent water bodies", "water"),
    90: ("Herbaceous wetland", "wetland"),
    95: ("Mangroves", "forest"),
    100: ("Moss/Lichen", "barren"),
}


# ── Mock facility registry ──────────────────────────────────────────────────────
# In production: replaced by PostGIS ST_DWithin query against industrial_facilities table.
_FACILITY_REGISTRY: list[dict] = [
    {"id": "fac-001", "name": "Reliance Jamnagar Petrochemical Complex", "type": "refinery", "lat": 22.368, "lon": 69.832},
    {"id": "fac-002", "name": "IOCL Haldia Refinery", "type": "refinery", "lat": 22.031, "lon": 88.082},
    {"id": "fac-003", "name": "Tata Steel Jamshedpur Works", "type": "metal_works", "lat": 22.804, "lon": 86.202},
    {"id": "fac-004", "name": "IOCL Panipat Refinery", "type": "refinery", "lat": 29.390, "lon": 76.963},
    {"id": "fac-005", "name": "ONGC Hazira Gas Processing", "type": "gas_processing", "lat": 21.112, "lon": 72.645},
    {"id": "fac-006", "name": "GSFC Chemical Complex", "type": "chemical", "lat": 21.720, "lon": 72.968},
    {"id": "fac-007", "name": "SAIL Bokaro Steel Plant", "type": "metal_works", "lat": 23.669, "lon": 86.151},
    {"id": "fac-008", "name": "HPCL Visakh Refinery", "type": "refinery", "lat": 17.724, "lon": 83.265},
    {"id": "fac-009", "name": "IOCL Mathura Refinery", "type": "refinery", "lat": 27.476, "lon": 77.679},
    {"id": "fac-010", "name": "IOCL Koyali Refinery", "type": "refinery", "lat": 22.526, "lon": 72.822},
    {"id": "fac-011", "name": "BPCL Mumbai Refinery", "type": "refinery", "lat": 18.978, "lon": 72.847},
    {"id": "fac-012", "name": "NTPC Dadri Thermal Power", "type": "power_plant", "lat": 28.554, "lon": 77.560},
    {"id": "fac-013", "name": "Mangalore Refinery", "type": "refinery", "lat": 12.911, "lon": 74.881},
    {"id": "fac-014", "name": "Kochi Refinery", "type": "refinery", "lat": 10.090, "lon": 76.218},
    {"id": "fac-015", "name": "Chennai Petroleum Corp", "type": "refinery", "lat": 13.168, "lon": 80.257},
    {"id": "fac-016", "name": "JSW Steel Paradip", "type": "metal_works", "lat": 20.317, "lon": 86.193},
    {"id": "fac-017", "name": "ACC Cement Jamul", "type": "cement", "lat": 21.233, "lon": 81.031},
    {"id": "fac-018", "name": "SAIL Rourkela Steel Plant", "type": "metal_works", "lat": 22.248, "lon": 84.884},
    {"id": "fac-019", "name": "NTPC Lara Thermal", "type": "power_plant", "lat": 21.954, "lon": 83.140},
    {"id": "fac-020", "name": "Bina Refinery", "type": "refinery", "lat": 24.193, "lon": 78.207},
]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_h3(lat: float, lon: float, res: int = 8) -> str:
    if _h3 is not None:
        return _h3.latlng_to_cell(lat, lon, res=res)
    return f"88619a{int(abs(lat)*1000):08d}{int(abs(lon)*1000):08d}"


def spatial_pipeline(state: SwarmState) -> SwarmState:
    """
    Agent 2: Spatial Pipeline node for LangGraph.

    Computes:
      - H3 hex index (r8 = 222m)
      - OSM industrial facility nearest-neighbor lookup (PostGIS ST_DWithin in production)
      - ESA WorldCover land cover class at hotspot centroid
      - HDBSCAN cluster size estimation (mock: based on FRP density)
      - Spatial score (0.0–1.0)

    Returns updated state with spatial scores.
    """
    lat = state.latitude
    lon = state.longitude
    h3_idx = compute_h3(lat, lon, res=8)

    # ── Nearest facility lookup ──────────────────────────────────────────────
    nearest = None
    min_dist_km = float("inf")
    for f in _FACILITY_REGISTRY:
        d = haversine_km(lat, lon, f["lat"], f["lon"])
        if d < min_dist_km:
            min_dist_km = d
            nearest = f

    # ── Spatial score ──────────────────────────────────────────────────────
    if nearest is not None and min_dist_km < 5.0:
        # Within 5km of known facility — high baseline confidence
        spatial_score = max(0.7, 1.0 - (min_dist_km / 5.0))
    elif min_dist_km < 20.0:
        spatial_score = 0.4
    else:
        spatial_score = 0.15

    # ── WorldCover land cover simulation ────────────────────────────────────
    # In production: fetch from ESA WorldCover API or pre-loaded raster cache.
    # This is the SATELLITE-DERIVED land cover — independent of facility proximity.
    # Facility proximity is a SEPARATE spatial signal used in the orchestrator.
    land_cover_class, land_cover_name = _simulate_worldcover(lat, lon)

    # ── Cluster size (mock HDBSCAN) ─────────────────────────────────────────
    # Refineries have persistent clustering; isolated fields = agricultural
    cluster_size = 3 if nearest and nearest["type"] in ("refinery", "metal_works") else 1

    # Only link facility if within 20km proximity
    is_near_facility = nearest is not None and min_dist_km <= 20.0

    state.spatial = SpatialScores(
        h3_index=h3_idx,
        facility_id=nearest["id"] if is_near_facility else None,
        facility_name=nearest["name"] if is_near_facility else None,
        facility_type=nearest["type"] if is_near_facility else None,
        land_cover_class=land_cover_class,
        land_cover_name=land_cover_name,
        cluster_size=cluster_size,
        nearest_facility_km=round(min_dist_km, 3) if nearest else None,
        distance_m=round(min_dist_km * 1000, 0) if nearest else None,
        score=round(spatial_score, 3),
    )
    state.h3_index = h3_idx

    return state


def _simulate_worldcover(lat: float, lon: float) -> Tuple[int, str]:
    """
    Simulates ESA WorldCover lookup based on geography heuristics.
    Note: this is INDEPENDENT of facility proximity — land cover is the
    actual satellite-derived ground class. Facility is a separate signal
    used in the orchestrator's CDE engine.
    """
    # Punjab/Haryana agricultural belt (28-31°N, 74-77°E)
    if 28.5 <= lat <= 31.5 and 74.0 <= lon <= 77.5:
        return 40, "Cropland"

    # Himalayan / NE forest belt (28-38°N, 73-97°E high elevation)
    if lat > 27.0 and 73.0 <= lon <= 97.0:
        return 10, "Tree cover"

    # Western Rajasthan / Gujarat scrub (22-28°N, 68-72°E low-rainfall)
    if 22.0 <= lat <= 28.0 and 68.0 <= lon <= 72.5:
        return 30, "Grassland"

    # Default: cropland (India is ~60% agricultural)
    return 40, "Cropland"
