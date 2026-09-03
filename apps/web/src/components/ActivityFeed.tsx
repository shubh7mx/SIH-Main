"use client";

import type { HotspotEvent } from "@/lib/types";
import { CLASSIFICATION_META } from "@/lib/types";

interface Props {
  events: HotspotEvent[];
  onSelect: (event: HotspotEvent) => void;
  selectedId: string | null;
}

export function ActivityFeed({ events, onSelect, selectedId }: Props) {
  return (
    <div className="h-full flex flex-col overflow-hidden select-none">
      {/* ── Feed Sub-header ──────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-elevated)] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Real-Time Ingestion Stream</span>
          <span className="text-[10px] font-mono text-[var(--accent-cyan)] px-1.5 py-0.2 rounded bg-[rgba(56,189,248,0.1)]">
            VIIRS NRT
          </span>
        </div>
        <div className="font-mono text-[10px] text-[var(--text-mute)]">
          {events.length} Events In View
        </div>
      </div>

      {/* ── Horizontal / Scannable Cards Stream ──────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-2 flex gap-2">
        {events.map((evt) => {
          const meta = CLASSIFICATION_META[evt.classification] || {
            label: "Hotspot",
            color: "#38bdf8",
            glow: "transparent",
          };
          const isSelected = evt.id === selectedId;
          const isEmergency = evt.is_critical_alert;

          return (
            <button
              key={evt.id}
              onClick={() => onSelect(evt)}
              className={`flex-shrink-0 w-64 p-3 rounded-lg text-left transition-all border flex flex-col justify-between ${
                isSelected
                  ? "bg-[var(--bg-surface-elevated)] border-[var(--border-strong)] shadow-sm"
                  : "bg-[var(--bg-surface)] border-[var(--border-hairline)] hover:border-[var(--border-elevated)]"
              }`}
              style={{
                borderColor: isSelected
                  ? isEmergency ? "#f03e3e" : "var(--accent-cyan)"
                  : undefined,
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <span
                      className="font-mono text-[9px] uppercase tracking-wider font-medium"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>

                  {isEmergency && (
                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-[rgba(240,62,62,0.2)] text-[#f03e3e] font-semibold animate-pulse">
                      ALERT
                    </span>
                  )}
                </div>

                <div className="text-[12px] font-medium text-[var(--text-primary)] leading-snug truncate">
                  {evt.facility_name || `${evt.latitude.toFixed(3)}°N, ${evt.longitude.toFixed(3)}°E`}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-mute)] pt-2 border-t border-[var(--border-hairline)] mt-2">
                <span>{evt.frp_megawatts.toFixed(0)} MW</span>
                <span className="text-[var(--text-secondary)]">
                  {(evt.confidence_score * 100).toFixed(0)}% Conf
                </span>
                <span>{evt.satellite_source.includes("SNPP") ? "SNPP" : "NOAA20"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
