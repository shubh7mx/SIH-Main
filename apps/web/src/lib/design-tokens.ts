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

export const SURFACE_TOKENS = {
  canvas: "#03060a",
  card: "rgba(10, 15, 26, 0.75)",
  cardElevated: "rgba(15, 23, 42, 0.85)",
  borderSubtle: "rgba(255, 255, 255, 0.07)",
  borderHighlight: "rgba(6, 182, 212, 0.25)",
} as const;
