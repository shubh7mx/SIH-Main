import { pgTable, uuid, varchar, doublePrecision, real, smallint, char, timestamp, boolean, jsonb, pgEnum, integer } from 'drizzle-orm/pg-core';

export const thermalClassEnum = pgEnum('thermal_class_enum', [
  'INDUSTRIAL_FIRE_EMERGENCY',
  'PERSISTENT_INDUSTRIAL_FLARE',
  'AGRICULTURAL_BURNING',
  'WILDFIRE',
  'DEFERRED_FOR_ANALYST',
]);

export const thermalHotspots = pgTable('thermal_hotspots', {
  id: uuid('id').primaryKey().defaultRandom(),
  firmsId: varchar('firms_id', { length: 64 }).unique(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  h3Index: varchar('h3_index', { length: 24 }).notNull(),
  brightnessTempKelvin: real('brightness_temp_kelvin').notNull(),
  frpMegawatts: real('frp_megawatts').notNull(),
  confidencePct: smallint('confidence_pct').notNull(),
  satelliteSource: varchar('satellite_source', { length: 32 }).notNull(),
  dayNight: char('day_night', { length: 1 }).notNull(),
  scanAngle: real('scan_angle'),
  trackPixel: real('track_pixel'),
  acqDatetime: timestamp('acq_datetime', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const industrialFacilities = pgTable('industrial_facilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  osmId: varchar('osm_id', { length: 64 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  facilityType: varchar('facility_type', { length: 64 }).notNull(),
  operator: varchar('operator', { length: 255 }),
  state: varchar('state', { length: 64 }),
  district: varchar('district', { length: 64 }),
  h3Res8: varchar('h3_res8', { length: 24 }).notNull(),
  baselineFrpMean: real('baseline_frp_mean').default(0),
  baselineFrpStd: real('baseline_frp_std').default(0),
  baselineBtMean: real('baseline_bt_mean').default(0),
  baselineBtStd: real('baseline_bt_std').default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const landCoverCells = pgTable('land_cover_cells', {
  h3Index: varchar('h3_index', { length: 24 }).primaryKey(),
  classCode: smallint('class_code').notNull(),
  className: varchar('class_name', { length: 64 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const anomalyClassifications = pgTable('anomaly_classifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  hotspotId: uuid('hotspot_id').references(() => thermalHotspots.id, { onDelete: 'cascade' }),
  facilityId: uuid('facility_id').references(() => industrialFacilities.id, { onDelete: 'set null' }),
  classification: thermalClassEnum('classification').notNull(),
  confidenceScore: real('confidence_score').notNull(),
  cdeAnomalyScore: real('cde_anomaly_score'),
  spatialScore: real('spatial_score').notNull(),
  temporalScore: real('temporal_score').notNull(),
  visionScore: real('vision_score'),
  agentReasoning: jsonb('agent_reasoning').notNull(),
  isCriticalAlert: boolean('is_critical_alert').default(false),
  analystVerified: boolean('analyst_verified').default(false),
  analystCorrection: thermalClassEnum('analyst_correction'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const incidentAlerts = pgTable('incident_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  classificationId: uuid('classification_id').references(() => anomalyClassifications.id, { onDelete: 'cascade' }),
  severity: varchar('severity', { length: 16 }).notNull(),
  hazardZone5kmPop: integer('hazard_zone_5km_pop').default(0),
  hazardZone10kmPop: integer('hazard_zone_10km_pop').default(0),
  recommendedAction: varchar('recommended_action', { length: 1000 }).notNull(),
  dispatchedChannels: jsonb('dispatched_channels').notNull(),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }).defaultNow().notNull(),
});
