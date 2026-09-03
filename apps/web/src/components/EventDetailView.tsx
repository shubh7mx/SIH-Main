"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ConsoleShell } from "@/components/ConsoleShell";
import { TacticalMap } from "@/components/TacticalMap";
import { IncidentAssessmentCard } from "@/components/IncidentAssessmentCard";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { ConfidenceMeter } from "@/components/ui/ConfidenceMeter";
import { SwarmEvidenceGrid } from "@/components/SwarmEvidenceGrid";
import { getClassificationSeverity } from "@/lib/design-tokens";
import { useEvents, useIncidentBrief } from "@/lib/hooks";
import type { HotspotEvent } from "@/lib/types";
import { inferAnomalyReason } from "@/lib/anomaly-inference";

export function EventDetailView() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const eventsQuery = useEvents({ limit: 200 });
  const [event, setEvent] = useState<HotspotEvent | null>(null);
  const { brief, loading: briefLoading } = useIncidentBrief(event?.id ?? null);
  const [escalated, setEscalated] = useState(false);

  useEffect(() => {
    if (eventsQuery.data && id) {
      const found = eventsQuery.data.find((e) => e.id === id);
      if (found) setEvent(found);
    }
  }, [eventsQuery.data, id]);

  if (eventsQuery.loading && !event) {
    return (
      <ConsoleShell>
        <div className="p-8 text-center text-mute font-mono text-xs">
          Loading detection #{id}…
        </div>
      </ConsoleShell>
    );
  }

  if (!event) {
    return (
      <ConsoleShell>
        <div className="p-8 max-w-md mx-auto text-center space-y-3">
          <div className="text-xl">⚠️</div>
          <h2 className="font-semibold text-lg">Event Not Found</h2>
          <p className="text-xs text-mute font-mono">
            Detection #{id} does not exist in the active 24h event store buffer.
          </p>
          <Link href="/events" className="btn-secondary text-xs inline-block">
            ← Back to Events List
          </Link>
        </div>
      </ConsoleShell>
    );
  }

  const sev = getClassificationSeverity(event.classification);
  const timeStr = new Date(event.acq_datetime).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const anomalyInfo = event ? inferAnomalyReason(event) : null;
  const title = event?.facility_name ?? "Unmapped Thermal Anomaly";

  return (
    <ConsoleShell>
      <div className="p-3 sm:p-4 lg:p-6 space-y-6 max-w-[1400px] w-full mx-auto">
        {/* Breadcrumb + back */}
        <div className="flex items-center gap-2 text-xs font-mono text-mute">
          <Link href="/events" className="hover:text-white transition-colors">
            ← Events
          </Link>
          <span>/</span>
          <span className="text-white truncate">#{event.id}</span>
        </div>

        {/* Hero header */}
        <div className="surface-card p-4 sm:p-6 rounded-xl border border-white/5 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <SeverityBadge classification={event.classification} size="lg" />
              <span className="font-mono text-xs text-mute">{timeStr} IST</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {title}
            </h1>
            <div className="font-mono text-xs text-mute">
              {event.latitude.toFixed(4)}°N · {event.longitude.toFixed(4)}°E · H3 Cell:{" "}
              <span className="text-white/80">{event.h3_index || "—"}</span> · Satellite:{" "}
              <span className="text-white/80">{event.satellite_source}</span>
            </div>
            {anomalyInfo && (!event.facility_name || event.facility_name.includes("Unmapped") || event.facility_name.includes("Thermal Anomaly")) ? (
              <div className="text-xs font-mono text-cyan-300">
                🌾 Probable Reason: <span className="text-white font-medium">{anomalyInfo.probableCause}</span> ({anomalyInfo.regionLabel})
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEscalated(true)}
              disabled={escalated}
              className={`py-2 px-4 rounded-lg font-mono text-xs font-semibold uppercase tracking-wider transition-all ${
                escalated
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : event.is_critical_alert
                  ? "bg-red-500 text-white hover:bg-red-400"
                  : "btn-secondary"
              }`}
            >
              {escalated
                ? "✓ Escalated to Duty Officer"
                : event.is_critical_alert
                ? "🚨 Escalate to NTRO"
                : "Forward to Incident Report"}
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 font-mono">
          <div className="surface-card p-4 rounded-xl border border-white/5">
            <div className="eyebrow mb-1">Radiative Power</div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {event.frp_megawatts.toFixed(1)} <span className="text-xs text-mute font-normal">MW</span>
            </div>
            <div className="text-[10px] text-mute mt-1">VIIRS 375m pixel integration</div>
          </div>
          <div className="surface-card p-4 rounded-xl border border-white/5">
            <div className="eyebrow mb-1">Brightness Temp</div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {event.brightness_temp_kelvin.toFixed(0)} <span className="text-xs text-mute font-normal">K</span>
            </div>
            <div className="text-[10px] text-mute mt-1">
              {(event.brightness_temp_kelvin - 273.15).toFixed(0)}°C calibrated
            </div>
          </div>
          <div className="surface-card p-4 rounded-xl border border-white/5">
            <div className="eyebrow mb-1">CDE Deviation</div>
            <div
              className="text-2xl font-bold tabular-nums"
              style={{
                color: (event.cde_anomaly_score ?? 0) > 3 ? "#ef4444" : "#10b981",
              }}
            >
              {(event.cde_anomaly_score ?? 0).toFixed(1)}σ
            </div>
            <div className="text-[10px] text-mute mt-1">
              {(event.cde_anomaly_score ?? 0) > 3 ? "Exceeds 30d baseline" : "Within normal operating range"}
            </div>
          </div>
          <div className="surface-card p-4 rounded-xl border border-white/5">
            <ConfidenceMeter confidence={event.confidence_score} />
          </div>
        </div>

        {/* Split view: High-Resolution Satellite Map + Tactical Brief */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tactical Map (Satellite by default, building-level zoom, style switcher in corner) */}
          <div className="surface-card rounded-xl border border-white/5 overflow-hidden h-[380px] relative">
            <div className="absolute top-3 left-3 z-10 font-mono text-[10px] text-white uppercase tracking-widest bg-black/80 px-2.5 py-1 rounded border border-cyan-500/30 backdrop-blur-sm shadow-md">
              Building-Level View ({event.latitude.toFixed(4)}°N, {event.longitude.toFixed(4)}°E)
            </div>
            <TacticalMap
              events={[event]}
              compact={false}
              showControls={true}
              initialStyle="satellite"
              initialCenter={[Number(event.longitude), Number(event.latitude)]}
              initialZoom={16.0}
            />
          </div>

          {/* Incident Assessment */}
          <IncidentAssessmentCard
            briefText={brief?.brief ?? null}
            event={event}
            loading={briefLoading}
            latencyMs={brief?.latency_ms}
            mode={brief?.mode}
          />
        </div>

        {/* 6-Agent Reasoning Grid */}
        <div className="surface-card rounded-xl border border-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="eyebrow">6-Agent Swarm Evidence & Reasoning</div>
            <div className="text-[10px] font-mono text-slate-400">Autonomous Multi-Sensor Verification</div>
          </div>
          <SwarmEvidenceGrid event={event} />
        </div>
      </div>
    </ConsoleShell>
  );
}
