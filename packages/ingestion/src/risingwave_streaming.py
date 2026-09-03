"""
RisingWave 2.x Streaming SQL Manager
======================================
Manages RisingWave stream processing schemas, materialized views, and
continuous aggregation queries for the 30-day thermal baseline.

In production, RisingWave consumes from the `raw-thermal` Kafka topic
(published by the FIRMS poller via Redpanda) and materializes the rolling
baseline per H3 cell, which the Temporal Agent queries for Z-score computation.
"""

import os
from typing import List, Dict, Any, Optional


class RisingWaveStreaming:
    """
    Manages RisingWave stream processing schemas for thermal anomaly
    temporal baseline aggregation.

    In production, this connects via asyncpg to RisingWave's PostgreSQL
    protocol at port 4566.
    """

    # Streaming SQL: 30-day rolling window aggregation per H3 cell
    CREATE_MV_30D_BASELINE = """
    CREATE MATERIALIZED VIEW IF NOT EXISTS thermal_baseline_30d AS
    SELECT
        h3_index,
        satellite_source,
        COUNT(*) AS observation_count,
        AVG(frp_megawatts) AS frp_mean,
        STDDEV(frp_megawatts) AS frp_std,
        AVG(brightness_temp_kelvin) AS bt_mean,
        STDDEV(brightness_temp_kelvin) AS bt_std,
        MAX(frp_megawatts) AS frp_max,
        MIN(brightness_temp_kelvin) AS bt_min
    FROM thermal_hotspots_stream
    WHERE acq_datetime >= NOW() - INTERVAL '30 days'
    GROUP BY h3_index, satellite_source;
    """

    # Stream source: bind to Redpanda/Kafka topic
    CREATE_SOURCE = """
    CREATE SOURCE IF NOT EXISTS thermal_hotspots_source (
        firms_id VARCHAR,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        h3_index VARCHAR,
        brightness_temp_kelvin REAL,
        frp_megawatts REAL,
        confidence_pct SMALLINT,
        satellite_source VARCHAR,
        day_night VARCHAR,
        acq_datetime TIMESTAMPTZ,
        created_at TIMESTAMPTZ
    ) WITH (
        connector = 'kafka',
        kafka.brokers = 'redpanda:9092',
        kafka.topic = 'raw-thermal-hotspots',
        kafka.scan.startup.mode = 'latest'
    ) FORMAT PLAIN ENCODE JSON;
    """

    # Diurnal profile: 24-hour pattern
    CREATE_MV_DIURNAL = """
    CREATE MATERIALIZED VIEW IF NOT EXISTS diurnal_profile AS
    SELECT
        h3_index,
        EXTRACT(HOUR FROM acq_datetime) AS hour_of_day,
        AVG(frp_megawatts) AS frp_mean_hourly,
        COUNT(*) AS obs_count
    FROM thermal_hotspots_stream
    WHERE acq_datetime >= NOW() - INTERVAL '30 days'
    GROUP BY h3_index, EXTRACT(HOUR FROM acq_datetime);
    """

    def __init__(self, connection_url: Optional[str] = None):
        self.connection_url = connection_url or os.getenv(
            "RISINGWAVE_URL", "postgresql://root@localhost:4566/dev"
        )

    def get_initialization_sql(self) -> List[str]:
        """Returns the full schema initialization SQL for RisingWave."""
        return [
            self.CREATE_SOURCE,
            self.CREATE_MV_30D_BASELINE,
            self.CREATE_MV_DIURNAL,
        ]

    def get_query_30d_baseline(self, h3_index: str) -> str:
        """Returns parameterized query for a specific H3 cell baseline."""
        return f"""
        SELECT
            frp_mean,
            frp_std,
            bt_mean,
            bt_std,
            observation_count
        FROM thermal_baseline_30d
        WHERE h3_index = '{h3_index}'
        LIMIT 1;
        """

    def get_query_diurnal_anomaly(self, h3_index: str, hour: int) -> str:
        """Returns diurnal pattern lookup for a specific hour."""
        return f"""
        SELECT frp_mean_hourly
        FROM diurnal_profile
        WHERE h3_index = '{h3_index}' AND hour_of_day = {hour};
        """
