import type { StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, Feature } from "geojson";

/**
 * NTRO Dark Tactical Command & Control MapLibre Style Specification
 * Deep Abyss (#03060a) · Accent Cyan (#06b6d4) · Precision Telemetry Overlays
 */
export const TACTICAL_DARK_STYLE: StyleSpecification = {
  version: 8,
  name: "NTRO-Dark-Tactical",
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    "maplibre-demotiles": {
      type: "vector",
      tiles: ["https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf"],
      minzoom: 0,
      maxzoom: 6,
      attribution: "© MapLibre · Natural Earth",
    },
  },
  layers: [
    {
      id: "background-canvas",
      type: "background",
      paint: {
        "background-color": "#03060a",
      },
    },
    {
      id: "countries-fill",
      type: "fill",
      source: "maplibre-demotiles",
      "source-layer": "countries",
      paint: {
        "fill-color": "#0b1220",
        "fill-outline-color": "#0b1220",
      },
    },
    {
      id: "countries-boundary",
      type: "line",
      source: "maplibre-demotiles",
      "source-layer": "countries",
      paint: {
        "line-color": "#ffffff",
        "line-width": 1.2,
        "line-opacity": 0.9,
      },
    },
  ],
};

/**
 * Generates an intelligence coordinate grid (Graticule) across India & surrounding region
 */
export function generateTacticalGraticule(): FeatureCollection {
  const features: Feature[] = [];

  // Latitudes from -10 to 45 step 5
  for (let lat = -10; lat <= 45; lat += 5) {
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [50, lat],
          [110, lat],
        ],
      },
      properties: {
        type: "grid",
        label: `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}`,
        isMajor: lat % 10 === 0,
      },
    });
  }

  // Longitudes from 55 to 105 step 5
  for (let lon = 55; lon <= 105; lon += 5) {
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [lon, -10],
          [lon, 45],
        ],
      },
      properties: {
        type: "grid",
        label: `${lon}°E`,
        isMajor: lon % 10 === 0,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * Simplified India National Boundary polygon (approximate coastline + borders)
 * Derived from public-domain Natural Earth admin-0 boundaries, simplified for tactical HUD.
 */
export const INDIA_BOUNDARY: Feature = {
  type: "Feature",
  properties: { name: "Republic of India", iso: "IND" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        // ── West coast, from Gujarat (Rann of Kutch) down to Kanyakumari ──
        [68.186, 23.975],   // Sir Creek / Rann of Kutch
        [68.743, 23.535],
        [69.922, 22.556],   // Kori Creek
        [70.05, 22.46],
        [70.34, 21.07],     // Saurashtra coast
        [70.83, 20.64],
        [72.0, 20.75],      // Gulf of Khambhat west
        [72.63, 21.0],      // Gulf of Khambhat head
        [72.4, 21.58],
        [72.85, 21.9],      // Gulf of Khambhat east / Bharuch
        [72.94, 22.48],     // Surat
        [72.83, 22.87],     // Daman
        [72.85, 23.25],
        [72.98, 23.88],     // Mumbai region coast
        [72.82, 24.03],     // Thane
        [72.95, 24.61],     // Palghar
        [72.86, 25.18],     // Dahanu
        [72.9, 25.71],
        [72.94, 26.42],
        [72.85, 27.14],
        [72.36, 27.68],
        [71.9, 28.04],     // Jaisalmer western border
        [70.76, 28.03],
        [69.51, 28.02],
        [68.86, 27.91],
        [68.44, 27.75],
        [67.97, 26.97],    // Barmer sector
        [68.13, 26.62],
        [68.75, 26.67],     // towards Jalore/Sirohi
        [69.31, 26.87],     // Jalore district
        [68.99, 27.55],
        [69.65, 27.95],     // Bikaner
        [70.09, 28.09],
        [69.52, 29.4],      // Bikaner north
        [69.7, 30.04],
        [70.34, 30.42],     // Ferozepur sector
        [70.77, 31.03],     // Amritsar
        [71.04, 31.39],     // Jalandhar
        [71.45, 32.32],     // Pathankot
        [72.03, 32.44],
        [72.9, 32.77],
        [73.82, 33.35],     // Kashmir valley / LoC
        [74.25, 34.35],
        [74.99, 34.73],     // LoC NE
        [75.35, 34.72],
        [76.1, 35.1],
        [76.15, 35.85],     // Siachen
        [77.82, 35.5],
        [78.0, 35.5],
        [78.95, 35.67],     // Ladakh east / Aksai Chin edge
        [79.19, 36.0],
        [79.53, 36.56],     // Depsang
        [78.738, 37.05],     // Daulat Beg Oldi sector
        [78.02, 37.02],
        [77.1, 36.9],
        [76.2, 36.85],      // Karakoram Pass
        [75.0, 36.84],
        [74.6, 36.85],
        [73.9, 36.85],
        [73.858, 37.017],   // NE corner near Siachen
        [77.83, 38.5],      // China border (Ladakh/Hotan)
        [78.93, 38.6],
        [79.5, 38.2],
        [78.9, 37.1],
        [79.2, 36.4],
        [79.0, 35.4],
        [78.75, 34.4],
        [79.0, 33.6],
        [79.1, 33.0],
        [78.7, 32.6],
        [78.4, 32.5],
        [78.77, 31.5],      // Uttarakhand border
        [79.3, 31.3],
        [79.15, 30.8],
        [80.23, 30.42],     // Nepal border
        [80.45, 29.9],
        [81.0, 29.3],
        [81.7, 28.7],
        [82.7, 28.17],
        [83.6, 28.0],
        [84.0, 27.9],
        [84.15, 27.4],
        [84.6, 27.4],
        [85.8, 26.9],      // Bihar/Nepal
        [85.05, 26.7],
        [85.8, 26.36],
        [86.95, 26.5],
        [87.98, 26.35],
        [88.05, 26.3],
        [88.11, 26.43],
        [88.75, 26.3],
        [89.09, 26.3],
        [88.81, 26.82],    // Sikkim
        [88.71, 27.34],
        [89.15, 27.31],
        [89.03, 28.02],    // Bhutan west
        [90.7, 28.08],
        [92.1, 27.8],      // Arunachal west
        [92.14, 27.98],
        [93.7, 28.6],
        [95.0, 29.03],
        [96.5, 29.45],
        [97.4, 28.2],
        [97.13, 27.7],
        [96.9, 27.5],
        [96.1, 27.2],
        [96.4, 27.0],
        [96.2, 26.7],
        [96.9, 26.0],
        [97.15, 26.2],
        [97.0, 25.5],
        [97.7, 25.1],
        [98.15, 24.5],     // Nagaland/Myanmar
        [98.7, 23.9],
        [98.7, 23.5],
        [98.6, 22.9],
        [98.5, 24.2],
        [98.6, 25.4],
        [98.25, 26.6],
        [98.4, 27.3],
        [97.32, 28.26],    // NE frontier
        [96.5, 28.5],
        [95.3, 28.2],
        [95.0, 27.55],
        [94.3, 27.6],
        [94.6, 26.8],
        [94.3, 26.2],
        [94.6, 25.5],
        [94.35, 25.0],
        [93.5, 24.2],
        [93.4, 23.9],
        [93.5, 23.1],
        [93.4, 22.2],
        [93.2, 22.5],
        [93.1, 23.0],
        [92.6, 23.7],
        [92.4, 23.1],
        [92.2, 22.2],
        [92.4, 21.9],
        [92.2, 21.2],      // Mizoram/Chittagong
        [92.6, 21.6],
        [92.05, 21.2],
        [91.8, 22.9],
        [91.8, 23.6],
        [91.2, 23.4],
        [91.5, 23.0],
        [91.7, 22.3],
        [91.15, 23.0],
        [91.4, 24.0],
        [91.15, 24.9],     // Tripura
        [91.4, 24.1],
        [91.9, 24.2],
        [92.35, 24.9],
        [92.1, 25.1],
        [91.8, 25.2],
        [91.4, 25.2],
        [91.2, 25.2],
        [90.4, 25.1],
        [89.8, 25.3],
        [89.7, 25.7],
        [89.66, 26.3],
        [88.35, 26.5],
        [88.1, 26.4],
        [88.08, 26.36],
        [88.0, 26.4],
        [87.1, 26.8],
        [86.9, 27.3],
        [85.1, 27.9],
        [84.7, 27.35],
        [84.0, 27.4],
        [83.8, 27.3],
        [83.1, 27.4],
        [82.7, 27.9],
        [82.0, 28.7],
        [81.0, 29.3],
        [80.45, 29.9],
        [80.23, 30.42],
        [79.15, 30.8],
        [79.3, 31.3],
        [78.77, 31.5],
        [78.4, 32.5],
        [78.7, 32.6],
        [79.1, 33.0],
        [79.0, 33.6],
        [78.75, 34.4],
        [79.0, 35.4],
        [79.2, 36.4],
        [78.9, 37.1],
        [79.5, 38.2],
        [78.93, 38.6],
        [77.83, 38.5],
        [73.858, 37.017],
        [73.9, 36.85],
        [74.6, 36.85],
        [75.0, 36.84],
        [76.2, 36.85],
        [77.1, 36.9],
        [78.02, 37.02],
        [78.738, 37.05],
        [79.53, 36.56],
        [79.19, 36.0],
        [78.95, 35.67],
        [78.0, 35.5],
        [77.82, 35.5],
        [76.15, 35.85],
        [76.1, 35.1],
        [75.35, 34.72],
        [74.99, 34.73],
        [74.25, 34.35],
        [73.82, 33.35],
        [72.9, 32.77],
        [72.03, 32.44],
        [71.45, 32.32],
        [71.04, 31.39],
        [70.77, 31.03],
        [70.34, 30.42],
        [69.7, 30.04],
        [69.52, 29.4],
        [70.09, 28.09],
        [69.65, 27.95],
        [68.99, 27.55],
        [69.31, 26.87],
        [68.75, 26.67],
        [68.13, 26.62],
        [67.97, 26.97],
        [68.44, 27.75],
        [68.86, 27.91],
        [69.51, 28.02],
        [70.76, 28.03],
        [71.9, 28.04],
        [72.36, 27.68],
        [72.85, 27.14],
        [72.94, 26.42],
        [72.9, 25.71],
        [72.86, 25.18],
        [72.95, 24.61],
        [72.82, 24.03],
        [72.98, 23.88],
        [72.85, 23.25],
        [72.83, 22.87],
        [72.94, 22.48],
        [72.85, 21.9],
        [72.4, 21.58],
        [72.63, 21.0],
        [72.0, 20.75],
        [70.83, 20.64],
        [70.34, 21.07],
        [70.05, 22.46],
        [69.922, 22.556],
        [68.743, 23.535],
        [68.186, 23.975],
      ].map(([lng, lat]) => [Number(lng), Number(lat)] as [number, number]),
    ],
  },
};

/**
 * India Boundary GeoJSON FeatureCollection (for MapLibre fill/line layers)
 */
export function getIndiaBoundaryGeoJSON(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [INDIA_BOUNDARY],
  };
}
