"use client";

import { useEffect, useMemo, useState } from "react";
import { TacticalMap } from "@/components/TacticalMap";
import { EventDetailPanel } from "@/components/EventDetailPanel";
import { ActivityFeed } from "@/components/ActivityFeed";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { TimelineScrubber } from "@/components/TimelineScrubber";
import { SystemLogsTerminal } from "@/components/SystemLogsTerminal";
import { TacticalCopilotDialog } from "@/components/TacticalCopilotDialog";
import { mockEvents } from "@/lib/mock-data";
import {
  useEvents,
  useAlertStream,
  useTimeline,
  useDetailedAnalytics,
  useLogStream,
  describeError,
} from "@/lib/hooks";
import type { HotspotEvent, ThermalClassification } from "@/lib/types";
import type { WsState } from "@/lib/api";

const WS_STATE_LABEL: Record<WsState, { label: string; color: string }> = {
  connecting: { label: "CONNECTING", color: "#f5a623" },
  open: { label: "LIVE STREAM", color: "#22c55e" },
  closed: { label: "OFFLINE", color: "#ef4444" },
  error: { label: "STREAM ERR", color: "#ef4444" },
};

type FilterCategory = "ALL" | "EMERGENCY" | "PERSISTENT" | "AGRICULTURAL" | "WILDFIRE";
type BottomTab = "FEED" | "LOGS" | "ANALYTICS";

export function TacticalMissionControl({ onExit }: { onExit: () => void }) {
  // ── Backend queries & streams ──────────────────────────────────────────────
  const eventsQuery = useEvents({ limit: 1000 }, 30_000);
  const alertStream = useAlertStream({ enabled: true });
  const timelineQuery = useTimeline({ intervalMinutes: 60 }, 30_000);
  const analyticsQuery = useDetailedAnalytics(30_000);
  const logStream = useLogStream({ enabled: true });

  // ── State ──────────────────────────────────────────────────────────────────
  const [localEvents, setLocalEvents] = useState<HotspotEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<HotspotEvent | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDetailOpen, setIsDetailOpen] = useState(true);
  const [bottomTab, setBottomTab] = useState<BottomTab>("FEED");
  const [showCopilot, setShowCopilot] = useState(false);
  const [selectedEpoch, setSelectedEpoch] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Merge backend events with websocket stream events
  const rawEvents = useMemo<HotspotEvent[]>(() => {
    const backend = eventsQuery.data ?? [];
    if (backend.length > 0) {
      const ids = new Set(backend.map((e) => e.id));
      const freshLocals = localEvents.filter((e) => !ids.has(e.id));
      return [...freshLocals, ...backend];
    }
    if (localEvents.length > 0) return localEvents;
    return mockEvents;
  }, [eventsQuery.data, localEvents]);

  // Buffer incoming live alerts
  useEffect(() => {
    if (alertStream.latestEvent) {
      setLocalEvents((prev) => {
        const exists = prev.some((e) => e.id === alertStream.latestEvent!.id);
        if (exists) return prev;
        return [alertStream.latestEvent!, ...prev].slice(0, 150);
      });
    }
  }, [alertStream.latestEvent]);

  // Handle Playback ticker
  useEffect(() => {
    if (!isPlaying) return;
    const buckets = timelineQuery.data?.buckets ?? [];
    if (!buckets.length) return;

    const interval = setInterval(() => {
      setSelectedEpoch((prev) => {
        if (prev === null) return buckets[0].epoch;
        const idx = buckets.findIndex((b) => b.epoch === prev);
        if (idx === -1 || idx >= buckets.length - 1) {
          setIsPlaying(false);
          return null; // return to live
        }
        return buckets[idx + 1].epoch;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlaying, timelineQuery.data]);

  // Apply filters + timeline scrub window
  const filteredEvents = useMemo(() => {
    return rawEvents.filter((ev) => {
      // Timeline scrubber window filter (1-hour window matching bucket interval)
      if (selectedEpoch !== null) {
        const evTime = new Date(ev.acq_datetime || ev.created_at || "").getTime();
        // show events in the 1-hour bucket window (in milliseconds)
        if (Math.abs(evTime - selectedEpoch) > 3600 * 1000) {
          return false;
        }
      }

      // Classification filter
      if (activeFilter === "EMERGENCY" && !ev.is_critical_alert) return false;
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

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const facMatch = ev.facility_name?.toLowerCase().includes(q) ?? false;
        const idMatch = ev.id.toLowerCase().includes(q);
        const classMatch = ev.classification.toLowerCase().includes(q);
        if (!facMatch && !idMatch && !classMatch) return false;
      }

      return true;
    });
  }, [rawEvents, activeFilter, searchQuery, selectedEpoch]);

  const wsInfo = WS_STATE_LABEL[alertStream.state];
  const isFallback = !eventsQuery.data || eventsQuery.data.length === 0;
  const emergencyCount = rawEvents.filter((e) => e.is_critical_alert).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#05070c] text-[var(--text-primary)] select-none">
      {/* ── Mission Control Header ────────────────────────────────────────── */}
      <header className="h-12 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 flex items-center justify-between flex-shrink-0">
        {/* Left: Console identity */}
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: wsInfo.color }}
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] font-medium text-[var(--text-primary)]">
            NTRO GEOINT Console
          </span>
          <span className="text-[var(--text-faint)]">·</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--text-mute)] hidden sm:inline">
            PS: SIH26162
          </span>
        </div>

        {/* Center: Filter Pills */}
        <div className="hidden md:flex items-center gap-1.5 bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-hairline)]">
          {[
            { id: "ALL" as const, label: "All Events", count: rawEvents.length, alert: false },
            { id: "EMERGENCY" as const, label: "Critical", count: emergencyCount, alert: emergencyCount > 0 },
            { id: "PERSISTENT" as const, label: "Persistent Flares", count: undefined, alert: false },
            { id: "AGRICULTURAL" as const, label: "Agricultural", count: undefined, alert: false },
            { id: "WILDFIRE" as const, label: "Wildfire", count: undefined, alert: false },
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-elevated)]"
                    : "text-[var(--text-mute)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[9px] px-1 rounded ${
                      tab.alert
                        ? "bg-[rgba(240,62,62,0.2)] text-[#f03e3e]"
                        : "bg-[rgba(255,255,255,0.06)] text-[var(--text-mute)]"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Actions, Copilot & Stream Status */}
        <div className="flex items-center gap-2.5">
          {/* Copilot button */}
          <button
            onClick={() => setShowCopilot(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[rgba(92,198,230,0.12)] border border-[rgba(92,198,230,0.3)] text-[var(--accent-cyan)] hover:bg-[rgba(92,198,230,0.2)] text-[11px] font-mono transition-all"
          >
            <span>⚡</span>
            <span>Tactical Copilot</span>
          </button>

          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[10px] font-mono"
            style={{ color: wsInfo.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: wsInfo.color }} />
            <span>{isFallback ? "OFFLINE BUFFER" : wsInfo.label}</span>
          </div>

          <button
            onClick={() => setIsDetailOpen(!isDetailOpen)}
            className="btn-secondary text-[11px] px-2.5 py-1 hidden lg:inline-flex"
            title="Toggle details panel"
          >
            {isDetailOpen ? "Hide Panel" : "Show Panel"}
          </button>

          <button
            onClick={onExit}
            className="btn-secondary text-[11px] px-2.5 py-1 text-[var(--text-secondary)] hover:text-white"
          >
            ✕ Exit
          </button>
        </div>
      </header>

      {/* ── Main Workspace ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Center: Map Canvas + Timeline + Bottom Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#07090e] relative overflow-hidden">
          {/* Map Area */}
          <div className="flex-1 relative">
            <TacticalMap
              events={filteredEvents}
              onSelect={(evt) => {
                setSelectedEvent(evt);
                setIsDetailOpen(true);
              }}
              selectedId={selectedEvent?.id ?? null}
            />
          </div>

          {/* Timeline Scrubber Bar */}
          <TimelineScrubber
            timeline={timelineQuery.data}
            loading={timelineQuery.loading}
            selectedEpoch={selectedEpoch}
            onSelectEpoch={setSelectedEpoch}
            onPlayToggle={setIsPlaying}
            isPlaying={isPlaying}
          />

          {/* Bottom Tabs Bar */}
          <div className="h-44 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col flex-shrink-0">
            {/* Tab switch header */}
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[10px] font-mono">
              <div className="flex items-center gap-2">
                {[
                  { id: "FEED" as const, label: `Activity Feed (${filteredEvents.length})` },
                  { id: "LOGS" as const, label: `Swarm Audit Logs (${logStream.logs.length})` },
                  { id: "ANALYTICS" as const, label: "Analytics Overview" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setBottomTab(t.id)}
                    className={`px-2.5 py-0.5 rounded transition-all ${
                      bottomTab === t.id
                        ? "bg-white/10 text-white font-bold"
                        : "text-mute hover:text-white/80"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {selectedEpoch !== null && (
                <span className="text-[var(--accent-cyan)] font-semibold">
                  HISTORICAL SCRUB ACTIVE
                </span>
              )}
            </div>

            {/* Tab contents */}
            <div className="flex-1 overflow-hidden">
              {bottomTab === "FEED" && (
                <ActivityFeed
                  events={filteredEvents}
                  onSelect={(evt) => {
                    setSelectedEvent(evt);
                    setIsDetailOpen(true);
                  }}
                  selectedId={selectedEvent?.id ?? null}
                />
              )}

              {bottomTab === "LOGS" && (
                <SystemLogsTerminal logs={logStream.logs} wsState={logStream.state} />
              )}

              {bottomTab === "ANALYTICS" && (
                <div className="h-full overflow-y-auto p-3 font-mono text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="surface-card p-2.5 rounded">
                    <div className="text-[10px] text-mute uppercase">Total Processed</div>
                    <div className="text-[20px] font-bold text-white mt-1">
                      {analyticsQuery.data?.total_events_processed ?? rawEvents.length}
                    </div>
                  </div>
                  <div className="surface-card p-2.5 rounded">
                    <div className="text-[10px] text-mute uppercase">Critical Gated</div>
                    <div className="text-[20px] font-bold text-red-400 mt-1">
                      {analyticsQuery.data?.critical_alerts_count ?? emergencyCount}
                    </div>
                  </div>
                  <div className="surface-card p-2.5 rounded">
                    <div className="text-[10px] text-mute uppercase">Mean FRP (MW)</div>
                    <div className="text-[20px] font-bold text-[var(--accent-cyan)] mt-1">
                      {analyticsQuery.data?.frp_percentiles.p50 ?? 38.5}
                    </div>
                  </div>
                  <div className="surface-card p-2.5 rounded">
                    <div className="text-[10px] text-mute uppercase">Monitored Facilities</div>
                    <div className="text-[20px] font-bold text-emerald-400 mt-1">
                      {analyticsQuery.data?.monitored_facilities ?? 46}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Scannable Event Details Drawer */}
        {isDetailOpen && (
          <aside className="w-80 sm:w-96 border-l border-[var(--border-hairline)] bg-[var(--bg-canvas)] flex-shrink-0 flex flex-col relative z-20">
            <EventDetailPanel event={selectedEvent} />
          </aside>
        )}
      </div>

      {/* ── Status Bar ────────────────────────────────────────────────────── */}
      <SystemStatusBar
        backendReachable={!eventsQuery.error}
        backendLatencyMs={0}
        totalEvents={rawEvents.length}
        lastEventAt={rawEvents[0]?.created_at}
      />

      {/* ── Tactical Copilot Dialog Modal ─────────────────────────────────── */}
      {showCopilot && <TacticalCopilotDialog onClose={() => setShowCopilot(false)} />}
    </div>
  );
}
