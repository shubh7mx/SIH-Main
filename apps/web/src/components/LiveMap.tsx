"use client";

import { useEffect, useRef, useState } from "react";
import type { HotspotEvent } from "@/lib/types";
import { CLASSIFICATION_META, ThermalClassification } from "@/lib/types";

interface LiveMapProps {
  events: HotspotEvent[];
  onSelect: (event: HotspotEvent) => void;
  selectedId: string | null;
}

/**
 * LiveMap — Canvas-rendered India thermal view.
 *
 * Phase 1 implementation: pure 2D-canvas rendering with real-time hotspot
 * overlays sourced from the live backend event store.
 * Phase 2: replace with MapLibre GL + deck.gl for satellite tile basemap.
 */
export function LiveMap({ events, onSelect, selectedId }: LiveMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;

    const render = () => {
      // Defer sizing to next animation frame so the parent layout settles.
      const rect = canvas.getBoundingClientRect();
      const W = Math.round(Math.max(rect.width, 320));
      const H = Math.round(Math.max(rect.height, 240));

      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;

      drawIndiaMap(canvas, events, selectedId);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    };

    schedule();
    setMapReady(true);

    const ro = new ResizeObserver(schedule);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [events, selectedId]);

  return (
    <div className="relative flex-1 min-h-0 bg-[#06060a]">
      {/* Map Label */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="surface-card px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-[0.15em] text-mute">
          🛰️ India · Thermal View
        </span>
        <span className="surface-card px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-[0.15em] text-mute">
          VIIRS 375m NRT
        </span>
      </div>

      {/* Hotspot count */}
      <div className="absolute top-3 right-3 z-10">
        <div className="surface-card px-3 py-1.5 rounded-md text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-mute">
            Active Events
          </div>
          <div className="font-favorit text-[28px] leading-none text-ink tabular-nums">
            {events.length}
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        style={{ width: "100%", height: "100%", display: "block" }}
        onClick={(e) => {
          // Hit test: find nearest hotspot to click location
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const W = rect.width;
          const H = rect.height;
          let nearest: HotspotEvent | null = null;
          let minDist = Infinity;
          for (const evt of events) {
            const px = ((evt.longitude - 68) / (98 - 68)) * W;
            const py = H - ((evt.latitude - 6) / (38 - 6)) * H;
            const d = Math.hypot(px - x, py - y);
            if (d < 20 && d < minDist) {
              minDist = d;
              nearest = evt;
            }
          }
          if (nearest) onSelect(nearest);
        }}
      />

      {/* Loading skeleton — only during first paint */}
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-canvas">
          <div className="text-center">
            <div className="skeleton w-16 h-16 rounded-full mx-auto mb-3" />
            <div className="skeleton w-32 h-3 rounded mb-2" />
            <div className="skeleton w-24 h-3 rounded" />
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-12 left-3 z-10 surface-card p-3 rounded-lg space-y-1.5">
        {Object.entries(CLASSIFICATION_META).map(([key, meta]) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: meta.color }}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-charcoal">
              {meta.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Canvas renderer ─────────────────────────────────────────────────────────
function drawIndiaMap(
  canvas: HTMLCanvasElement,
  events: HotspotEvent[],
  selectedId: string | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  // Background: dark canvas
  ctx.fillStyle = "#06060a";
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const x = (W / 10) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
    const y = (H / 10) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Lat/lon labels
  ctx.font = "9px Geist Mono, monospace";
  ctx.fillStyle = "rgba(161,164,165,0.4)";
  ctx.fillText("68°E", 8, H - 8);
  ctx.fillText("98°E", W - 32, H - 8);
  ctx.fillText("38°N", 4, 16);
  ctx.fillText("6°N", 4, H - 4);

  // India outline (rough, drawn with stroke only)
  const outline: [number, number][] = [
    [6.5, 80], [8.5, 77], [9.5, 76.5], [12, 74.5], [14.5, 74.5],
    [15.5, 73.5], [16.5, 73], [18, 73], [19.5, 72], [20.5, 71],
    [21.5, 69], [22.5, 69], [22.5, 68], [24, 68], [25, 68.5],
    [27, 70], [28, 72], [29.5, 74], [30.5, 76], [32, 78],
    [33.5, 79], [35, 79], [36, 80], [37, 80.5], [37, 82],
    [37.5, 84], [37, 86], [36, 88], [34.5, 90], [34, 91.5],
    [33, 92.5], [31, 94], [28, 95], [26, 95], [24, 94.5],
    [22, 94], [21, 93.5], [20, 92.5], [18.5, 92.5], [17.5, 93],
    [16, 94], [15, 94.5], [13, 94], [11.5, 93], [10.5, 92.5],
    [9, 92.5], [8, 92.5], [7, 93], [6.5, 93.5], [6, 93], [6, 92], [6.5, 80],
  ];
  const toCanvas = (lat: number, lon: number) => ({
    x: ((lon - 68) / (98 - 68)) * W,
    y: H - ((lat - 6) / (38 - 6)) * H,
  });
  ctx.beginPath();
  outline.forEach(([lat, lon], i) => {
    const { x, y } = toCanvas(lat, lon);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = "rgba(92,198,230,0.32)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(92,198,230,0.04)";
  ctx.fill();

  // Coastline ring (subtle outer)
  ctx.shadowColor = "rgba(92,198,230,0.18)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  outline.forEach(([lat, lon], i) => {
    const { x, y } = toCanvas(lat, lon);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Facility dots (static, demo)
  const facs: [number, number][] = [
    [22.368, 69.832], [22.031, 88.082], [29.39, 76.963], [17.724, 83.265],
    [22.804, 86.202], [18.93, 72.83], [19.08, 72.87],
    [28.55, 77.55], [12.91, 74.88], [10.09, 76.22],
    [13.17, 80.26], [21.71, 72.97], [23.67, 86.15], [20.32, 86.19],
    [21.23, 81.03], [25.42, 81.85], [26.86, 80.95], [28.99, 77.71],
  ];
  facs.forEach(([lat, lon]) => {
    const { x, y } = toCanvas(lat, lon);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(92,198,230,0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(92,198,230,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Hotspot events
  events.forEach((evt) => {
    const meta = CLASSIFICATION_META[evt.classification] || CLASSIFICATION_META[ThermalClassification.AGRICULTURAL_BURNING];
    const { x, y } = toCanvas(evt.latitude, evt.longitude);

    // Skip off-canvas
    if (x < -50 || x > W + 50 || y < -50 || y > H + 50) return;

    const isSelected = evt.id === selectedId;
    const isCritical = evt.is_critical_alert;

    const radius = isSelected ? 18 : isCritical ? 14 : 10;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, meta.color + "cc");
    gradient.addColorStop(0.4, meta.color + "55");
    gradient.addColorStop(1, meta.color + "00");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Core dot
    ctx.fillStyle = meta.color;
    ctx.beginPath();
    ctx.arc(x, y, isSelected ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // Empty state
  if (events.length === 0) {
    ctx.fillStyle = "rgba(161,164,165,0.45)";
    ctx.font = "11px Geist Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("No active events in current view", W / 2, H / 2);
    ctx.textAlign = "left";
  }
}
