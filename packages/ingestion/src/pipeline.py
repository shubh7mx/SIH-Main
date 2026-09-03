"""
SIH26162 Phase 1 — End-to-End Ingestion Pipeline Runner
=========================================================
CLI tool that orchestrates the complete real-time data pipeline:
  1. Polls NASA FIRMS NRT API (async, every 10 min)
  2. Extracts OSM industrial facilities (India)
  3. Seeds historical baselines (50+ facilities)
  4. Ingest hotspots into PostGIS
  5. Ingest facilities into PostGIS

Usage:
  python -m packages.ingestion.src.pipeline run --poll-interval 600
  python -m packages.ingestion.src.pipeline seed-baselines
  python -m packages.ingestion.src.pipeline ingest-firms --count 20
"""

import asyncio
import argparse
import sys
from datetime import datetime, timezone

# Add package to path
sys.path.insert(0, ".")

from packages.ingestion.src.firms_poller import FIRMSPoller
from packages.ingestion.src.osm_extractor import OSMFacilityExtractor
from packages.ingestion.src.historical_baseline_seeder import HistoricalBaselineSeeder
from packages.ingestion.src.database import SpatialDB
from packages.ingestion.src.risingwave_streaming import RisingWaveStreaming


async def seed_facilities():
    """Extracts OSM facilities and ingests them into PostGIS."""
    print(f"[{timestamp()}] === Seed: OSM Industrial Facilities ===")
    extractor = OSMFacilityExtractor()
    facilities = await extractor.fetch_facilities()
    print(f"[{timestamp()}] Extracted {len(facilities)} facilities from OSM/seed")

    try:
        async with SpatialDB() as db:
            count = await db.upsert_facilities(facilities)
            print(f"[{timestamp()}] ✅ Inserted {count} facilities into PostGIS")
    except Exception as e:
        print(f"[{timestamp()}] ⚠️  PostGIS not available ({e}) — facilities cached in memory")

    return facilities


async def seed_historical_baselines(facilities):
    """Generates 30-day historical observation history for all facilities."""
    print(f"[{timestamp()}] === Seed: Historical Baselines ===")
    seeder = HistoricalBaselineSeeder(facilities)
    baselines = seeder.compute_all_baselines()
    print(f"[{timestamp()}] Computed baselines for {len(baselines)} facilities")

    all_history = []
    for f in facilities:
        # Convert facility dict to match seeder's expected format
        facility_record = {
            "name": f["name"],
            "facility_type": f["facility_type"],
            "latitude": f["latitude"],
            "longitude": f["longitude"],
            "osm_id": f["osm_id"],
        }
        history = seeder.generate_30d_observation_history(facility_record, days=30, samples_per_day=4)
        all_history.extend(history)

    print(f"[{timestamp()}] Generated {len(all_history)} synthetic historical observations")

    try:
        async with SpatialDB() as db:
            count = await db.ingest_hotspots(all_history)
            print(f"[{timestamp()}] ✅ Ingested {count} historical observations into PostGIS")
    except Exception as e:
        print(f"[{timestamp()}] ⚠️  PostGIS not available ({e}) — skipping historical ingest")

    return baselines


async def poll_and_ingest_hotspots(count: int = 20):
    """Polls FIRMS API and ingests hotspots into PostGIS."""
    print(f"[{timestamp()}] === Poll: NASA FIRMS NRT Ingestion ===")
    poller = FIRMSPoller()
    hotspots = await poller.fetch_live_firms(day_range=1)
    print(f"[{timestamp()}] Fetched {len(hotspots)} hotspots from FIRMS API / simulation")

    if not hotspots:
        print(f"[{timestamp()}] ⚠️  No hotspots returned from FIRMS")
        return []

    # Optionally limit count
    if count and count > 0:
        hotspots = hotspots[:count]

    # Show distribution
    by_source = {}
    for h in hotspots:
        src = h["satellite_source"]
        by_source[src] = by_source.get(src, 0) + 1
    print(f"[{timestamp()}] Source distribution: {by_source}")

    try:
        async with SpatialDB() as db:
            ingested_count = await db.ingest_hotspots(hotspots)
            print(f"[{timestamp()}] ✅ Ingested {ingested_count} hotspots into PostGIS")
    except Exception as e:
        print(f"[{timestamp()}] ⚠️  PostGIS not available ({e}) — hotspots in memory only")

    return hotspots


async def show_risingwave_schema():
    """Prints the RisingWave streaming SQL schema."""
    print(f"[{timestamp()}] === RisingWave Streaming Schema ===")
    rw = RisingWaveStreaming()
    for sql in rw.get_initialization_sql():
        print(sql)
        print("--")


async def run_pipeline_continuous(poll_interval: int = 600):
    """
    Runs the full pipeline continuously.
    - Polls FIRMS every `poll_interval` seconds
    - Ingest facilities once on startup
    """
    print(f"[{timestamp()}] SIH26162 Phase 1 — Continuous Pipeline Starting")
    print(f"[{timestamp()}] Poll interval: {poll_interval}s ({poll_interval//60} min)")

    facilities = await seed_facilities()
    await seed_historical_baselines(facilities)

    print(f"[{timestamp()}] Facilities seeded. Entering FIRMS poll loop...")
    poller = FIRMSPoller(poll_interval_seconds=poll_interval)

    poll_count = 0
    while True:
        poll_count += 1
        print(f"\n[{timestamp()}] --- Poll #{poll_count} ---")
        hotspots = await poller.fetch_live_firms(day_range=1)
        print(f"[{timestamp()}] {len(hotspots)} hotspots detected")

        try:
            async with SpatialDB() as db:
                n = await db.ingest_hotspots(hotspots)
                print(f"[{timestamp()}] ✅ {n} hotspots persisted to PostGIS")
        except Exception as e:
            print(f"[{timestamp()}] ⚠️  DB error: {e}")

        print(f"[{timestamp()}] Next poll in {poll_interval}s...")
        await asyncio.sleep(poll_interval)


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S UTC")


def main():
    parser = argparse.ArgumentParser(
        description="SIH26162 Phase 1 — Ingestion Pipeline Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("run", help="Run continuous FIRMS polling loop")
    sub.add_parser("seed-baselines", help="Seed OSM facilities + 30-day historical baselines")
    sub.add_parser("ingest-firms", help="Poll FIRMS once and ingest into PostGIS")
    sub.add_parser("risingwave-schema", help="Print RisingWave streaming SQL schema")
    sub.add_parser("list-sources", help="Show all data sources")

    args = parser.parse_args()

    if args.command == "run":
        asyncio.run(run_pipeline_continuous())
    elif args.command == "seed-baselines":
        async def _seed():
            f = await seed_facilities()
            await seed_historical_baselines(f)
        asyncio.run(_seed())
    elif args.command == "ingest-firms":
        asyncio.run(poll_and_ingest_hotspots(count=20))
    elif args.command == "risingwave-schema":
        asyncio.run(show_risingwave_schema())
    elif args.command == "list-sources":
        print("=== SIH26162 Data Sources ===")
        print("NASA FIRMS         → https://firms.modaps.eosdis.nasa.gov/api/")
        print("OSM Overpass       → https://overpass-api.de/api/interpreter")
        print("ESA WorldCover     → https://worldcover.esa.int/api/")
        print("Copernicus CDSE    → https://dataspace.copernicus.eu/")
        print("ECMWF ERA5         → https://cds.climate.copernicus.eu/")
        print("RisingWave 2.x     → localhost:4566 (PostgreSQL protocol)")


if __name__ == "__main__":
    main()
