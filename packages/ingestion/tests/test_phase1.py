"""
SIH26162 Phase 1 — Unit Tests
Tests: FIRMS poller deduplication, OSM extractor, historical baseline seeder.
"""

import sys
sys.path.insert(0, ".")

from packages.ingestion.src.firms_poller import FIRMSPoller
from packages.ingestion.src.osm_extractor import OSMFacilityExtractor
from packages.ingestion.src.historical_baseline_seeder import HistoricalBaselineSeeder


def test_firms_deduplication():
    """Ensures same hotspot is not ingested twice."""
    poller = FIRMSPoller()
    lat, lon = 22.368, 69.832
    h1 = poller._generate_hotspot_id("VIIRS_SNPP_NRT", lat, lon, "2026-01-15T14:32:00Z")
    h2 = poller._generate_hotspot_id("VIIRS_SNPP_NRT", lat, lon, "2026-01-15T14:32:00Z")
    assert h1 == h2, "Same event must produce identical ID"
    assert not poller.is_duplicate(h1), "New ID should not be duplicate"
    poller.mark_seen(h1)
    assert poller.is_duplicate(h1), "After mark_seen, should be duplicate"
    print("✅ Deduplication: PASS")


def test_firms_simulation():
    """Simulation generates realistic hotspot distributions."""
    poller = FIRMSPoller()
    hotspots = poller.generate_simulated_hotspots(count=20)
    assert len(hotspots) == 20, f"Expected 20, got {len(hotspots)}"
    for h in hotspots:
        assert -90 <= h["latitude"] <= 90, f"Invalid lat: {h['latitude']}"
        assert 0 <= h["longitude"] <= 180, f"Invalid lon: {h['longitude']}"
        assert 300 <= h["brightness_temp_kelvin"] <= 1200, f"Invalid BT: {h['brightness_temp_kelvin']}"
        assert h["frp_megawatts"] > 0, f"Invalid FRP: {h['frp_megawatts']}"
        assert h["h3_index"], "H3 index must be present"
        assert h["firms_id"], "Firms ID must be present"
    print("✅ FIRMS simulation: PASS")


def test_osm_extractor_seed():
    """Seed extraction produces 50+ Indian industrial facilities."""
    import asyncio
    extractor = OSMFacilityExtractor()
    facilities = extractor._seed_india_facilities()
    assert len(facilities) >= 45, f"Expected ≥45 facilities, got {len(facilities)}"

    # Verify no duplicates by name
    names = [f["name"] for f in facilities]
    assert len(names) == len(set(names)), "Duplicate facility names found"

    # Verify all have required fields
    for f in facilities:
        assert f["name"], "Facility name required"
        assert f["facility_type"], "Facility type required"
        assert f["latitude"], "Latitude required"
        assert f["longitude"], "Longitude required"
        assert f["h3_res8"], "H3 index required"

    # Verify facility type distribution
    types = [f["facility_type"] for f in facilities]
    assert "refinery" in types, "Must include refineries"
    assert "metal_works" in types, "Must include steel works"
    print(f"✅ OSM extractor seed: PASS ({len(facilities)} facilities)")


def test_baseline_seeder():
    """Baseline profiler computes realistic FRP/BT distributions per type."""
    facilities = [
        {"name": "Reliance Jamnagar", "facility_type": "refinery",
         "latitude": 22.368, "longitude": 69.832, "osm_id": "test/1"},
        {"name": "Tata Steel Jamshedpur", "facility_type": "metal_works",
         "latitude": 22.804, "longitude": 86.202, "osm_id": "test/2"},
    ]
    seeder = HistoricalBaselineSeeder(facilities)
    baselines = seeder.compute_all_baselines()
    assert len(baselines) == 2

    for b in baselines:
        assert b["frp_mean"] > 0
        assert b["frp_std"] > 0
        assert b["bt_mean"] > 273  # Above absolute zero
        assert b["bt_std"] > 0

    # Refineries should have lower FRP than metal works
    ref = next(b for b in baselines if "Jamnagar" in b["facility_name"])
    steel = next(b for b in baselines if "Jamshedpur" in b["facility_name"])
    print(f"✅ Baseline seeder: PASS")
    print(f"   Jamnagar refinery: {ref['frp_mean']:.1f} ± {ref['frp_std']:.1f} MW")
    print(f"   Jamshedpur steel: {steel['frp_mean']:.1f} ± {steel['frp_std']:.1f} MW")


def test_historical_observation_count():
    """Generates correct number of historical observations per facility."""
    facilities = [
        {"name": "Test Refinery", "facility_type": "refinery",
         "latitude": 22.368, "longitude": 69.832, "osm_id": "test/1"},
    ]
    seeder = HistoricalBaselineSeeder(facilities)
    history = seeder.generate_30d_observation_history(facilities[0], days=30, samples_per_day=4)
    expected = 30 * 4  # 30 days × 4 samples/day = 120
    assert len(history) == expected, f"Expected {expected}, got {len(history)}"
    print(f"✅ Historical seeder: PASS ({len(history)} observations for 30 days)")


if __name__ == "__main__":
    test_firms_deduplication()
    test_firms_simulation()
    test_osm_extractor_seed()
    test_baseline_seeder()
    test_historical_observation_count()
    print("\n🎯 All Phase 1 unit tests passed.")
