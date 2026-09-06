"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ConsoleShell } from "@/components/ConsoleShell";
import { TacticalMap } from "@/components/TacticalMap";
import { ExportBriefModal } from "@/components/ExportBriefModal";
import { FacilityBaselineChart } from "@/components/FacilityBaselineChart";
import { EscalateButton } from "@/components/EscalateButton";
import { useIncidentBrief } from "@/lib/hooks";
import { IncidentAssessmentCard } from "@/components/IncidentAssessmentCard";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { ConfidenceMeter } from "@/components/ui/ConfidenceMeter";
import { SwarmEvidenceGrid } from "@/components/SwarmEvidenceGrid";
import { getClassificationSeverity } from "@/lib/design-tokens";
import { getEvent } from "@/lib/api";
import { inferAnomalyReason } from "@/lib/anomaly-inference";
import { getEventLocation } from "@/lib/location-resolver";
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
  const [isExportOpen, setIsExportOpen] = useState(false);
  // escalate state removed: EscalateButton is now a self-contained loader

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
  const locInfo = getEventLocation(event);
  const title = event.facility_name ?? `Thermal Anomaly near ${locInfo.city}`;

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
            {Number(event.latitude).toFixed(4)}°N · {Number(event.longitude).toFixed(4)}°E{event.h3_index ? ` · H3 Cell: ${event.h3_index}` : ""}{" "}
            · {locInfo.displayLocation} · Satellite:{" "}
            <span className="text-white/80">{event.satellite_source}</span>
          </div>
          <div className="text-xs font-mono text-cyan-300">
            {anomalyInfo.categoryIcon} AI Probable Cause — {anomalyInfo.probableCause} · <span className="text-white/60 font-normal">{anomalyInfo.regionLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExportOpen(true)}
            className="py-2 px-3.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md"
          >
            <span>📄</span> Export Brief
          </button>
          <EscalateButton
            eventId={event.id}
            facilityName={event.facility_name}
            isCritical={event.is_critical_alert}
            escalated={escalated}
            onComplete={() => setEscalated(true)}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="surface-card p-4 rounded-xl border border-white/5">
          <div className="eyebrow mb-1">Radiative Power (FRP)</div>
          <div className="text-2xl font-bold font-mono text-cyan-300 tabular-nums">
            {Number(event.frp_megawatts ?? 0).toFixed(1)}{" "}
            <span className="text-xs text-mute font-normal">MW</span>
          </div>
          <div className="text-[10px] text-mute font-mono mt-1">Satellite pixel energy</div>
        </div>
        <div className="surface-card p-4 rounded-xl border border-white/5">
          <div className="eyebrow mb-1">Brightness Temp</div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {Number(event.brightness_temp_kelvin ?? 0).toFixed(0)}{" "}
            <span className="text-xs text-mute font-normal">K</span>
          </div>
          <div className="text-[10px] text-mute mt-1">
            {(Number(event.brightness_temp_kelvin ?? 0) - 273.15).toFixed(0)}°C calibrated
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

      {/* 30-Day Facility CDE Thermodynamic Profile & Baseline Chart */}
      <FacilityBaselineChart event={event} />

      {/* 6-Agent Reasoning Grid */}
      <div className="space-y-3">
        <h2 className="eyebrow">Multi-Agent Swarm Evidence</h2>
        <SwarmEvidenceGrid event={event} />
      </div>

      {/* NTRO Classified Intelligence Brief Export Modal */}
      <ExportBriefModal
        event={event}
        briefText={brief?.brief ?? null}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
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
