-- ==============================================================================
-- SIH26162 — PostGIS & Database Initialization Script
-- Sponsoring Org: National Technical Research Organisation (NTRO)
-- ==============================================================================

-- Enable spatial extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Raw Thermal Hotspots (from NASA FIRMS VIIRS/MODIS)
CREATE TABLE IF NOT EXISTS thermal_hotspots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firms_id VARCHAR(64) UNIQUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    h3_index VARCHAR(24) NOT NULL,
    brightness_temp_kelvin REAL NOT NULL,
    frp_megawatts REAL NOT NULL,
    confidence_pct SMALLINT NOT NULL,
    satellite_source VARCHAR(32) NOT NULL, -- e.g. 'VIIRS_SNPP_NRT', 'MODIS_AQUA'
    day_night CHAR(1) NOT NULL,            -- 'D' or 'N'
    scan_angle REAL,
    track_pixel REAL,
    acq_datetime TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hotspots_geom ON thermal_hotspots USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_hotspots_h3 ON thermal_hotspots (h3_index);
CREATE INDEX IF NOT EXISTS idx_hotspots_acq ON thermal_hotspots (acq_datetime DESC);

-- 2. Industrial Facilities Registry (from OpenStreetMap Overpass API)
CREATE TABLE IF NOT EXISTS industrial_facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    osm_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255),
    facility_type VARCHAR(64) NOT NULL, -- 'refinery', 'chemical', 'metal_works', 'cement', 'flare'
    operator VARCHAR(255),
    state VARCHAR(64),
    district VARCHAR(64),
    geom GEOMETRY(Geometry, 4326) NOT NULL, -- Polygon, MultiPolygon or Point
    centroid GEOMETRY(Point, 4326) NOT NULL,
    h3_res8 VARCHAR(24) NOT NULL,
    baseline_frp_mean REAL DEFAULT 0,
    baseline_frp_std REAL DEFAULT 0,
    baseline_bt_mean REAL DEFAULT 0,
    baseline_bt_std REAL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_facilities_geom ON industrial_facilities USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_facilities_centroid ON industrial_facilities USING GIST (centroid);
CREATE INDEX IF NOT EXISTS idx_facilities_type ON industrial_facilities (facility_type);

-- 3. ESA WorldCover Land Cover Cache
CREATE TABLE IF NOT EXISTS land_cover_cells (
    h3_index VARCHAR(24) PRIMARY KEY,
    class_code SMALLINT NOT NULL, -- 10: Trees, 40: Cropland, 50: Built-up, etc.
    class_name VARCHAR(64) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Swarm AI Classifications
CREATE TYPE thermal_class_enum AS ENUM (
    'INDUSTRIAL_FIRE_EMERGENCY',
    'PERSISTENT_INDUSTRIAL_FLARE',
    'AGRICULTURAL_BURNING',
    'WILDFIRE',
    'DEFERRED_FOR_ANALYST'
);

CREATE TABLE IF NOT EXISTS anomaly_classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotspot_id UUID REFERENCES thermal_hotspots(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES industrial_facilities(id) ON DELETE SET NULL,
    classification thermal_class_enum NOT NULL,
    confidence_score REAL NOT NULL,
    cde_anomaly_score REAL,
    spatial_score REAL NOT NULL,
    temporal_score REAL NOT NULL,
    vision_score REAL,
    agent_reasoning JSONB NOT NULL,
    is_critical_alert BOOLEAN DEFAULT FALSE,
    analyst_verified BOOLEAN DEFAULT FALSE,
    analyst_correction thermal_class_enum,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_classifications_created ON anomaly_classifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classifications_type ON anomaly_classifications (classification);

-- 5. Hazard Dispersion & Incident Alerts
CREATE TABLE IF NOT EXISTS incident_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classification_id UUID REFERENCES anomaly_classifications(id) ON DELETE CASCADE,
    severity VARCHAR(16) NOT NULL, -- 'CRITICAL', 'WARNING', 'WATCH'
    plume_polygon GEOMETRY(Polygon, 4326),
    hazard_zone_5km_pop INT DEFAULT 0,
    hazard_zone_10km_pop INT DEFAULT 0,
    recommended_action TEXT NOT NULL,
    dispatched_channels JSONB NOT NULL, -- ['telegram', 'sms', 'webhook']
    dispatched_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_geom ON incident_alerts USING GIST (plume_polygon);
