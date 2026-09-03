import type { FeatureCollection } from "geojson";

/**
 * Comprehensive Indian Sovereign Geographic Places Dataset
 * 28 States, 8 Union Territories, and Major/Industrial Cities
 * Optimized for Tactical Command & Control MapLibre Rendering
 */

export interface IndianPlace {
  name: string;
  type: "state" | "ut" | "metro" | "city" | "industrial_hub";
  coordinates: [number, number]; // [lng, lat]
  minZoom: number;
  maxZoom?: number;
  stateCode?: string;
  isIndustrial?: boolean;
}

export const INDIAN_STATES_AND_UTS: IndianPlace[] = [
  // ── 28 States ──────────────────────────────────────────────────────────
  { name: "ANDHRA PRADESH", type: "state", coordinates: [79.74, 15.91], minZoom: 4.5, stateCode: "AP" },
  { name: "ARUNACHAL PRADESH", type: "state", coordinates: [94.72, 28.21], minZoom: 4.8, stateCode: "AR" },
  { name: "ASSAM", type: "state", coordinates: [92.93, 26.2], minZoom: 4.8, stateCode: "AS" },
  { name: "BIHAR", type: "state", coordinates: [85.31, 25.09], minZoom: 4.8, stateCode: "BR" },
  { name: "CHHATTISGARH", type: "state", coordinates: [81.86, 21.27], minZoom: 4.8, stateCode: "CG" },
  { name: "GOA", type: "state", coordinates: [74.12, 15.29], minZoom: 6.0, stateCode: "GA" },
  { name: "GUJARAT", type: "state", coordinates: [71.19, 22.25], minZoom: 4.5, stateCode: "GJ" },
  { name: "HARYANA", type: "state", coordinates: [76.08, 29.05], minZoom: 5.2, stateCode: "HR" },
  { name: "HIMACHAL PRADESH", type: "state", coordinates: [77.17, 31.1], minZoom: 5.0, stateCode: "HP" },
  { name: "JHARKHAND", type: "state", coordinates: [85.27, 23.61], minZoom: 4.8, stateCode: "JH" },
  { name: "KARNATAKA", type: "state", coordinates: [75.71, 15.31], minZoom: 4.5, stateCode: "KA" },
  { name: "KERALA", type: "state", coordinates: [76.27, 10.85], minZoom: 5.0, stateCode: "KL" },
  { name: "MADHYA PRADESH", type: "state", coordinates: [77.41, 22.97], minZoom: 4.5, stateCode: "MP" },
  { name: "MAHARASHTRA", type: "state", coordinates: [75.71, 19.75], minZoom: 4.5, stateCode: "MH" },
  { name: "MANIPUR", type: "state", coordinates: [93.9, 24.66], minZoom: 5.5, stateCode: "MN" },
  { name: "MEGHALAYA", type: "state", coordinates: [91.36, 25.46], minZoom: 5.5, stateCode: "ML" },
  { name: "MIZORAM", type: "state", coordinates: [92.93, 23.16], minZoom: 5.5, stateCode: "MZ" },
  { name: "NAGALAND", type: "state", coordinates: [94.56, 26.15], minZoom: 5.5, stateCode: "NL" },
  { name: "ODISHA", type: "state", coordinates: [84.41, 20.95], minZoom: 4.6, stateCode: "OD" },
  { name: "PUNJAB", type: "state", coordinates: [75.34, 31.14], minZoom: 5.0, stateCode: "PB" },
  { name: "RAJASTHAN", type: "state", coordinates: [74.21, 27.02], minZoom: 4.4, stateCode: "RJ" },
  { name: "SIKKIM", type: "state", coordinates: [88.51, 27.53], minZoom: 6.0, stateCode: "SK" },
  { name: "TAMIL NADU", type: "state", coordinates: [78.65, 11.12], minZoom: 4.5, stateCode: "TN" },
  { name: "TELANGANA", type: "state", coordinates: [79.01, 18.11], minZoom: 4.6, stateCode: "TS" },
  { name: "TRIPURA", type: "state", coordinates: [91.98, 23.94], minZoom: 5.8, stateCode: "TR" },
  { name: "UTTAR PRADESH", type: "state", coordinates: [80.34, 26.84], minZoom: 4.5, stateCode: "UP" },
  { name: "UTTARAKHAND", type: "state", coordinates: [79.01, 30.06], minZoom: 5.0, stateCode: "UK" },
  { name: "WEST BENGAL", type: "state", coordinates: [87.85, 22.98], minZoom: 4.8, stateCode: "WB" },

  // ── 8 Union Territories ────────────────────────────────────────────────
  { name: "JAMMU & KASHMIR", type: "ut", coordinates: [74.79, 33.77], minZoom: 4.8, stateCode: "JK" },
  { name: "LADAKH", type: "ut", coordinates: [77.57, 34.15], minZoom: 4.8, stateCode: "LA" },
  { name: "NATIONAL CAPITAL (DELHI)", type: "ut", coordinates: [77.1, 28.7], minZoom: 5.5, stateCode: "DL" },
  { name: "CHANDIGARH", type: "ut", coordinates: [76.77, 30.73], minZoom: 6.8, stateCode: "CH" },
  { name: "PUDUCHERRY", type: "ut", coordinates: [79.8, 11.94], minZoom: 6.8, stateCode: "PY" },
  { name: "ANDAMAN & NICOBAR", type: "ut", coordinates: [92.74, 11.62], minZoom: 5.2, stateCode: "AN" },
  { name: "LAKSHADWEEP", type: "ut", coordinates: [72.64, 10.56], minZoom: 6.0, stateCode: "LD" },
  { name: "DADRA & NAGAR HAVELI / DAMAN", type: "ut", coordinates: [72.97, 20.42], minZoom: 6.8, stateCode: "DN" },
];

export const INDIAN_CITIES: IndianPlace[] = [
  // ── Tier 1 Metros (minZoom: 5.8) ────────────────────────────────────────
  { name: "New Delhi", type: "metro", coordinates: [77.209, 28.6139], minZoom: 5.6 },
  { name: "Mumbai", type: "metro", coordinates: [72.8777, 19.076], minZoom: 5.6 },
  { name: "Bengaluru", type: "metro", coordinates: [77.5946, 12.9716], minZoom: 5.6 },
  { name: "Kolkata", type: "metro", coordinates: [88.3639, 22.5726], minZoom: 5.6 },
  { name: "Chennai", type: "metro", coordinates: [80.2707, 13.0827], minZoom: 5.6 },
  { name: "Hyderabad", type: "metro", coordinates: [78.4867, 17.385], minZoom: 5.6 },
  { name: "Ahmedabad", type: "metro", coordinates: [72.5714, 23.0225], minZoom: 5.8 },
  { name: "Pune", type: "metro", coordinates: [73.8567, 18.5204], minZoom: 5.8 },

  // ── Tier 2 Major State Capitals & Industrial Corridors (minZoom: 6.6) ──
  { name: "Surat", type: "industrial_hub", coordinates: [72.8311, 21.1702], minZoom: 6.5, isIndustrial: true },
  { name: "Jamnagar", type: "industrial_hub", coordinates: [70.0577, 22.4707], minZoom: 6.5, isIndustrial: true },
  { name: "Hazira", type: "industrial_hub", coordinates: [72.6446, 21.1057], minZoom: 6.8, isIndustrial: true },
  { name: "Vadodara", type: "industrial_hub", coordinates: [73.1812, 22.3072], minZoom: 6.6, isIndustrial: true },
  { name: "Jamshedpur", type: "industrial_hub", coordinates: [86.2029, 22.8046], minZoom: 6.6, isIndustrial: true },
  { name: "Visakhapatnam", type: "industrial_hub", coordinates: [83.2185, 17.6868], minZoom: 6.5, isIndustrial: true },
  { name: "Haldia", type: "industrial_hub", coordinates: [88.0655, 22.0621], minZoom: 6.8, isIndustrial: true },
  { name: "Kochi", type: "industrial_hub", coordinates: [76.2673, 9.9312], minZoom: 6.5, isIndustrial: true },
  { name: "Mangalore", type: "industrial_hub", coordinates: [74.856, 12.9141], minZoom: 6.5, isIndustrial: true },
  { name: "Nagpur", type: "city", coordinates: [79.0882, 21.1458], minZoom: 6.2 },
  { name: "Jaipur", type: "city", coordinates: [75.7873, 26.9124], minZoom: 6.0 },
  { name: "Lucknow", type: "city", coordinates: [80.9462, 26.8467], minZoom: 6.0 },
  { name: "Kanpur", type: "city", coordinates: [80.3319, 26.4499], minZoom: 6.2 },
  { name: "Indore", type: "city", coordinates: [75.8577, 22.7196], minZoom: 6.2 },
  { name: "Bhopal", type: "city", coordinates: [77.4126, 23.2599], minZoom: 6.2 },
  { name: "Patna", type: "city", coordinates: [85.1376, 25.5941], minZoom: 6.2 },
  { name: "Ludhiana", type: "city", coordinates: [75.8573, 30.901], minZoom: 6.4 },
  { name: "Amritsar", type: "city", coordinates: [74.8723, 31.634], minZoom: 6.4 },
  { name: "Jalandhar", type: "city", coordinates: [75.5762, 31.326], minZoom: 6.8 },
  { name: "Bhubaneswar", type: "city", coordinates: [85.8245, 20.2961], minZoom: 6.4 },
  { name: "Ranchi", type: "city", coordinates: [85.3096, 23.3441], minZoom: 6.4 },
  { name: "Raipur", type: "city", coordinates: [81.6296, 21.2514], minZoom: 6.4 },
  { name: "Chandigarh", type: "city", coordinates: [76.7794, 30.7333], minZoom: 6.4 },
  { name: "Dehradun", type: "city", coordinates: [78.0322, 30.3165], minZoom: 6.6 },
  { name: "Shimla", type: "city", coordinates: [77.1734, 31.1048], minZoom: 6.8 },
  { name: "Srinagar", type: "city", coordinates: [74.7973, 34.0837], minZoom: 6.4 },
  { name: "Jammu", type: "city", coordinates: [74.857, 32.7266], minZoom: 6.6 },
  { name: "Leh", type: "city", coordinates: [77.5771, 34.1526], minZoom: 6.8 },
  { name: "Guwahati", type: "city", coordinates: [91.7362, 26.1445], minZoom: 6.2 },
  { name: "Shillong", type: "city", coordinates: [91.8933, 25.5788], minZoom: 6.8 },
  { name: "Agartala", type: "city", coordinates: [91.2868, 23.8315], minZoom: 6.8 },
  { name: "Imphal", type: "city", coordinates: [93.9368, 24.817], minZoom: 6.8 },
  { name: "Aizawl", type: "city", coordinates: [92.7176, 23.7271], minZoom: 6.8 },
  { name: "Kohima", type: "city", coordinates: [94.1086, 25.6751], minZoom: 6.8 },
  { name: "Itanagar", type: "city", coordinates: [93.6053, 27.0844], minZoom: 6.8 },
  { name: "Gangtok", type: "city", coordinates: [88.6138, 27.3389], minZoom: 6.8 },
  { name: "Panaji", type: "city", coordinates: [73.8278, 15.4909], minZoom: 6.8 },
  { name: "Port Blair", type: "city", coordinates: [92.7265, 11.6234], minZoom: 6.8 },

  // ── Tier 3 Regional Centres & Disticts (minZoom: 7.5 - 8.5) ─────────────
  { name: "Jodhpur", type: "city", coordinates: [73.0243, 26.2389], minZoom: 7.2 },
  { name: "Udaipur", type: "city", coordinates: [73.7125, 24.5854], minZoom: 7.4 },
  { name: "Kota", type: "city", coordinates: [75.8648, 25.2138], minZoom: 7.4 },
  { name: "Gwalior", type: "city", coordinates: [78.1828, 26.2183], minZoom: 7.2 },
  { name: "Jabalpur", type: "city", coordinates: [79.9864, 23.1815], minZoom: 7.4 },
  { name: "Varanasi", type: "city", coordinates: [82.9739, 25.3176], minZoom: 7.0 },
  { name: "Prayagraj", type: "city", coordinates: [81.8463, 25.4358], minZoom: 7.2 },
  { name: "Agra", type: "city", coordinates: [78.0081, 27.1767], minZoom: 7.0 },
  { name: "Meerut", type: "city", coordinates: [77.7064, 28.9845], minZoom: 7.4 },
  { name: "Bareilly", type: "city", coordinates: [79.4304, 28.367], minZoom: 7.4 },
  { name: "Aligarh", type: "city", coordinates: [78.088, 27.8974], minZoom: 7.6 },
  { name: "Gorakhpur", type: "city", coordinates: [83.3732, 26.7606], minZoom: 7.4 },
  { name: "Bhatinda", type: "city", coordinates: [74.9455, 30.211], minZoom: 7.8 },
  { name: "Patiala", type: "city", coordinates: [76.3869, 30.3398], minZoom: 7.8 },
  { name: "Karnal", type: "city", coordinates: [76.9897, 29.6857], minZoom: 7.8 },
  { name: "Hisar", type: "city", coordinates: [75.7217, 29.1492], minZoom: 7.8 },
  { name: "Faridabad", type: "city", coordinates: [77.3178, 28.4089], minZoom: 7.5 },
  { name: "Gurugram", type: "city", coordinates: [77.0266, 28.4595], minZoom: 7.5 },
  { name: "Noida", type: "city", coordinates: [77.391, 28.5355], minZoom: 7.5 },
  { name: "Nashik", type: "city", coordinates: [73.7898, 19.9975], minZoom: 7.2 },
  { name: "Aurangabad", type: "city", coordinates: [75.3433, 19.8762], minZoom: 7.4 },
  { name: "Solapur", type: "city", coordinates: [75.9064, 17.6599], minZoom: 7.6 },
  { name: "Kolhapur", type: "city", coordinates: [74.2433, 16.705], minZoom: 7.8 },
  { name: "Rajkot", type: "city", coordinates: [70.8022, 22.3039], minZoom: 7.2 },
  { name: "Bhavnagar", type: "city", coordinates: [72.1519, 21.7645], minZoom: 7.6 },
  { name: "Anand", type: "city", coordinates: [72.9289, 22.5645], minZoom: 7.8 },
  { name: "Bharuch", type: "industrial_hub", coordinates: [72.9959, 21.7051], minZoom: 7.8, isIndustrial: true },
  { name: "Ankleshwar", type: "industrial_hub", coordinates: [73.0031, 21.6264], minZoom: 8.0, isIndustrial: true },
  { name: "Vapi", type: "industrial_hub", coordinates: [72.906, 20.3709], minZoom: 8.0, isIndustrial: true },
  { name: "Coimbatore", type: "city", coordinates: [76.9558, 11.0168], minZoom: 7.2 },
  { name: "Madurai", type: "city", coordinates: [78.1198, 9.9252], minZoom: 7.4 },
  { name: "Tiruchirappalli", type: "city", coordinates: [78.7047, 10.7905], minZoom: 7.4 },
  { name: "Salem", type: "city", coordinates: [78.146, 11.6643], minZoom: 7.6 },
  { name: "Tirunelveli", type: "city", coordinates: [77.7567, 8.7139], minZoom: 7.8 },
  { name: "Kozhikode", type: "city", coordinates: [75.7804, 11.2588], minZoom: 7.4 },
  { name: "Thrissur", type: "city", coordinates: [76.2144, 10.5276], minZoom: 7.8 },
  { name: "Thiruvananthapuram", type: "city", coordinates: [76.9366, 8.5241], minZoom: 7.2 },
  { name: "Hubballi-Dharwad", type: "city", coordinates: [75.124, 15.3647], minZoom: 7.4 },
  { name: "Mysuru", type: "city", coordinates: [76.6394, 12.2958], minZoom: 7.4 },
  { name: "Belagavi", type: "city", coordinates: [74.4977, 15.8497], minZoom: 7.8 },
  { name: "Kalaburagi", type: "city", coordinates: [76.8343, 17.3297], minZoom: 7.8 },
  { name: "Warangal", type: "city", coordinates: [79.5941, 17.9689], minZoom: 7.4 },
  { name: "Nizamabad", type: "city", coordinates: [78.0941, 18.6725], minZoom: 7.8 },
  { name: "Karimnagar", type: "city", coordinates: [79.1288, 18.4386], minZoom: 7.8 },
  { name: "Vijayawada", type: "city", coordinates: [80.648, 16.5062], minZoom: 7.2 },
  { name: "Guntur", type: "city", coordinates: [80.4365, 16.3067], minZoom: 7.4 },
  { name: "Nellore", type: "city", coordinates: [79.9865, 14.4426], minZoom: 7.6 },
  { name: "Kurnool", type: "city", coordinates: [78.0373, 15.8281], minZoom: 7.6 },
  { name: "Tirupati", type: "city", coordinates: [79.4192, 13.6288], minZoom: 7.6 },
  { name: "Dhanbad", type: "industrial_hub", coordinates: [86.4304, 23.7957], minZoom: 7.4, isIndustrial: true },
  { name: "Bokaro Steel City", type: "industrial_hub", coordinates: [86.1511, 23.6693], minZoom: 7.6, isIndustrial: true },
  { name: "Rourkela", type: "industrial_hub", coordinates: [84.8536, 22.2604], minZoom: 7.6, isIndustrial: true },
  { name: "Durg-Bhilai", type: "industrial_hub", coordinates: [81.38, 21.19], minZoom: 7.4, isIndustrial: true },
  { name: "Korba", type: "industrial_hub", coordinates: [82.6841, 22.3595], minZoom: 7.8, isIndustrial: true },
  { name: "Asansol", type: "industrial_hub", coordinates: [86.9746, 23.6739], minZoom: 7.6, isIndustrial: true },
  { name: "Durgapur", type: "industrial_hub", coordinates: [87.3119, 23.5204], minZoom: 7.6, isIndustrial: true },
  { name: "Siliguri", type: "city", coordinates: [88.4352, 26.7271], minZoom: 7.2 },
  { name: "Muzaffarpur", type: "city", coordinates: [85.3906, 26.1209], minZoom: 7.6 },
  { name: "Gaya", type: "city", coordinates: [85.0002, 24.7914], minZoom: 7.6 },
  { name: "Bhagalpur", type: "city", coordinates: [86.9842, 25.2425], minZoom: 7.8 },
  { name: "Dibrugarh", type: "city", coordinates: [94.912, 27.4728], minZoom: 7.6 },
  { name: "Silchar", type: "city", coordinates: [92.7789, 24.8333], minZoom: 7.8 },
];

/**
 * Builds GeoJSON Feature Collection for Indian States
 */
export function getIndiaStatesGeoJSON(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: INDIAN_STATES_AND_UTS.map((item) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: item.coordinates,
      },
      properties: {
        name: item.name,
        type: item.type,
        minZoom: item.minZoom,
      },
    })),
  };
}

/**
 * Builds GeoJSON Feature Collection for Indian Cities & Industrial Hubs
 */
export function getIndiaCitiesGeoJSON(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: INDIAN_CITIES.map((item) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: item.coordinates,
      },
      properties: {
        name: item.name,
        type: item.type,
        minZoom: item.minZoom,
        isIndustrial: item.isIndustrial ? 1 : 0,
      },
    })),
  };
}
