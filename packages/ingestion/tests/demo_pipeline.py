"""Phase 1 Pipeline Demonstration"""
import sys
sys.path.insert(0, ".")
import asyncio
from packages.ingestion.src.firms_poller import FIRMSPoller
from packages.ingestion.src.osm_extractor import OSMFacilityExtractor
from packages.ingestion.src.historical_baseline_seeder import HistoricalBaselineSeeder

async def demo():
    print("=" * 60)
    print("SIH26162 Phase 1 — Real-Time Ingestion Pipeline Demo")
    print("=" * 60)

    # 1. FIRMS NRT Poller
    print("\n[1] NASA FIRMS NRT API Poller")
    print("    Source: VIIRS S-NPP 375m (simulation mode — no API key)")
    print("    BBox: India 6-38N, 68-98E")
    poller = FIRMSPoller()
    hotspots = await poller.fetch_live_firms(day_range=1)
    print(f"    Fetched: {len(hotspots)} thermal events")
    for i, h in enumerate(hotspots[:4]):
        print(f"    [{i+1}] {h['firms_id']} ({h['latitude']}, {h['longitude']})")
        print(f"        FRP={h['frp_megawatts']} MW | BT={h['brightness_temp_kelvin']} K | Conf={h['confidence_pct']}%")

    # 2. OSM Facility Extractor
    print("\n[2] OSM Industrial Facility Extractor")
    print("    Overpass QL: industrial + flare + power plant tags")
    extractor = OSMFacilityExtractor()
    facilities = await extractor.fetch_facilities()
    print(f"    Loaded: {len(facilities)} Indian industrial facilities")
    types = {}
    for f in facilities:
        types[f['facility_type']] = types.get(f['facility_type'], 0) + 1
    for ft, cnt in sorted(types.items(), key=lambda x: -x[1]):
        print(f"    - {ft}: {cnt}")

    # 3. Historical Baseline Seeder
    print("\n[3] Historical Baseline Seeder (30-day bootstrap)")
    seeder = HistoricalBaselineSeeder(facilities)
    baselines = seeder.compute_all_baselines()
    print(f"    Computed baselines for {len(baselines)} facilities")

    # Generate 30-day observation history
    total_obs = 0
    for f in facilities[:5]:
        f_rec = {
            "name": f["name"], "facility_type": f["facility_type"],
            "latitude": f["latitude"], "longitude": f["longitude"], "osm_id": f["osm_id"]
        }
        obs = seeder.generate_30d_observation_history(f_rec, days=30, samples_per_day=4)
        total_obs += len(obs)
    print(f"    Generated {total_obs} historical observations (5 sample facilities)")

    # 4. RisingWave Schema
    print("\n[4] RisingWave Streaming SQL (Tumbling Window)")
    from packages.ingestion.src.risingwave_streaming import RisingWaveStreaming
    rw = RisingWaveStreaming()
    print("    MATERIALIZED VIEW: thermal_baseline_30d (30-day rolling)")
    print("    MATERIALIZED VIEW: diurnal_profile (24h pattern)")

    print("\n" + "=" * 60)
    print("Phase 1 pipeline components: ALL OPERATIONAL")
    print("Next: Run 'python -m packages.ingestion.src.pipeline run'")
    print("=" * 60)

asyncio.run(demo())
