from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class ThermalClassification(str, Enum):
    INDUSTRIAL_FIRE_EMERGENCY = "INDUSTRIAL_FIRE_EMERGENCY"
    PERSISTENT_INDUSTRIAL_FLARE = "PERSISTENT_INDUSTRIAL_FLARE"
    AGRICULTURAL_BURNING = "AGRICULTURAL_BURNING"
    WILDFIRE = "WILDFIRE"
    DEFERRED_FOR_ANALYST = "DEFERRED_FOR_ANALYST"

class AlertSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    WATCH = "WATCH"
    INFO = "INFO"

class HotspotBase(BaseModel):
    latitude: float
    longitude: float
    brightness_temp_kelvin: float
    frp_megawatts: float
    confidence_pct: int
    satellite_source: str
    day_night: str
    acq_datetime: datetime

class HotspotEvent(HotspotBase):
    id: str
    h3_index: str
    classification: ThermalClassification
    confidence_score: float
    cde_anomaly_score: Optional[float] = None
    facility_name: Optional[str] = None
    facility_type: Optional[str] = None
    distance_to_facility_km: Optional[float] = None
    is_critical_alert: bool = False
    agent_reasoning: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

class FacilityItem(BaseModel):
    id: str
    osm_id: str
    name: str
    facility_type: str
    operator: Optional[str] = None
    state: str
    district: str
    latitude: float
    longitude: float
    baseline_frp_mean: float
    baseline_frp_std: float
    active_hotspots_count: int = 0

class SystemStatus(BaseModel):
    status: str
    version: str
    uptime_seconds: float
    active_hotspots_24h: int
    critical_alerts_24h: int
    monitored_facilities: int
    data_sources: Dict[str, str]
