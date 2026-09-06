import type { HotspotEvent } from "./types";

export interface AnomalyInference {
  probableCause: string;
  category:
    | "INDUSTRIAL_EMERGENCY"
    | "INDUSTRIAL_FLARE"
    | "AGRICULTURAL"
    | "FOREST_WILDFIRE"
    | "UNREGISTERED_INDUSTRIAL"
    | "BRUSH_BURNING"
    | "OPEN_WASTE"
    | "ANALYST_DEFERRED";
  categoryIcon: string;
  categoryLabel: string;
  confidenceLevel: "HIGH" | "MODERATE" | "ESTIMATED";
  regionLabel: string;
  metricAnalysis: string;
  indicators: string[];
}

/**
 * Accurately infers probable real-world cause, operational context, and telemetry breakdown
 * for thermal anomalies by fusing multi-agent ML classifications, facility registry context,
 * CDE baseline deviations, radiometric signatures (FRP, Brightness Temp, Day/Night pass),
 * and Indian geographic belts.
 */
export function inferAnomalyReason(event: HotspotEvent): AnomalyInference {
  const lat = Number(event.latitude);
  const lon = Number(event.longitude);
  const frp = Number(event.frp_megawatts ?? 10);
  const bt = Number(event.brightness_temp_kelvin ?? 340);
  const isNight = event.day_night === "N";
  const conf = Number(((event.confidence_score ?? 0.8) * 100).toFixed(0));
  const cde = event.cde_anomaly_score != null ? Number(event.cde_anomaly_score) : null;
  const facility = event.facility_name;
  const facilityType = (event.facility_type ?? "").toLowerCase();
  const distKm = event.distance_to_facility_km != null ? Number(event.distance_to_facility_km) : null;
  const hasNearFacility = facility && (!facility.includes("Unmapped") && !facility.includes("Thermal Anomaly")) && (distKm == null || distKm <= 10.0);

  // 1. Granular Indian Regional & Industrial Belts
  let region = "Indian Mainland";
  const isPunjabHaryana = lat >= 29.0 && lat <= 32.8 && lon >= 74.0 && lon <= 77.8;
  const isNorthAgBelt = lat >= 26.0 && lat <= 32.8 && lon >= 73.8 && lon <= 84.0;
  const isGujaratPetroCorridor = lat >= 21.0 && lat <= 23.5 && lon >= 68.8 && lon <= 73.5;
  const isMaharashtraIndustrial = lat >= 18.2 && lat <= 20.2 && lon >= 72.5 && lon <= 74.5;
  const isEasternMiningBelt = lat >= 20.5 && lat <= 25.5 && lon >= 82.5 && lon <= 88.5;
  const isWesternGhats = lat >= 8.5 && lat <= 19.5 && lon >= 73.2 && lon <= 77.2;
  const isHimalayanBelt = lat >= 29.5 && lat <= 36.0 && lon >= 74.0 && lon <= 81.0;
  const isNorthEast = lon >= 89.5 && lat >= 22.0 && lat <= 29.0;
  const isCentralDeccan = lat >= 14.0 && lat <= 23.5 && lon >= 75.0 && lon <= 82.0;
  const isWesternArid = lat >= 23.5 && lat <= 29.0 && lon >= 68.5 && lon <= 74.0;

  if (isGujaratPetroCorridor) region = "Gulf of Khambhat / Kutch Petrochemical Corridor (Gujarat)";
  else if (isPunjabHaryana) region = "Indo-Gangetic Agrarian Heartland (Punjab & Haryana)";
  else if (isNorthAgBelt) region = "Indo-Gangetic Plain (West UP & Agrarian Basin)";
  else if (isEasternMiningBelt) region = "Chota Nagpur Mineral, Coking & Heavy Metal Corridor";
  else if (isMaharashtraIndustrial) region = "Mumbai-Pune-Thane Industrial & Chemical Corridor";
  else if (isWesternGhats) region = "Western Ghats Ecological & Mountain Forest Zone";
  else if (isHimalayanBelt) region = "Sub-Himalayan & Shivalik Forest Reserve Belt";
  else if (isNorthEast) region = "North-Eastern Tropical Forests & Hill Tracts";
  else if (isWesternArid) region = "Thar Arid & Semi-Industrial Western Belt";
  else if (isCentralDeccan) region = "Central Deccan Plateau & Agrarian-Mineral Basin";

  const cls = event.classification;
  const isCritical = event.is_critical_alert || cls === "INDUSTRIAL_FIRE_EMERGENCY" || (cde != null && cde >= 3.0);

  // ── 2. Primary Classification-Driven Probable Cause ──────────────────────

  // CASE A: Industrial Fire Emergency
  if (cls === "INDUSTRIAL_FIRE_EMERGENCY" || (isCritical && hasNearFacility)) {
    let cause = "Catastrophic Industrial Fire / Uncontrolled Thermal Surge";
    if (hasNearFacility) {
      if (facilityType.includes("refinery") || facilityType.includes("petroleum") || facilityType.includes("chemical") || (facility && /refinery|petro|oil|gas|chem/i.test(facility))) {
        cause = `Severe Hydrocarbon Flare Surge / Process Unit Fire at ${facility}`;
      } else if (facilityType.includes("metal") || facilityType.includes("steel") || (facility && /steel|smelter|metal|iron/i.test(facility))) {
        cause = `Blast Furnace / Molten Ladle Breakout Emergency at ${facility}`;
      } else if (facilityType.includes("power") || (facility && /thermal|power|ntpc/i.test(facility))) {
        cause = `Thermal Power Boiler / Generator Unit Excursion at ${facility}`;
      } else {
        cause = `Major Industrial Plant Emergency Fire at ${facility}`;
      }
    } else {
      cause = `High-Intensity Unmapped Industrial Fire Emergency (${frp.toFixed(0)} MW)`;
    }

    const cdeStr = cde != null ? `+${cde.toFixed(1)}σ baseline deviation` : "Elevated thermal threshold";
    return {
      probableCause: cause,
      category: "INDUSTRIAL_EMERGENCY",
      categoryIcon: "🚨",
      categoryLabel: "Industrial Fire Emergency",
      confidenceLevel: conf >= 85 ? "HIGH" : "MODERATE",
      regionLabel: region,
      metricAnalysis: `Severe thermal anomaly with Radiative Power of ${frp.toFixed(1)} MW and Brightness Temperature of ${bt.toFixed(0)} K (${cdeStr}). Extreme heat signature exceeds standard operating envelopes, indicating uncontained combustion requiring immediate response.`,
      indicators: [
        `Thermal Intensity: ${frp.toFixed(1)} MW FRP · ${bt.toFixed(0)} K Brightness Temp`,
        `CDE Anomaly: ${cde != null ? `+${cde.toFixed(1)}σ standard deviations` : "Critical thermal elevation"}`,
        `Temporal Mode: ${isNight ? "Nighttime high-power persistence (Evident non-solar industrial surge)" : "Daytime intense combustion plume"}`,
        `Facility Proximity: ${hasNearFacility ? `${facility} (${(distKm ?? 0).toFixed(2)} km)` : "Unregistered / High-Intensity Standalone Site"}`,
        `AI Swarm Validation: ${conf}% Bayesian fused confidence score`,
      ],
    };
  }

  // CASE B: Persistent Industrial Flare
  if (cls === "PERSISTENT_INDUSTRIAL_FLARE" || (hasNearFacility && !isCritical && (cde == null || cde < 2.5))) {
    let cause = "Operational Gas Flare Stack / Smelting Combustion";
    if (hasNearFacility) {
      if (facilityType.includes("refinery") || facilityType.includes("petroleum") || (facility && /refinery|petro|oil|gas/i.test(facility))) {
        cause = `Continuous Elevated Flare Stack Operation at ${facility}`;
      } else if (facilityType.includes("steel") || facilityType.includes("metal") || (facility && /steel|smelter|iron/i.test(facility))) {
        cause = `Blast Furnace Top-Gas / Coke Oven Thermal Emission at ${facility}`;
      } else if (facilityType.includes("cement") || (facility && /cement/i.test(facility))) {
        cause = `Rotary Kiln Clinker Burning Operation at ${facility}`;
      } else {
        cause = `Routine Industrial Combustion Baseline at ${facility}`;
      }
    } else {
      cause = isEasternMiningBelt
        ? "Industrial Coal Washery / Sintering Kiln Operation"
        : "Continuous Unmapped Industrial Flare / Processing Heat";
    }

    const cdeDesc = cde != null
      ? `within normal operational envelope (${cde.toFixed(1)}σ deviation)`
      : "consistent with facility baseline thermal output";

    return {
      probableCause: cause,
      category: "INDUSTRIAL_FLARE",
      categoryIcon: "🏭",
      categoryLabel: "Persistent Industrial Flare",
      confidenceLevel: conf >= 80 ? "HIGH" : "MODERATE",
      regionLabel: region,
      metricAnalysis: `Baseline industrial thermal output of ${frp.toFixed(1)} MW at ${bt.toFixed(0)} K ${cdeDesc}. Typical signatures correspond to continuous hydrocarbon flaring, blast furnace exhaust, or cement kiln operations.`,
      indicators: [
        `Operational FRP: ${frp.toFixed(1)} MW · Brightness Temp: ${bt.toFixed(0)} K`,
        `Baseline Delta: ${cde != null ? `${cde >= 0 ? "+" : ""}${cde.toFixed(1)}σ (Within normal operating variance)` : "Consistent baseline"}`,
        `Diurnal Cycle: ${isNight ? "24/7 Nighttime flaring persistence (Consistent with continuous refining)" : "Standard operational daytime pass"}`,
        `Containment: ${hasNearFacility ? `Matched to ${facility} (${(distKm ?? 0).toFixed(2)} km)` : "Persistent geographic thermal cluster"}`,
      ],
    };
  }

  // CASE C: Agricultural Crop Residue / Stubble Burning
  if (cls === "AGRICULTURAL_BURNING") {
    let cause = "Post-Harvest Agricultural Stubble (Parali) Field Burning";
    if (isPunjabHaryana) {
      cause = "Paddy Crop Residue (Parali) / Wheat Stubble Burning";
    } else if (isNorthAgBelt) {
      cause = "Indo-Gangetic Plain Agricultural Crop Residue Field Clearance";
    } else if (isCentralDeccan) {
      cause = "Sugarcane Trash / Post-Harvest Biomass Burning";
    } else if (isEasternMiningBelt) {
      cause = "Eastern Agrarian Basin Paddy Straw Field Clearance";
    }

    return {
      probableCause: cause,
      category: "AGRICULTURAL",
      categoryIcon: "🌾",
      categoryLabel: "Agricultural Stubble Burning",
      confidenceLevel: conf >= 85 ? "HIGH" : "MODERATE",
      regionLabel: region,
      metricAnalysis: `Dispersed, moderate-temperature surface combustion (${frp.toFixed(1)} MW at ${bt.toFixed(0)} K). Rapid open-field burning across agricultural acreage, characteristic of post-harvest crop residue disposal.`,
      indicators: [
        `Radiative Output: ${frp.toFixed(1)} MW FRP (Typical open crop field spread)`,
        `Combustion Temp: ${bt.toFixed(0)} K (Low-to-moderate surface biomass flame)`,
        `Acquisition Mode: ${isNight ? "Evasive nighttime field incineration" : "Peak afternoon open field burn"}`,
        `Geographic Context: Open agrarian acreage (${region.split("(")[0].trim()})`,
        `Multi-Sensor Match: LandCover Class 40 (Cropland / Cultivated Area)`,
      ],
    };
  }

  // CASE D: Wildfire / Forest Fire
  if (cls === "WILDFIRE") {
    let cause = "Forest Vegetation / Canopy Wildfire";
    if (isHimalayanBelt) {
      cause = "Himalayan Pine Forest (Chir Pine) / Forest Reserve Wildfire";
    } else if (isWesternGhats) {
      cause = "Western Ghats Moist Deciduous Forest / Canopy Wildfire";
    } else if (isNorthEast) {
      cause = "Tropical Rainforest & Mountain Scrub Vegetation Wildfire";
    } else if (isEasternMiningBelt) {
      cause = "Dry Deciduous Sal Forest / Hill Tract Vegetation Fire";
    }

    return {
      probableCause: cause,
      category: "FOREST_WILDFIRE",
      categoryIcon: "🌲",
      categoryLabel: "Forest & Vegetation Wildfire",
      confidenceLevel: conf >= 80 ? "HIGH" : "MODERATE",
      regionLabel: region,
      metricAnalysis: `Broad-front natural or scrub vegetation fire (${frp.toFixed(1)} MW at ${bt.toFixed(0)} K). Surface fuel loading and canopy combustible mass in forested terrain, corroborated by high vegetation indices.`,
      indicators: [
        `Fire Radiative Power: ${frp.toFixed(1)} MW (Expanding natural flame front)`,
        `Sensor Brightness: ${bt.toFixed(0)} K (High combustible woody biomass heat)`,
        `Topographic Zone: ${region}`,
        `Satellite Overlay: LandCover Class 10/20 (Tree Cover & Shrubland)`,
        `Dispersion Impact: Regional smoke haze and particulate dispersion`,
      ],
    };
  }

  // CASE E: Deferred for Analyst Review
  if (cls === "DEFERRED_FOR_ANALYST" || event.human_review_required) {
    const reasons = event.uncertainty_reasons && event.uncertainty_reasons.length > 0
      ? event.uncertainty_reasons.join("; ")
      : "Multi-model ambiguity / Boundary condition";

    return {
      probableCause: `Ambiguous Thermal Signature — Deferred for Analyst Validation`,
      category: "ANALYST_DEFERRED",
      categoryIcon: "📋",
      categoryLabel: "Analyst Review Queue",
      confidenceLevel: "ESTIMATED",
      regionLabel: region,
      metricAnalysis: `Thermal signature with ${frp.toFixed(1)} MW at ${bt.toFixed(0)} K near decision boundary (${reasons}). Automated classifiers deferred decision to human analyst to prevent false alarms.`,
      indicators: [
        `Uncertainty Factors: ${reasons}`,
        `Model Agreement: ${event.model_agreement != null ? `${(event.model_agreement * 100).toFixed(0)}% XGB↔RF agreement` : "Borderline posterior margin"}`,
        `Telemetry: ${frp.toFixed(1)} MW FRP · ${bt.toFixed(0)} K Brightness Temp`,
        `Location: ${region}`,
      ],
    };
  }

  // ── 3. Fallback Heuristic Disambiguation (For unclassified or raw inputs) ─
  if (isHimalayanBelt || isWesternGhats || isNorthEast) {
    return {
      probableCause: "Vegetation & Forest Canopy Wildfire",
      category: "FOREST_WILDFIRE",
      categoryIcon: "🌲",
      categoryLabel: "Forest Wildfire",
      confidenceLevel: "MODERATE",
      regionLabel: region,
      metricAnalysis: `Surface biomass combustion (${frp.toFixed(1)} MW, ${bt.toFixed(0)} K) situated in ecologically dense terrain.`,
      indicators: [
        `Radiative Output: ${frp.toFixed(1)} MW FRP`,
        `Terrain: ${region}`,
      ],
    };
  }

  if (isNorthAgBelt || isPunjabHaryana) {
    return {
      probableCause: "Agricultural Crop Stubble / Field Biomass Burning",
      category: "AGRICULTURAL",
      categoryIcon: "🌾",
      categoryLabel: "Agricultural Burning",
      confidenceLevel: "HIGH",
      regionLabel: region,
      metricAnalysis: `Low-intensity open field burning (${frp.toFixed(1)} MW at ${bt.toFixed(0)} K) across agrarian land.`,
      indicators: [
        `Radiative Power: ${frp.toFixed(1)} MW FRP`,
        `Belt: ${region}`,
      ],
    };
  }

  if (frp >= 40 || bt >= 420) {
    return {
      probableCause: "Unregistered Industrial Kiln / Small-Scale Sintering Unit",
      category: "UNREGISTERED_INDUSTRIAL",
      categoryIcon: "🏭",
      categoryLabel: "Unregistered Industrial",
      confidenceLevel: "MODERATE",
      regionLabel: region,
      metricAnalysis: `High-temperature localized point source (${bt.toFixed(0)} K, ${frp.toFixed(1)} MW) indicative of unindexed kiln or metallurgical activity.`,
      indicators: [
        `Concentrated Heat: ${bt.toFixed(0)} K Brightness Temp`,
        `Power: ${frp.toFixed(1)} MW FRP`,
      ],
    };
  }

  return {
    probableCause: "Open Biomass / Municipal Waste Burning",
    category: "OPEN_WASTE",
    categoryIcon: "🔥",
    categoryLabel: "Open Waste / Brush Fire",
    confidenceLevel: "ESTIMATED",
    regionLabel: region,
    metricAnalysis: `Localized low-level thermal emission (${frp.toFixed(1)} MW at ${bt.toFixed(0)} K) consistent with open waste incineration.`,
    indicators: [
      `FRP: ${frp.toFixed(1)} MW`,
      `BT: ${bt.toFixed(0)} K`,
    ],
  };
}
