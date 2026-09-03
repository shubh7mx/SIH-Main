// Shared TypeScript types for SIH26162 — aligned with FastAPI Pydantic schemas

export enum ThermalClassification {
  INDUSTRIAL_FIRE_EMERGENCY = "INDUSTRIAL_FIRE_EMERGENCY",
  PERSISTENT_INDUSTRIAL_FLARE = "PERSISTENT_INDUSTRIAL_FLARE",
  AGRICULTURAL_BURNING = "AGRICULTURAL_BURNING",
  WILDFIRE = "WILDFIRE",
  DEFERRED_FOR_ANALYST = "DEFERRED_FOR_ANALYST",
}

export enum AlertSeverity {
  CRITICAL = "CRITICAL",
  WARNING = "WARNING",
  WATCH = "WATCH",
  INFO = "INFO",
}

export interface AgentEvidenceField {
  label: string;
  value: string | number | boolean | null | undefined;
  format?: "mw" | "km" | "pct" | "deg" | "sigma" | "raw";
}

/** One agent's evidence trace: title + narrative + structured telemetry fields. */
export interface AgentEvidenceCard {
  key: string;
  title: string;
  narrative: string;
  score?: number | null;
  fields: AgentEvidenceField[];
}

/** Normalizes the backend's nested agent_reasoning dict into renderable cards. */
export function toEvidenceCards(
  reasoning: Record<string, Record<string, unknown>> | Record<string, string> | null | undefined,
): AgentEvidenceCard[] {
  if (!reasoning || typeof reasoning !== "object") return [];

  const AGENT_META: Record<string, { title: string; narrative: (f: Record<string, unknown>) => string; weight?: number }> = {
    spatial: {
      title: "Spatial Agent · H3 + OSM Containment",
      narrative: (f) => {
        const d = Number(f.distance_km);
        const inFacility = d != null && isFinite(d) && d <= 1.5;
        if (inFacility) {
          return `Hotspot resolves inside OSM industrial polygon "${f.facility ?? "unregistered"}" (${f.facility_type ?? "unknown type"}). Land cover under pixel: ${f.land_cover ?? "unknown"}.`;
        }
        return `No OSM industrial polygon within containment radius. Nearest registered facility ${Number.isFinite(d) ? `${d.toFixed(1)} km` : "unknown distance"} away; land cover ${f.land_cover ?? "unknown"} — agricultural / open-land track.`;
      },
    },
    temporal: {
      title: "Temporal Agent · Baseline Deviation (CDE)",
      narrative: (f) => {
        const z = Number(f.frp_zscore);
        const base = Number(f.baseline_frp_mean);
        const obs = Number(f.observation_count);
        const zTxt = Number.isFinite(z) ? `${z > 0 ? "+" : ""}${z.toFixed(1)}σ` : "n/a";
        const baseTxt = Number.isFinite(base) ? `${base.toFixed(0)} MW` : "n/a";
        return `Current FRP sits ${zTxt} against the rolling facility baseline (μ=${baseTxt}, n=${Number.isFinite(obs) ? obs : 0} observations). Temporal Persistence Index ${Number(f.tpi ?? 0).toFixed(4)}; diurnal anomaly ${Number(f.diurnal_anomaly ?? 0).toFixed(2)}.`;
      },
    },
    vision: {
      title: "Vision Agent · Sentinel-2 SWIR Validation",
      narrative: (f) => {
        const cloud = Number(f.cloud_coverage_pct ?? 0);
        const free = Boolean(f.cloud_free);
        if (free) {
          return `Cloud-free Sentinel-2 SWIR tile (${cloud.toFixed(0)}% cloud) available — CNN classification: ${String(f.predicted_class ?? "UNKNOWN").replace(/_/g, " ").toLowerCase()} @ ${(Number(f.vision_class_confidence ?? 0) * 100).toFixed(0)}% confidence.`;
        }
        return `Optical validation deferred: tile ${cloud.toFixed(0)}% cloud-covered (SAR fallback track). Last known tile ref: ${f.sentinel2_tile_id ?? "none"}.`;
      },
    },
    dispersion: {
      title: "Dispersion Agent · Gaussian Puff Model",
      narrative: (f) => {
        const wind = Number(f.wind_speed_ms ?? 0);
        const dir = Number(f.wind_direction_deg ?? 0);
        if (!Number.isFinite(wind) || wind <= 0) {
          return "Dispersion simulation skipped — event did not meet Industrial Fire Emergency gating criteria.";
        }
        const dirTxt = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(((dir % 360) / 45)) % 8];
        return `Plume modeled with ERA5 winds ${wind.toFixed(1)} m/s bearing ${dir.toFixed(0)}° (${dirTxt}). Hazard corridors computed for downwind population exposure.`;
      },
    },
    orchestrator: {
      title: "Orchestrator · Bayesian Fusion",
      narrative: (f) => {
        const cls = String(f.final_classification ?? "UNKNOWN");
        return `Weighted agent votes fused (spatial 0.30 · temporal 0.30 · vision 0.35 · dispersion 0.05) → final class ${cls.replace(/_/g, " ")} at ${(Number(f.final_confidence ?? 0) * 100).toFixed(1)}% confidence. CDE override severity: ${String(f.cde_severity ?? "NORMAL").toLowerCase()}.`;
      },
    },
    dispatcher: {
      title: "Dispatcher · 4-Tier Alert Routing",
      narrative: (f) => {
        const sev = String(f.alert_severity ?? "INFO");
        return `Routed as ${sev} under 4-tier gating. ${sev === "CRITICAL" ? "Immediate multi-channel dispatch (WebSocket + SMS + Telegram)." : sev === "WARNING" ? "Analyst watch queue — 15-min recheck armed." : "Logged to 24h event store; no dispatch."}`;
      },
    },
  };

  const FORMAT_META: Record<string, { label: string; suffix?: string; pct?: boolean; bool?: [string, string] }> = {
    facility: { label: "Facility" },
    facility_type: { label: "Facility type" },
    land_cover: { label: "Land cover" },
    distance_km: { label: "Nearest facility", suffix: " km" },
    score: { label: "Agent score" },
    frp_zscore: { label: "FRP z-score", suffix: "σ" },
    bt_zscore: { label: "BT z-score", suffix: "σ" },
    diurnal_anomaly: { label: "Diurnal anomaly" },
    tpi: { label: "TPI" },
    baseline_frp_mean: { label: "Baseline μ FRP", suffix: " MW" },
    baseline_frp_std: { label: "Baseline σ FRP", suffix: " MW" },
    observation_count: { label: "Observations" },
    cloud_free: { label: "Cloud-free tile", bool: ["YES", "NO"] },
    cloud_coverage_pct: { label: "Cloud coverage", suffix: "%" },
    predicted_class: { label: "CNN verdict" },
    vision_class_confidence: { label: "CNN confidence", pct: true },
    sentinel2_tile_id: { label: "S2 tile" },
    wind_direction_deg: { label: "Wind bearing", suffix: "°" },
    wind_speed_ms: { label: "Wind speed", suffix: " m/s" },
    final_classification: { label: "Fused class" },
    final_confidence: { label: "Fused confidence", pct: true },
    cde_severity: { label: "CDE severity" },
    alert_severity: { label: "Alert tier" },
  };

  const cards: AgentEvidenceCard[] = [];
  for (const [key, raw] of Object.entries(reasoning)) {
    const meta = AGENT_META[key];
    if (!meta) continue;

    // Back-compat: legacy string payloads (mock data) get wrapped as a single field.
    if (typeof raw === "string") {
      cards.push({
        key,
        title: meta.title,
        narrative: raw,
        fields: [],
      });
      continue;
    }
    if (!raw || typeof raw !== "object") continue;

    const f = raw as Record<string, unknown>;
    const fields: AgentEvidenceField[] = [];
    for (const [fk, fv] of Object.entries(f)) {
      const fm = FORMAT_META[fk];
      if (!fm) continue;
      if (fv === null || fv === undefined) continue;
      let value: string | number | boolean = typeof fv === "string" || typeof fv === "number" || typeof fv === "boolean" ? fv : String(fv);
      if (fm.pct && typeof fv === "number") value = `${(fv * 100).toFixed(1)}%`;
      else if (fm.bool && typeof fv === "boolean") value = fm.bool[fv ? 0 : 1];
      fields.push({ label: fm.label, value, suffix: fm.suffix, format: "raw" } as AgentEvidenceField);
    }

    cards.push({
      key,
      title: meta.title,
      narrative: meta.narrative(f),
      score: typeof f.score === "number" ? f.score : null,
      fields,
    });
  }
  return cards;
}

export interface HotspotEvent {
  id: string;
  latitude: number;
  longitude: number;
  h3_index: string;
  brightness_temp_kelvin: number;
  frp_megawatts: number;
  confidence_pct: number;
  satellite_source: string;
  day_night: string;
  acq_datetime: string;
  classification: ThermalClassification;
  confidence_score: number;
  cde_anomaly_score: number | null;
  facility_name: string | null;
  facility_type: string | null;
  distance_to_facility_km: number | null;
  is_critical_alert: boolean;
  agent_reasoning: Record<string, string>;
  created_at: string;
}

export interface Facility {
  id: string;
  osm_id: string;
  name: string;
  facility_type: string;
  operator: string | null;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  baseline_frp_mean: number;
  baseline_frp_std: number;
  active_hotspots_count: number;
}

export interface SystemStatus {
  status: string;
  version: string;
  uptime_seconds: number;
  active_hotspots_24h: number;
  critical_alerts_24h: number;
  monitored_facilities: number;
  data_sources: Record<string, string>;
}

export const CLASSIFICATION_META: Record<
  ThermalClassification,
  { label: string; color: string; glow: string; emoji: string }
> = {
  INDUSTRIAL_FIRE_EMERGENCY: {
    label: "Industrial Fire",
    color: "#ff2047",
    glow: "rgba(255,32,71,0.34)",
    emoji: "🚨",
  },
  PERSISTENT_INDUSTRIAL_FLARE: {
    label: "Persistent Flare",
    color: "#ff801f",
    glow: "rgba(255,89,0,0.22)",
    emoji: "🏭",
  },
  AGRICULTURAL_BURNING: {
    label: "Agricultural",
    color: "#ffc53d",
    glow: "transparent",
    emoji: "🌾",
  },
  WILDFIRE: {
    label: "Wildfire",
    color: "#3b9eff",
    glow: "rgba(0,117,255,0.34)",
    emoji: "🔥",
  },
  DEFERRED_FOR_ANALYST: {
    label: "Pending Review",
    color: "#888e90",
    glow: "transparent",
    emoji: "⏳",
  },
};
