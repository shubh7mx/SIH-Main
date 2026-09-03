"use client";

import { useMemo } from "react";
import type { TimelineResponse } from "@/lib/api";

interface TimelineScrubberProps {
  timeline: TimelineResponse | null;
  loading?: boolean;
  selectedEpoch: number | null;
  onSelectEpoch: (epoch: number | null) => void;
  onPlayToggle?: (playing: boolean) => void;
  isPlaying?: boolean;
}

export function TimelineScrubber({
  timeline,
  loading = false,
  selectedEpoch,
  onSelectEpoch,
  onPlayToggle,
  isPlaying = false,
}: TimelineScrubberProps) {
  const buckets = timeline?.buckets ?? [];
  const totalEventsInTimeline = timeline?.total_events ?? buckets.reduce((s, b) => s + b.total_events, 0);

  // Find max event count for bar normalization
  const maxEvents = useMemo(() => {
    if (!buckets.length) return 1;
    return Math.max(...buckets.map((b) => b.total_events), 1);
  }, [buckets]);

  // Handle scrubber index
  const currentIdx = useMemo(() => {
    if (selectedEpoch === null || !buckets.length) return null;
    const idx = buckets.findIndex((b) => b.epoch === selectedEpoch);
    return idx === -1 ? null : idx;
  }, [selectedEpoch, buckets]);

  const activeBucket = currentIdx !== null ? buckets[currentIdx] : null;

  return (
    <div className="surface-card p-3 border-t border-hairline flex flex-col gap-2">
      {/* Header with scrub status */}
      <div className="flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 uppercase tracking-[0.14em] text-[10px] font-mono font-semibold">
            🕒 24H Timeline Scrubber
          </span>
          {activeBucket ? (
            <span className="text-[var(--accent-cyan)] font-semibold">
              Time-slice:{" "}
              {new Date(activeBucket.epoch * 1000).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              IST
            </span>
          ) : (
            <span className="text-emerald-400 font-semibold">
              ● All 24H Detections
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {activeBucket ? (
            <div className="flex items-center gap-2 text-[10px] text-mute">
              <span className="text-white font-medium">
                {activeBucket.total_events} hotspots in 1h window
              </span>
              {activeBucket.critical_count > 0 && (
                <span className="text-red-400 font-bold">
                  ● {activeBucket.critical_count} CRITICAL
                </span>
              )}
              {activeBucket.mean_frp_mw > 0 && (
                <span>· FRP {activeBucket.mean_frp_mw.toFixed(0)} MW</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[10px] text-mute">
              <span className="text-white font-medium">
                {totalEventsInTimeline > 0
                  ? `${totalEventsInTimeline} total hotspots in 24h`
                  : "All available detections in view"}
              </span>
            </div>
          )}

          {/* Play / Live button */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPlayToggle && onPlayToggle(!isPlaying)}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] transition-all cursor-pointer"
            >
              {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
            </button>
            <button
              onClick={() => onSelectEpoch(null)}
              className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                selectedEpoch === null
                  ? "bg-[var(--accent-cyan)] text-black font-bold"
                  : "bg-white/5 hover:bg-white/10 text-mute"
              }`}
            >
              ● ALL 24H
            </button>
          </div>
        </div>
      </div>

      {/* Histogram Bar Strip */}
      <div className="relative h-9 bg-black/40 rounded border border-white/5 flex items-end px-1 gap-0.5 overflow-hidden">
        {loading && !buckets.length ? (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-mute">
            Loading timeline...
          </div>
        ) : buckets.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-mute">
            Continuous satellite stream active across 24h window
          </div>
        ) : (
          buckets.map((b, i) => {
            const isSelected = selectedEpoch === b.epoch;
            const heightPct = Math.max(
              (b.total_events / maxEvents) * 100,
              b.total_events > 0 ? 15 : 6
            );
            const isCrit = b.critical_count > 0;
            return (
              <button
                key={b.epoch}
                onClick={() => onSelectEpoch(isSelected ? null : b.epoch)}
                title={`${new Date(b.epoch * 1000).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                })}: ${b.total_events} hotspots (${b.critical_count} critical)`}
                className="flex-1 flex flex-col justify-end items-center h-full group focus:outline-none cursor-pointer"
              >
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-t transition-all ${
                    isSelected
                      ? "bg-[var(--accent-cyan)] shadow-[0_0_8px_#06b6d4]"
                      : isCrit
                      ? "bg-red-500/80 group-hover:bg-red-400"
                      : b.total_events > 0
                      ? "bg-blue-500/60 group-hover:bg-blue-400"
                      : "bg-white/5 group-hover:bg-white/15"
                  }`}
                />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
