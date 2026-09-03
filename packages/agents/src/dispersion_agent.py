"""
Agent 5 — DISPERSION SIMULATOR
================================
Computes Gaussian puff plume dispersion for industrial fire emergencies.

Inputs:
  - Fire source location (lat, lon)
  - FRP (Fire Radiative Power) in MW
  - Wind direction (deg) and speed (m/s) from ERA5 reanalysis

Outputs:
  - Plume polygon (downwind, crosswind extent)
  - 5km and 10km hazard zone population estimates
  - Recommended action based on classification

In production, this uses:
  - ERA5: https://cds.climate.copernicus.eu/cdsapp
  - Physics-Informed Neural Network (PINN) for plume dynamics
  - GHS-POP (Global Human Settlement Layer) for population density
"""

import math
import os
from datetime import datetime, timezone
from typing import Optional, Tuple
from packages.agents.src.state import SwarmState, DispersionResult


# ── Wind field simulation (ERA5 in production) ───────────────────────────────
# Realistic Indian monsoon wind patterns
def _simulate_wind(lat: float, lon: float, dt: Optional[datetime] = None) -> Tuple[float, float]:
    """
    Returns (wind_direction_deg, wind_speed_ms).
    Wind direction is meteorological (where wind comes FROM).
    """
    dt = dt or datetime.now(timezone.utc)
    month = dt.month

    # Southwest Monsoon (Jun-Sep): SW winds over most of India
    if 6 <= month <= 9:
        if lat < 20.0:
            return 230.0, 6.5  # Strong SW winds
        elif 20.0 <= lat <= 28.0:
            return 250.0, 4.5  # WSW winds
        else:
            return 270.0, 3.5  # W winds in north India

    # Northeast Monsoon (Oct-Dec): NE winds
    if 10 <= month <= 12:
        return 50.0, 4.0

    # Winter (Jan-Feb): NW winds
    if month in (1, 2):
        return 320.0, 3.0

    # Pre-monsoon (Mar-May): variable
    return 200.0, 4.0


# ── Gaussian puff model ────────────────────────────────────────────────────────
def _gaussian_puff_plume(
    source_lat: float,
    source_lon: float,
    wind_speed_ms: float,
    wind_dir_deg: float,
    frp_mw: float,
    hours: int = 4,
) -> dict:
    """
    Computes Gaussian puff dispersion polygon for a fire source.
    Returns GeoJSON Polygon feature.

    σ_y(x) = a * x^b  (crosswind spread, Briggs urban coefficients)
    σ_z(x) = c * x^d  (vertical spread)
    """
    # Downwind distance for plume extent (km)
    downwind_km = min(50.0, max(5.0, wind_speed_ms * 3.6 * hours))  # 1 m/s = 3.6 km/h

    # Plume width scales with downwind distance
    sigma_y_km = 0.08 * (downwind_km ** 0.95)  # ~1-5 km at 5-30 km
    plume_half_width_km = sigma_y_km * 2.5

    # Convert wind direction (FROM) to downwind direction (TO)
    # Wind from SW (225°) means plume goes NE (45°)
    downwind_bearing = (wind_dir_deg + 180.0) % 360.0

    # Generate polygon vertices (5 points: 2 along edges, 1 apex)
    # Apex is downwind at full distance
    # 2 lateral points at 50% distance for Gaussian envelope
    vertices = []

    # Start at source
    vertices.append([source_lon, source_lat])

    # Lateral left at 50% downwind
    lat_mid, lon_mid = _move_point(source_lat, source_lon, downwind_km * 0.5, downwind_bearing - 90)
    vertices.append([lon_mid, lat_mid])

    # Apex (downwind)
    lat_apex, lon_apex = _move_point(source_lat, source_lon, downwind_km, downwind_bearing)
    vertices.append([lon_apex, lat_apex])

    # Lateral right at 50% downwind
    lat_mid_r, lon_mid_r = _move_point(source_lat, source_lon, downwind_km * 0.5, downwind_bearing + 90)
    vertices.append([lon_mid_r, lat_mid_r])

    # Close polygon
    vertices.append([source_lon, source_lat])

    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [vertices]
        },
        "properties": {
            "downwind_km": round(downwind_km, 2),
            "sigma_y_km": round(sigma_y_km, 2),
            "plume_half_width_km": round(plume_half_width_km, 2),
            "wind_speed_ms": round(wind_speed_ms, 1),
            "wind_direction_deg": round(wind_dir_deg, 0),
        }
    }


def _move_point(lat: float, lon: float, distance_km: float, bearing_deg: float) -> Tuple[float, float]:
    """Move lat/lon by distance_km at bearing_deg (0=N, 90=E)."""
    R = 6371.0
    bearing_rad = math.radians(bearing_deg)
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)

    new_lat_rad = math.asin(
        math.sin(lat_rad) * math.cos(distance_km / R) +
        math.cos(lat_rad) * math.sin(distance_km / R) * math.cos(bearing_rad)
    )
    new_lon_rad = lon_rad + math.atan2(
        math.sin(bearing_rad) * math.sin(distance_km / R) * math.cos(lat_rad),
        math.cos(distance_km / R) - math.sin(lat_rad) * math.sin(new_lat_rad)
    )
    return math.degrees(new_lat_rad), math.degrees(new_lon_rad)


# ── Population density (GHS-POP simulation) ──────────────────────────────────
def _estimate_population(lat: float, lon: float, radius_km: float) -> int:
    """
    Simulates GHS-POP population density lookup.
    Returns estimated population within `radius_km` of the point.
    """
    # India average: ~470 people/km²
    base_density = 470

    # Major city uplift
    if 18.5 <= lat <= 19.5 and 72.7 <= lon <= 73.0:  # Mumbai
        return int(8000 * radius_km ** 2)
    if 28.4 <= lat <= 28.7 and 76.8 <= lon <= 77.3:  # Delhi
        return int(6500 * radius_km ** 2)
    if 12.8 <= lat <= 13.2 and 80.1 <= lon <= 80.4:  # Chennai
        return int(4500 * radius_km ** 2)
    if 22.4 <= lat <= 22.7 and 88.2 <= lon <= 88.5:  # Kolkata
        return int(6000 * radius_km ** 2)
    if 12.8 <= lat <= 13.1 and 77.4 <= lon <= 77.8:  # Bangalore
        return int(5000 * radius_km ** 2)
    if 17.2 <= lat <= 17.5 and 78.2 <= lon <= 78.6:  # Hyderabad
        return int(3500 * radius_km ** 2)

    # Industrial zones get ~3x base
    if 22.0 <= lat <= 23.0 and 69.0 <= lon <= 70.0:  # Jamnagar corridor
        return int(1500 * radius_km ** 2)

    return int(base_density * radius_km ** 2)


# ── Recommended action generator ─────────────────────────────────────────────
def _recommend_action(classification: str, pop_5km: int, pop_10km: int) -> str:
    if classification == "INDUSTRIAL_FIRE_EMERGENCY":
        if pop_5km > 2000:
            return f"CRITICAL: Evacuate 5km zone (pop ~{pop_5km}). Deploy NDRF. Notify District Collector."
        elif pop_5km > 500:
            return f"HIGH ALERT: Issue advisory to 5km zone (pop ~{pop_5km}). Pre-position NDRF."
        else:
            return "INDUSTRIAL ALERT: Notify facility operator. Monitor for escalation."
    elif classification == "PERSISTENT_INDUSTRIAL_FLARE":
        return "ROUTINE: Log and continue monitoring. Normal flaring operation."
    elif classification == "AGRICULTURAL_BURNING":
        return "INFO: Agricultural stubble burning detected. Log only."
    elif classification == "WILDFIRE":
        return "WARNING: Forest fire. Alert state forest department."
    else:
        return "MONITOR: Awaiting analyst review."


def dispersion_pipeline(state: SwarmState) -> SwarmState:
    """
    Agent 5: Dispersion Simulator node for LangGraph.

    Activates only for high-severity events (Industrial Fire, large wildfire).
    Computes:
      - Plume polygon (Gaussian puff downwind)
      - Population within 5km / 10km hazard zones
      - Recommended emergency action
    """
    wind_dir, wind_speed = _simulate_wind(state.latitude, state.longitude, state.acq_datetime)

    # Only compute plume for critical or warning events
    if state.cde_severity in ("CRITICAL", "WARNING") or state.spatial.facility_type in (
        "refinery", "metal_works", "chemical", "gas_processing", "power_plant"
    ):
        plume_geojson = _gaussian_puff_plume(
            state.latitude, state.longitude,
            wind_speed, wind_dir, state.frp_mw, hours=4
        )
        pop_5km = _estimate_population(state.latitude, state.longitude, 5.0)
        pop_10km = _estimate_population(state.latitude, state.longitude, 10.0)
    else:
        plume_geojson = None
        pop_5km = 0
        pop_10km = 0

    # Generate recommendation based on classification (pre-orchestrator)
    provisional_class = state.final_classification or "UNKNOWN"
    action = _recommend_action(provisional_class, pop_5km, pop_10km)

    state.dispersion = DispersionResult(
        plume_polygon_geojson=plume_geojson,
        wind_direction_deg=round(wind_dir, 1),
        wind_speed_ms=round(wind_speed, 1),
        hazard_5km_pop=pop_5km,
        hazard_10km_pop=pop_10km,
        recommended_action=action,
    )
    return state
