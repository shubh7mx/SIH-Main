"""Single test runner."""
import sys
sys.path.insert(0, ".")
from packages.agents.src.graph import run_swarm

hotspot = {
    "firms_id": "evt-002",
    "latitude": 22.031,
    "longitude": 88.082,
    "frp_megawatts": 145.2,
    "brightness_temp_kelvin": 780.0,
    "confidence_pct": 92,
    "satellite_source": "VIIRS_NOAA20_NRT",
    "day_night": "N",
    "acq_datetime": "2026-01-15T03:14:00+00:00",
}
result = run_swarm(hotspot)
print(f"\n\n*** RESULT: classification={result['classification']}, cde={result['cde_anomaly_score']}, is_critical={result['is_critical_alert']}")
