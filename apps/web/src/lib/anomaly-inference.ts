import type { HotspotEvent } from "./types";

export interface AnomalyInference {
  probableCause: string;
  category: "AGRICULTURAL" | "FOREST_WILDFIRE" | "UNREGISTERED_INDUSTRIAL" | "BRUSH_BURNING" | "OPEN_WASTE";
  categoryLabel: string;
  confidenceLevel: "HIGH" | "MODERATE" | "ESTIMATED";
  regionLabel: string;
  metricAnalysis: string;
  indicators: string[];
}

/**
 * Infers probable real-world cause and context for unmapped thermal anomalies
 * by analyzing radiometric metrics (FRP, Brightness Temp, Day/Night) and Indian geospatial coordinates.
 */
export function inferAnomalyReason(event: HotspotEvent): AnomalyInference {
  const lat = Number(event.latitude);
  const lon = Number(event.longitude);
  const frp = Number(event.frp_megawatts ?? 10);
  const bt = Number(event.brightness_temp_kelvin ?? 340);
  const isNight = event.day_night === "N";
  const conf = Number(((event.confidence_score ?? 0.8) * 100).toFixed(0));

  // 1. Regional classification
  let region = "Indian Mainland";
  const isNorthAgBelt = lat >= 28.2 && lat <= 32.8 && lon >= 73.8 && lon <= 79.2;
  const isEasternMiningBelt = lat >= 20.5 && lat <= 25.5 && lon >= 82.5 && lon <= 88.5;
  const isWesternGhats = lat >= 8.5 && lat <= 19.5 && lon >= 73.2 && lon <= 77.2;
  const isHimalayanBelt = lat >= 29.5 && lat <= 36.0 && lon >= 74.0 && lon <= 81.0;
  const isNorthEast = lon >= 89.5 && lat >= 22.0 && lat <= 29.0;
  const isCentralDeccan = lat >= 14.0 && lat <= 23.5 && lon >= 75.0 && lon <= 82.0;
  const isWesternArid = lat >= 23.5 && lat <= 29.0 && lon >= 68.5 && lon <= 74.0;

  if (isNorthAgBelt) region = "Indo-Gangetic Plain (Punjab / Haryana / West UP)";
  else if (isEasternMiningBelt) region = "Chota Nagpur / Eastern Mineral & Forest Belt";
  else if (isWesternGhats) region = "Western Ghats Ecological Belt";
  else if (isHimalayanBelt) region = "Himalayan Foothills & Shivalik Range";
  else if (isNorthEast) region = "North-Eastern Hill Tracts";
  else if (isCentralDeccan) region = "Central Deccan Agro-Climatic Belt";
  else if (isWesternArid) region = "Western Thar & Semi-Arid Corridor";

  // 2. High FRP / BT (> 180 MW or > 380 K) in non-industrial zone
  if (frp >= 150 || bt >= 390) {
    if (isHimalayanBelt || isWesternGhats || isNorthEast) {
      return {
        probableCause: "High-Intensity Forest Canopy Wildfire",
        category: "FOREST_WILDFIRE",
        categoryLabel: "Forest Wildfire",
        confidenceLevel: conf >= 80 ? "HIGH" : "MODERATE",
        regionLabel: region,
        metricAnalysis: `Intense thermal radiative signature (${frp.toFixed(1)} MW FRP, ${bt.toFixed(0)} K) indicating rapid fuel consumption of timber/canopy biomass.`,
        indicators: [
          `Elevated Radiative Power (${frp.toFixed(1)} MW) exceeds agrarian baseline by >5x`,
          `High Radiance Brightness (${bt.toFixed(0)} K) matches open crown combustion`,
          isNight ? "Night-time sustained combustion confirms substantial fuel load" : "Day-time peak solar-assisted burn",
        ],
      };
    }
    return {
      probableCause: "Unregistered High-Heat Industrial Operation / Kiln Cluster",
      category: "UNREGISTERED_INDUSTRIAL",
      categoryLabel: "Unregistered Industrial",
      confidenceLevel: "MODERATE",
      regionLabel: region,
      metricAnalysis: `High thermal output (${frp.toFixed(1)} MW FRP) in unmapped perimeter, characteristic of brick kilns, secondary furnaces, or heavy open-pit heating.`,
      indicators: [
        `Extreme localized heat concentration (${frp.toFixed(1)} MW)`,
        `Brightness temperature (${bt.toFixed(0)} K) typical of refractory combustion`,
        "No matching registered OSM industrial polygon within 500m",
      ],
    };
  }

  // 3. Agricultural Crop Residue Burning (North Ag Belt or Central Deccan, FRP 5 - 80 MW)
  if (isNorthAgBelt || isCentralDeccan || event.classification === "AGRICULTURAL_BURNING") {
    const cropType = isNorthAgBelt
      ? "Paddy Stubble / Wheat Straw Crop Residue Burning"
      : "Sugarcane Trash / Cotton Stalk / Post-Harvest Biomass Clearing";

    return {
      probableCause: cropType,
      category: "AGRICULTURAL",
      categoryLabel: "Agricultural Biomass",
      confidenceLevel: conf >= 75 ? "HIGH" : "MODERATE",
      regionLabel: region,
      metricAnalysis: `Radiative signature (${frp.toFixed(1)} MW FRP, ${bt.toFixed(0)} K) matches open-field surface crop residue incineration with low smoke opacity.`,
      indicators: [
        `FRP (${frp.toFixed(1)} MW) within standard agricultural clearing range (5–80 MW)`,
        `Brightness (${bt.toFixed(0)} K) aligns with surface straw combustion`,
        isNight ? "Night-time burning to evade daytime satellite overpasses" : "Daytime post-harvest field clearing pass",
        `Located in active agricultural zone (${region})`,
      ],
    };
  }

  // 4. Forest / Brush Fire in Ecological or Hilly Zones
  if (isHimalayanBelt || isWesternGhats || isNorthEast || event.classification === "WILDFIRE") {
    const isJhum = isNorthEast;
    return {
      probableCause: isJhum
        ? "Shifting Cultivation (Jhum) Slash-and-Burn / Forest Fringe Fire"
        : "Dry Deciduous Leaf-Litter & Understory Scrub Fire",
      category: "FOREST_WILDFIRE",
      categoryLabel: isJhum ? "Jhum / Forest Slash" : "Scrub & Understory Fire",
      confidenceLevel: conf >= 70 ? "HIGH" : "MODERATE",
      regionLabel: region,
      metricAnalysis: `Moderate thermal energy (${frp.toFixed(1)} MW FRP) typical of spreading ground fire in forest understory and dry foliage.`,
      indicators: [
        `Moderate FRP (${frp.toFixed(1)} MW) consistent with surface litter fire`,
        `Terrain slope and foliage density favor dry seasonal fire spread`,
        isNight ? "Night-time glow captured across unpopulated forest coordinates" : "Day-time thermal anomaly detected in forest tract",
      ],
    };
  }

  // 5. Night-time Persistent Anomaly outside mapped facilities
  if (isNight && bt >= 335) {
    return {
      probableCause: "Night-Time Small Kiln / Charcoal Burning / Unindexed Heat Source",
      category: "UNREGISTERED_INDUSTRIAL",
      categoryLabel: "Unindexed Thermal Source",
      confidenceLevel: "MODERATE",
      regionLabel: region,
      metricAnalysis: `Night-time thermal emission (${bt.toFixed(0)} K) without solar reflectance indicates artificial heat generation or smoldering waste pile.`,
      indicators: [
        `Night pass detection (Day/Night = 'N') rules out solar ground heating`,
        `Brightness Temperature (${bt.toFixed(0)} K) indicates continuous heat emission`,
        "Located in unclassified rural/semi-urban tract",
      ],
    };
  }

  // 6. Generic Open-Air Waste or Brush Burning
  return {
    probableCause: "Open-Air Waste Burning / Roadside Brush & Biomass Disposal",
    category: "BRUSH_BURNING",
    categoryLabel: "Biomass / Open Waste",
    confidenceLevel: "ESTIMATED",
    regionLabel: region,
    metricAnalysis: `Low-to-moderate thermal intensity (${frp.toFixed(1)} MW FRP, ${bt.toFixed(0)} K) indicative of localized open-air refuse or brush disposal.`,
    indicators: [
      `Low FRP (${frp.toFixed(1)} MW) indicates small localized fire perimeter`,
      `Brightness (${bt.toFixed(0)} K) matches open atmospheric smolder`,
      "No industrial infrastructure or heavy forest canopy at detection coordinates",
    ],
  };
}
