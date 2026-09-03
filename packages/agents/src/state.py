"""
SIH26162 — Multi-Agent Swarm State Schema (Pydantic v2)
========================================================
Defines the typed state object that flows through the LangGraph 1.2 state machine.
"""

from __future__ import annotations
from typing import Literal, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

ThermalClass = Literal[
    "INDUSTRIAL_FIRE_EMERGENCY",
    "PERSISTENT_INDUSTRIAL_FLARE",
    "AGRICULTURAL_BURNING",
    "WILDFIRE",
    "DEFERRED_FOR_ANALYST",
    "UNKNOWN",
]

AlertSeverity = Literal["CRITICAL", "WARNING", "WATCH", "INFO"]


class SpatialScores(BaseModel):
    h3_index: str = ""
    facility_id: Optional[str] = None
    facility_name: Optional[str] = None
    facility_type: Optional[str] = None
    operator: Optional[str] = None
    land_cover_class: Optional[int] = None
    land_cover_name: Optional[str] = None
    cluster_size: int = 0
    nearest_facility_km: Optional[float] = None
    distance_m: Optional[float] = None
    score: float = 0.0


class TemporalScores(BaseModel):
    frp_zscore: float = 0.0
    bt_zscore: float = 0.0
    diurnal_anomaly: float = 0.0
    tpi: float = 0.0
    baseline_frp_mean: float = 0.0
    baseline_frp_std: float = 0.0
    baseline_bt_mean: float = 0.0
    baseline_bt_std: float = 0.0
    observation_count: int = 0
    score: float = 0.0


class VisionScores(BaseModel):
    cloud_free: bool = False
    cloud_coverage_pct: float = 100.0
    sentinel2_tile_id: Optional[str] = None
    patch_url: Optional[str] = None
    predicted_class: ThermalClass = "UNKNOWN"
    vision_class_confidence: float = 0.0
    score: float = 0.0


class DispersionResult(BaseModel):
    plume_polygon_geojson: Optional[dict] = None
    wind_direction_deg: float = 0.0
    wind_speed_ms: float = 0.0
    hazard_5km_pop: int = 0
    hazard_10km_pop: int = 0
    recommended_action: str = ""


class SwarmState(BaseModel):
    # ── Input from FIRMS pipeline ──────────────────────────────────────
    hotspot_id: str = ""
    firms_id: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    frp_mw: float = 0.0
    brightness_temp_k: float = 0.0
    confidence_pct: int = 0
    satellite_source: str = ""
    day_night: str = "D"
    acq_datetime: Optional[datetime] = None
    h3_index: str = ""

    # ── Agent Outputs ──────────────────────────────────────────────────
    spatial: SpatialScores = Field(default_factory=SpatialScores)
    temporal: TemporalScores = Field(default_factory=TemporalScores)
    vision: VisionScores = Field(default_factory=VisionScores)
    dispersion: DispersionResult = Field(default_factory=DispersionResult)

    # ── Fusion Output ──────────────────────────────────────────────────
    final_classification: ThermalClass = "UNKNOWN"
    final_confidence: float = 0.0
    cde_score: float = 0.0
    cde_severity: str = "NORMAL"
    alert_severity: AlertSeverity = "INFO"
    is_critical: bool = False
    human_review_required: bool = False

    # ── Meta ───────────────────────────────────────────────────────────
    errors: list[str] = Field(default_factory=list)
    agents_completed: list[str] = Field(default_factory=list)
    pipeline_started_at: Optional[datetime] = None
    pipeline_completed_at: Optional[datetime] = None
    processing_duration_ms: int = 0

    def to_classification_dict(self) -> dict[str, Any]:
        """Output format for the FastAPI `/events` endpoint."""
        return {
            "id": self.hotspot_id,
            "firms_id": self.firms_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "h3_index": self.h3_index or self.spatial.h3_index,
            "brightness_temp_kelvin": self.brightness_temp_k,
            "frp_megawatts": self.frp_mw,
            "confidence_pct": self.confidence_pct,
            "satellite_source": self.satellite_source,
            "day_night": self.day_night,
            "acq_datetime": self.acq_datetime.isoformat() if self.acq_datetime else "",
            "classification": self.final_classification,
            "confidence_score": round(self.final_confidence, 4),
            "cde_anomaly_score": round(self.cde_score, 2),
            "cde_severity": self.cde_severity,
            "facility_id": self.spatial.facility_id,
            "facility_name": self.spatial.facility_name,
            "facility_type": self.spatial.facility_type,
            "distance_to_facility_km": self.spatial.nearest_facility_km,
            "alert_severity": self.alert_severity,
            "is_critical_alert": self.is_critical,
            "human_review_required": self.human_review_required,
            "agent_reasoning": {
                "spatial": {
                    "facility": self.spatial.facility_name,
                    "facility_type": self.spatial.facility_type,
                    "land_cover": self.spatial.land_cover_name,
                    "distance_km": self.spatial.nearest_facility_km,
                    "score": round(self.spatial.score, 3),
                },
                "temporal": {
                    "frp_zscore": round(self.temporal.frp_zscore, 2),
                    "bt_zscore": round(self.temporal.bt_zscore, 2),
                    "diurnal_anomaly": round(self.temporal.diurnal_anomaly, 2),
                    "tpi": round(self.temporal.tpi, 4),
                    "baseline_frp_mean": round(self.temporal.baseline_frp_mean, 1),
                    "baseline_frp_std": round(self.temporal.baseline_frp_std, 1),
                    "observation_count": self.temporal.observation_count,
                    "score": round(self.temporal.score, 3),
                },
                "vision": {
                    "cloud_free": self.vision.cloud_free,
                    "cloud_coverage_pct": self.vision.cloud_coverage_pct,
                    "predicted_class": self.vision.predicted_class,
                    "vision_class_confidence": round(self.vision.vision_class_confidence, 3),
                    "score": round(self.vision.score, 3),
                    "sentinel2_tile_id": self.vision.sentinel2_tile_id,
                },
                "dispersion": {
                    "wind_direction_deg": self.dispersion.wind_direction_deg,
                    "wind_speed_ms": self.dispersion.wind_speed_ms,
                    "hazard_5km_pop": self.dispersion.hazard_5km_pop,
                    "hazard_10km_pop": self.dispersion.hazard_10km_pop,
                    "recommended_action": self.dispersion.recommended_action,
                },
                "orchestrator": {
                    "final_classification": self.final_classification,
                    "final_confidence": round(self.final_confidence, 3),
                    "cde_score": round(self.cde_score, 2),
                    "cde_severity": self.cde_severity,
                    "alert_severity": self.alert_severity,
                    "is_critical": self.is_critical,
                    "human_review_required": self.human_review_required,
                },
            },
            "created_at": self.pipeline_completed_at.isoformat() if self.pipeline_completed_at else (
                self.acq_datetime.isoformat() if self.acq_datetime else ""
            ),
            "processing_duration_ms": self.processing_duration_ms,
        }
