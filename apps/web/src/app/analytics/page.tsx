"use client";

import { useMemo } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { KpiStatTile } from "@/components/ui/KpiStatTile";
import { useDetailedAnalytics, useEvents } from "@/lib/hooks";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend,
} from "recharts";
import { getClassificationSeverity } from "@/lib/design-tokens";

const PIE_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#a855f7"];

export default function AnalyticsPage() {
  const analyticsQuery = useDetailedAnalytics(30_000);
  const eventsQuery = useEvents({ limit: 200 });

  const stats = analyticsQuery.data;
  const events = eventsQuery.data ?? [];

  // Breakdown data for Pie
  const categoryData = useMemo(() => {
    if (!stats?.class_breakdown) return [];
    return Object.entries(stats.class_breakdown).map(([k, v]) => ({
      name: getClassificationSeverity(k).shortLabel,
      value: v as number,
    }));
  }, [stats]);

  // State distribution data for Bar
  const stateData = useMemo(() => {
    if (!stats?.state_breakdown) return [];
    return Object.entries(stats.state_breakdown)
      .map(([state, count]) => ({ state, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [stats]);

  // Confidence distribution histogram buckets
  const confData = useMemo(() => {
    const buckets = [
      { range: "0–40%", count: 0 },
      { range: "40–60%", count: 0 },
      { range: "60–80%", count: 0 },
      { range: "80–90%", count: 0 },
      { range: "90–100%", count: 0 },
    ];
    for (const e of events) {
      const c = e.confidence_score * 100;
      if (c < 40) buckets[0].count++;
      else if (c < 60) buckets[1].count++;
      else if (c < 80) buckets[2].count++;
      else if (c < 90) buckets[3].count++;
      else buckets[4].count++;
    }
    return buckets;
  }, [events]);

  return (
    <ConsoleShell>
      <div className="p-3 sm:p-4 lg:p-6 space-y-6 max-w-[1600px] w-full mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Thermal Anomaly Analytics
          </h1>
          <p className="text-xs text-mute mt-1 font-mono">
            Longitudinal trends, FRP percentiles, and facility risk rankings
          </p>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <KpiStatTile
            label="Total Ingested"
            value={stats?.total_events_processed ?? events.length}
            unit="events"
            subtext="NASA FIRMS 24h stream"
            accentColor="#06b6d4"
            loading={analyticsQuery.loading}
          />
          <KpiStatTile
            label="FRP 90th Percentile"
            value={
              typeof stats?.frp_percentiles?.p90 === "number"
                ? stats.frp_percentiles.p90.toFixed(1)
                : "—"
            }
            unit="MW"
            subtext="Top 10% thermal intensity"
            accentColor="#f97316"
            loading={analyticsQuery.loading}
          />
          <KpiStatTile
            label="Max FRP Recorded"
            value={
              typeof stats?.frp_percentiles?.max === "number"
                ? stats.frp_percentiles.max.toFixed(1)
                : "—"
            }
            unit="MW"
            subtext="Peak single-event output"
            accentColor="#ef4444"
            loading={analyticsQuery.loading}
          />
          <KpiStatTile
            label="Monitored Facilities"
            value={stats?.monitored_facilities ?? 46}
            unit="sites"
            subtext="OSM + PostGIS Indian registry"
            accentColor="#10b981"
            loading={analyticsQuery.loading}
          />
        </div>

        {/* Charts Row 1: Category Pie + State Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Category distribution */}
          <div className="surface-card rounded-xl border border-white/5 p-5">
            <div className="eyebrow mb-4">Classification Proportion</div>
            {categoryData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-mute font-mono text-xs">
                No breakdown data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(8,14,26,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontFamily: "monospace",
                      fontSize: 11,
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(val) => (
                      <span className="font-mono text-[10px] text-white/80">{val}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* State Distribution */}
          <div className="surface-card rounded-xl border border-white/5 p-5">
            <div className="eyebrow mb-4">Regional Hotspot Distribution</div>
            {stateData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-mute font-mono text-xs">
                No state telemetry data.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stateData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="state"
                    tick={{ fill: "#94a3b8", fontSize: 9, fontFamily: "monospace" }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
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
                  <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Charts Row 2: Confidence Histogram + Top Risk Facilities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Confidence distribution */}
          <div className="surface-card rounded-xl border border-white/5 p-5">
            <div className="eyebrow mb-4">AI Confidence Distribution</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={confData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="range"
                  tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
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
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Risk Facilities list */}
          <div className="surface-card rounded-xl border border-white/5 p-5 flex flex-col justify-between">
            <div>
              <div className="eyebrow mb-3">Facility Thermal Rankings</div>
              <div className="space-y-2.5 font-mono text-xs">
                {(stats?.facilities_ranking ?? []).slice(0, 5).map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/5"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-white font-medium truncate">{f.name}</div>
                      <div className="text-[10px] text-mute">
                        {f.critical_count > 0 ? (
                          <span className="text-red-400 font-bold">{f.critical_count} critical</span>
                        ) : (
                          "0 critical"
                        )}{" "}
                        · CDE {f.mean_cde !== null ? `+${f.mean_cde.toFixed(1)}σ` : "0.0σ"}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-cyan-400 font-bold">{f.max_frp_mw.toFixed(0)} MW</div>
                      <div className="text-[10px] text-mute">{f.event_count} hits</div>
                    </div>
                  </div>
                ))}
                {(stats?.facilities_ranking ?? []).length === 0 && (
                  <div className="p-4 text-center text-mute">No facility risk rankings yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
