"""
Agent 4 — VISION VALIDATOR
============================
Fetches Sentinel-2 L1C/L2A SWIR composite (B12, B11, B8A) via Copernicus Data
Space Ecosystem (CDSE) STAC API and runs the EfficientNet-B0 ONNX classifier
on a 256×256 patch centered on the hotspot.

In production, this connects to:
  - CDSE: https://catalogue.dataspace.copernicus.eu/odata/v1/Products
  - Triton Inference Server (ONNX runtime) for the vision model

For Phase 2 demo, this implements the contract layer with cloud-coverage
detection and simulated classifier scores.
"""

import os
import random
import hashlib
from datetime import datetime, timezone
from typing import Optional
from packages.agents.src.state import SwarmState, VisionScores


# ── Monsoon season cloud-cover simulation (India, June–September) ────────────
def _simulate_cloud_cover(lat: float, lon: float, dt: Optional[datetime] = None) -> float:
    """
    Returns simulated cloud coverage % for the location/date.
    India experiences >70% cloud cover during monsoon (Jun–Sep).
    """
    dt = dt or datetime.now(timezone.utc)
    month = dt.month

    # Monsoon months: June, July, August, September
    if 6 <= month <= 9:
        # Punjab/Haryana belt: 70-90% cloud cover
        if 28.0 <= lat <= 32.0 and 73.0 <= lon <= 78.0:
            return random.uniform(70.0, 90.0)
        # Coastal areas: 80-95% cloud cover
        if lat < 16.0:
            return random.uniform(80.0, 95.0)
        # North-east: 85-95% cloud cover
        if 23.0 <= lat <= 28.0 and 88.0 <= lon <= 97.0:
            return random.uniform(85.0, 95.0)
        # Rest: 50-75%
        return random.uniform(50.0, 75.0)

    # Winter (Dec–Feb): low cloud cover
    if month in (12, 1, 2):
        if 22.0 <= lat <= 30.0:
            return random.uniform(5.0, 25.0)  # North India: clear skies
        return random.uniform(15.0, 40.0)

    # Pre-monsoon (Mar–May)
    if 3 <= month <= 5:
        return random.uniform(20.0, 50.0)

    # Post-monsoon (Oct–Nov)
    return random.uniform(15.0, 40.0)


def _generate_sentinel2_tile_id(lat: float, lon: float, dt: datetime) -> str:
    """Generates a realistic Sentinel-2 tile ID for the location."""
    # MGRS tile is 100km×100km in UTM. S2A/B naming convention.
    utm_zone = int((lon + 180) / 6) + 1
    latitude_band = "CDEF"[min(3, int((lat + 80) / 8))]
    grid_square = f"{(int(abs(lat*100)) % 100):02d}{(int(abs(lon*100)) % 100):02d}"
    sensing_time = dt.strftime("%Y%m%dT%H%M%S")
    satellite = random.choice(["S2A", "S2B"])
    return f"{satellite}_MSIL2A_{sensing_time}_N0500_R019_T{utm_zone}{latitude_band}{grid_square}_{sensing_time}"


def vision_pipeline(state: SwarmState) -> SwarmState:
    """
    Agent 4: Vision Validator node for LangGraph.

    Steps:
      1. Compute cloud cover for the hotspot location & date
      2. If cloud_free → query Sentinel-2 L2A via CDSE STAC
      3. Extract 256×256 SWIR composite (B12, B11, B8A)
      4. Run EfficientNet-B0 classifier → 4-class prediction

    Returns updated state with vision scores.
    """
    cloud_cover = _simulate_cloud_cover(state.latitude, state.longitude, state.acq_datetime)
    cloud_free = cloud_cover < 60.0

    if cloud_free:
        # Generate mock Sentinel-2 tile ID
        dt = state.acq_datetime or datetime.now(timezone.utc)
        tile_id = _generate_sentinel2_tile_id(state.latitude, state.longitude, dt)
        patch_url = f"/satellite/patches/{state.hotspot_id}-swir-256.png"

        # Vision classifier score
        vision_class_confidence = random.uniform(0.75, 0.97)
        vision_score = vision_class_confidence

        # Vision prediction: consistent with spatial + temporal
        spatial_facility = state.spatial.facility_type
        if spatial_facility in ("refinery", "metal_works", "cement", "gas_processing", "flare"):
            predicted_class = "INDUSTRIAL_FIRE_EMERGENCY" if state.frp_mw > 500 else "PERSISTENT_INDUSTRIAL_FLARE"
        elif state.spatial.land_cover_class == 40:
            predicted_class = "AGRICULTURAL_BURNING"
        elif state.spatial.land_cover_class == 10:
            predicted_class = "WILDFIRE"
        else:
            predicted_class = "UNKNOWN"
    else:
        tile_id = None
        patch_url = None
        vision_class_confidence = 0.0
        vision_score = 0.0
        predicted_class = "UNKNOWN"

    state.vision = VisionScores(
        cloud_free=cloud_free,
        cloud_coverage_pct=round(cloud_cover, 1),
        sentinel2_tile_id=tile_id,
        patch_url=patch_url,
        predicted_class=predicted_class,
        vision_class_confidence=round(vision_class_confidence, 3),
        score=round(vision_score, 3),
    )
    return state
