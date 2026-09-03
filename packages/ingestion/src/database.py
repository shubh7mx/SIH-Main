"""
Async PostGIS Database Client
==============================
Asyncpg-based PostgreSQL 17 + PostGIS 3.6 client for the SIH26162 spatial database.
Handles: hotspot ingestion, facility upsert, spatial queries, baseline retrieval.
"""

import os
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import asyncpg


class SpatialDB:
    def __init__(
        self,
        database_url: Optional[str] = None,
        min_connections: int = 2,
        max_connections: int = 10,
    ):
        self.database_url = database_url or os.getenv(
            "DATABASE_URL",
            "postgresql://sih_user:sih_secret_2026@localhost:5432/sih26162_spatial"
        )
        self.min_connections = min_connections
        self.max_connections = max_connections
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        """Initializes the asyncpg connection pool."""
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                self.database_url,
                min_size=self.min_connections,
                max_size=self.max_connections,
                command_timeout=30.0,
            )
            print("[SpatialDB] Connection pool established.")

    async def disconnect(self):
        """Closes the connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            print("[SpatialDB] Connection pool closed.")

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()

    # ─── Hotspot Ingestion ──────────────────────────────────────────────

    async def ingest_hotspots(self, hotspots: List[Dict[str, Any]]) -> int:
        """
        Bulk-upserts thermal hotspots into the `thermal_hotspots` table.
        Returns the number of rows inserted/updated.
        """
        if not self._pool or not hotspots:
            return 0

        async with self._pool.acquire() as conn:
            await conn.execute("SET search_path TO public, postgis")

            rows = [
                {
                    "firms_id": h["firms_id"],
                    "latitude": h["latitude"],
                    "longitude": h["longitude"],
                    "geom": conn.geom if hasattr(conn, 'geom') else f"SRID=4326;POINT({h['longitude']} {h['latitude']})",
                    "h3_index": h["h3_index"],
                    "brightness_temp_kelvin": h["brightness_temp_kelvin"],
                    "frp_megawatts": h["frp_megawatts"],
                    "confidence_pct": h["confidence_pct"],
                    "satellite_source": h["satellite_source"],
                    "day_night": h["day_night"],
                    "scan_angle": h.get("scan_angle"),
                    "track_pixel": h.get("track_pixel"),
                    "acq_datetime": h["acq_datetime"],
                }
                for h in hotspots
            ]

            # Use ON CONFLICT to upsert (ignore duplicates)
            query = """
            INSERT INTO thermal_hotspots
                (firms_id, latitude, longitude, geom, h3_index,
                 brightness_temp_kelvin, frp_megawatts, confidence_pct,
                 satellite_source, day_night, scan_angle, track_pixel, acq_datetime)
            VALUES
                ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6,
                 $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (firms_id) DO UPDATE SET
                frp_megawatts = EXCLUDED.frp_megawatts,
                brightness_temp_kelvin = EXCLUDED.brightness_temp_kelvin,
                confidence_pct = EXCLUDED.confidence_pct
            """
            async with conn.transaction():
                results = await conn.executemany(query, [
                    (
                        r["firms_id"],
                        r["latitude"],
                        r["longitude"],
                        r["longitude"],
                        r["latitude"],
                        r["h3_index"],
                        r["brightness_temp_kelvin"],
                        r["frp_megawatts"],
                        r["confidence_pct"],
                        r["satellite_source"],
                        r["day_night"],
                        r["scan_angle"],
                        r["acq_datetime"],
                    )
                    for r in rows
                ])
            return len(hotspots)

    # ─── Facility Ingestion ───────────────────────────────────────────

    async def upsert_facilities(self, facilities: List[Dict[str, Any]]) -> int:
        """Bulk-upserts industrial facilities into the `industrial_facilities` table."""
        if not self._pool or not facilities:
            return 0

        async with self._pool.acquire() as conn:
            async with conn.transaction():
                for f in facilities:
                    await conn.execute("""
                    INSERT INTO industrial_facilities
                        (osm_id, name, facility_type, operator, state, district,
                         geom, centroid, h3_res8, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6,
                            ST_SetSRID(ST_MakePoint($8, $7), 4326),
                            ST_SetSRID(ST_MakePoint($8, $7), 4326),
                            $9, NOW())
                    ON CONFLICT (osm_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        updated_at = NOW()
                    """,
                        f["osm_id"], f["name"], f["facility_type"],
                        f.get("operator", ""), f.get("state", ""), f.get("district", ""),
                        f["latitude"], f["longitude"], f["h3_res8"]
                    )
            return len(facilities)

    # ─── Spatial Queries ────────────────────────────────────────────────

    async def find_nearest_facility(
        self, lat: float, lon: float, max_km: float = 10.0
    ) -> Optional[Dict[str, Any]]:
        """
        Finds the nearest industrial facility within max_km using PostGIS
        ST_DWithin (geography) for accurate great-circle distance.
        """
        if not self._pool:
            return None

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("""
            SELECT
                id, osm_id, name, facility_type, operator, state, district,
                ST_Distance(
                    ST_MakePoint($2, $1)::geography,
                    centroid::geography
                ) / 1000.0 AS distance_km
            FROM industrial_facilities
            WHERE ST_DWithin(
                centroid::geography,
                ST_MakePoint($2, $1)::geography,
                $3 * 1000
            )
            ORDER BY centroid::geography <-> ST_MakePoint($2, $1)::geography
            LIMIT 1
            """, lat, lon, max_km)

            if row:
                return dict(row)
            return None

    async def get_facilities_by_h3(self, h3_index: str) -> List[Dict[str, Any]]:
        """Returns all facilities within an H3 cell (r8)."""
        if not self._pool:
            return []

        async with self._pool.acquire() as conn:
            rows = await conn.fetch("""
            SELECT id, osm_id, name, facility_type, operator, state, district,
                   ST_X(centroid) AS longitude, ST_Y(centroid) AS latitude,
                   baseline_frp_mean, baseline_frp_std,
                   baseline_bt_mean, baseline_bt_std
            FROM industrial_facilities
            WHERE h3_res8 = $1
            """, h3_index)
            return [dict(r) for r in rows]

    async def get_hotspots_24h(self, limit: int = 500) -> List[Dict[str, Any]]:
        """Returns hotspots from the last 24 hours."""
        if not self._pool:
            return []

        async with self._pool.acquire() as conn:
            rows = await conn.fetch("""
            SELECT id, firms_id, latitude, longitude, h3_index,
                   brightness_temp_kelvin, frp_megawatts, confidence_pct,
                   satellite_source, day_night, acq_datetime, created_at
            FROM thermal_hotspots
            WHERE acq_datetime >= NOW() - INTERVAL '24 hours'
            ORDER BY acq_datetime DESC
            LIMIT $1
            """, limit)
            return [dict(r) for r in rows]

    # ─── Baseline Retrieval ─────────────────────────────────────────────

    async def get_facility_baseline(self, facility_id: str) -> Optional[Dict[str, float]]:
        """
        Retrieves the 30-day FRP/BT baseline (mean, std) for a facility.
        Used by the Temporal Agent to compute Z-score deviation.
        """
        if not self._pool:
            return None

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("""
            SELECT
                baseline_frp_mean,
                baseline_frp_std,
                baseline_bt_mean,
                baseline_bt_std
            FROM industrial_facilities
            WHERE id = $1
            """, facility_id)

            if row and row["baseline_frp_mean"] is not None:
                return {
                    "frp_mean": float(row["baseline_frp_mean"]),
                    "frp_std": float(row["baseline_frp_std"] or 0.0),
                    "bt_mean": float(row["baseline_bt_mean"]),
                    "bt_std": float(row["baseline_bt_std"] or 0.0),
                }
            return None

    async def update_facility_baseline(
        self,
        facility_id: str,
        frp_mean: float,
        frp_std: float,
        bt_mean: float,
        bt_std: float,
    ) -> None:
        """Updates the rolling baseline for a facility."""
        if not self._pool:
            return

        async with self._pool.acquire() as conn:
            await conn.execute("""
            UPDATE industrial_facilities
            SET baseline_frp_mean = $2,
                baseline_frp_std = $3,
                baseline_bt_mean = $4,
                baseline_bt_std = $5,
                updated_at = NOW()
            WHERE id = $1
            """, facility_id, frp_mean, frp_std, bt_mean, bt_std)
