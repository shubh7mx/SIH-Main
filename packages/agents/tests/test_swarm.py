"""
SIH26162 Phase 2 — Multi-Agent Swarm Integration Tests
=====================================================
Tests the complete 6-agent pipeline with known Indian thermal events.
"""

import sys
sys.path.insert(0, ".")

from packages.agents.src.graph import run_swarm, run_batch


def test_jamnagar_critical_fire():
    """Jamnagar petrochemical: +5.8σ deviation → CRITICAL alert."""
    hotspot = {
        "firms_id": "evt-001",
        "latitude": 22.368,
        "longitude": 69.832,
        "frp_megawatts": 842.0,
        "brightness_temp_kelvin": 942.5,
        "confidence_pct": 98,
        "satellite_source": "VIIRS_SNPP_NRT",
        "day_night": "N",
        "acq_datetime": "2026-01-15T14:32:00+00:00",
        "h3_index": "88619a6953fffff",
    }
    result = run_swarm(hotspot)

    assert result["classification"] == "INDUSTRIAL_FIRE_EMERGENCY", (
        f"Expected INDUSTRIAL_FIRE_EMERGENCY, got {result['classification']}"
    )
    assert result["is_critical_alert"] is True, "Jamnagar +5.8σ must be critical"
    assert result["cde_anomaly_score"] > 4.0, f"CDE must be >4σ, got {result['cde_anomaly_score']}"
    assert result["confidence_score"] > 0.85, f"Confidence too low: {result['confidence_score']}"
    assert result["facility_name"] == "Reliance Jamnagar Petrochemical Complex"
    print(f"  ✅ Jamnagar CRITICAL: cde={result['cde_anomaly_score']}σ, conf={result['confidence_score']:.3f}")


def test_haldia_persistent_flare():
    """Haldia refinery: within 1σ → Persistent Flare, INFO."""
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

    assert result["classification"] == "PERSISTENT_INDUSTRIAL_FLARE", (
        f"Expected PERSISTENT_INDUSTRIAL_FLARE, got {result['classification']}"
    )
    assert result["is_critical_alert"] is False, "Haldia within baseline must not be critical"
    assert result["cde_anomaly_score"] < 0.5, f"CDE must be <0.5, got {result['cde_anomaly_score']}"
    print(f"  ✅ Haldia PERSISTENT FLARE: cde={result['cde_anomaly_score']}σ")


def test_punjab_agricultural():
    """Punjab cropland: agricultural burning, not industrial."""
    hotspot = {
        "firms_id": "evt-003",
        "latitude": 30.342,
        "longitude": 75.832,
        "frp_megawatts": 42.0,
        "brightness_temp_kelvin": 365.4,
        "confidence_pct": 88,
        "satellite_source": "VIIRS_SNPP_NRT",
        "day_night": "D",
        "acq_datetime": "2026-01-15T06:22:00+00:00",
    }
    result = run_swarm(hotspot)

    assert result["classification"] in ("AGRICULTURAL_BURNING", "WILDFIRE"), (
        f"Expected AGRICULTURAL_BURNING or WILDFIRE, got {result['classification']}"
    )
    assert result["facility_name"] is None, "No industrial facility near Punjab cropland"
    assert result["is_critical_alert"] is False
    print(f"  ✅ Punjab agricultural: {result['classification']}, conf={result['confidence_score']:.3f}")


def test_uttarakhand_wildfire():
    """Uttarakhand forest: wildfire, not industrial."""
    hotspot = {
        "firms_id": "evt-004",
        "latitude": 30.082,
        "longitude": 79.241,
        "frp_megawatts": 68.5,
        "brightness_temp_kelvin": 412.0,
        "confidence_pct": 85,
        "satellite_source": "VIIRS_SNPP_NRT",
        "day_night": "D",
        "acq_datetime": "2026-01-15T10:05:00+00:00",
    }
    result = run_swarm(hotspot)

    assert result["classification"] in ("WILDFIRE", "AGRICULTURAL_BURNING"), (
        f"Expected WILDFIRE, got {result['classification']}"
    )
    assert result["is_critical_alert"] is False
    print(f"  ✅ Uttarakhand wildfire: {result['classification']}")


def test_batch_processing():
    """Processes 10 hotspots in batch through the full pipeline."""
    hotspots = [
        {"firms_id": f"batch-{i}", "latitude": 22.368, "longitude": 69.832,
         "frp_megawatts": 800.0 + i * 10, "brightness_temp_kelvin": 920.0 + i * 2,
         "confidence_pct": 95, "satellite_source": "VIIRS_SNPP_NRT", "day_night": "N"}
        for i in range(5)
    ]
    hotspots += [
        {"firms_id": f"batch-{i}", "latitude": 30.342, "longitude": 75.832,
         "frp_megawatts": 40.0, "brightness_temp_kelvin": 365.0,
         "confidence_pct": 88, "satellite_source": "VIIRS_SNPP_NRT", "day_night": "D"}
        for i in range(5, 10)
    ]

    results = run_batch(hotspots)
    assert len(results) == 10

    industrial = [r for r in results if r["classification"] == "INDUSTRIAL_FIRE_EMERGENCY"]
    agri = [r for r in results if r["classification"] == "AGRICULTURAL_BURNING"]

    assert len(industrial) == 5, f"Expected 5 industrial fires, got {len(industrial)}"
    assert len(agri) >= 3, f"Expected ≥3 agricultural events, got {len(agri)}"
    print(f"  ✅ Batch: {len(industrial)} industrial, {len(agri)} agricultural")


def test_cde_threshold_boundary():
    """Tests the CDE threshold at boundary conditions."""
    # Jamnagar at exactly 4σ threshold
    hotspot_critical = {
        "firms_id": "boundary-1", "latitude": 22.368, "longitude": 69.832,
        "frp_megawatts": 860.0, "brightness_temp_kelvin": 930.0,
        "confidence_pct": 98, "satellite_source": "VIIRS_SNPP_NRT", "day_night": "N"
    }
    result = run_swarm(hotspot_critical)
    assert result["is_critical_alert"] is True, "4σ must trigger CRITICAL"
    print(f"  ✅ CDE boundary: {result['cde_anomaly_score']}σ → {result['classification']}")

    # Jamnagar at 2σ (within operational range)
    hotspot_normal = {
        "firms_id": "boundary-2", "latitude": 22.368, "longitude": 69.832,
        "frp_megawatts": 175.0, "brightness_temp_kelvin": 830.0,
        "confidence_pct": 92, "satellite_source": "VIIRS_SNPP_NRT", "day_night": "N"
    }
    result2 = run_swarm(hotspot_normal)
    assert result2["is_critical_alert"] is False, "2σ must NOT be critical"
    assert result2["classification"] in ("PERSISTENT_INDUSTRIAL_FLARE", "INDUSTRIAL_FIRE_EMERGENCY")
    print(f"  ✅ CDE normal: {result2['cde_anomaly_score']}σ → {result2['classification']}")


if __name__ == "__main__":
    print("\n═══════════════════════════════════════════════")
    print("SIH26162 Phase 2 — Multi-Agent Swarm Tests")
    print("═══════════════════════════════════════════════")

    print("\n[1] Jamnagar Critical Fire")
    test_jamnagar_critical_fire()

    print("\n[2] Haldia Persistent Flare")
    test_haldia_persistent_flare()

    print("\n[3] Punjab Agricultural Burning")
    test_punjab_agricultural()

    print("\n[4] Uttarakhand Wildfire")
    test_uttarakhand_wildfire()

    print("\n[5] Batch Processing (10 events)")
    test_batch_processing()

    print("\n[6] CDE Threshold Boundaries")
    test_cde_threshold_boundary()

    print("\n" + "=" * 51)
    print("🎯 All Phase 2 swarm tests passed.")
    print("=" * 51)
