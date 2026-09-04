"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { TacticalMap } from "@/components/TacticalMap";
import { EventDrawer } from "@/components/EventDrawer";
import { TimelineScrubber } from "@/components/TimelineScrubber";
import { useEvents, useAlertStream, useTimeline } from "@/lib/hooks";
import type { HotspotEvent, ThermalClassification } from "@/lib/types";

type FilterCategory = "ALL" | "CRITICAL" | "PERSISTENT" | "AGRICULTURAL" | "WILDFIRE";

const FILTERS: { id: FilterCategory; label: string }[] = [
  { id: "ALL", label: "All Events" },
  { id: "CRITICAL", label: "Critical" },
  { id: "PERSISTENT", label: "Persistent Flares" },
  { id: "AGRICULTURAL", label: "Agricultural" },
  { id: "WILDFIRE", label: "Wildfire" },
];

function MapPageInner() {
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("event") || searchParams.get("id");

  const eventsQuery = useEvents({ limit: 1000 }, 30_000);
  const alertStream = useAlertStream({ enabled: true });
  const timelineQuery = useTimeline({ intervalMinutes: 60 }, 60_000);

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

  // Playback ticker
  useEffect(() => {
    if (!isPlaying) return;
    const buckets = timelineQuery.data?.buckets ?? [];
    if (!buckets.length) {
      setIsPlaying(false);
      return;
    }
    const id = setInterval(() => {
      setSelectedEpoch((prev) => {
        if (prev === null) return buckets[0].epoch;
        const idx = buckets.findIndex((b) => b.epoch === prev);
        if (idx === -1 || idx >= buckets.length - 1) {
          setIsPlaying(false);
          return null;
        }
        return buckets[idx + 1].epoch;
      });
    }, 1400);
    return () => clearInterval(id);
  }, [isPlaying, timelineQuery.data]);

  const allEvents = useMemo(() => {
    const backend = eventsQuery.data ?? [];
    const ids = new Set(backend.map((e) => e.id));
    const fresh = liveEvents.filter((e) => !ids.has(e.id));
    return [...fresh, ...backend];
  }, [eventsQuery.data, liveEvents]);

  // ── Deep-link support: /map?event=<id> selects & flies to the event ──────
  useEffect(() => {
    if (!eventParam) return;
    const target = allEvents.find((e) => e.id === eventParam);
    if (target) {
      setSelected(target);
    }
  }, [eventParam, allEvents]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      if (activeFilter === "CRITICAL" && !ev.is_critical_alert) return false;
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

      if (selectedEpoch !== null) {
        const evTime = new Date(ev.acq_datetime || ev.created_at || "").getTime();
        // Match events within the selected 1-hour time bucket (3600 * 1000 ms)
        if (Math.abs(evTime - selectedEpoch) > 3600 * 1000) return false;
      }
      return true;
    });
  }, [allEvents, activeFilter, selectedEpoch]);

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
              <span className="text-white">{filteredEvents.length}</span> of{" "}
              {allEvents.length} hotspots
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
