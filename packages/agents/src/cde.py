"""
CDE — Co-location Disambiguation Engine
========================================
The hardest problem: distinguishing a persistent industrial flare from an
accidental industrial fire at the same facility, which share the same GPS
coordinates, the same satellite pixel, and often the same FRP range.

CDE solves this with a thermodynamic Z-score fingerprint delta:
  CDE_score = w1·Z_FRP + w2·Z_BT + w3·Z_diurnal + w4·Z_persistence

Where each Z is computed against the 30-day facility baseline. A flare stack
is thermodynamically stable — FRP and BT stay in a narrow band. An
accidental fire is thermodynamically unstable — FRP spikes, BT surges,
diurnal patterns break.
"""

from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class FacilityBaseline:
    """30-day rolling FRP/BT profile for a single facility."""
    facility_id: str
    facility_name: str
    facility_type: str
    frp_mean: float
    frp_std: float
    bt_mean: float
    bt_std: float
    observation_count: int = 0
    day_night_ratio: float = 0.94  # 0.94 means 24/7 operation (industrial flare)


@dataclass
class CDEInput:
    """Observation to be evaluated by CDE."""
    frp_mw: float
    brightness_temp_k: float
    day_night: str  # "D" or "N"
    hotspots_per_day: int = 4  # Hotspots in H3 cell over last 24h


@dataclass
class CDEOutput:
    """CDE verdict with all component scores and severity tier."""
    cde_score: float
    z_frp: float
    z_bt: float
    diurnal_anomaly: float
    severity: str  # NORMAL, WATCH, WARNING, CRITICAL
    verdict: str
    persist_score: float = 0.0


class CoDisambiguationEngine:
    """
    Quantifies the deviation between an observed thermal event and the
    facility's 30-day baseline fingerprint. Returns a severity tier:
      NORMAL    (CDE < 0.3)  — Persistent Industrial Flare
      WATCH     (0.3 ≤ CDE < 0.7) — Elevated but within 2σ
      WARNING   (0.7 ≤ CDE < 0.9) — Significant deviation (2-4σ)
      CRITICAL  (CDE ≥ 0.9)   — Catastrophic deviation (>4σ)
    """

    # Z-score weights (sum to 1.0)
    W_ZFRP = 0.45
    W_ZBT = 0.30
    W_DIURNAL = 0.15
    W_PERSIST = 0.10

    # Severity thresholds on raw CDE score (sum of |Z| weighted)
    THRESHOLD_CRITICAL = 4.0
    THRESHOLD_WARNING = 2.5
    THRESHOLD_WATCH = 1.0

    def __init__(self, baseline: FacilityBaseline):
        self.baseline = baseline

    def _z_score(self, observed: float, mu: float, sigma: float) -> float:
        if sigma <= 0:
            return 0.0
        return (observed - mu) / sigma

    def _diurnal_score(self, day_night: str) -> float:
        """
        Score 0.0–1.0 indicating how anomalous the day/night observation is
        for this facility type. Industrial flares have day_night_ratio ~0.94
        (nearly 24/7), so nighttime observations are NOT anomalous for them.
        """
        baseline_ratio = self.baseline.day_night_ratio
        if day_night == "N":
            return max(0.0, 1.0 - baseline_ratio)
        else:
            return 0.0 if baseline_ratio > 0.8 else 0.5

    def _persistence_score(self, hotspots_per_day: int) -> float:
        """
        Persistence score (0.0-1.0): how suspicious is the high count of
        observations in a short period? A flare stack has 1-4 observations
        per satellite pass (VIIRS has 2 overpasses/day); a sustained fire
        has many clustered events over multiple overpasses.

        hotspots_per_day: number of FIRMS hotspots detected in the H3 cell
        over the last 24 hours.
        """
        if hotspots_per_day <= 4:
            return 0.0
        elif hotspots_per_day <= 12:
            return 0.3
        else:
            return 0.9

    def evaluate(self, cde_input: CDEInput) -> CDEOutput:
        z_frp = self._z_score(cde_input.frp_mw, self.baseline.frp_mean, self.baseline.frp_std)
        z_bt = self._z_score(cde_input.brightness_temp_k, self.baseline.bt_mean, self.baseline.bt_std)
        diurnal = self._diurnal_score(cde_input.day_night)
        persist = self._persistence_score(cde_input.hotspots_per_day)

        # Only positive FRP/BT deviation counts as anomalous (fires heat UP, not down).
        # Negative Z means cooler than baseline — equipment shutdown or natural cooling,
        # not a runaway fire. We do NOT penalize that direction.
        z_frp_positive = max(0.0, z_frp)
        z_bt_positive = max(0.0, z_bt)

        # Combined CDE score (raw sum of |Z| weighted)
        cde_raw = (
            self.W_ZFRP * z_frp_positive +
            self.W_ZBT * z_bt_positive +
            self.W_DIURNAL * (diurnal * 5.0) +  # scale to Z-equivalent
            self.W_PERSIST * (persist * 5.0)
        )

        # Normalize to 0.0-1.0 for tier classification
        cde_normalized = min(1.0, cde_raw / 5.0)

        # Severity tier
        if cde_raw >= self.THRESHOLD_CRITICAL:
            severity = "CRITICAL"
            verdict = "INDUSTRIAL_FIRE_EMERGENCY_CONFIRMED"
        elif cde_raw >= self.THRESHOLD_WARNING:
            severity = "WARNING"
            verdict = "ANOMALOUS_DEVIATION_REVIEW_REQUIRED"
        elif cde_raw >= self.THRESHOLD_WATCH:
            severity = "WATCH"
            verdict = "ELEVATED_MONITOR_CLOSELY"
        else:
            severity = "NORMAL"
            verdict = "PERSISTENT_INDUSTRIAL_FLARE"

        return CDEOutput(
            cde_score=round(cde_raw, 3),
            z_frp=round(z_frp, 3),
            z_bt=round(z_bt, 3),
            diurnal_anomaly=round(diurnal, 3),
            severity=severity,
            verdict=verdict,
            persist_score=round(persist, 3),
        )
