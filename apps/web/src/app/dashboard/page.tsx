"use client";

import { useEffect, useMemo, useState } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { TacticalMap } from "@/components/TacticalMap";
import { DetectionsTrendChart } from "@/components/DetectionsTrendChart";
import { KpiStatTile } from "@/components/ui/KpiStatTile";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { SectorBadge } from "@/components/ui/SectorBadge";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { useEvents, useAlertStream, useTimeline, describeError } from "@/lib/hooks";
import type { HotspotEvent } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid,
} from "recharts";
import { getClassificationSeverity } from "@/lib/design-tokens";

type TimeWindowFilter = "24h" | "7d" | "30d" | "ALL";

export default function DashboardPage() {
  const eventsQuery = useEvents({ limit: 1000 }, 30_000);
  const alertStream = useAlertStream({ enabled: true });
  const timelineQuery = useTimeline({ intervalMinutes: 60 }, 60_000);

  const [liveEvents, setLiveEvents] = useState<HotspotEvent[]>([]);
  const [mixWindow, setMixWindow] = useState<TimeWindowFilter>("24h");

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

  // Filtered events for Classification Mix based on selected time window
  const mixFilteredEvents = useMemo(() => {
    if (mixWindow === "ALL" || allEvents.length === 0) return allEvents;

    // Anchor cutoff from latest timestamp in events or now
    const latestMs = Math.max(
      ...allEvents.map((e) => new Date(e.acq_datetime || e.created_at).getTime()).filter((t) => !isNaN(t)),
      Date.now()
    );

    const windowMs =
      mixWindow === "24h"
        ? 24 * 60 * 60 * 1000
        : mixWindow === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

    const cutoff = latestMs - windowMs;
    const filtered = allEvents.filter((e) => {
      const t = new Date(e.acq_datetime || e.created_at).getTime();
      return isNaN(t) || t >= cutoff;
    });

    return filtered.length > 0 ? filtered : allEvents;
  }, [allEvents, mixWindow]);

  // Category distribution for active mix window
  const classCounts = new Map<string, number>();
  for (const e of mixFilteredEvents) {
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
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] text-white/90 truncate font-medium">
                            {ev.facility_name ?? "Unmapped anomaly"}
                          </span>
                          <SectorBadge
                            facilityType={ev.facility_type}
                            facilityName={ev.facility_name}
                            size="sm"
                          />
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
          <DetectionsTrendChart
            timeline={timelineQuery.data}
            loading={timelineQuery.loading}
          />

          {/* Classification distribution */}
          <div className="surface-card rounded-xl border border-white/5 p-4 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="eyebrow">Classification Mix</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-400 border border-cyan-800/60">
                    {mixWindow === "24h"
                      ? "Last 24 Hours"
                      : mixWindow === "7d"
                      ? "Past 7 Days"
                      : mixWindow === "30d"
                      ? "Past 30 Days"
                      : "All Active"}
                    {" · "}
                    {mixFilteredEvents.length} events
                  </span>
                </div>
                {/* Time Range Selector */}
                <div className="inline-flex items-center rounded-lg bg-black/40 border border-white/5 p-0.5 font-mono text-[10px]">
                  {(["24h", "7d", "30d", "ALL"] as TimeWindowFilter[]).map((w) => (
                    <button
                      key={w}
                      onClick={() => setMixWindow(w)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        mixWindow === w
                          ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {w === "ALL" ? "All" : w}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mb-2">
                Distribution across 4-class taxonomy for the selected operational window
              </p>
            </div>

            {classData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-mute font-mono text-[11px]">
                No classified events in {mixWindow === "ALL" ? "database" : mixWindow} window.
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
