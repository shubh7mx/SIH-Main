"use client";

/**
 * MapLibreMap — Real interactive India map.
 * Uses MapLibre GL with public OSM raster tiles.
 * Renders hotspot events as DOM markers.
 *
 * This replaces canvas-based fake maps with a real, working map.
 */

import { useEffect, useRef, useState } from "react";
import type { HotspotEvent } from "@/lib/types";
import { CLASSIFICATION_META } from "@/lib/types";

interface MapLibreMapProps {
  events: HotspotEvent[];
  onSelect?: (event: HotspotEvent) => void;
  selectedId?: string | null;
  height?: string;
  showLabels?: boolean;
}

export function MapLibreMap({
  events,
  onSelect,
  selectedId,
  height = "100%",
  showLabels = true,
}: MapLibreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize the map ONCE
  useEffect(() => {
    let cancelled = false;
    let map: unknown = null;

    (async () => {
      try {
        const mlModule = await import("maplibre-gl");
        const maplibregl: any = (mlModule as any).default || mlModule;
        if (cancelled || !containerRef.current) return;

        // India bbox center
        const m = new maplibregl.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              "osm-raster": {
                type: "raster",
                tiles: [
                  "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                  "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                  "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
                ],
                tileSize: 256,
                attribution: "&copy; OpenStreetMap contributors",
                maxzoom: 19,
              },
            },
            layers: [
              { id: "osm", type: "raster", source: "osm-raster" },
            ],
          } as unknown as string,
          center: [82, 22],
          zoom: 4,
          minZoom: 3,
          maxZoom: 14,
          attributionControl: false,
        });

        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        m.addControl(
          new maplibregl.AttributionControl({ compact: true }),
          "bottom-right"
        );

        m.on("load", () => {
          if (cancelled) return;
          setReady(true);
        });

        m.on("error", (e: { error?: { message?: string } }) => {
          // Tile load errors are common; only set state for fatal errors
          const msg = e?.error?.message ?? "";
          if (msg && !msg.includes("404")) {
            console.warn("[MapLibreMap] error:", msg);
          }
        });

        map = m;
        mapRef.current = m;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        const m = mapRef.current as { remove?: () => void } | null;
        m?.remove?.();
      } catch {
        // ignore
      }
      mapRef.current = null;
    };
  }, []);

  // Update markers when events change
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      const mlModule = await import("maplibre-gl");
      const maplibregl: any = (mlModule as any).default || mlModule;
      const map = mapRef.current as { remove: () => void; getCanvas: () => HTMLElement } | null;
      if (!map || cancelled) return;

      // Clear old markers
      for (const m of markersRef.current as Array<{ remove: () => void }>) {
        m.remove();
      }
      markersRef.current = [];

      const newMarkers: unknown[] = [];

      for (const ev of events.slice(0, 50)) {
        const meta = CLASSIFICATION_META[ev.classification] || CLASSIFICATION_META.AGRICULTURAL_BURNING;
        const isSelected = ev.id === selectedId;
        const isCritical = ev.is_critical_alert;

        // Build a DOM marker element
        const el = document.createElement("div");
        el.style.cssText = `
          width: ${isSelected ? 24 : 18}px;
          height: ${isSelected ? 24 : 18}px;
          border-radius: 50%;
          background: ${meta.color};
          border: 2px solid ${isSelected ? "#fff" : isCritical ? "#ef4444" : meta.color};
          box-shadow: 0 0 ${isCritical ? 18 : 8}px ${meta.color}cc,
                      0 0 0 1px rgba(0,0,0,0.4);
          cursor: pointer;
          position: relative;
          transition: transform 0.15s ease;
        `;
        el.title = `${ev.classification} | ${ev.facility_name ?? "Uncorrelated"} | FRP ${ev.frp_megawatts} MW`;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelect?.(ev);
        });
        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.3)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1.0)";
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([ev.longitude, ev.latitude])
          .addTo(map as unknown as Parameters<typeof maplibregl.Marker.prototype.addTo>[0]);
        newMarkers.push(marker);
      }

      // Industrial facility reference markers
      const facs: Array<{ name: string; lat: number; lon: number }> = [
        { name: "Reliance Jamnagar", lat: 22.368, lon: 69.832 },
        { name: "IOCL Haldia", lat: 22.031, lon: 88.082 },
        { name: "IOCL Panipat", lat: 29.39, lon: 76.963 },
        { name: "HPCL Visakh", lat: 17.724, lon: 83.265 },
        { name: "Tata Steel Jamshedpur", lat: 22.804, lon: 86.202 },
        { name: "BPCL Mumbai", lat: 18.978, lon: 72.847 },
        { name: "ONGC Hazira", lat: 21.112, lon: 72.645 },
        { name: "SAIL Bokaro", lat: 23.669, lon: 86.151 },
        { name: "Mangalore Refinery", lat: 12.911, lon: 74.881 },
        { name: "Kochi Refinery", lat: 10.09, lon: 76.218 },
        { name: "Chennai Petroleum", lat: 13.168, lon: 80.257 },
        { name: "NTPC Dadri", lat: 28.554, lon: 77.560 },
      ];

      for (const f of facs) {
        const el = document.createElement("div");
        el.style.cssText = `
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(92,198,230,0.85);
          border: 1px solid rgba(92,198,230,0.4);
          box-shadow: 0 0 6px rgba(92,198,230,0.4);
        `;
        el.title = f.name;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([f.lon, f.lat])
          .addTo(map as unknown as Parameters<typeof maplibregl.Marker.prototype.addTo>[0]);
        newMarkers.push(marker);
      }

      markersRef.current = newMarkers;
    })();

    return () => {
      cancelled = true;
    };
  }, [events, ready, selectedId, onSelect]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        background: "#0a0e14",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Top-left status badge */}
      {showLabels && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 10,
            display: "flex",
            gap: 8,
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              background: "rgba(10,14,20,0.85)",
              border: "1px solid rgba(92,198,230,0.3)",
              borderRadius: 6,
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "rgba(232,238,245,0.7)",
            }}
          >
            🛰️ India · Thermal View
          </div>
          <div
            style={{
              padding: "6px 10px",
              background: "rgba(10,14,20,0.85)",
              border: "1px solid rgba(92,198,230,0.3)",
              borderRadius: 6,
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "rgba(232,238,245,0.7)",
            }}
          >
            VIIRS 375m NRT
          </div>
          <div
            style={{
              padding: "6px 10px",
              background: "rgba(10,14,20,0.85)",
              border: "1px solid rgba(92,198,230,0.4)",
              borderRadius: 6,
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#5cc6e6",
            }}
          >
            {ready ? `● ${events.length} LIVE` : "○ loading…"}
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10,14,20,0.95)",
            color: "#ef4444",
            fontFamily: "monospace",
            fontSize: 12,
            padding: 20,
            zIndex: 20,
          }}
        >
          Map failed: {error}
        </div>
      )}
    </div>
  );
}
