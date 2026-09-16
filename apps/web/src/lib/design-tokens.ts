/**
 * SIH26162 — Dark Tactical Design System Tokens
 * Aligned with NTRO command-and-control visual language.
 */

import { ThermalClassification } from "./types";

export const SEVERITY_COLORS = {
  // Primary classification taxonomy
  EMERGENCY: {
    bg: "rgba(239, 68, 68, 0.12)",
    border: "#fca5a5",
    borderSoft: "rgba(252, 165, 165, 0.9)",
    text: "#ef4444",
    dot: "#ef4444",
    glow: "rgba(239, 68, 68, 0.45)",
    label: "Industrial Fire Emergency",
    shortLabel: "Industrial Fire",
  },
  WILDFIRE: {
    bg: "rgba(249, 115, 22, 0.12)",
    border: "#fdba74",
    borderSoft: "rgba(253, 186, 116, 0.9)",
    text: "#f97316",
    dot: "#f97316",
    glow: "rgba(249, 115, 22, 0.4)",
    label: "Wildfire Detection",
    shortLabel: "Wildfire",
  },
  PERSISTENT: {
    bg: "rgba(245, 158, 11, 0.12)",
    border: "#fcd34d",
    borderSoft: "rgba(252, 211, 77, 0.9)",
    text: "#f59e0b",
    dot: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.35)",
    label: "Persistent Industrial Flare",
    shortLabel: "Persistent",
  },
  AGRICULTURAL: {
    bg: "rgba(234, 179, 8, 0.12)",
    border: "#fef08a",
    borderSoft: "rgba(254, 240, 138, 0.9)",
    text: "#eab308",
    dot: "#eab308",
    glow: "rgba(234, 179, 8, 0.3)",
    label: "Agricultural Burning",
    shortLabel: "Agricultural",
  },
  DEFERRED: {
    bg: "rgba(168, 85, 247, 0.12)",
    border: "#d8b4fe",
    borderSoft: "rgba(216, 180, 254, 0.9)",
    text: "#a855f7",
    dot: "#a855f7",
    glow: "rgba(168, 85, 247, 0.35)",
    label: "Analyst Review Required",
    shortLabel: "Review",
  },
  // Operational normal baseline
  NORMAL: {
    bg: "rgba(16, 185, 129, 0.12)",
    border: "#6ee7b7",
    borderSoft: "rgba(110, 231, 183, 0.9)",
    text: "#10b981",
    dot: "#10b981",
    glow: "rgba(16, 185, 129, 0.25)",
    label: "Within Normal Range",
    shortLabel: "Normal",
  },
  CYAN: {
    bg: "rgba(6, 182, 212, 0.12)",
    border: "#67e8f9",
    borderSoft: "rgba(103, 232, 249, 0.9)",
    text: "#06b6d4",
    dot: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.35)",
    label: "Standard Telemetry",
    shortLabel: "Telemetry",
  },
} as const;

export function getClassificationSeverity(classification: string | ThermalClassification) {
  switch (classification) {
    case ThermalClassification.INDUSTRIAL_FIRE_EMERGENCY:
    case "INDUSTRIAL_FIRE_EMERGENCY":
      return SEVERITY_COLORS.EMERGENCY;
    case ThermalClassification.WILDFIRE:
    case "WILDFIRE":
      return SEVERITY_COLORS.WILDFIRE;
    case ThermalClassification.PERSISTENT_INDUSTRIAL_FLARE:
    case "PERSISTENT_INDUSTRIAL_FLARE":
      return SEVERITY_COLORS.PERSISTENT;
    case ThermalClassification.AGRICULTURAL_BURNING:
    case "AGRICULTURAL_BURNING":
      return SEVERITY_COLORS.AGRICULTURAL;
    case ThermalClassification.DEFERRED_FOR_ANALYST:
    case "DEFERRED_FOR_ANALYST":
      return SEVERITY_COLORS.DEFERRED;
    default:
      return SEVERITY_COLORS.NORMAL;
  }
}

// ── Industrial Sector Sub-Tags Taxonomy ──────────────────────────────────────
export interface SectorTagInfo {
  key: string;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  border: string;
  bg: string;
}

export const SECTOR_TAGS: Record<string, SectorTagInfo> = {
  refinery: {
    key: "refinery",
    label: "Petroleum Refinery",
    shortLabel: "Refinery",
    icon: "🛢️",
    color: "#38bdf8", // Sky blue
    border: "rgba(56, 189, 248, 0.4)",
    bg: "rgba(56, 189, 248, 0.12)",
  },
  lng: {
    key: "lng",
    label: "LNG & Gas Terminal",
    shortLabel: "LNG / Gas",
    icon: "⛽",
    color: "#06b6d4", // Cyan
    border: "rgba(6, 182, 212, 0.4)",
    bg: "rgba(6, 182, 212, 0.12)",
  },
  steel: {
    key: "steel",
    label: "Steel & Metallurgy",
    shortLabel: "Steel / Metals",
    icon: "🏗️",
    color: "#fb923c", // Orange
    border: "rgba(251, 146, 60, 0.4)",
    bg: "rgba(251, 146, 60, 0.12)",
  },
  cement: {
    key: "cement",
    label: "Cement Rotary Kiln",
    shortLabel: "Cement",
    icon: "🧱",
    color: "#facc15", // Amber/Yellow
    border: "rgba(250, 204, 21, 0.4)",
    bg: "rgba(250, 204, 21, 0.12)",
  },
  mining: {
    key: "mining",
    label: "Mining & Mineral Extraction",
    shortLabel: "Mining / Quarry",
    icon: "⛏️",
    color: "#d97706", // Dark amber/bronze
    border: "rgba(217, 119, 6, 0.4)",
    bg: "rgba(217, 119, 6, 0.12)",
  },
  chemical: {
    key: "chemical",
    label: "Chemical & Fertilizer Plant",
    shortLabel: "Chemicals",
    icon: "🧪",
    color: "#c084fc", // Purple
    border: "rgba(192, 132, 252, 0.4)",
    bg: "rgba(192, 132, 252, 0.12)",
  },
  power: {
    key: "power",
    label: "Thermal Power Station",
    shortLabel: "Power Plant",
    icon: "⚡",
    color: "#4ade80", // Emerald
    border: "rgba(74, 222, 128, 0.4)",
    bg: "rgba(74, 222, 128, 0.12)",
  },
};

/**
 * Sentinel / placeholder facility_type values that should never resolve to a sector tag.
 * These are the defaults TacticalMap & the events list use when no facility is mapped.
 */
const _SENTINEL_TYPES = new Set([
  "unmapped", "unknown", "industrial", "other", "none", "null", "", "thermal anomaly",
]);

/**
 * Substrings (lowercased) in facility_name that indicate a synthetic placeholder
 * rather than a real facility (e.g. TacticalMap's default "Thermal Anomaly").
 */
const _SENTINEL_NAME_PATTERNS = [
  "thermal anomaly", "unmapped", "industrial facility",
  "unknown facility", "anomaly",
];

/**
 * Resolves the industrial sector tag from facility_type string or facility name keywords.
 * Guards against placeholder values so agricultural/wildfire/unmapped events are not
 * mistagged as an industrial sector (e.g. never tag "Thermal Anomaly" as Power Plant).
 */
export function getSectorTag(
  facilityType?: string | null,
  facilityName?: string | null
): SectorTagInfo | null {
  const typeStr = (facilityType || "").toLowerCase().trim();
  const nameStr = (facilityName || "").toLowerCase().trim();

  // Reject explicit sentinel facility types
  if (_SENTINEL_TYPES.has(typeStr)) return null;
  // Reject sentinel facility-name patterns (placeholders, not real plant names)
  if (_SENTINEL_NAME_PATTERNS.some((p) => nameStr.includes(p))) return null;

  // 1. Exact or prefix match on facility_type
  if (typeStr.includes("refiner") || typeStr.includes("petrochem")) return SECTOR_TAGS.refinery;
  if (typeStr.includes("gas") || typeStr.includes("lng") || typeStr.includes("gail") || typeStr.includes("pipeline")) return SECTOR_TAGS.lng;
  if (typeStr.includes("metal") || typeStr.includes("steel") || typeStr.includes("smelter") || typeStr.includes("blast") || typeStr.includes("iron")) return SECTOR_TAGS.steel;
  if (typeStr.includes("cement") || typeStr.includes("clinker")) return SECTOR_TAGS.cement;
  if (typeStr.includes("mining") || typeStr.includes("mine") || typeStr.includes("quarry") || typeStr.includes("coal") || typeStr.includes("bauxite") || typeStr.includes("iron_ore")) return SECTOR_TAGS.mining;
  if (typeStr.includes("chem") || typeStr.includes("fertiliz") || typeStr.includes("urea") || typeStr.includes("ammonia")) return SECTOR_TAGS.chemical;
  if (typeStr.includes("power") || typeStr.includes("thermal") || typeStr.includes("ntpc")) return SECTOR_TAGS.power;

  // 2. Name-based heuristics fallback
  if (nameStr.includes("refiner") || nameStr.includes("iocl") || nameStr.includes("bpcl") || nameStr.includes("hpcl") || nameStr.includes("reliance jamnagar")) return SECTOR_TAGS.refinery;
  if (nameStr.includes("lng") || nameStr.includes("petronet") || nameStr.includes("gail") || nameStr.includes("terminal")) return SECTOR_TAGS.lng;
  if (nameStr.includes("steel") || nameStr.includes("tata steel") || nameStr.includes("jsw") || nameStr.includes("sail") || nameStr.includes("jindal")) return SECTOR_TAGS.steel;
  if (nameStr.includes("cement") || nameStr.includes("ultratech") || nameStr.includes("ambuja") || nameStr.includes("acc") || nameStr.includes("shree")) return SECTOR_TAGS.cement;
  if (nameStr.includes("mine") || nameStr.includes("mining") || nameStr.includes("singrauli") || nameStr.includes("coal") || nameStr.includes("quarry") || nameStr.includes("bauxite")) return SECTOR_TAGS.mining;
  if (nameStr.includes("chemical") || nameStr.includes("fertilizer") || nameStr.includes("iffco") || nameStr.includes("gnfc")) return SECTOR_TAGS.chemical;
  if (nameStr.includes("power") || nameStr.includes("ntpc") || nameStr.includes("thermal")) return SECTOR_TAGS.power;

  return null;
}

export const SURFACE_TOKENS = {
  canvas: "#03060a",
  card: "rgba(10, 15, 26, 0.75)",
  cardElevated: "rgba(15, 23, 42, 0.85)",
  borderSubtle: "rgba(255, 255, 255, 0.07)",
  borderHighlight: "rgba(6, 182, 212, 0.25)",
} as const;
