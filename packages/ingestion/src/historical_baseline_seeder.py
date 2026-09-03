"""
Historical Baseline Seeder
============================
Generates 30-day synthetic historical thermal baseline per Indian industrial
facility. Used to bootstrap the CDE (Co-location Disambiguation Engine)
during the first 30 days of deployment (Strategy G4: Temporal Bootstrap).
"""

import random
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
import os

try:
    import h3 as _h3
except ImportError:
    _h3 = None


class HistoricalBaselineSeeder:
    """
    Pre-computes 30-day thermal baseline statistics (mean, std) for each
    Indian industrial facility in the seed set.

    In production, this would be replaced by:
      SELECT h3_index,
             AVG(frp_megawatts), STDDEV(frp_megawatts)
      FROM thermal_hotspots
      WHERE acq_datetime >= NOW() - INTERVAL '30 days'
      GROUP BY h3_index
    """

    # Realistic baseline FRP (MW) by facility type
    BASELINE_PROFILES = {
        "refinery": (140.0, 18.0, 815.0, 9.0),       # mu_frp, sigma_frp, mu_bt, sigma_bt
        "chemical": (95.0, 12.0, 760.0, 8.0),
        "metal_works": (210.0, 24.0, 880.0, 11.0),
        "cement": (175.0, 22.0, 860.0, 10.0),
        "gas_processing": (125.0, 15.0, 795.0, 8.5),
        "power_plant": (320.0, 35.0, 720.0, 7.0),
        "flare": (85.0, 9.0, 920.0, 12.0),
        "industrial_other": (110.0, 14.0, 780.0, 9.0),
    }

    def __init__(self, facilities: List[Dict[str, Any]]):
        self.facilities = facilities

    def compute_all_baselines(self) -> List[Dict[str, Any]]:
        """
        Returns list of {facility_id, frp_mean, frp_std, bt_mean, bt_std}.
        """
        baselines = []
        for f in self.facilities:
            profile = self.BASELINE_PROFILES.get(
                f.get("facility_type", "industrial_other"),
                self.BASELINE_PROFILES["industrial_other"]
            )
            mu_frp, sigma_frp, mu_bt, sigma_bt = profile
            baselines.append({
                "facility_id": f.get("id", hashlib.md5(f["name"].encode()).hexdigest()),
                "facility_name": f["name"],
                "facility_type": f.get("facility_type", "industrial_other"),
                "frp_mean": round(mu_frp, 2),
                "frp_std": round(sigma_frp, 2),
                "bt_mean": round(mu_bt, 2),
                "bt_std": round(sigma_bt, 2),
            })
        return baselines

    def generate_30d_observation_history(
        self, facility: Dict[str, Any], days: int = 30, samples_per_day: int = 4
    ) -> List[Dict[str, Any]]:
        """
        Generates 30 days of synthetic thermal observations for a facility.
        Used to populate the historical archive during initial deployment.
        """
        profile = self.BASELINE_PROFILES.get(
            facility.get("facility_type", "industrial_other"),
            self.BASELINE_PROFILES["industrial_other"]
        )
        mu_frp, sigma_frp, mu_bt, sigma_bt = profile

        lat = facility["latitude"]
        lon = facility["longitude"]
        h3_idx = self._compute_h3(lat, lon)

        history = []
        now = datetime.now(timezone.utc)
        for day in range(days):
            day_dt = now - timedelta(days=day)
            for sample in range(samples_per_day):
                # Spread over 24 hours
                hour = (sample * 6 + random.randint(0, 3)) % 24
                timestamp = day_dt.replace(hour=hour, minute=random.randint(0, 59))
                
                # Day vs Night effect
                is_night = hour < 6 or hour > 19
                # Persistent flares show nighttime activity
                if facility.get("facility_type") == "flare":
                    frp = random.gauss(mu_frp, sigma_frp)
                    bt = random.gauss(mu_bt, sigma_bt)
                else:
                    if is_night and facility.get("facility_type") in ("refinery", "metal_works"):
                        # Industrial runs 24/7
                        frp = random.gauss(mu_frp, sigma_frp)
                        bt = random.gauss(mu_bt, sigma_bt)
                    elif is_night:
                        # Non-persistent drops at night
                        frp = random.gauss(mu_frp * 0.3, sigma_frp)
                        bt = random.gauss(mu_bt - 50, sigma_bt)
                    else:
                        frp = random.gauss(mu_frp, sigma_frp)
                        bt = random.gauss(mu_bt, sigma_bt)

                history.append({
                    "firms_id": f"hist-{facility.get('osm_id', 'unk')}-{day}-{sample}",
                    "latitude": round(lat + random.uniform(-0.005, 0.005), 5),
                    "longitude": round(lon + random.uniform(-0.005, 0.005), 5),
                    "h3_index": h3_idx,
                    "brightness_temp_kelvin": round(max(300.0, bt), 1),
                    "frp_megawatts": round(max(2.0, frp), 1),
                    "confidence_pct": random.randint(85, 99),
                    "satellite_source": random.choice(["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"]),
                    "day_night": "N" if is_night else "D",
                    "scan_angle": round(random.uniform(0.1, 1.0), 2),
                    "track_pixel": round(random.uniform(0.1, 1.0), 2),
                    "acq_datetime": timestamp.isoformat(),
                    "created_at": timestamp.isoformat(),
                })
        return history

    def _compute_h3(self, lat: float, lon: float) -> str:
        if _h3 is not None:
            return _h3.latlng_to_cell(lat, lon, res=8)
        return f"88619a{int(abs(lat)*100):06d}{int(abs(lon)*100):06d}"
