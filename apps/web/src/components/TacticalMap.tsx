"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { Map as MlMap, Popup as MlPopup } from "maplibre-gl";
import type { HotspotEvent } from "@/lib/types";
import { getClassificationSeverity } from "@/lib/design-tokens";
import {
  getIndiaStatesGeoJSON,
  getIndiaCitiesGeoJSON,
  INDIAN_STATES_AND_UTS,
  INDIAN_CITIES,
  type IndianPlace,
} from "@/lib/india-places";
import { inferAnomalyReason } from "@/lib/anomaly-inference";
import { getEventLocation } from "@/lib/location-resolver";
import libertyStyleSpec from "@/lib/liberty-style.json";
import "maplibre-gl/dist/maplibre-gl.css";

export type TacticalMapStyleId = "dark" | "satellite" | "3d";

interface TacticalMapProps {
  events: HotspotEvent[];
  onSelect?: (event: HotspotEvent) => void;
  selectedId?: string | null;
  /** Compact mode for dashboard preview */
  compact?: boolean;
  /** Show legend + controls */
  showControls?: boolean;
  className?: string;
  /** External zoom command (increment to recenter on India) */
  resetSignal?: number;
  /** Initial style */
  initialStyle?: TacticalMapStyleId;
  /** Optional custom initial center [lng, lat] */
  initialCenter?: [number, number];
  /** Optional custom initial zoom */
  initialZoom?: number;
  /** Dossier mode: Clean view without telemetry, cursor bar, or classification HUD */
  dossierMode?: boolean;
  /** Optional localStorage key to remember the user's style choice across reloads */
  persistKey?: string;
}

// Strict Indian Mainland Geographic bounds [Lng, Lat]
const INDIA_CENTER: [number, number] = [79.2, 22.8];
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [68.2, 8.0],  // SW corner (Gujarat West / Kanyakumari)
  [97.2, 35.6], // NE corner (Kashmir / Arunachal Pradesh)
];
const INDIA_FIT_PADDING = 16;
const INDIA_FIT_MAXZOOM = 4.85;

// Smart Regional Sectors for India
export const REGIONAL_SECTORS = [
  { id: "all", label: "All India", type: "bounds", bounds: INDIA_BOUNDS },
  { id: "north", label: "North Ag (Punjab/UP)", type: "center", center: [76.8, 29.8] as [number, number], zoom: 6.8 },
  { id: "west", label: "West Corridor (Gujarat/MH)", type: "center", center: [72.8, 21.2] as [number, number], zoom: 6.8 },
  { id: "east", label: "East Industrial (JH/WB/OD)", type: "center", center: [85.8, 22.8] as [number, number], zoom: 6.8 },
  { id: "south", label: "South Tech & Ports (KA/TN)", type: "center", center: [78.5, 12.8] as [number, number], zoom: 6.8 },
  { id: "central", label: "Central Belts (MP/CG)", type: "center", center: [80.5, 22.0] as [number, number], zoom: 6.8 },
] as const;

const SEA_COLOR = "#334658";   // Light bluish grey sea
const LAND_COLOR = "#16202e";  // Dark slate landmass

// Tactical Basemap Style Definitions
// Pure MapLibre vector & keyless raster styles — NO CARTO dependencies, NO API keys required.
const DARK_STYLE_SPEC: any = {
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
    openmaptiles: {
      type: "vector",
      tiles: [
        "https://tiles.openfreemap.org/planet/20260830_080001_pt/{z}/{x}/{y}.pbf",
      ],
      maxzoom: 14,
      attribution: "© OpenFreeMap · © OpenMapTiles",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": SEA_COLOR },
    },
    {
      id: "countries-fill",
      type: "fill",
      source: "maplibre-demotiles",
      "source-layer": "countries",
      paint: {
        "fill-color": LAND_COLOR,
        "fill-outline-color": LAND_COLOR,
      },
    },
    {
      // Provider-native State Borders (Admin Level 4) -> Grey lines
      id: "provider-state-borders",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: ["==", ["get", "admin_level"], 4],
      paint: {
        "line-color": "#94a3b8",
        "line-width": 1.0,
        "line-opacity": 0.85,
        "line-dasharray": [3, 2],
      },
    },
    {
      // Provider-native Country Borders (Admin Level 2) -> Crisp White lines
      id: "provider-country-borders",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: ["==", ["get", "admin_level"], 2],
      paint: {
        "line-color": "#ffffff",
        "line-width": 1.4,
        "line-opacity": 0.95,
      },
    },
    {
      id: "countries-outline",
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

// 3D Mode uses the pre-styled inlined Liberty vector style (Google Maps white theme with 3D buildings)
// Inlined locally for 0ms style switching without network latency.
const LIBERTY_3D_STYLE_SPEC = libertyStyleSpec as any;

const SATELLITE_STYLE_SPEC: any = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "ESRI World Imagery",
    },
  },
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#020617" },
    },
    {
      id: "esri-satellite-layer",
      type: "raster",
      source: "esri-satellite",
      minzoom: 0,
      maxzoom: 19,
      paint: {
        "raster-opacity": 0.95,
        "raster-brightness-min": 0.05,
        "raster-brightness-max": 0.9,
        "raster-contrast": 0.1,
      },
    },
  ],
};

// Colors for tactical map styling
const COUNTRY_BORDER_COLOR = "#ffffff";
const STATE_BORDER_COLOR = "#64748b";
const COUNTRY_LABEL_COLOR = "#dbeafe";

// Palette for severity mapping
const SEV_CRITICAL = "#ef4444";
const SEV_CRITICAL_BORDER = "#fca5a5";
const SEV_WILDFIRE = "#f97316";
const SEV_WILDFIRE_BORDER = "#fdba74";
const SEV_AGRICULTURAL = "#eab308";
const SEV_AGRICULTURAL_BORDER = "#fef08a";

/** Apply tactical adjustments on dark style (sea, rivers, borders matching website theme) */
function applyDarkBasemapStyling(map: MlMap) {
  const styleLayers = map.getStyle()?.layers ?? [];
  for (const layer of styleLayers) {
    const lid = layer.id.toLowerCase();

    // 0. Base background (Landmass fill - dark tactical slate)
    // 0. Base background (sea) - light bluish grey
    if (layer.type === "background") {
      try {
        map.setPaintProperty(layer.id, "background-color", SEA_COLOR);
      } catch {}
      continue;
    }

    // 1. Waterways
    if (lid.includes("waterway") || lid.includes("river") || lid.includes("stream") || lid.includes("canal")) {
      try {
        map.setLayoutProperty(layer.id, "visibility", "visible");
        if (layer.type === "line") {
          map.setPaintProperty(layer.id, "line-color", "#4a5b6e");
          map.setPaintProperty(layer.id, "line-width", 1.1);
          map.setPaintProperty(layer.id, "line-opacity", 0.8);
        }
      } catch {}
      continue;
    }

    // 2. Water / Ocean (light bluish grey sea - matches background)
    if (lid.includes("water") || lid.includes("ocean") || lid.includes("sea") || lid.includes("marine")) {
      if (layer.type === "fill") {
        try {
          map.setPaintProperty(layer.id, "fill-color", SEA_COLOR);
          map.setPaintProperty(layer.id, "fill-opacity", 1.0);
        } catch {}
      }
      continue;
    }

    // 3. National Country Borders -> Crisp WHITE lines (#ffffff) matching website theme
    if (
      layer.type === "line" &&
      (lid.includes("boundary_country") ||
        ((lid.includes("admin") || lid.includes("boundary") || lid.includes("border")) &&
          (lid.includes("0") || lid.includes("country") || lid.includes("national"))))
    ) {
      try {
        map.setLayoutProperty(layer.id, "visibility", "visible");
        map.setPaintProperty(layer.id, "line-color", "#ffffff");
        map.setPaintProperty(layer.id, "line-width", 1.5);
        map.setPaintProperty(layer.id, "line-opacity", 0.95);
      } catch {}
      continue;
    }

    // 4. State Borders -> Light Grey lines (#94a3b8) matching website theme
    if (
      layer.type === "line" &&
      (lid.includes("boundary_state") ||
        ((lid.includes("admin") || lid.includes("boundary") || lid.includes("border")) &&
          (lid.includes("1") || lid.includes("state") || lid.includes("province"))))
    ) {
      try {
        map.setLayoutProperty(layer.id, "visibility", "visible");
        map.setPaintProperty(layer.id, "line-color", "#94a3b8");
        map.setPaintProperty(layer.id, "line-width", 1.0);
        map.setPaintProperty(layer.id, "line-opacity", 0.85);
      } catch {}
      continue;
    }

    // 5. Roads & Transport Lines (Subtle tactical styling)
    if (lid.includes("highway") || lid.includes("road")) {
      if (layer.type === "line") {
        try {
          if (lid.includes("motorway") || lid.includes("major")) {
            map.setPaintProperty(layer.id, "line-color", "#334155");
            map.setPaintProperty(layer.id, "line-opacity", 0.6);
          } else {
            map.setPaintProperty(layer.id, "line-color", "#1e293b");
            map.setPaintProperty(layer.id, "line-opacity", 0.4);
          }
        } catch {}
      }
    }

    // 6. Buildings (Dark slate footprints)
    if (lid.includes("building") && layer.type === "fill") {
      try {
        map.setPaintProperty(layer.id, "fill-color", "#1e293b");
        map.setPaintProperty(layer.id, "fill-opacity", 0.7);
      } catch {}
    }
  }
}

const LEGEND = [
  {
    label: "Critical / Emergency",
    color: SEV_CRITICAL,
    match: (e: HotspotEvent) => Boolean(e.is_critical_alert || e.classification === "INDUSTRIAL_FIRE_EMERGENCY"),
  },
  {
    label: "Wildfire",
    color: SEV_WILDFIRE,
    match: (e: HotspotEvent) => !e.is_critical_alert && e.classification === "WILDFIRE",
  },
  {
    label: "Persistent Flare",
    color: "#f59e0b",
    match: (e: HotspotEvent) => !e.is_critical_alert && e.classification === "PERSISTENT_INDUSTRIAL_FLARE",
  },
  {
    label: "Agricultural",
    color: SEV_AGRICULTURAL,
    match: (e: HotspotEvent) => !e.is_critical_alert && e.classification === "AGRICULTURAL_BURNING",
  },
  {
    label: "Deferred Review",
    color: "#a855f7",
    match: (e: HotspotEvent) => !e.is_critical_alert && e.classification === "DEFERRED_FOR_ANALYST",
  },
];

/** Deduplicate incoming events by ID or spatial-temporal signature */
function deduplicateEvents(rawEvents: HotspotEvent[]): HotspotEvent[] {
  const seen = new Set<string>();
  const clean: HotspotEvent[] = [];
  for (const ev of rawEvents) {
    if (!ev || typeof ev.latitude !== "number" || typeof ev.longitude !== "number") continue;
    const key = ev.id || `${ev.latitude.toFixed(4)}_${ev.longitude.toFixed(4)}_${ev.acq_datetime || ev.created_at || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      clean.push(ev);
    }
  }
  return clean;
}

export function TacticalMap({
  events: rawEvents,
  onSelect,
  selectedId,
  compact = false,
  showControls = true,
  className = "",
  resetSignal = 0,
  initialStyle = "dark",
  initialCenter,
  initialZoom,
  dossierMode = false,
  persistKey,
}: TacticalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<MlPopup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // ─── Persisted Style Preference (Opt-in via persistKey) ──────────────────
  // Reads a previously saved style from localStorage so the map does not
  // auto-reset to "dark" on every page load. Falls back to initialStyle.
  const readPersistedStyle = (): TacticalMapStyleId => {
    if (!persistKey || typeof window === "undefined") return initialStyle;
    try {
      const saved = window.localStorage.getItem(persistKey);
      if (saved === "dark" || saved === "satellite" || saved === "3d") {
        return saved;
      }
    } catch {
      /* localStorage unavailable — silently fall back */
    }
    return initialStyle;
  };

  const [activeStyle, setActiveStyle] = useState<TacticalMapStyleId>(initialStyle);

  // Sync persisted style after client mount to prevent SSR hydration mismatches
  useEffect(() => {
    if (!persistKey || typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(persistKey) as TacticalMapStyleId | null;
      if (saved && (saved === "dark" || saved === "satellite" || saved === "3d")) {
        setActiveStyle(saved);
      }
    } catch {
      /* localStorage unavailable */
    }
  }, [persistKey]);
  const [cursorPos, setCursorPos] = useState<{ lat: number; lng: number } | null>(null);
  const [activeSector, setActiveSector] = useState<string>("all");
  const [activePlaceName, setActivePlaceName] = useState<string>("All India");
  const [showPlacesMenu, setShowPlacesMenu] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showLayerSettings, setShowLayerSettings] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
  const [placeFilterCategory, setPlaceFilterCategory] = useState<"all" | "sectors" | "states" | "industrial" | "cities">("all");
  const placesDropdownRef = useRef<HTMLDivElement>(null);
  const layerSettingsRef = useRef<HTMLDivElement>(null);
  const showHeatmapRef = useRef(showHeatmap);
  showHeatmapRef.current = showHeatmap;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const setupLayersRef = useRef<() => void>(() => {});

  // Sync persisted showHeatmap preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("tactical-map-show-heatmap");
      if (saved !== null) {
        const val = saved !== "false";
        setShowHeatmap(val);
        showHeatmapRef.current = val;
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Close places dropdown and layer settings on click outside
  useEffect(() => {
    if (!showPlacesMenu && !showLayerSettings) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        showPlacesMenu &&
        placesDropdownRef.current &&
        !placesDropdownRef.current.contains(e.target as Node)
      ) {
        setShowPlacesMenu(false);
      }
      if (
        showLayerSettings &&
        layerSettingsRef.current &&
        !layerSettingsRef.current.contains(e.target as Node)
      ) {
        setShowLayerSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showPlacesMenu, showLayerSettings]);

  // Imperative toggle for heatmap visibility (leaving circles only when off)
  const toggleHeatmap = (visible?: boolean) => {
    const nextVal = visible !== undefined ? visible : !showHeatmapRef.current;
    setShowHeatmap(nextVal);
    showHeatmapRef.current = nextVal;
    try {
      window.localStorage.setItem("tactical-map-show-heatmap", String(nextVal));
    } catch {
      /* non-fatal */
    }
    const map = mapRef.current;
    if (map && map.getLayer("thermal-heatmap")) {
      try {
        map.setLayoutProperty("thermal-heatmap", "visibility", nextVal ? "visible" : "none");
      } catch (err) {
        console.warn("[Map] Failed to toggle heatmap visibility:", err);
      }
    }
  };

  // Deduplicate events cleanly
  const events = useMemo(() => deduplicateEvents(rawEvents), [rawEvents]);

  // Always-fresh events for imperative style.load handlers (never stale closures)
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Always-fresh active style for imperative handlers (never stale closures)
  const activeStyleRef = useRef(activeStyle);
  activeStyleRef.current = activeStyle;

  // ─── Convert Events to Clustered GeoJSON ─────────────────────────────
  const toGeoJSON = (items: HotspotEvent[]): import("geojson").FeatureCollection => {
    return {
      type: "FeatureCollection",
      features: items
        .filter((e) => {
          const lat = Number(e.latitude);
          const lng = Number(e.longitude);
          return !Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        })
        .map((e) => {
          const sev = getClassificationSeverity(e.classification);
          const isCritical = e.is_critical_alert || e.classification === "INDUSTRIAL_FIRE_EMERGENCY";
          const colorHex = sev.dot ?? "#06b6d4";
          const frp = Number(e.frp_megawatts);
          const bt = Number(e.brightness_temp_kelvin);
          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [Number(e.longitude), Number(e.latitude)],
            },
            properties: {
              id: e.id,
              frp: Number.isFinite(frp) ? frp : 10,
              bt: Number.isFinite(bt) ? bt : 350,
              confidence: Number(((e.confidence_score ?? 0.8) * 100).toFixed(0)),
              classification: e.classification,
              is_critical: isCritical ? 1 : 0,
              facility_name: e.facility_name ?? "Thermal Anomaly",
              facility_type: e.facility_type ?? "unmapped",
              cde_score: e.cde_anomaly_score ?? 0,
              color: colorHex,
              shortLabel: sev.shortLabel,
              lat: Number(e.latitude),
              lng: Number(e.longitude),
            },
          };
        }),
    };
  };

  // ─── Initialize Map Instance ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    (async () => {
      const mlModule = await import("maplibre-gl");
      const maplibregl: any = (mlModule as any).default || mlModule;
      if (cancelled || !containerRef.current) return;

      const hasCustomCenter = initialCenter && typeof initialCenter[0] === "number";
      const startCenter = hasCustomCenter ? initialCenter : INDIA_CENTER;
      const startZoom = typeof initialZoom === "number" ? initialZoom : hasCustomCenter ? 15.8 : 4.4;

      const startStyle = readPersistedStyle();
      const map = new maplibregl.Map({
        container: containerRef.current,
        style:
          startStyle === "satellite"
            ? SATELLITE_STYLE_SPEC
            : startStyle === "3d"
            ? LIBERTY_3D_STYLE_SPEC
            : DARK_STYLE_SPEC,
        center: startCenter,
        zoom: startZoom,
        minZoom: 3.5,
        maxZoom: 19,
        pitch: startStyle === "3d" ? 50 : 0,
        bearing: 0,
        attributionControl: false,
      });

      if (!hasCustomCenter) {
        // Strict India-focused initial crop via fitBounds
        map.fitBounds(INDIA_BOUNDS, {
          padding: compact ? 8 : INDIA_FIT_PADDING,
          maxZoom: INDIA_FIT_MAXZOOM,
          duration: 0,
        });
      }

      const onMapLoadOrStyle = () => {
        if (cancelled) return;
        if (startStyle === "dark") {
          applyDarkBasemapStyling(map);
        }
        setMapReady(true);
        map.resize();
        try {
          setupLayersRef.current?.();
          const geoData = toGeoJSON(eventsRef.current);
          const hs = map.getSource("hotspots") as any;
          if (hs && typeof hs.setData === "function") hs.setData(geoData);
          const ht = map.getSource("heat") as any;
          if (ht && typeof ht.setData === "function") ht.setData(geoData);
          map.triggerRepaint();
        } catch (err) {
          console.warn("[Map] Error in initial setupLayers:", err);
        }
      };

      map.on("load", onMapLoadOrStyle);
      map.on("styledata", () => {
        if (map.isStyleLoaded() && !map.getSource("hotspots")) {
          onMapLoadOrStyle();
        }
      });

      // Log tile/network errors for debugging without crashing the UI
      map.on("error", (e: any) => {
        if (e?.error?.status === 404 || e?.error?.status === 403) return; // expected missing tiles
        console.warn("[Map] Non-fatal error:", e?.error?.message || e);
      });

      map.on("mousemove", (e: any) => {
        if (!cancelled && !compact) {
          setCursorPos({
            lat: Number(e.lngLat.lat.toFixed(4)),
            lng: Number(e.lngLat.lng.toFixed(4)),
          });
        }
      });

      mapRef.current = map;

      const ro = new ResizeObserver(() => {
        if (!cancelled && mapRef.current) mapRef.current.resize();
      });
      if (containerRef.current) ro.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      if (popupRef.current) popupRef.current.remove();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [compact, initialStyle, initialCenter, initialZoom, persistKey]);

  // ─── Instant Map Style Switch (0ms with transformStyle layer preservation) ───
  const handleStyleChange = (newStyle: TacticalMapStyleId) => {
    if (newStyle === activeStyle || !mapRef.current) return;
    const map = mapRef.current;
    setActiveStyle(newStyle);
    activeStyleRef.current = newStyle;

    // Persist the user's explicit style choice (only when opted-in via persistKey)
    if (persistKey) {
      try {
        window.localStorage.setItem(persistKey, newStyle);
      } catch {
        /* localStorage unavailable — non-fatal */
      }
    }

    const targetSpec =
      newStyle === "satellite"
        ? SATELLITE_STYLE_SPEC
        : newStyle === "3d"
        ? LIBERTY_3D_STYLE_SPEC
        : DARK_STYLE_SPEC;

    // Custom overlay source and layer IDs that must be preserved seamlessly across style changes
    const CUSTOM_SOURCE_IDS = new Set([
      "hotspots",
      "heat",
      "monitored-facilities-src",
      "india-states-src",
      "india-cities-src",
      "english-country-label-src",
    ]);

    const CUSTOM_LAYER_PREFIXES = [
      "thermal-",
      "clusters",
      "cluster-",
      "unclustered-",
      "monitored-facilities",
      "tactical-india-",
      "english-country-",
      "3d-buildings-extruded",
    ];

    try {
      map.setStyle(targetSpec, {
        diff: false,
        validate: false,
        transformStyle: (previousStyle: any, nextStyle: any) => {
          if (!previousStyle) return nextStyle;
          const mergedSources = { ...nextStyle.sources };
          for (const sid of CUSTOM_SOURCE_IDS) {
            if (previousStyle.sources && previousStyle.sources[sid]) {
              mergedSources[sid] = previousStyle.sources[sid];
            }
          }
          const preservedLayers = (previousStyle.layers || []).filter((l: any) =>
            CUSTOM_LAYER_PREFIXES.some((p) => l.id.startsWith(p))
          );
          return {
            ...nextStyle,
            sources: mergedSources,
            layers: [...nextStyle.layers, ...preservedLayers],
          };
        },
      } as any);
    } catch {
      // Fallback if setStyle with options fails
      map.setStyle(targetSpec);
    }

    // Immediately re-attach or refresh layers as soon as style loads
    map.once("style.load", () => {
      try {
        setupLayersRef.current?.();
      } catch (err) {
        console.warn("[Map] Error re-attaching layers on style change:", err);
      }
    });

    if (newStyle === "dark") {
      map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
    } else if (newStyle === "satellite") {
      map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
    } else if (newStyle === "3d") {
      map.easeTo({ pitch: 60, bearing: -15, duration: 550 });
    }
  };

  // ─── Attach 3D Building Extrusions & Layers whenever Style Loads ─────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const setupLayers = () => {
      if (!map.isStyleLoaded()) {
        map.once("style.load", setupLayers);
        return;
      }

      // If active style is dark, apply custom dark basemap styling (water, borders)
      const currentStyle = activeStyleRef.current;
      if (currentStyle === "dark") {
        applyDarkBasemapStyling(map);
      }

      // ─── 3D Mode: White Google-Maps-style Building Models ───────────────
      // Liberty's native "building-3d" layer is beige (hsl(35,8%,85%)) with
      // opacity 0.8. We override it to a crisp white extrusion theme with
      // grey side accents — the classic Google Maps 3D look.
      if (currentStyle === "3d") {
        try {
          // 2D building footprint fill (zoom 13-14) -> light grey, subtle
          if (map.getLayer("building")) {
            map.setPaintProperty("building", "fill-color", "#e8eaed");
            map.setPaintProperty("building", "fill-outline-color", "#c7ccd1");
          }
          // 3D extruded buildings (zoom >= 14) -> white faces, grey base shadow
          if (map.getLayer("building-3d")) {
            map.setPaintProperty("building-3d", "fill-extrusion-color", "#f8f9fa");
            map.setPaintProperty("building-3d", "fill-extrusion-opacity", 0.96);
            map.setPaintProperty("building-3d", "fill-extrusion-height", [
              "interpolate",
              ["linear"],
              ["zoom"],
              14, 0,
              14.8, ["coalesce", ["get", "render_height"], ["get", "height"], 12],
            ]);
            map.setPaintProperty("building-3d", "fill-extrusion-base", [
              "interpolate",
              ["linear"],
              ["zoom"],
              14, 0,
              14.8, ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
            ]);
          } else {
            // Fallback: add our own white extrusion layer if liberty didn't provide one
            const hasOmtSource = Boolean(map.getSource("openmaptiles"));
            if (hasOmtSource) {
              map.addLayer({
                id: "ntro-white-buildings-3d",
                type: "fill-extrusion",
                source: "openmaptiles",
                "source-layer": "building",
                minzoom: 14,
                paint: {
                  "fill-extrusion-color": "#f8f9fa",
                  "fill-extrusion-height": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    14, 0,
                    14.8, ["coalesce", ["get", "render_height"], ["get", "height"], 12],
                  ],
                  "fill-extrusion-base": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    14, 0,
                    14.8, ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
                  ],
                  "fill-extrusion-opacity": 0.96,
                },
              });
            }
          }
        } catch {}
      }

      // 0. Hide default basemap place/state/city symbol layers to prevent foreign state/city clutter
      const styleLayers = map.getStyle()?.layers ?? [];
      for (const layer of styleLayers) {
        const lid = layer.id.toLowerCase();
        if (
          layer.type === "symbol" &&
          !lid.startsWith("tactical-") &&
          !lid.startsWith("english-country-") &&
          !lid.startsWith("cluster-") &&
          (lid.includes("place") ||
            lid.includes("state") ||
            lid.includes("city") ||
            lid.includes("town") ||
            lid.includes("village") ||
            lid.includes("suburb") ||
            lid.includes("country_other") ||
            lid.includes("country_minor"))
        ) {
          try {
            map.setLayoutProperty(layer.id, "visibility", "none");
          } catch {}
        }
      }

      // 2. English Country Labels
      if (!map.getSource("english-country-label-src")) {
        const COUNTRY_LABELS: Array<[string, number, number]> = [
          ["INDIA", 79.0, 22.5],
          ["NEPAL", 84.2, 28.3],
          ["BANGLADESH", 90.3, 23.7],
          ["SRI LANKA", 80.7, 7.6],
          ["MYANMAR", 95.9, 21.5],
          ["CHINA", 88.0, 33.0],
          ["BHUTAN", 90.4, 27.5],
          ["AFGHANISTAN", 66.0, 33.8],
          ["IRAN", 59.5, 32.5],
          ["OMAN", 56.1, 21.5],
          ["THAILAND", 101.0, 15.5],
          ["MALDIVES", 73.5, 3.2],
        ];

        map.addSource("english-country-label-src", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: COUNTRY_LABELS.map(([name, lng, lat]) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [lng, lat] },
              properties: { name },
            })),
          },
        });

        map.addLayer({
          id: "english-country-labels",
          type: "symbol",
          source: "english-country-label-src",
          minzoom: 2,
          maxzoom: 6.5,
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Bold"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 4, 13, 6, 16],
            "text-letter-spacing": 0.25,
            "text-transform": "uppercase",
            "text-allow-overlap": false,
            "text-padding": 6,
          },
          paint: {
            "text-color": COUNTRY_LABEL_COLOR,
            "text-halo-color": "#000a12",
            "text-halo-width": 1.6,
            "text-opacity": 0.85,
          },
        });
      }

      // 3. Indian State Names ONLY (Visible at Country & Regional Zooms)
      if (!map.getSource("india-states-src")) {
        map.addSource("india-states-src", {
          type: "geojson",
          data: getIndiaStatesGeoJSON(),
        });

        map.addLayer({
          id: "tactical-india-states",
          type: "symbol",
          source: "india-states-src",
          minzoom: 4.2,
          maxzoom: 10.5,
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Bold"],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4.2, 8.5,
              6.0, 10.5,
              8.0, 12.5,
              10.0, 14.0,
            ],
            "text-letter-spacing": 0.16,
            "text-transform": "uppercase",
            "text-allow-overlap": false,
            "text-padding": 8,
          },
          paint: {
            "text-color": currentStyle === "satellite" ? "#f8fafc" : "#cbd5e1",
            "text-halo-color": "#020617",
            "text-halo-width": 2.2,
            "text-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4.2, 0.7,
              5.5, 0.9,
              8.5, 0.75,
              10.5, 0,
            ],
          },
        });
      }

      // 4. Indian Cities & Industrial Hubs (Visible when Zoomed in >= 5.6)
      if (!map.getSource("india-cities-src")) {
        map.addSource("india-cities-src", {
          type: "geojson",
          data: getIndiaCitiesGeoJSON(),
        });

        // City Anchor Dots
        map.addLayer({
          id: "tactical-india-city-dots",
          type: "circle",
          source: "india-cities-src",
          minzoom: 5.6,
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "isIndustrial"], 1], "#38bdf8",
              "#94a3b8",
            ],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5.6, 2,
              8, 3.2,
              12, 4.5,
            ],
            "circle-opacity": 0.9,
            "circle-stroke-color": "#020617",
            "circle-stroke-width": 1.2,
          },
        });

        // City Name Labels
        map.addLayer({
          id: "tactical-india-cities",
          type: "symbol",
          source: "india-cities-src",
          minzoom: 5.6,
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Regular"],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5.6, 9.5,
              8.0, 11.5,
              12.0, 13.5,
            ],
            "text-offset": [0, 0.9],
            "text-anchor": "top",
            "text-letter-spacing": 0.04,
            "text-allow-overlap": false,
            "text-padding": 5,
          },
          paint: {
            "text-color": [
              "case",
              ["==", ["get", "isIndustrial"], 1], "#38bdf8",
              "#f8fafc",
            ],
            "text-halo-color": "#020617",
            "text-halo-width": 2.0,
            "text-opacity": 0.95,
          },
        });
      }

      // 5. 3D Building Extrusions (Active in 3D Mode)
      if (currentStyle === "3d") {
        const hasOpenMapTiles = map.getSource("openmaptiles");
        if (hasOpenMapTiles && !map.getLayer("3d-buildings-extruded") && !map.getLayer("building-3d")) {
          map.addLayer({
            id: "3d-buildings-extruded",
            source: "openmaptiles",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 12,
            paint: {
              "fill-extrusion-color": "#ffffff",
              "fill-extrusion-height": [
                "interpolate",
                ["linear"],
                ["zoom"],
                12, 0,
                14.5, ["coalesce", ["get", "render_height"], ["get", "height"], 12],
              ],
              "fill-extrusion-base": [
                "interpolate",
                ["linear"],
                ["zoom"],
                12, 0,
                14.5, ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
              ],
              "fill-extrusion-opacity": 0.95,
            },
          });
        }
      }

      // 6. Thermal Hotspots & Cluster Layers
      if (!map.getSource("hotspots")) {
        map.addSource("hotspots", {
          type: "geojson",
          data: toGeoJSON(eventsRef.current),
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 42,
          clusterProperties: {
            max_frp: [["max", ["accumulated"], ["get", "max_frp"]], ["get", "frp"]],
            has_critical: [["max", ["accumulated"], ["get", "has_critical"]], ["get", "is_critical"]],
          },
        });

        // Non-clustered duplicate source required by the heatmap layer
        if (!map.getSource("heat")) {
          map.addSource("heat", {
            type: "geojson",
            data: toGeoJSON(eventsRef.current),
          });
        }

        // TRUE Heatmap layer (thermal gradient by FRP intensity)
        map.addLayer({
          id: "thermal-heatmap",
          type: "heatmap",
          source: "heat",
          maxzoom: 14,
          layout: {
            visibility: showHeatmapRef.current ? "visible" : "none",
          },
          paint: {
            // Thermal color ramp: low FRP fires visibly glow on dark map
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0.0, "rgba(0, 0, 0, 0)",
              0.01, "rgba(6, 182, 212, 0.40)",
              0.1, "rgba(14, 165, 233, 0.60)",
              0.25, "rgba(34, 197, 94, 0.78)",
              0.5, "rgba(234, 179, 8, 0.88)",
              0.75, "rgba(249, 115, 22, 0.96)",
              1.0, "rgba(239, 68, 68, 1.0)",
            ],
            // Heatmap radius for both country-wide and regional views
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3, 18,
              6, 30,
              10, 48,
              14, 65,
            ],
            // Weight by FRP power output - lower threshold for agricultural fires
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "frp"], 0],
              0, 0.25,
              20, 0.55,
              100, 0.85,
              300, 1.0,
            ],
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3, 1.4,
              8, 2.8,
              12, 3.8,
            ],
            "heatmap-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3, 0.9,
              9, 0.8,
              13, 0.4,
            ],
          },
        });

        // Cluster Outer Pulse Glow
        map.addLayer({
          id: "clusters-glow",
          type: "circle",
          source: "hotspots",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "case",
              [">", ["get", "has_critical"], 0], SEV_CRITICAL,
              [">=", ["get", "max_frp"], 200], SEV_WILDFIRE,
              SEV_AGRICULTURAL,
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              24, 10,
              32, 50,
              44,
            ],
            "circle-opacity": 0.28,
            "circle-blur": 0.9,
          },
        });

        // Cluster Core Circle
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "hotspots",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "case",
              [">", ["get", "has_critical"], 0], SEV_CRITICAL,
              [">=", ["get", "max_frp"], 200], SEV_WILDFIRE,
              SEV_AGRICULTURAL,
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              14, 10,
              18, 50,
              24,
            ],
            "circle-opacity": 0.92,
            "circle-stroke-width": 1.25,
            "circle-stroke-color": [
              "case",
              [">", ["get", "has_critical"], 0], SEV_CRITICAL_BORDER,
              [">=", ["get", "max_frp"], 200], SEV_WILDFIRE_BORDER,
              SEV_AGRICULTURAL_BORDER,
            ],
            "circle-stroke-opacity": 0.95,
          },
        });

        // Cluster Count
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "hotspots",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 11,
            "text-font": ["Noto Sans Bold"],
            "text-letter-spacing": 0.02,
          },
          paint: {
            "text-color": "#ffffff",
            "text-opacity": 0.98,
          },
        });

        // Unclustered Outer Glow (High Visibility)
        map.addLayer({
          id: "unclustered-glow",
          type: "circle",
          source: "hotspots",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["coalesce", ["get", "color"], "#06b6d4"],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3, 16,
              8, 24,
              14, 36,
            ],
            "circle-opacity": 0.55,
            "circle-blur": 0.85,
          },
        });

        // Unclustered Point Body (Solid Vibrant Marker + White Halo)
        map.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "hotspots",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["coalesce", ["get", "color"], "#06b6d4"],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3, 6,
              8, 10,
              14, 16,
            ],
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-opacity": 1.0,
            "circle-opacity": 1.0,
          },
        });

        // Invisible Expanded Hitbox for effortless tapping/clicking
        map.addLayer({
          id: "unclustered-hitbox",
          type: "circle",
          source: "hotspots",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 18,
            "circle-opacity": 0.001,
          },
        });

        // Helper to trigger rich popup
        let activePopupSeq = 0;
        const removeAllPopups = () => {
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }
          try {
            const el = containerRef.current;
            if (el) {
              const popups = el.querySelectorAll(".maplibregl-popup");
              popups.forEach((p) => p.remove());
            }
          } catch {
            /* ignore DOM cleanup error */
          }
        };

        const showHotspotPopup = async (coords: [number, number], props: any, isHover: boolean = false) => {
          const currentSeq = ++activePopupSeq;
          removeAllPopups();
          const mlModule = await import("maplibre-gl");
          if (currentSeq !== activePopupSeq) return; // Discard stale async call
          const maplibregl: any = (mlModule as any).default || mlModule;
          const color = props.color || "#06b6d4";
          const ev = eventsRef.current.find((item) => item.id === props.id);
          const anomalyInfo = ev ? inferAnomalyReason(ev) : null;
          const locInfo = ev ? getEventLocation(ev) : null;
          const title = props.facility_name || "Unmapped Thermal Anomaly";
          const locationLine = locInfo ? `<div class="hp-meta">📍 ${locInfo.displayLocation}</div>` : "";

          popupRef.current = new maplibregl.Popup({
            closeButton: !isHover,
            offset: 14,
            className: "hotspot-popup pointer-events-none",
          })
            .setLngLat(coords)
            .setHTML(`
              <div class="hp-badge" style="background:${color}22; border:1px solid ${color}66; color:${color}">${props.shortLabel || props.classification}</div>
              <div class="hp-title">${title}</div>
              ${locationLine}
              ${anomalyInfo && (!props.facility_name || props.facility_name.includes("Unmapped") || props.facility_name.includes("Thermal Anomaly")) ? `<div class="hp-meta text-cyan-300 text-[10px] mt-0.5 font-sans">🌾 Suggestion: ${anomalyInfo.probableCause}</div>` : ""}
              <div class="hp-meta">${Number(props.lat ?? coords[1]).toFixed(4)}°N · ${Number(props.lng ?? coords[0]).toFixed(4)}°E</div>
              <div class="hp-meta text-cyan-400 font-bold">${Number(props.frp ?? 10).toFixed(1)} MW FRP · ${props.confidence ?? 85}% confidence</div>
              ${props.cde_score && Math.abs(props.cde_score) >= 2.0 ? `<div class="hp-meta text-red-400 font-mono text-[9px] mt-0.5">⚠️ CDE Anomaly Score: ${Number(props.cde_score).toFixed(1)}σ</div>` : ""}
            `)
            .addTo(map);
        };

        const showClusterPopup = async (coords: [number, number], count: number, maxFrp: number, hasCritical: boolean) => {
          const currentSeq = ++activePopupSeq;
          removeAllPopups();
          const mlModule = await import("maplibre-gl");
          if (currentSeq !== activePopupSeq) return; // Discard stale async call
          const maplibregl: any = (mlModule as any).default || mlModule;
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            offset: 14,
            className: "hotspot-popup pointer-events-none",
          })
            .setLngLat(coords)
            .setHTML(`
              <div class="hp-badge" style="background:#06b6d422; border:1px solid #06b6d466; color:#06b6d4">THERMAL CLUSTER (${count} SPOTS)</div>
              <div class="hp-title font-bold text-white">${count} Hotspots in this Region</div>
              <div class="hp-meta text-cyan-400 font-mono">Max Radiative Power: ${Number(maxFrp).toFixed(1)} MW</div>
              ${hasCritical ? '<div class="hp-meta text-red-400 font-bold text-[10px]">🚨 Contains 1+ Level-1 Critical Alert(s)</div>' : '<div class="hp-meta text-slate-400 text-[10px]">Click or zoom in to inspect individual spots</div>'}
            `)
            .addTo(map);
        };

        // Hover Handlers across all hotspot and cluster layers
        const interactiveLayers = [
          "clusters",
          "cluster-count",
          "clusters-glow",
          "unclustered-point",
          "unclustered-hitbox",
          "unclustered-glow",
        ];

        let currentHoveredKey: string | null = null;

        // Hover on unclustered points
        const handlePointMouseEnter = (e: any) => {
          map.getCanvas().style.cursor = "pointer";
          const feat = e.features?.[0];
          if (feat && feat.properties) {
            const featId = feat.properties.id || `${feat.properties.lat}_${feat.properties.lng}`;
            if (currentHoveredKey === featId) return; // already showing this point
            currentHoveredKey = featId;
            const coords = (feat.geometry as any).coordinates.slice() as [number, number];
            showHotspotPopup(coords, feat.properties, true);
          }
        };

        const handlePointMouseLeave = () => {
          currentHoveredKey = null;
          map.getCanvas().style.cursor = "";
          removeAllPopups();
        };

        // Hover on clusters
        const handleClusterMouseEnter = (e: any) => {
          map.getCanvas().style.cursor = "pointer";
          const feat = e.features?.[0];
          if (feat && feat.properties) {
            const clusterKey = `cluster_${feat.properties.cluster_id || feat.properties.point_count}`;
            if (currentHoveredKey === clusterKey) return; // already showing this cluster
            currentHoveredKey = clusterKey;
            const coords = (feat.geometry as any).coordinates.slice() as [number, number];
            const count = feat.properties.point_count || 1;
            const maxFrp = feat.properties.max_frp || 0;
            const hasCritical = (feat.properties.has_critical || 0) > 0;
            showClusterPopup(coords, count, maxFrp, hasCritical);
          }
        };

        map.on("mouseenter", "unclustered-point", handlePointMouseEnter);
        map.on("mouseenter", "unclustered-hitbox", handlePointMouseEnter);
        map.on("mouseleave", "unclustered-point", handlePointMouseLeave);
        map.on("mouseleave", "unclustered-hitbox", handlePointMouseLeave);

        map.on("mouseenter", "clusters", handleClusterMouseEnter);
        map.on("mouseenter", "cluster-count", handleClusterMouseEnter);
        map.on("mouseleave", "clusters", handlePointMouseLeave);
        map.on("mouseleave", "cluster-count", handlePointMouseLeave);

        // Global hover sweep: automatically hides popup as soon as cursor moves off interactive markers
        const handleGlobalMouseMove = (e: any) => {
          const checkLayers = [
            "unclustered-point",
            "unclustered-hitbox",
            "unclustered-glow",
            "clusters",
            "cluster-count",
            "clusters-glow",
          ].filter((id) => Boolean(map.getLayer(id)));

          if (checkLayers.length === 0) return;

          // Query a tight 10x10px bounding box around the cursor
          const queryBox: [[number, number], [number, number]] = [
            [e.point.x - 5, e.point.y - 5],
            [e.point.x + 5, e.point.y + 5],
          ];
          const features = map.queryRenderedFeatures(queryBox, { layers: checkLayers });

          if (features.length === 0) {
            currentHoveredKey = null;
            map.getCanvas().style.cursor = "";
            removeAllPopups();
          }
        };
        map.on("mousemove", handleGlobalMouseMove);

        // Clear popup whenever cursor leaves the map container or window
        const handleCanvasMouseOut = () => {
          currentHoveredKey = null;
          map.getCanvas().style.cursor = "";
          removeAllPopups();
        };
        map.getCanvas().addEventListener("mouseleave", handleCanvasMouseOut);
        map.getCanvas().addEventListener("mouseout", handleCanvasMouseOut);

        // Unified Click Handler for Clusters, Cluster Counts, Glows & Hotspots
        const handleMapClick = (e: any) => {
          // Generous hit-testing box around click point (32x32px)
          const bbox: [[number, number], [number, number]] = [
            [e.point.x - 16, e.point.y - 16],
            [e.point.x + 16, e.point.y + 16],
          ];

          // 1. Check for Cluster clicks first
          const clusterLayers = ["clusters", "cluster-count", "clusters-glow"].filter((id) =>
            Boolean(map.getLayer(id))
          );
          const clusterFeatures =
            clusterLayers.length > 0
              ? map.queryRenderedFeatures(bbox, { layers: clusterLayers })
              : [];

          if (clusterFeatures.length > 0) {
            const feat = clusterFeatures[0];
            const clusterId = feat.properties?.cluster_id;
            const clusterCoords = (feat.geometry as any).coordinates.slice() as [number, number];
            const src = map.getSource("hotspots") as any;

            // Progressive drill-down: each click expands the clicked group into
            // its child sub-clusters / individual hotspots without jumping away.
            const easeToExpansion = (targetZoom: number) => {
              map.easeTo({
                center: clusterCoords,
                zoom: Math.min(16.5, targetZoom),
                pitch: activeStyleRef.current === "3d" ? 45 : 0,
                duration: 650,
                essential: true,
              });
            };

            if (clusterId != null && src && typeof src.getClusterExpansionZoom === "function") {
              src.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
                if (!err && typeof zoom === "number") {
                  // zoom + 0.4 ensures the cluster fully splits into children
                  easeToExpansion(zoom + 0.4);
                } else {
                  easeToExpansion(map.getZoom() + 2.5);
                }
              });
            } else if (clusterId != null && src && typeof src.getClusterLeaves === "function") {
              // Legacy fallback: measure leaf spread to pick a fitting zoom
              src.getClusterLeaves(clusterId, 200, 0, (err: any, leaves: any[]) => {
                if (!err && leaves && leaves.length > 0) {
                  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
                  for (const leaf of leaves) {
                    const [lng, lat] = leaf.geometry.coordinates;
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                  }
                  const spanLng = Math.max(0.02, maxLng - minLng);
                  const spanLat = Math.max(0.02, maxLat - minLat);
                  const span = Math.max(spanLng, spanLat);
                  const fitZoom = Math.log2(360 / (span * 2.2));
                  easeToExpansion(Math.max(map.getZoom() + 1.5, Math.min(16.5, fitZoom)));
                } else {
                  easeToExpansion(map.getZoom() + 2.5);
                }
              });
            } else {
              easeToExpansion(map.getZoom() + 2.5);
            }
            return;
          }

          // 2. Check for Unclustered Point clicks
          const pointLayers = ["unclustered-point", "unclustered-hitbox", "unclustered-glow"].filter(
            (id) => Boolean(map.getLayer(id))
          );
          const pointFeatures =
            pointLayers.length > 0
              ? map.queryRenderedFeatures(bbox, { layers: pointLayers })
              : [];

          if (pointFeatures.length > 0) {
            const f = pointFeatures[0];
            if (f && f.properties) {
              const props = f.properties;
              const coords = (f.geometry as any).coordinates.slice() as [number, number];
              const ev = eventsRef.current.find((item) => item.id === props.id);
              if (ev) onSelectRef.current?.(ev);

              // Smooth fly-in towards clicked hotspot to building level (15.8)
              map.flyTo({
                center: coords,
                zoom: 15.8,
                pitch: activeStyleRef.current === "3d" ? 45 : 0,
                duration: 750,
                essential: true,
              });

              showHotspotPopup(coords, props);
            }
          } else {
            // Clicked on empty terrain / ocean on map: trigger unselect callback (e.g. to close sidebar/drawer)
            onSelectRef.current?.(null as any);
            if (popupRef.current) {
              popupRef.current.remove();
              popupRef.current = null;
            }
          }
        };

        // Attach unified click listener
        map.on("click", handleMapClick);
      } else {
        const source = map.getSource("hotspots") as any;
        if (source && typeof source.setData === "function") {
          source.setData(toGeoJSON(eventsRef.current));
        }
        const heatSource = map.getSource("heat") as any;
        if (heatSource && typeof heatSource.setData === "function") {
          heatSource.setData(toGeoJSON(eventsRef.current));
        }
      }

      // Synchronize heatmap layer visibility with user preference
      if (map.getLayer("thermal-heatmap")) {
        try {
          map.setLayoutProperty(
            "thermal-heatmap",
            "visibility",
            showHeatmapRef.current ? "visible" : "none"
          );
        } catch {}
      }
    };

    setupLayersRef.current = setupLayers;
    map.on("style.load", setupLayers);
    if (mapReady) setupLayers();

    return () => {
      map.off("style.load", setupLayers);
    };
  }, [activeStyle, mapReady]);

  // ─── Heatmap Visibility Effect ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer("thermal-heatmap")) {
      try {
        map.setLayoutProperty(
          "thermal-heatmap",
          "visibility",
          showHeatmap ? "visible" : "none"
        );
      } catch {}
    }
  }, [showHeatmap, mapReady]);

  // ─── Instant GeoJSON Data Sync on Events / Timeline Scrub ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncSources = () => {
      if (!map.isStyleLoaded()) return;
      if (!map.getSource("hotspots") || !map.getSource("heat")) {
        setupLayersRef.current?.();
      }
      const geoData = toGeoJSON(eventsRef.current);
      const source = map.getSource("hotspots") as any;
      if (source && typeof source.setData === "function") {
        source.setData(geoData);
      }
      const heatSource = map.getSource("heat") as any;
      if (heatSource && typeof heatSource.setData === "function") {
        heatSource.setData(geoData);
      }
      try {
        map.resize();
        map.triggerRepaint();
      } catch {}
    };

    syncSources();

    // Secondary sync after 150ms and 500ms to catch SPA container resize transitions
    const t1 = setTimeout(syncSources, 150);
    const t2 = setTimeout(syncSources, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [events, mapReady, activeStyle]);

  // ─── Selection Sync (Fly to Selected Event) ──────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId || !mapReady) return;

    const ev = events.find((e) => e.id === selectedId);
    if (!ev) return;

    map.flyTo({
      center: [Number(ev.longitude), Number(ev.latitude)],
      zoom: 15.8, // Building-level zoom
      pitch: activeStyleRef.current === "3d" ? 45 : 0,
      duration: 750,
    });
    (async () => {
      if (popupRef.current) popupRef.current.remove();
      const mlModule = await import("maplibre-gl");
      const maplibregl: any = (mlModule as any).default || mlModule;
      const sev = getClassificationSeverity(ev.classification);
      const color = sev.text ?? "#06b6d4";
      const anomalyInfo = inferAnomalyReason(ev);
      const locInfo = getEventLocation(ev);
      const title = ev.facility_name && ev.facility_name !== "Unmapped Thermal Anomaly" && ev.facility_name !== "Thermal Anomaly"
        ? ev.facility_name
        : anomalyInfo.probableCause;

      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        offset: 14,
        className: "hotspot-popup",
      })
        .setLngLat([Number(ev.longitude), Number(ev.latitude)])
        .setHTML(`
          <div class="hp-badge" style="background:${color}22; border:1px solid ${color}66; color:${color}">${sev.shortLabel}</div>
          <div class="hp-title">${title}</div>
          ${locInfo ? `<div class="hp-meta">📍 ${locInfo.displayLocation}</div>` : ""}
          <div class="hp-meta">${Number(ev.latitude).toFixed(4)}°N · ${Number(ev.longitude).toFixed(4)}°E</div>
          <div class="hp-meta text-cyan-400 font-bold">${Number(ev.frp_megawatts).toFixed(1)} MW FRP · ${((ev.confidence_score ?? 0.8) * 100).toFixed(0)}% confidence</div>
          ${!ev.facility_name || ev.facility_name.includes("Unmapped") || ev.facility_name.includes("Thermal Anomaly") ? `<div class="hp-meta text-slate-300 text-[10px] mt-0.5">🌾 ${anomalyInfo.categoryLabel} (${anomalyInfo.regionLabel.split("(")[0].trim()})</div>` : ""}
        `)
        .addTo(map);
    })();
  }, [selectedId, events, mapReady, activeStyle]);

  // ─── Sector Quick-Jump Handler ───────────────────────────────────────
  const handleSectorSelect = (sector: typeof REGIONAL_SECTORS[number]) => {
    setActiveSector(sector.id);
    setActivePlaceName(sector.label);
    setShowPlacesMenu(false);
    if (!mapRef.current) return;

    if (sector.type === "bounds" && sector.bounds) {
      mapRef.current.fitBounds(sector.bounds, {
        padding: compact ? 8 : INDIA_FIT_PADDING,
        maxZoom: INDIA_FIT_MAXZOOM,
        duration: 700,
      });
    } else if (sector.type === "center" && sector.center) {
      mapRef.current.flyTo({
        center: sector.center,
        zoom: sector.zoom,
        duration: 700,
      });
    }
  };

  // ─── Place Quick-Jump Handler (States, Industrial Hubs, Cities) ──────
  const handlePlaceSelect = (place: IndianPlace) => {
    setActivePlaceName(place.name);
    setShowPlacesMenu(false);
    setPlaceSearchQuery("");
    setPlaceFilterCategory("all");
    if (!mapRef.current) return;

    const zoomFor = place.type === "state" ? place.minZoom + 1.6 : Math.max(9, place.minZoom + 1.8);
    mapRef.current.flyTo({
      center: place.coordinates,
      zoom: zoomFor,
      duration: 900,
      essential: true,
    });
  };

  // Recenter on India when resetSignal fires
  useEffect(() => {
    if (resetSignal > 0 && mapRef.current) {
      mapRef.current.fitBounds(INDIA_BOUNDS, {
        padding: compact ? 8 : INDIA_FIT_PADDING,
        maxZoom: INDIA_FIT_MAXZOOM,
        duration: 600,
      });
      setActiveSector("all");
      setActivePlaceName("All India");
    }
  }, [resetSignal, compact]);

  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 300 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 300 });
  const handleRecenter = () => {
    mapRef.current?.fitBounds(INDIA_BOUNDS, {
      padding: compact ? 8 : INDIA_FIT_PADDING,
      maxZoom: INDIA_FIT_MAXZOOM,
      duration: 600,
    });
    setActiveSector("all");
    setActivePlaceName("All India");
  };

  const totalEvents = events.length;

  const MAP_STYLES = [
    { id: "dark", label: "Dark", icon: "🌌", desc: "High-contrast dark vector basemap" },
    { id: "satellite", label: "Satellite", icon: "🛰️", desc: "ESRI high-resolution orbital imagery" },
    { id: "3d", label: "3D Buildings", icon: "🏢", desc: "Extruded 3D structures & terrain pitch" },
  ] as const;

  return (
    <div
      className={`relative w-full h-full bg-[#020617] overflow-hidden select-none ${className}`}
      onClick={() => {
        if (showPlacesMenu) setShowPlacesMenu(false);
      }}
    >
      {/* ── Map Container ── */}
      <div
        ref={containerRef}
        className="w-full h-full"
      />

      {/* ── Floating Controls Bar (Top Left): Style Switcher (Icons Only) + Recenter + Sector Quick-Jump ── */}
      {!compact && (
        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-2">
          {/* Map Style Switcher — Icons Only (Dark / Satellite / 3D Buildings) */}
          <div className="flex items-center bg-[#080d18]/90 backdrop-blur-md border border-cyan-500/25 rounded-md p-0.5 shadow-lg">
            {MAP_STYLES.map((st) => (
              <button
                key={st.id}
                onClick={() => handleStyleChange(st.id as TacticalMapStyleId)}
                className={`flex items-center justify-center w-8 h-8 rounded text-[15px] font-mono transition-all cursor-pointer ${
                  activeStyle === st.id
                    ? "bg-cyan-500/30 border border-cyan-400/50 shadow-sm"
                    : "hover:bg-white/5 border border-transparent"
                }`}
                title={st.desc}
                aria-label={st.label}
              >
                <span>{st.icon}</span>
              </button>
            ))}
          </div>

          {/* ── Layer Settings Cog — Heatmap Toggle (below style switcher) ── */}
          <div className="relative" ref={layerSettingsRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLayerSettings((prev) => !prev);
              }}
              className={`flex items-center justify-center w-8 h-8 bg-[#080d18]/90 hover:bg-white/10 text-slate-300 hover:text-white backdrop-blur-md border rounded-md font-mono text-[15px] transition-all shadow-lg cursor-pointer ${
                showLayerSettings
                  ? "border-cyan-400/50 bg-cyan-500/30 text-white"
                  : "border-cyan-500/20"
              }`}
              title="Layer Settings (Heatmap / Circles)"
              aria-label="Layer Settings"
            >
              <span>⚙️</span>
            </button>

            {showLayerSettings && (
              <div className="absolute top-full left-0 mt-1 w-[16rem] bg-[#080d18]/98 backdrop-blur-xl border border-cyan-500/30 rounded-md shadow-2xl z-30 font-mono text-[10px] overflow-hidden">
                <div className="px-3 py-2 text-cyan-400 border-b border-cyan-500/20 tracking-wider">
                  LAYER SETTINGS
                </div>
                <div className="p-2">
                  <label className="flex items-center justify-between gap-2 px-2 py-2 rounded hover:bg-white/5 cursor-pointer select-none">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span>🔥</span>
                      <span>Thermal Heatmap</span>
                    </span>
                    <span
                      role="switch"
                      aria-checked={showHeatmap}
                      tabIndex={0}
                      onClick={(e) => {
                        e.preventDefault();
                        toggleHeatmap();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleHeatmap();
                        }
                      }}
                      className={`relative inline-flex items-center h-4 w-8 rounded-full transition-colors cursor-pointer shrink-0 ${
                        showHeatmap ? "bg-cyan-500/80" : "bg-slate-600/60"
                      }`}
                    >
                      <span
                        className={`absolute h-3 w-3 rounded-full bg-white transition-transform ${
                          showHeatmap ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </label>
                  <div className="px-2 pt-1 pb-2 text-[8px] text-slate-500 leading-relaxed">
                    {showHeatmap
                      ? "Thermal heatmap + fire circles visible."
                      : "Heatmap off — showing fire marker circles only."}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Row: Recenter + Sector Quick-Jump (below style switcher / settings) */}
          <div className="flex flex-wrap items-center gap-2">
          {!dossierMode && (
            <>
              {/* Recenter India Button */}
              <button
                onClick={handleRecenter}
                className="flex items-center gap-1.5 bg-[#080d18]/90 hover:bg-white/10 text-slate-300 hover:text-white backdrop-blur-md border border-cyan-500/20 rounded-md px-2.5 py-1.5 font-mono text-[10px] transition-all shadow-lg cursor-pointer"
                title="Recenter India Sovereign Mainland (All-India View)"
              >
                <span className="text-cyan-400 font-bold">⌖</span>
                <span>All India</span>
              </button>

              {/* Regional Sector Quick-Jump Dropdown */}
              <div className="relative" ref={placesDropdownRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlacesMenu((prev) => !prev);
                  }}
                  className="flex items-center gap-1.5 bg-[#080d18]/90 hover:bg-white/10 text-slate-300 hover:text-white backdrop-blur-md border border-cyan-500/20 rounded-md px-2.5 py-1.5 font-mono text-[10px] transition-all shadow-lg cursor-pointer max-w-[10rem]"
                >
                  <span className="text-cyan-400">📍</span>
                  <span className="truncate">{activePlaceName}</span>
                  <span className="text-slate-500 text-[8px]">▼</span>
                </button>

                {showPlacesMenu && (
                  <div className="absolute top-full left-0 mt-1 w-[22rem] bg-[#080d18]/98 backdrop-blur-xl border border-cyan-500/30 rounded-md shadow-2xl z-30 font-mono text-[10px] overflow-hidden">
                    {/* Search input */}
                    <div className="sticky top-0 bg-[#080d18] px-3 py-2 border-b border-cyan-500/20">
                      <input
                        type="text"
                        value={placeSearchQuery}
                        onChange={(e) => setPlaceSearchQuery(e.target.value)}
                        placeholder="Search states, hubs, cities…"
                        className="w-full bg-[#0d162b] border border-white/10 rounded px-2 py-1.5 text-[10px] text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/60"
                        autoFocus
                      />
                      {/* Category filter chips */}
                      <div className="flex gap-1 mt-1.5 overflow-x-auto no-scrollbar">
                        {([
                          { id: "all", label: "All" },
                          { id: "sectors", label: "⚡ Sectors" },
                          { id: "states", label: "🏛 States/UT" },
                          { id: "industrial", label: "🏭 Industrial Hubs" },
                          { id: "cities", label: "🏙 Cities" },
                        ] as const).map((chip) => (
                          <button
                            key={chip.id}
                            onClick={() => setPlaceFilterCategory(chip.id)}
                            className={`shrink-0 px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                              placeFilterCategory === chip.id
                                ? "bg-cyan-500/25 border-cyan-400/60 text-cyan-300"
                                : "bg-transparent border-white/10 text-slate-400 hover:text-white hover:border-white/30"
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Scrollable list */}
                    <div className="max-h-[16rem] overflow-y-auto py-1">
                      {/* Sectors section */}
                      {(placeFilterCategory === "all" || placeFilterCategory === "sectors") && (
                        <>
                          <div className="px-3 py-1 text-[9px] text-cyan-500/80 uppercase tracking-widest border-b border-white/5 sticky top-0 bg-[#080d18]">
                            ⚡ Regional Sectors
                          </div>
                          {REGIONAL_SECTORS.filter((sec) =>
                            sec.label.toLowerCase().includes(placeSearchQuery.toLowerCase())
                          ).map((sec) => (
                            <button
                              key={sec.id}
                              onClick={() => handleSectorSelect(sec)}
                              className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-cyan-500/15 cursor-pointer transition-colors ${
                                activeSector === sec.id ? "text-cyan-300 bg-cyan-500/10 font-bold" : "text-slate-300"
                              }`}
                            >
                              <span>{sec.label}</span>
                              {activeSector === sec.id && <span className="text-cyan-400 text-[10px]">●</span>}
                            </button>
                          ))}
                        </>
                      )}

                      {/* States/UT section */}
                      {(placeFilterCategory === "all" || placeFilterCategory === "states") && (
                        <>
                          <div className="px-3 py-1 text-[9px] text-cyan-500/80 uppercase tracking-widest border-b border-white/5 mt-1">
                            🏛 States & Union Territories
                          </div>
                          {INDIAN_STATES_AND_UTS.filter((s) =>
                            s.name.toLowerCase().includes(placeSearchQuery.toLowerCase())
                          ).map((s) => (
                            <button
                              key={s.name}
                              onClick={() => handlePlaceSelect(s)}
                              className="w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 text-slate-300 hover:bg-cyan-500/15 hover:text-white cursor-pointer transition-colors"
                            >
                              <span>{s.name}</span>
                              <span className="text-[8px] text-slate-500">{s.stateCode ?? "UT"}</span>
                            </button>
                          ))}
                        </>
                      )}

                      {/* Industrial hubs section */}
                      {(placeFilterCategory === "all" || placeFilterCategory === "industrial") && (
                        <>
                          <div className="px-3 py-1 text-[9px] text-cyan-500/80 uppercase tracking-widest border-b border-white/5 mt-1">
                            🏭 Industrial Hubs
                          </div>
                          {INDIAN_CITIES.filter(
                            (c) => c.type === "industrial_hub" && c.name.toLowerCase().includes(placeSearchQuery.toLowerCase())
                          ).map((c) => (
                            <button
                              key={c.name}
                              onClick={() => handlePlaceSelect(c)}
                              className="w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 text-slate-300 hover:bg-cyan-500/15 hover:text-white cursor-pointer transition-colors"
                            >
                              <span>{c.name}</span>
                              <span className="text-[8px] text-orange-400">IND</span>
                            </button>
                          ))}
                        </>
                      )}

                      {/* Cities section */}
                      {(placeFilterCategory === "all" || placeFilterCategory === "cities") && (
                        <>
                          <div className="px-3 py-1 sticky top-0 bg-[#080d18] text-[9px] text-cyan-500/80 uppercase tracking-widest border-b border-white/5 mt-1">
                            🏙 Major Cities & Ports
                          </div>
                          {INDIAN_CITIES.filter(
                            (c) =>
                              c.type !== "industrial_hub" &&
                              c.name.toLowerCase().includes(placeSearchQuery.toLowerCase())
                          ).map((c) => (
                            <button
                              key={c.name}
                              onClick={() => handlePlaceSelect(c)}
                              className="w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 text-slate-300 hover:bg-cyan-500/15 hover:text-white cursor-pointer transition-colors"
                            >
                              <span>{c.name}</span>
                              <span className="text-[8px] text-blue-400">CITY</span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* ── Tactical Zoom Control Stack (Top Right) ── */}
      {!compact && showControls && (
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 bg-[#080d18]/90 backdrop-blur-md border border-cyan-500/20 rounded-md p-1 shadow-lg">
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-white/10 font-mono text-sm transition-all cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <div className="h-[1px] bg-white/10 w-full" />
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-white/10 font-mono text-sm transition-all cursor-pointer"
            title="Zoom Out"
          >
            −
          </button>
        </div>
      )}

      {/* ── Interactive Classification Breakdown HUD (Bottom Right) ── */}
      {!compact && showControls && !dossierMode && (
        <div className="absolute bottom-4 right-4 z-20 bg-[#080d18]/90 backdrop-blur-md border border-cyan-500/20 rounded-md p-3 min-w-[230px] max-w-[270px] shadow-2xl">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-slate-400 mb-2 border-b border-white/5 pb-1.5">
            <span className="text-cyan-400 font-bold">CLASSIFICATION</span>
            <span className="text-slate-500 font-mono">{totalEvents} TOTAL</span>
          </div>

          <div className="space-y-1.5">
            {LEGEND.map((item) => {
              const count = events.filter((e) => item.match(e)).length;
              const pct = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
              const isZero = count === 0;

              return (
                <div
                  key={item.label}
                  className={`transition-opacity duration-200 ${
                    isZero ? "opacity-35" : "opacity-100"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono mb-0.5 gap-4">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span
                        className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{
                          background: item.color,
                          boxShadow: isZero ? "none" : `0 0 6px ${item.color}`,
                        }}
                      />
                      <span className={`truncate ${isZero ? "text-slate-500" : "text-slate-200"}`}>
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] tabular-nums shrink-0 ml-auto">
                      <span className={isZero ? "text-slate-600" : "text-slate-300 font-medium"}>
                        {count}
                      </span>
                      <span className="text-slate-600">({pct}%)</span>
                    </div>
                  </div>

                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${pct}%`,
                        backgroundColor: item.color,
                      }}
                      className="h-full rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Cursor Coordinate HUD (Bottom Left) ── */}
      {!compact && cursorPos && !dossierMode && (
        <div className="absolute bottom-4 left-4 z-20 bg-[#080d18]/90 backdrop-blur-md border border-cyan-500/20 rounded px-2.5 py-1 font-mono text-[10px] text-slate-400 tracking-wider shadow-lg">
          <span className="text-cyan-400 font-bold">CURSOR TELEMETRY: </span>
          <span className="text-white">{cursorPos.lat > 0 ? `${cursorPos.lat}°N` : `${Math.abs(cursorPos.lat)}°S`}</span>
          {" · "}
          <span className="text-white">{cursorPos.lng > 0 ? `${cursorPos.lng}°E` : `${Math.abs(cursorPos.lng)}°W`}</span>
        </div>
      )}
    </div>
  );
}
