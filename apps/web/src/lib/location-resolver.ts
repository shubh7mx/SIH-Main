import type { HotspotEvent } from "./types";
import { INDIAN_CITIES, INDIAN_STATES_AND_UTS } from "./india-places";

export interface GeoLocationInfo {
  city: string;
  state: string;
  displayLocation: string; // e.g. "Jamnagar, Gujarat"
  region: string;
  isKnownFacility: boolean;
}

// Known facility-to-location mapping for 100% accurate ground truth
const KNOWN_FACILITY_LOCATIONS: Record<string, { city: string; state: string }> = {
  jamnagar: { city: "Jamnagar", state: "Gujarat" },
  haldia: { city: "Haldia", state: "West Bengal" },
  panipat: { city: "Panipat", state: "Haryana" },
  jamshedpur: { city: "Jamshedpur", state: "Jharkhand" },
  hazira: { city: "Surat", state: "Gujarat" },
  mumbai: { city: "Mumbai", state: "Maharashtra" },
  visakhapatnam: { city: "Visakhapatnam", state: "Andhra Pradesh" },
  vizag: { city: "Visakhapatnam", state: "Andhra Pradesh" },
  bokaro: { city: "Bokaro", state: "Jharkhand" },
  mangalore: { city: "Mangalore", state: "Karnataka" },
  kochi: { city: "Kochi", state: "Kerala" },
  chennai: { city: "Chennai", state: "Tamil Nadu" },
  dadri: { city: "Gautam Buddha Nagar", state: "Uttar Pradesh" },
  ludhiana: { city: "Ludhiana", state: "Punjab" },
  bathinda: { city: "Bathinda", state: "Punjab" },
  angul: { city: "Angul", state: "Odisha" },
  paradip: { city: "Jagatsinghpur", state: "Odisha" },
  nagpur: { city: "Nagpur", state: "Maharashtra" },
  raipur: { city: "Raipur", state: "Chhattisgarh" },
  bhubaneswar: { city: "Bhubaneswar", state: "Odisha" },
  amritsar: { city: "Amritsar", state: "Punjab" },
  jalandhar: { city: "Jalandhar", state: "Punjab" },
  patna: { city: "Patna", state: "Bihar" },
  ranchi: { city: "Ranchi", state: "Jharkhand" },
  jaipur: { city: "Jaipur", state: "Rajasthan" },
  lucknow: { city: "Lucknow", state: "Uttar Pradesh" },
  kanpur: { city: "Kanpur", state: "Uttar Pradesh" },
  indore: { city: "Indore", state: "Madhya Pradesh" },
  bhopal: { city: "Bhopal", state: "Madhya Pradesh" },
  vadodara: { city: "Vadodara", state: "Gujarat" },
  ahmedabad: { city: "Ahmedabad", state: "Gujarat" },
  surat: { city: "Surat", state: "Gujarat" },
  ankleshwar: { city: "Bharuch", state: "Gujarat" },
  vapi: { city: "Valsad", state: "Gujarat" },
};

// Precise Bounding Box approximations for Indian States
const STATE_BOUNDS = [
  { name: "Punjab", latMin: 29.5, latMax: 32.5, lonMin: 73.8, lonMax: 77.0, defaultCity: "Ludhiana" },
  { name: "Haryana", latMin: 27.6, latMax: 30.9, lonMin: 74.4, lonMax: 77.6, defaultCity: "Panipat" },
  { name: "Gujarat", latMin: 20.1, latMax: 24.7, lonMin: 68.1, lonMax: 74.5, defaultCity: "Jamnagar" },
  { name: "Maharashtra", latMin: 15.6, latMax: 22.0, lonMin: 72.6, lonMax: 80.9, defaultCity: "Mumbai" },
  { name: "Odisha", latMin: 17.8, latMax: 22.6, lonMin: 81.4, lonMax: 87.5, defaultCity: "Bhubaneswar" },
  { name: "West Bengal", latMin: 21.5, latMax: 27.2, lonMin: 85.8, lonMax: 89.9, defaultCity: "Kolkata" },
  { name: "Jharkhand", latMin: 21.9, latMax: 25.3, lonMin: 83.3, lonMax: 87.9, defaultCity: "Ranchi" },
  { name: "Chhattisgarh", latMin: 17.8, latMax: 24.1, lonMin: 80.2, lonMax: 84.4, defaultCity: "Raipur" },
  { name: "Rajasthan", latMin: 23.0, latMax: 30.2, lonMin: 69.5, lonMax: 78.3, defaultCity: "Jaipur" },
  { name: "Uttar Pradesh", latMin: 23.8, latMax: 30.4, lonMin: 77.1, lonMax: 84.6, defaultCity: "Lucknow" },
  { name: "Uttarakhand", latMin: 28.7, latMax: 31.5, lonMin: 77.5, lonMax: 81.1, defaultCity: "Dehradun" },
  { name: "Madhya Pradesh", latMin: 21.3, latMax: 26.9, lonMin: 74.0, lonMax: 82.8, defaultCity: "Bhopal" },
  { name: "Andhra Pradesh", latMin: 12.6, latMax: 19.9, lonMin: 76.7, lonMax: 84.8, defaultCity: "Visakhapatnam" },
  { name: "Tamil Nadu", latMin: 8.0, latMax: 13.6, lonMin: 76.2, lonMax: 80.3, defaultCity: "Chennai" },
  { name: "Kerala", latMin: 8.3, latMax: 12.8, lonMin: 74.8, lonMax: 77.4, defaultCity: "Kochi" },
  { name: "Karnataka", latMin: 11.5, latMax: 18.5, lonMin: 74.0, lonMax: 78.6, defaultCity: "Bengaluru" },
  { name: "Bihar", latMin: 24.3, latMax: 27.5, lonMin: 83.3, lonMax: 88.3, defaultCity: "Patna" },
  { name: "Assam", latMin: 24.1, latMax: 28.0, lonMin: 89.7, lonMax: 96.0, defaultCity: "Guwahati" },
];

/**
 * Calculates haversine approximate distance in kilometers between two coords.
 */
function getApproxDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * 111.0;
  const dLon = (lon2 - lon1) * 111.0 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

/**
 * High-precision Indian City and State resolver from event metadata and coordinates.
 */
export function getEventLocation(
  eventOrLat: HotspotEvent | { latitude?: number | null; longitude?: number | null; facility_name?: string | null },
  lonOpt?: number
): GeoLocationInfo {
  let lat = 0;
  let lon = 0;
  let facName = "";

  if (typeof eventOrLat === "number") {
    lat = eventOrLat;
    lon = Number(lonOpt ?? 0);
  } else if (eventOrLat) {
    lat = Number(eventOrLat.latitude ?? 0);
    lon = Number(eventOrLat.longitude ?? 0);
    facName = String(eventOrLat.facility_name ?? "").toLowerCase();
  }

  // 1. Check known facility dictionary matching
  if (facName) {
    for (const [key, loc] of Object.entries(KNOWN_FACILITY_LOCATIONS)) {
      if (facName.includes(key)) {
        return {
          city: loc.city,
          state: loc.state,
          displayLocation: `${loc.city}, ${loc.state}`,
          region: loc.state,
          isKnownFacility: true,
        };
      }
    }
  }

  // 2. Find closest Indian city within realistic proximity (<= 150 km)
  let closestCity: { name: string; dist: number } | null = null;
  for (const place of INDIAN_CITIES) {
    const dist = getApproxDistanceKm(lat, lon, place.coordinates[1], place.coordinates[0]);
    if (!closestCity || dist < closestCity.dist) {
      closestCity = { name: place.name, dist };
    }
  }

  // 3. Resolve State by Geographic Bounding Box
  let resolvedState = "India";
  let defaultCityForState = closestCity?.name ?? "District Region";

  for (const sb of STATE_BOUNDS) {
    if (lat >= sb.latMin && lat <= sb.latMax && lon >= sb.lonMin && lon <= sb.lonMax) {
      resolvedState = sb.name;
      defaultCityForState = sb.defaultCity;
      break;
    }
  }

  // If closest city is within reasonable range (<= 100km), use that city
  const finalCity = (closestCity && closestCity.dist <= 100) ? closestCity.name : defaultCityForState;

  return {
    city: finalCity,
    state: resolvedState,
    displayLocation: resolvedState !== "India" ? `${finalCity}, ${resolvedState}` : finalCity,
    region: resolvedState,
    isKnownFacility: false,
  };
}
