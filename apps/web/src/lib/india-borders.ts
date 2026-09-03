import type { FeatureCollection } from "geojson";

/**
 * Tactical GeoJSON State Boundaries for Indian Union
 * Defines accurate state division corridors across Northern, Western,
 * Central, Eastern, Southern, and North-Eastern regions.
 * Rendered with high-contrast tactical light-grey lines (#94a3b8).
 */
export const INDIA_STATE_BORDERS: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    // ── Punjab - Haryana - Himachal - J&K ──────────────────────────────────
    {
      type: "Feature",
      properties: { name: "Punjab / Haryana / HP" },
      geometry: {
        type: "LineString",
        coordinates: [
          [74.3, 30.1],
          [75.1, 30.3],
          [75.8, 30.6],
          [76.8, 30.9],
          [77.2, 31.0],
          [77.8, 31.4],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Haryana / Rajasthan" },
      geometry: {
        type: "LineString",
        coordinates: [
          [74.5, 29.8],
          [75.0, 29.0],
          [75.6, 28.3],
          [76.4, 28.1],
          [76.9, 27.8],
          [77.2, 27.7],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Haryana / UP / Delhi" },
      geometry: {
        type: "LineString",
        coordinates: [
          [77.1, 30.4],
          [77.2, 29.5],
          [77.3, 28.9],
          [77.4, 28.4],
          [77.5, 27.8],
        ],
      },
    },
    // ── Rajasthan - Gujarat - MP ───────────────────────────────────────────
    {
      type: "Feature",
      properties: { name: "Rajasthan / Gujarat" },
      geometry: {
        type: "LineString",
        coordinates: [
          [71.0, 24.6],
          [71.8, 24.5],
          [72.5, 24.4],
          [73.1, 24.1],
          [73.8, 23.8],
          [74.3, 23.4],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Rajasthan / MP" },
      geometry: {
        type: "LineString",
        coordinates: [
          [74.3, 23.4],
          [75.0, 24.2],
          [75.8, 24.8],
          [76.6, 25.3],
          [77.2, 25.8],
          [78.0, 26.5],
          [78.7, 26.8],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Gujarat / Maharashtra" },
      geometry: {
        type: "LineString",
        coordinates: [
          [72.8, 20.4],
          [73.2, 20.7],
          [73.8, 21.2],
          [74.2, 21.5],
          [74.8, 21.6],
        ],
      },
    },
    // ── Uttar Pradesh - Bihar - MP ─────────────────────────────────────────
    {
      type: "Feature",
      properties: { name: "UP / MP" },
      geometry: {
        type: "LineString",
        coordinates: [
          [78.7, 26.8],
          [79.2, 25.8],
          [80.0, 25.3],
          [80.8, 25.1],
          [81.8, 25.0],
          [82.6, 24.8],
          [83.1, 24.5],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "UP / Bihar" },
      geometry: {
        type: "LineString",
        coordinates: [
          [83.8, 27.4],
          [84.1, 26.8],
          [84.3, 26.0],
          [84.2, 25.6],
          [83.9, 25.2],
          [83.5, 24.9],
        ],
      },
    },
    // ── Maharashtra - MP - Chhattisgarh ────────────────────────────────────
    {
      type: "Feature",
      properties: { name: "Maharashtra / MP" },
      geometry: {
        type: "LineString",
        coordinates: [
          [74.8, 21.6],
          [76.0, 21.4],
          [77.2, 21.5],
          [78.5, 21.6],
          [79.5, 21.6],
          [80.3, 21.7],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "MP / Chhattisgarh" },
      geometry: {
        type: "LineString",
        coordinates: [
          [80.3, 21.7],
          [81.0, 22.2],
          [81.8, 23.0],
          [82.4, 23.8],
          [83.1, 24.5],
        ],
      },
    },
    // ── Bihar - Jharkhand - West Bengal - Odisha ───────────────────────────
    {
      type: "Feature",
      properties: { name: "Bihar / Jharkhand" },
      geometry: {
        type: "LineString",
        coordinates: [
          [83.5, 24.9],
          [84.5, 24.6],
          [85.5, 24.5],
          [86.5, 24.5],
          [87.3, 24.8],
          [87.8, 25.2],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Jharkhand / West Bengal" },
      geometry: {
        type: "LineString",
        coordinates: [
          [87.8, 25.2],
          [87.2, 24.2],
          [86.8, 23.7],
          [86.7, 23.0],
          [86.8, 22.4],
          [86.6, 21.9],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Jharkhand / Odisha" },
      geometry: {
        type: "LineString",
        coordinates: [
          [83.8, 22.5],
          [84.5, 22.3],
          [85.5, 22.2],
          [86.2, 22.1],
          [86.6, 21.9],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "West Bengal / Odisha" },
      geometry: {
        type: "LineString",
        coordinates: [
          [86.6, 21.9],
          [87.2, 21.7],
          [87.5, 21.5],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Chhattisgarh / Odisha" },
      geometry: {
        type: "LineString",
        coordinates: [
          [83.8, 22.5],
          [83.2, 21.5],
          [82.8, 20.5],
          [82.4, 19.5],
          [81.8, 18.8],
        ],
      },
    },
    // ── Maharashtra - Karnataka - Telangana - AP ───────────────────────────
    {
      type: "Feature",
      properties: { name: "Maharashtra / Karnataka" },
      geometry: {
        type: "LineString",
        coordinates: [
          [73.6, 15.8],
          [74.4, 16.2],
          [75.5, 17.0],
          [76.6, 17.5],
          [77.4, 17.8],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Maharashtra / Telangana" },
      geometry: {
        type: "LineString",
        coordinates: [
          [77.4, 17.8],
          [78.2, 18.8],
          [79.2, 19.3],
          [80.0, 19.0],
          [80.5, 18.7],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Karnataka / Telangana" },
      geometry: {
        type: "LineString",
        coordinates: [
          [77.4, 17.8],
          [77.5, 17.0],
          [77.4, 16.3],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Karnataka / Andhra Pradesh" },
      geometry: {
        type: "LineString",
        coordinates: [
          [77.4, 16.3],
          [77.2, 15.5],
          [77.0, 14.5],
          [77.8, 13.8],
          [78.4, 13.2],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Telangana / Andhra Pradesh" },
      geometry: {
        type: "LineString",
        coordinates: [
          [77.4, 16.3],
          [78.5, 16.4],
          [79.5, 16.8],
          [80.5, 17.4],
          [81.3, 17.8],
        ],
      },
    },
    // ── Karnataka - Kerala - Tamil Nadu ────────────────────────────────────
    {
      type: "Feature",
      properties: { name: "Karnataka / Kerala" },
      geometry: {
        type: "LineString",
        coordinates: [
          [74.9, 12.8],
          [75.5, 12.2],
          [76.1, 11.9],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Karnataka / Tamil Nadu" },
      geometry: {
        type: "LineString",
        coordinates: [
          [76.1, 11.9],
          [76.8, 11.8],
          [77.4, 12.0],
          [77.9, 12.5],
          [78.4, 13.2],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Kerala / Tamil Nadu" },
      geometry: {
        type: "LineString",
        coordinates: [
          [76.1, 11.9],
          [76.7, 10.8],
          [77.0, 10.0],
          [77.2, 9.2],
          [77.5, 8.4],
          [77.55, 8.08],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Andhra Pradesh / Tamil Nadu" },
      geometry: {
        type: "LineString",
        coordinates: [
          [78.4, 13.2],
          [79.2, 13.2],
          [80.1, 13.5],
        ],
      },
    },
    // ── North-East (Assam / Meghalaya / Arunachal / Nagaland / Manipur) ────
    {
      type: "Feature",
      properties: { name: "Assam / Meghalaya" },
      geometry: {
        type: "LineString",
        coordinates: [
          [89.9, 25.8],
          [91.0, 25.9],
          [92.0, 25.8],
          [92.6, 25.4],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Assam / Arunachal Pradesh" },
      geometry: {
        type: "LineString",
        coordinates: [
          [92.1, 26.9],
          [93.2, 27.2],
          [94.5, 27.5],
          [95.5, 27.8],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Assam / Nagaland" },
      geometry: {
        type: "LineString",
        coordinates: [
          [93.5, 25.8],
          [94.2, 26.3],
          [94.8, 26.8],
          [95.2, 27.0],
        ],
      },
    },
  ],
};
