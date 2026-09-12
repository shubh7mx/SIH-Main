"use client";

import { useMemo } from "react";
import type { TimelineResponse } from "@/lib/api";

export type TimelineRange = "24H" | "7D" | "30D";

interface TimelineScrubberProps {
  timeline: TimelineResponse | null;
  loading?: boolean;
  error?: Error | null;
  selectedEpoch: number | null;
  onSelectEpoch: (epoch: number | null) => void;
  onPlayToggle?: (playing: boolean) => void;
  isPlaying?: boolean;
  onRefresh?: () => void;
  timeRange?: TimelineRange;
  onRangeChange?: (range: TimelineRange) => void;
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
  timeRange = "24H",
  onRangeChange,
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
      {/* Header with scrub status + range switcher + connection telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] font-mono">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <span className="text-slate-400 uppercase tracking-[0.14em] text-[10px] font-mono font-semibold whitespace-nowrap flex items-center gap-1.5">
            <span className="text-cyan-400">🕒</span> Timeline Intelligence
          </span>

          {/* Time range selector pill buttons */}
          {onRangeChange && (
            <div className="inline-flex items-center bg-black/60 rounded-md p-0.5 border border-white/10 text-[10px]">
              {(["24H", "7D", "30D"] as TimelineRange[]).map((r) => {
                const active = timeRange === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onRangeChange(r)}
                    className={`px-2 py-0.5 rounded transition-all font-mono font-semibold ${
                      active
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          )}

          {activeBucket ? (
            <span className="text-[var(--accent-cyan)] font-semibold">
              Time-slice:{" "}
              {timeRange === "24H"
                ? new Date(activeBucket.epoch).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                  }) + " IST"
                : new Date(activeBucket.epoch).toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }) + " IST"}
            </span>
          ) : (
            <span className="text-emerald-400 font-semibold">
              ● All {timeRange} Detections ({totalEventsInTimeline.toLocaleString()})
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
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              Updating {timeRange}…
            </span>
          )}

          {/* Reset / All filter button */}
          {selectedEpoch !== null && (
            <button
              onClick={() => onSelectEpoch(null)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-mono tracking-wider"
            >
              Show All
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-[10px] text-mute hover:text-ink font-mono px-1.5 py-0.5 rounded border border-hairline hover:bg-white/5 transition"
              title="Refresh timeline data"
            >
              ↻ Refresh
            </button>
          )}
        </div>
      </div>

      {/* Scrubber track with continuous histogram bars */}
      <div className="relative w-full h-14 bg-black/40 rounded border border-hairline flex items-end p-1 gap-[2px] overflow-visible">
        {buckets.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-mute font-mono">
            {loading ? "Loading temporal histogram…" : `No thermal events recorded in past ${timeRange}`}
          </div>
        ) : (
          buckets.map((b) => {
            const heightPct = Math.max((b.total_events / maxEvents) * 100, 8);
            const isSelected = selectedEpoch === b.epoch;
            const hasCritical = (b.critical_count ?? 0) > 0 || ((b.class_counts?.["INDUSTRIAL_FIRE_EMERGENCY"] ?? 0) > 0);
            const isHighFRP = (b.max_frp_mw ?? 0) > 100;
            const isModerateFRP = (b.max_frp_mw ?? 0) > 40;

            // Bar background color based strictly on verified critical counts and FRP
            let barBg = "bg-cyan-950/60 hover:bg-cyan-800/80 border-cyan-800/40";
            if (hasCritical) {
              barBg = "bg-red-950/80 hover:bg-red-800 border-red-500/50";
            } else if (isHighFRP) {
              barBg = "bg-orange-950/70 hover:bg-orange-800/80 border-orange-700/50";
            } else if (isModerateFRP) {
              barBg = "bg-amber-950/60 hover:bg-amber-800/70 border-amber-700/40";
            }

            if (isSelected) {
              barBg = hasCritical
                ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] border-white"
                : isHighFRP
                ? "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)] border-white"
                : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] border-white";
            }

            return (
              <button
                key={b.epoch}
                type="button"
                onClick={() => onSelectEpoch(isSelected ? null : b.epoch)}
                className={`group relative flex-1 min-w-[6px] rounded-t-sm border-t border-x transition-all duration-150 ${barBg}`}
                style={{ height: `${heightPct}%` }}
                title={`${
                  timeRange === "24H"
                    ? new Date(b.epoch).toLocaleTimeString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : new Date(b.epoch).toLocaleDateString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                      })
                } IST: ${b.total_events} events (${b.critical_count} critical), Max FRP ${b.max_frp_mw.toFixed(1)} MW`}
              >
                {/* Hover indicator tooltip on individual bucket - elevated z-index & backdrop */}
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center bg-[#070b14]/95 backdrop-blur-md border border-cyan-500/50 px-2.5 py-1.5 rounded-md text-[10px] font-mono text-white shadow-[0_10px_25px_rgba(0,0,0,0.8)] z-50 whitespace-nowrap">
                  <span className="font-semibold text-cyan-300">
                    {timeRange === "24H"
                      ? new Date(b.epoch).toLocaleTimeString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : new Date(b.epoch).toLocaleDateString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                        })}{" "}
                    IST
                  </span>
                  <span>{b.total_events} events</span>
                  {b.critical_count > 0 && (
                    <span className="text-red-400 font-bold">
                      🚨 {b.critical_count} critical
                    </span>
                  )}
                  <span className="text-slate-400 text-[9px]">
                    Max FRP: {b.max_frp_mw.toFixed(1)} MW
                  </span>
                  {/* Tooltip caret */}
                  <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-cyan-500/50" />
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Control row: Playback + Time Labels */}
      <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-mute pt-0.5">
        <div className="flex items-center gap-2">
          {onPlayToggle && buckets.length > 0 && (
            <button
              onClick={() => onPlayToggle(!isPlaying)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-medium transition ${
                isPlaying
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-white/5 hover:bg-white/10 text-ink border border-hairline"
              }`}
            >
              <span>{isPlaying ? "⏸ Pause" : "▶ Play Sequence"}</span>
            </button>
          )}

          {activeBucket && (
            <span className="text-[10px] text-slate-300">
              Active slice: <strong>{activeBucket.total_events}</strong> events (
              <span className="text-red-400 font-semibold">
                {activeBucket.critical_count} critical
              </span>
              , max FRP {activeBucket.max_frp_mw.toFixed(1)} MW)
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-[9px] text-mute">
          {buckets.length > 0 && (
            <>
              <span>
                {timeRange === "24H"
                  ? new Date(buckets[0].epoch).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : new Date(buckets[0].epoch).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                      month: "short",
                    })}{" "}
                IST
              </span>
              <span className="text-slate-600">┈┈┈┈┈┈</span>
              <span>
                {timeRange === "24H"
                  ? new Date(
                      buckets[buckets.length - 1].epoch
                    ).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : new Date(
                      buckets[buckets.length - 1].epoch
                    ).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                      month: "short",
                    })}{" "}
                IST (Now)
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
