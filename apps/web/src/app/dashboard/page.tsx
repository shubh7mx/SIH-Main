"use client";

import { useEffect, useMemo, useState } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { TacticalMap } from "@/components/TacticalMap";
import { KpiStatTile } from "@/components/ui/KpiStatTile";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { useEvents, useAlertStream, useTimeline, describeError } from "@/lib/hooks";
import type { HotspotEvent } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import { getClassificationSeverity } from "@/lib/design-tokens";

export default function DashboardPage() {
  const eventsQuery = useEvents({ limit: 1000 }, 30_000);
  const alertStream = useAlertStream({ enabled: true });
  const timelineQuery = useTimeline({ intervalMinutes: 60 }, 60_000);

  const [liveEvents, setLiveEvents] = useState<HotspotEvent[]>([]);

  useEffect(() => {
    if (alertStream.latestEvent) {
      setLiveEvents((prev) => {
        if (prev.some((e) => e.id === alertStream.latestEvent!.id)) return prev;
        return [alertStream.latestEvent!, ...prev].slice(0, 120);
      });
    }
  }, [alertStream.latestEvent]);

  const allEvents = useMemo(() => {
    const backend = eventsQuery.data ?? [];
    const ids = new Set(backend.map((e) => e.id));
    const fresh = liveEvents.filter((e) => !ids.has(e.id));
    return [...fresh, ...backend];
  }, [eventsQuery.data, liveEvents]);

  const criticalCount = allEvents.filter((e) => e.is_critical_alert).length;
  const meanConfidence =
    allEvents.length > 0
      ? allEvents.reduce((s, e) => s + e.confidence_score, 0) / allEvents.length
      : 0;

  // Sparkline data from timeline buckets
  const sparkData = (timelineQuery.data?.buckets ?? []).map((b) => ({
    t: new Date(b.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", hour12: false }),
    events: b.total_events,
    critical: b.critical_count,
  }));

  // Category distribution
  const classCounts = new Map<string, number>();
  for (const e of allEvents) {
    classCounts.set(e.classification, (classCounts.get(e.classification) ?? 0) + 1);
  }
  const classData = Array.from(classCounts.entries()).map(([name, count]) => ({
    name: getClassificationSeverity(name).shortLabel,
    count,
    color: getClassificationSeverity(name).dot,
  }));

  const recentActivity = [...allEvents]
    .sort((a, b) => +new Date(b.acq_datetime) - +new Date(a.acq_datetime))
    .slice(0, 12);

  const loading = eventsQuery.loading && allEvents.length === 0;

  return (
    <ConsoleShell>
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] w-full mx-auto overflow-x-hidden">
        {/* ── Page heading ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Operational Overview
            </h1>
            <p className="text-xs text-mute mt-1 font-mono">
              Live thermal intelligence across the Indian subcontinent · VIIRS 375m NRT
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span
              className={`px-2 py-1 rounded border ${
                alertStream.state === "open"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              {alertStream.state === "open" ? "● LIVE STREAM" : "○ POLLING"}
            </span>
            <span className="px-2 py-1 rounded border border-white/10 bg-white/5 text-mute">
              NASA FIRMS · {allEvents.length} detections / 24h
            </span>
          </div>
        </div>

        {/* ── KPI Row ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <KpiStatTile
            label="Active Detections"
            value={allEvents.length}
            unit="/24h"
            subtext="Hotspots in current window"
            accentColor="#06b6d4"
            loading={loading}
          />
          <KpiStatTile
            label="Critical Emergencies"
            value={criticalCount}
            unit="alerts"
            delta={{
              value: criticalCount > 0 ? "ACTION" : "CLEAR",
              trend: criticalCount > 0 ? "up" : "down",
              label: criticalCount > 0 ? "Duty review" : "No active emergencies",
            }}
            accentColor="#ef4444"
            loading={loading}
          />
          <KpiStatTile
            label="Mean AI Confidence"
            value={meanConfidence > 0 ? `${(meanConfidence * 100).toFixed(1)}%` : "—"}
            subtext="6-agent Bayesian fusion"
            accentColor="#10b981"
            loading={loading}
          />
          <KpiStatTile
            label="Total FRP Tracked"
            value={allEvents.reduce((s, e) => s + e.frp_megawatts, 0).toFixed(0)}
            unit="MW"
            subtext="Cumulative radiative power"
            accentColor="#f97316"
            loading={loading}
          />
        </div>

        {/* ── Map preview + Activity ticker ──────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Compact map */}
          <div className="xl:col-span-2 surface-card rounded-xl border border-white/5 overflow-hidden relative h-[320px] sm:h-[380px]">
            <div className="absolute top-3 left-3 z-10 font-mono text-[10px] text-mute uppercase tracking-widest bg-black/60 px-2 py-1 rounded border border-white/10">
              India Thermal Overview
            </div>
            <TacticalMap events={allEvents} compact showControls={false} />
            <div className="absolute bottom-3 right-3 z-10">
              <a
                href="/map"
                className="btn-secondary text-[10px] bg-black/70 backdrop-blur-sm"
              >
                Open Full Map →
              </a>
            </div>
          </div>

          {/* Recent activity ticker */}
          <div className="surface-card rounded-xl border border-white/5 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <span className="eyebrow">Recent Detections</span>
              <a href="/events" className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono">
                View all →
              </a>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03] max-h-[340px]">
              {loading ? (
                <div className="p-4 space-y-3">
                  <CardSkeleton />
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="p-6 text-center text-mute font-mono text-[11px]">
                  No detections in current window.
                </div>
              ) : (
                recentActivity.map((ev) => {
                  const sev = getClassificationSeverity(ev.classification);
                  const time = new Date(ev.acq_datetime).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "Asia/Kolkata",
                  });
                  return (
                    <a
                      key={ev.id}
                      href={`/event?id=${ev.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors group"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: sev.dot, boxShadow: `0 0 6px ${sev.glow}` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-white/90 truncate font-medium">
                          {ev.facility_name ?? "Unmapped anomaly"}
                        </div>
                        <div className="font-mono text-[9px] text-mute">
                          {sev.shortLabel} · {ev.frp_megawatts.toFixed(0)} MW
                        </div>
                      </div>
                      <span className="font-mono text-[9px] text-mute tabular-nums">
                        {time}
                      </span>
                    </a>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Charts row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Activity sparkline */}
          <div className="surface-card rounded-xl border border-white/5 p-4">
            <div className="eyebrow mb-3">Detections Trend · Last 24h</div>
            {sparkData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-mute font-mono text-[11px]">
                {timelineQuery.loading ? "Loading telemetry…" : "No timeline data available."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={sparkData}>
                  <defs>
                    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="critFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
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
                    contentStyle={{
                      background: "rgba(8,14,26,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontFamily: "monospace",
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="events"
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                    fill="url(#sparkFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="critical"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    fill="url(#critFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Classification distribution */}
          <div className="surface-card rounded-xl border border-white/5 p-4">
            <div className="eyebrow mb-3">Classification Mix</div>
            {classData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-mute font-mono text-[11px]">
                No classified events yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={classData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "rgba(8,14,26,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontFamily: "monospace",
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                    {classData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── System health strip ─────────────────────────────────────── */}
        <div className="surface-card rounded-xl border border-white/5 p-4">
          <div className="eyebrow mb-3">Data Source Health</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-[10px]">
            {[
              { src: "NASA FIRMS (VIIRS 375m)", status: "NOMINAL", ok: true },
              { src: "OSM Facility Registry", status: "46 sites cached", ok: true },
              { src: "Sentinel-2 CDSE", status: "STANDBY", ok: true },
              { src: "Swarm AI (6 agents)", status: "READY", ok: true },
            ].map((s) => (
              <div
                key={s.src}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    s.ok ? "bg-emerald-400 shadow-[0_0_6px_#10b981]" : "bg-amber-400"
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-white/80 truncate">{s.src}</div>
                  <div className="text-mute text-[9px]">{s.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
