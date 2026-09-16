"use client";

import { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { TacticalMap } from "@/components/TacticalMap";
import { EventDrawer } from "@/components/EventDrawer";
import { TimelineScrubber, type TimelineRange } from "@/components/TimelineScrubber";
import { useEvents, useAlertStream, useTimeline } from "@/lib/hooks";
import type { HotspotEvent, ThermalClassification } from "@/lib/types";

type FilterCategory = "ALL" | "CRITICAL" | "EMERGENCY" | "PERSISTENT" | "AGRICULTURAL" | "WILDFIRE";

const FILTERS: { id: FilterCategory; label: string }[] = [
  { id: "ALL", label: "All Events" },
  { id: "CRITICAL", label: "🚨 Critical Alerts" },
  { id: "EMERGENCY", label: "Industrial Fire" },
  { id: "PERSISTENT", label: "Persistent Flares" },
  { id: "AGRICULTURAL", label: "Agricultural" },
  { id: "WILDFIRE", label: "Wildfire" },
];

function MapPageInner() {
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("event") || searchParams.get("id");

  const eventsQuery = useEvents({ limit: 5000 }, 30_000);
  const alertStream = useAlertStream({ enabled: true });
  const [timeRange, setTimeRange] = useState<TimelineRange>("24H");

  const [liveEvents, setLiveEvents] = useState<HotspotEvent[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("ALL");
  const [selected, setSelected] = useState<HotspotEvent | null>(null);
  const [selectedEpoch, setSelectedEpoch] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

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

  // Determine latest anchor timestamp across dataset
  const latestMs = useMemo(() => {
    if (!allEvents.length) return Date.now();
    const timestamps = allEvents
      .map((e) => new Date(e.acq_datetime || e.created_at).getTime())
      .filter((t) => !isNaN(t));
    return timestamps.length ? Math.max(...timestamps) : Date.now();
  }, [allEvents]);

  // Dynamic timeline query config based on selected range and dataset anchor
  const timelineQueryConfig = useMemo(() => {
    const to = new Date(latestMs + 60 * 1000).toISOString();
    if (timeRange === "7D") {
      const from = new Date(latestMs - 7 * 24 * 3600 * 1000).toISOString();
      return { fromTime: from, toTime: to, intervalMinutes: 360 }; // 6-hour buckets
    }
    if (timeRange === "30D") {
      const from = new Date(latestMs - 30 * 24 * 3600 * 1000).toISOString();
      return { fromTime: from, toTime: to, intervalMinutes: 1440 }; // 24-hour daily buckets
    }
    // Default 24H
    const from = new Date(latestMs - 24 * 3600 * 1000).toISOString();
    return { fromTime: from, toTime: to, intervalMinutes: 60 };
  }, [timeRange, latestMs]);

  const timelineQuery = useTimeline(timelineQueryConfig, 60_000);

  // ── Deep-link support: /map?event=<id> selects & flies to the event once on trigger ──────
  const handledEventParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (!eventParam) {
      handledEventParamRef.current = null;
      return;
    }
    // Only auto-open on initial deep-link navigate or when target ID changes
    if (handledEventParamRef.current !== eventParam) {
      const target = allEvents.find((e) => e.id === eventParam);
      if (target) {
        handledEventParamRef.current = eventParam;
        setSelected(target);
      }
    }
  }, [eventParam, allEvents]);

  const filteredEvents = useMemo(() => {
    // Time range cutoff
    const windowMs =
      timeRange === "30D"
        ? 30 * 24 * 3600 * 1000
        : timeRange === "7D"
        ? 7 * 24 * 3600 * 1000
        : 24 * 3600 * 1000;
    const rangeCutoff = latestMs - windowMs;

    return allEvents.filter((ev) => {
      if (activeFilter === "CRITICAL" && !ev.is_critical_alert && ev.classification !== "INDUSTRIAL_FIRE_EMERGENCY") return false;
      if (
        activeFilter === "EMERGENCY" &&
        ev.classification !== ("INDUSTRIAL_FIRE_EMERGENCY" as ThermalClassification)
      )
        return false;
      if (
        activeFilter === "PERSISTENT" &&
        ev.classification !== ("PERSISTENT_INDUSTRIAL_FLARE" as ThermalClassification)
      )
        return false;
      if (
        activeFilter === "AGRICULTURAL" &&
        ev.classification !== ("AGRICULTURAL_BURNING" as ThermalClassification)
      )
        return false;
      if (
        activeFilter === "WILDFIRE" &&
        ev.classification !== ("WILDFIRE" as ThermalClassification)
      )
        return false;

      const evTime = new Date(ev.acq_datetime || ev.created_at || "").getTime();

      if (selectedEpoch !== null) {
        // Dynamic interval window match based on range: 1h (24H), 6h (7D), 24h (30D)
        const sliceWindowMs =
          timeRange === "30D"
            ? 24 * 3600 * 1000
            : timeRange === "7D"
            ? 6 * 3600 * 1000
            : 3600 * 1000;
        if (Math.abs(evTime - selectedEpoch) > sliceWindowMs) return false;
      } else {
        // Range window filter
        if (!isNaN(evTime) && evTime < rangeCutoff) return false;
      }
      return true;
    });
  }, [allEvents, activeFilter, selectedEpoch, timeRange, latestMs]);

  return (
    <ConsoleShell>
      <div className="flex flex-col h-[calc(100vh-48px)]">
        {/* ── Filter bar ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-white/[0.07] bg-[#04070c] flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1 overflow-x-auto" role="tablist">
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[11px] transition-all whitespace-nowrap focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
                    isActive
                      ? "bg-white/[0.10] text-white border border-white/[0.12]"
                      : "text-mute hover:text-white/90 border border-transparent hover:bg-white/[0.05]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono text-[10px] text-mute hidden md:inline">
              Showing{" "}
              <span className="text-cyan-300 font-semibold">{filteredEvents.length}</span> of{" "}
              <span className="text-white">{timeRange === "30D" ? "30D" : timeRange === "7D" ? "7D" : "24H"}</span> hotspots
            </span>
            <button
              onClick={() => setResetSignal((s) => s + 1)}
              className="btn-secondary text-[10px]"
              title="Recenter on India"
            >
              ⟲ Recentre
            </button>
          </div>
        </div>

        {/* ── Map canvas ──────────────────────────────────────────────── */}
        <div className="flex-1 relative min-h-0">
          <TacticalMap
            events={filteredEvents}
            onSelect={(ev) => setSelected(ev)}
            selectedId={selected?.id ?? null}
            resetSignal={resetSignal}
            persistKey="sih26162.live-map.style"
          />
        </div>

        {/* ── Timeline scrubber ───────────────────────────────────────── */}
        <div className="border-t border-white/[0.07] bg-[#04070c] flex-shrink-0">
          <TimelineScrubber
            timeline={timelineQuery.data}
            loading={timelineQuery.loading}
            error={timelineQuery.error}
            selectedEpoch={selectedEpoch}
            onSelectEpoch={setSelectedEpoch}
            onPlayToggle={setIsPlaying}
            isPlaying={isPlaying}
            timeRange={timeRange}
            onRangeChange={(r) => {
              setTimeRange(r);
              setSelectedEpoch(null);
            }}
            onRefresh={() => {
              timelineQuery.refresh();
              eventsQuery.refresh();
            }}
          />
        </div>
      </div>

      {/* ── Event drawer (slide-over) ─────────────────────────────────── */}
      <EventDrawer event={selected} onClose={() => setSelected(null)} />
    </ConsoleShell>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <ConsoleShell>
          <div className="flex items-center justify-center h-[calc(100vh-48px)] font-mono text-xs text-mute">
            INITIALIZING TACTICAL MAP…
          </div>
        </ConsoleShell>
      }
    >
      <MapPageInner />
    </Suspense>
  );
}
