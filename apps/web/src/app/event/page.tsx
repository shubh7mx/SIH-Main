"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ConsoleShell } from "@/components/ConsoleShell";
import { TacticalMap } from "@/components/TacticalMap";
import { IncidentAssessmentCard } from "@/components/IncidentAssessmentCard";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { ConfidenceMeter } from "@/components/ui/ConfidenceMeter";
import { SwarmEvidenceGrid } from "@/components/SwarmEvidenceGrid";
import { getClassificationSeverity } from "@/lib/design-tokens";
import { useIncidentBrief } from "@/lib/hooks";
import { getEvent } from "@/lib/api";
import { inferAnomalyReason } from "@/lib/anomaly-inference";
import type { HotspotEvent } from "@/lib/types";

function cleanBrief(rawText?: string | null): string {
  if (!rawText) return "No briefing available.";
  let text = rawText
    .replace(/\x3cthink\x3e[\s\S]*?(?:\x3c\/think\x3e|$)/gi, "")
    .replace(/\x3c!--[\s\S]*?(?:--\x3e|$)/g, "");
  const tagIdx = text.indexOf("[TAXONOMY & THREAT SEVERITY]");
  if (tagIdx !== -1) {
    text = text.slice(tagIdx);
  } else {
    text = text.replace(/^(?:thinking process|thought|analysis|reasoning):[\s\S]*?\n\n/gi, "");
  }
  return text.trim();
}

function EventDetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [event, setEvent] = useState<HotspotEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { brief, loading: briefLoading } = useIncidentBrief(id);
  const [escalated, setEscalated] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    getEvent(id)
      .then((evt) => {
        if (!cancelled && evt) {
          setEvent(evt);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Event not found");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading && !event) {
    return (
      <div className="p-8 text-center text-mute font-mono text-xs">
        Loading detection #{id}…
      </div>
    );
  }

  if (!event || fetchError) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <div className="text-xl">⚠️</div>
        <h2 className="font-semibold text-lg text-white">Event Not Found</h2>
        <p className="text-xs text-mute font-mono">
          Detection #{id ?? "unknown"} does not exist in the active 24h event store buffer.
        </p>
        <Link
          href="/events"
          className="inline-block py-2 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono text-white transition-colors"
        >
          ← Back to Events Directory
        </Link>
      </div>
    );
  }

  const sev = getClassificationSeverity(event.classification);
  const anomalyInfo = inferAnomalyReason(event);
  const title = event.facility_name ?? "Unmapped Thermal Anomaly";

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

  return (
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {title}
          </h1>
          <div className="font-mono text-xs text-mute">
            {event.latitude.toFixed(4)}°N · {event.longitude.toFixed(4)}°E · H3 Cell:{" "}
            <span className="text-white/80">{event.h3_index || "—"}</span> · Satellite:{" "}
            <span className="text-white/80">{event.satellite_source}</span>
          </div>
          {!event.facility_name ||
          event.facility_name.includes("Unmapped") ||
          event.facility_name.includes("Thermal Anomaly") ? (
            <div className="text-xs font-mono text-cyan-300">
              🌾 AI Probable Cause Suggestion: <span className="text-white font-medium">{anomalyInfo.probableCause}</span> ({anomalyInfo.regionLabel})
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEscalated(true)}
            disabled={escalated}
            className={`py-2 px-4 rounded-lg font-mono text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="surface-card p-4 rounded-xl border border-white/5">
          <div className="eyebrow mb-1">Radiative Power (FRP)</div>
          <div className="text-2xl font-bold font-mono text-cyan-300 tabular-nums">
            {event.frp_megawatts.toFixed(1)}{" "}
            <span className="text-xs text-mute font-normal">MW</span>
          </div>
          <div className="text-[10px] text-mute font-mono mt-1">Satellite pixel energy</div>
        </div>
        <div className="surface-card p-4 rounded-xl border border-white/5">
          <div className="eyebrow mb-1">Brightness Temp</div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {event.brightness_temp_kelvin.toFixed(0)}{" "}
            <span className="text-xs text-mute font-normal">K</span>
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
        {/* Tactical Map (Satellite by default, building-level zoom, icon-only style switcher, clean dossier mode) */}
        <div className="surface-card rounded-xl border border-white/5 overflow-hidden h-[420px] relative">
          <TacticalMap
            events={[event]}
            compact={false}
            showControls={true}
            dossierMode={true}
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
      <div className="space-y-3">
        <h2 className="eyebrow">Multi-Agent Swarm Evidence</h2>
        <SwarmEvidenceGrid event={event} />
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  return (
    <ConsoleShell>
      <Suspense
        fallback={
          <div className="p-8 text-center text-mute font-mono text-xs">
            Loading detection details…
          </div>
        }
      >
        <EventDetailInner />
      </Suspense>
    </ConsoleShell>
  );
}
