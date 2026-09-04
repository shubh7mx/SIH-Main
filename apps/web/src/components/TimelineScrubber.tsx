"use client";

import { useMemo } from "react";
import type { TimelineResponse } from "@/lib/api";

interface TimelineScrubberProps {
  timeline: TimelineResponse | null;
  loading?: boolean;
  error?: Error | null;
  selectedEpoch: number | null;
  onSelectEpoch: (epoch: number | null) => void;
  onPlayToggle?: (playing: boolean) => void;
  isPlaying?: boolean;
  onRefresh?: () => void;
}

export function TimelineScrubber({
  timeline,
  loading = false,
  error = null,
  selectedEpoch,
  onSelectEpoch,
  onPlayToggle,
  isPlaying = false,
  onRefresh,
}: TimelineScrubberProps) {
  const buckets = timeline?.buckets ?? [];
  const totalEventsInTimeline =
    timeline?.total_events ?? buckets.reduce((s, b) => s + b.total_events, 0);

  const isStale = !!error && !!timeline;
  const isDisconnected = !!error && !timeline;

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
    <div
      className={`surface-card p-3 border-t border-hairline flex flex-col gap-2 transition-opacity ${
        isStale ? "opacity-75" : ""
      }`}
    >
      {/* Header with scrub status + connection telemetry */}
      <div className="flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 uppercase tracking-[0.14em] text-[10px] font-mono font-semibold">
            🕒 24H Timeline Scrubber
          </span>
          {activeBucket ? (
            <span className="text-[var(--accent-cyan)] font-semibold">
              Time-slice:{" "}
              {new Date(activeBucket.epoch).toLocaleTimeString("en-IN", {
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

        <div className="flex items-center gap-2">
          {/* Connection state banner */}
          {isDisconnected && (
            <span className="text-[9px] text-red-400 flex items-center gap-1 animate-pulse font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Reconnecting…
            </span>
          )}
          {isStale && (
            <span className="text-[9px] text-yellow-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              Cached timeline
            </span>
          )}
          {!error && loading && (
            <span className="text-[9px] text-cyan-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Syncing…
            </span>
          )}

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
                  ? `${totalEventsInTimeline.toLocaleString("en-IN")} total anomalies`
                  : "Continuous scan"}
              </span>
            </div>
          )}

          {/* Retry action on failure */}
          {error && onRefresh && (
            <button
              onClick={onRefresh}
              className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/20 text-slate-300 transition-all cursor-pointer"
              title="Retry connection"
            >
              ↩ Retry
            </button>
          )}

          <div className="flex items-center gap-1">
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
            Loading timeline…
          </div>
        ) : isDisconnected ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-mute gap-0.5">
            <span className="text-red-400 font-mono">⚠ Backend unreachable — auto-reconnecting</span>
          </div>
        ) : buckets.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-mute">
            Continuous satellite stream active across 24h window
          </div>
        ) : (
          buckets.map((b) => {
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
                title={`${new Date(b.epoch).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                })}: ${b.total_events} hotspots${
                  b.critical_count > 0 ? `, ${b.critical_count} critical` : ""
                }${b.mean_frp_mw > 0 ? `, FRP ${b.mean_frp_mw.toFixed(0)} MW` : ""}`}
                className={`flex-1 rounded-t transition-all duration-150 cursor-pointer hover:opacity-100 ${
                  isSelected
                    ? "ring-2 ring-cyan-400 ring-offset-1 ring-offset-black/80 z-10 scale-y-110"
                    : ""
                } ${isCrit ? "bg-orange-500/80" : "bg-cyan-500/60"}`}
                style={{
                  height: `${heightPct}%`,
                  minHeight: 4,
                  alignSelf: "flex-end",
                }}
              />
            );
          })
        )}
      </div>

      {/* Footer with time labels & playback controls */}
      <div className="flex items-center justify-between text-[9px] font-mono text-mute">
        <div className="flex items-center gap-1.5">
          {onPlayToggle && (
            <button
              onClick={() => onPlayToggle(!isPlaying)}
              disabled={!buckets.length}
              className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
                isPlaying
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-mute"
              }`}
              title={isPlaying ? "Pause timeline playback" : "Play 24H timeline animation"}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play 24H"}
            </button>
          )}
          <span className="text-slate-500">
            {buckets.length > 0
              ? `T-24H (${new Date(buckets[0].epoch).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                })})`
              : "24h ago"}
          </span>
        </div>

        <span className="text-slate-500">12h ago</span>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">
            {buckets.length > 0
              ? `NOW (${new Date(buckets[buckets.length - 1].epoch).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                })})`
              : "Now"}
          </span>
        </div>
      </div>
    </div>
  );
}