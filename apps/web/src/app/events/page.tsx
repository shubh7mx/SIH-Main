"use client";

import { useEffect, useMemo, useState } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { EventDrawer } from "@/components/EventDrawer";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useEvents, useAlertStream } from "@/lib/hooks";
import type { HotspotEvent, ThermalClassification } from "@/lib/types";
import { getClassificationSeverity } from "@/lib/design-tokens";
import { getEventLocation } from "@/lib/location-resolver";

type SortKey = "acq_datetime" | "frp_megawatts" | "brightness_temp_kelvin" | "confidence_score";
type FilterCat = "ALL" | "CRITICAL" | "PERSISTENT" | "AGRICULTURAL" | "WILDFIRE" | "DEFERRED";

export default function EventsPage() {
  const eventsQuery = useEvents({ limit: 200 }, 30_000);
  const alertStream = useAlertStream({ enabled: true });
  const [liveEvents, setLiveEvents] = useState<HotspotEvent[]>([]);
  const [selected, setSelected] = useState<HotspotEvent | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("acq_datetime");
  const [sortDesc, setSortDesc] = useState(true);
  const [filter, setFilter] = useState<FilterCat>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (alertStream.latestEvent) {
      setLiveEvents((prev) => {
        if (prev.some((e) => e.id === alertStream.latestEvent!.id)) return prev;
        return [alertStream.latestEvent!, ...prev].slice(0, 200);
      });
    }
  }, [alertStream.latestEvent]);

  const allEvents = useMemo(() => {
    const backend = eventsQuery.data ?? [];
    const ids = new Set(backend.map((e) => e.id));
    const fresh = liveEvents.filter((e) => !ids.has(e.id));
    return [...fresh, ...backend];
  }, [eventsQuery.data, liveEvents]);

  const processed = useMemo(() => {
    let list = allEvents;

    if (filter === "CRITICAL") list = list.filter((e) => e.is_critical_alert);
    else if (filter !== "ALL") {
      const map: Record<string, string> = {
        PERSISTENT: "PERSISTENT_INDUSTRIAL_FLARE",
        AGRICULTURAL: "AGRICULTURAL_BURNING",
        WILDFIRE: "WILDFIRE",
        DEFERRED: "DEFERRED_FOR_ANALYST",
      };
      const cls = map[filter];
      list = list.filter((e) => e.classification === (cls as ThermalClassification));
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (e) =>
          e.facility_name?.toLowerCase().includes(q) ||
          e.classification.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDesc ? -cmp : cmp;
    });
  }, [allEvents, filter, query, sortKey, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      scope="col"
      onClick={() => toggleSort(k)}
      className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-mute cursor-pointer select-none hover:text-white transition-colors"
    >
      {label} {sortKey === k && <span className="text-cyan-400">{sortDesc ? "▼" : "▲"}</span>}
    </th>
  );

  return (
    <ConsoleShell>
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 max-w-[1600px] w-full mx-auto">
        {/* Heading */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Thermal Detections
            </h1>
            <p className="text-xs text-mute mt-1 font-mono">
              {processed.length} of {allEvents.length} events · sorted by{" "}
              {sortKey.replace(/_/g, " ")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search facility, class, id…"
              className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 font-mono text-[11px] text-white placeholder:text-mute focus:outline-none focus:border-cyan-400/50 w-48 sm:w-56"
            />

            {/* Filter select */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterCat)}
              className="bg-[#0b1324] border border-cyan-500/30 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-white focus:outline-none focus:border-cyan-400 cursor-pointer shadow-sm"
            >
              <option className="bg-[#0b1324] text-slate-100" value="ALL">All Classifications</option>
              <option className="bg-[#0b1324] text-red-400 font-semibold" value="CRITICAL">🚨 Critical Only</option>
              <option className="bg-[#0b1324] text-orange-400" value="PERSISTENT">🏭 Persistent Flares</option>
              <option className="bg-[#0b1324] text-yellow-400" value="AGRICULTURAL">🌾 Agricultural</option>
              <option className="bg-[#0b1324] text-blue-400" value="WILDFIRE">🔥 Wildfire</option>
              <option className="bg-[#0b1324] text-slate-300" value="DEFERRED">📋 Analyst Review</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {eventsQuery.loading && allEvents.length === 0 ? (
          <TableSkeleton rows={8} />
        ) : processed.length === 0 ? (
          <EmptyState
            title="No Events Match"
            description={
              query
                ? `No results for "${query}". Try clearing the search or filter.`
                : "No thermal detections match the current filter."
            }
            action={{
              label: "Reset filters",
              onClick: () => {
                setQuery("");
                setFilter("ALL");
              },
            }}
          />
        ) : (
          <div className="surface-card rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead className="bg-black/40 border-b border-white/[0.07]">
                  <tr>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-mute">
                      Class
                    </th>
                    <SortHeader k="acq_datetime" label="Acquired" />
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-mute">
                      Facility / Location
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-mute">
                      State & Region
                    </th>
                    <SortHeader k="frp_megawatts" label="FRP (MW)" />
                    <SortHeader k="brightness_temp_kelvin" label="BT (K)" />
                    <SortHeader k="confidence_score" label="AI Conf." />
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-mute">
                      CDE
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {processed.map((ev) => {
                    const sev = getClassificationSeverity(ev.classification);
                    return (
                      <tr
                        key={ev.id}
                        onClick={() => setSelected(ev)}
                        className="cursor-pointer hover:bg-white/[0.03] transition-colors focus:outline-none focus-visible:bg-white/[0.05]"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setSelected(ev);
                        }}
                      >
                        <td className="px-3 py-2">
                          <SeverityBadge classification={ev.classification} size="sm" />
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-mute tabular-nums whitespace-nowrap">
                          {new Date(ev.acq_datetime).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </td>
                        <td className="px-3 py-2 text-[11px] max-w-[200px] truncate">
                          <div className="text-white/90 font-medium truncate">
                            {ev.facility_name ?? `Near ${getEventLocation(ev).city}`}
                          </div>
                          <div className="font-mono text-[9px] text-mute">
                            {Number(ev.latitude ?? 0).toFixed(2)}°, {Number(ev.longitude ?? 0).toFixed(2)}°
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-300 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/5">
                            📍 {getEventLocation(ev).state}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-white">
                          {Number(ev.frp_megawatts ?? 0).toFixed(1)}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-white">
                          {Number(ev.brightness_temp_kelvin ?? 300).toFixed(0)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-white/80 tabular-nums w-8">
                              {(Number(ev.confidence_score ?? 0.8) * 100).toFixed(0)}%
                            </span>
                            <div className="w-14 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Number(ev.confidence_score ?? 0.8) * 100}%`,
                                  backgroundColor:
                                    Number(ev.confidence_score ?? 0.8) >= 0.75
                                      ? "#10b981"
                                      : Number(ev.confidence_score ?? 0.8) >= 0.5
                                      ? "#06b6d4"
                                      : "#f59e0b",
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] tabular-nums">
                          <span
                            style={{
                              color: (ev.cde_anomaly_score ?? 0) > 3 ? "#ef4444" : "#10b981",
                            }}
                          >
                            {(ev.cde_anomaly_score ?? 0).toFixed(1)}σ
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <EventDrawer event={selected} onClose={() => setSelected(null)} />
    </ConsoleShell>
  );
}
