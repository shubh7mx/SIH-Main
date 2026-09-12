"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { TimelineResponse } from "@/lib/api";

interface DetectionsTrendChartProps {
  timeline: TimelineResponse | null;
  loading?: boolean;
}

interface SparkPoint {
  index: number;
  t: string;
  dateLabel: string;
  events: number;
  critical: number;
  maxFrp: number;
  meanFrp: number;
}

/**
 * Self-contained scrubbing area chart for "Detections Trend · Last 24h".
 * Hover state lives INSIDE this component so the recharts tooltip tracks the
 * cursor natively (parent re-renders break recharts' internal tooltip sync
 * and cause it to stick to the last data point).
 */
export function DetectionsTrendChart({ timeline, loading = false }: DetectionsTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const sparkData: SparkPoint[] = useMemo(() => {
    return (timeline?.buckets ?? []).map((b, i) => ({
      index: i,
      epoch: b.epoch,
      t: new Date(b.epoch).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      dateLabel: new Date(b.epoch).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      events: b.total_events,
      critical: b.critical_count,
      maxFrp: b.max_frp_mw,
      meanFrp: b.mean_frp_mw,
    }));
  }, [timeline]);

  const hovered = hoverIndex !== null && sparkData[hoverIndex] ? sparkData[hoverIndex] : null;

  return (
    <div className="surface-card rounded-xl border border-white/5 p-4 flex flex-col justify-between">
      {/* Header with live scrub readout — updates as the tooltip moves */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="eyebrow">Detections Trend · Last 24h</div>
        {hovered ? (
          <div className="flex items-center gap-2 font-mono text-[11px] whitespace-nowrap">
            <span className="text-cyan-400 font-semibold">{hovered.t} IST</span>
            <span className="text-white/80">· {hovered.events} events</span>
            {hovered.critical > 0 && (
              <span className="text-red-400 font-bold">· 🚨 {hovered.critical} critical</span>
            )}
          </div>
        ) : (
          <div className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
            Hover / scrub to inspect hourly slice
          </div>
        )}
      </div>

      {sparkData.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-mute font-mono text-[11px]">
          {loading ? "Loading telemetry…" : "No timeline data available."}
        </div>
      ) : (
        <div className="h-40 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={sparkData}
              margin={{ top: 5, right: 8, bottom: 0, left: 0 }}
              onMouseMove={(e: any) => {
                if (e && e.activeTooltipIndex != null) {
                  const idx = Number(e.activeTooltipIndex);
                  if (!Number.isNaN(idx)) setHoverIndex(idx);
                }
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="critFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="t"
                tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ stroke: "rgba(6,182,212,0.45)", strokeWidth: 1.5, strokeDasharray: "3 3" }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0]?.payload as SparkPoint | undefined;
                  if (!d) return null;
                  return (
                    <div className="bg-[#070b14]/95 backdrop-blur-md border border-cyan-500/40 rounded-lg p-2.5 font-mono text-[11px] shadow-2xl">
                      <div className="text-cyan-300 font-semibold mb-1 flex items-center justify-between gap-3">
                        <span>{d.dateLabel} IST</span>
                        <span className="text-[10px] text-slate-400">Slice #{d.index + 1}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                        <span>Total Events: <strong>{d.events}</strong></span>
                      </div>
                      {d.critical > 0 && (
                        <div className="flex items-center gap-2 text-red-400 font-semibold mt-0.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                          <span>🚨 Critical: <strong>{d.critical}</strong></span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-1 pt-1 border-t border-white/10 flex justify-between gap-4">
                        <span>Peak FRP: {d.maxFrp.toFixed(1)} MW</span>
                        <span>Avg: {d.meanFrp.toFixed(1)} MW</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="events"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="url(#sparkFill)"
                activeDot={{ r: 4, stroke: "#22d3ee", strokeWidth: 2, fill: "#080e1a" }}
              />
              <Area
                type="monotone"
                dataKey="critical"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#critFill)"
                activeDot={{ r: 5, stroke: "#f87171", strokeWidth: 2, fill: "#ef4444" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
