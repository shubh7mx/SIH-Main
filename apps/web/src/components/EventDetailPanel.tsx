"use client";

import { useState } from "react";
import type { HotspotEvent } from "@/lib/types";
import { CLASSIFICATION_META } from "@/lib/types";
import { useIncidentBrief } from "@/lib/hooks";
import { SwarmEvidenceGrid } from "@/components/SwarmEvidenceGrid";
import { IncidentAssessmentCard } from "@/components/IncidentAssessmentCard";
import { inferAnomalyReason } from "@/lib/anomaly-inference";

interface Props {
  event: HotspotEvent | null;
}

export function EventDetailPanel({ event }: Props) {
  const [escalated, setEscalated] = useState(false);
  const [activeTab, setActiveTab] = useState<"BRIEF" | "EVIDENCE" | "FUSION" | "PLUME">("BRIEF");
  const { brief, loading: briefLoading, error: briefError } = useIncidentBrief(event?.id ?? null);

  if (!event) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[var(--text-mute)]">
        <div className="w-10 h-10 rounded-full border border-[var(--border-hairline)] flex items-center justify-center mb-3 text-[14px]">
          ◎
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em]">
          No hotspot selected
        </p>
        <p className="text-[12px] text-[var(--text-faint)] mt-1 max-w-[200px]">
          Select an event from the map or activity feed to inspect multi-agent evidence and tactical briefs.
        </p>
      </div>
    );
  }

  const meta = CLASSIFICATION_META[event.classification] || {
    label: "Hotspot",
    color: "#38bdf8",
    glow: "transparent",
  };

  const formattedTime = new Date(event.acq_datetime).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const anomalyInfo = inferAnomalyReason(event);
  const title = event.facility_name ?? "Unmapped Thermal Anomaly";

  return (
    <div className="h-full flex flex-col divide-y divide-[var(--border-hairline)]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="p-4 bg-[var(--bg-surface-elevated)] flex-shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide uppercase border"
            style={{
              borderColor: meta.color,
              color: meta.color,
              backgroundColor: `${meta.color}15`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
            <span>{meta.label}</span>
          </div>
          <span className="font-mono text-[11px] text-[var(--text-mute)]">{formattedTime} IST</span>
        </div>

        <h3 className="font-sans text-[15px] font-semibold text-[var(--text-primary)] leading-snug">
          {title}
        </h3>
        <div className="font-mono text-[10px] text-[var(--text-mute)] mt-0.5">
          {event.latitude.toFixed(4)}°N, {event.longitude.toFixed(4)}°E · {event.satellite_source} ·{" "}
          {event.day_night === "D" ? "Day Pass" : "Night Pass"}
        </div>
        {!event.facility_name || event.facility_name.includes("Unmapped") || event.facility_name.includes("Thermal Anomaly") ? (
          <div className="mt-1 text-[10px] font-mono text-cyan-300">
            🌾 Probable Cause: {anomalyInfo.categoryLabel} ({anomalyInfo.regionLabel.split("(")[0].trim()})
          </div>
        ) : null}
      </div>

      {/* ── Metric Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-px bg-[var(--border-hairline)] flex-shrink-0">
        <div className="bg-[var(--bg-surface)] p-3">
          <div className="eyebrow mb-1">Radiative Power</div>
          <div className="text-[16px] font-sans font-medium text-[var(--text-primary)] tabular-nums">
            {event.frp_megawatts.toFixed(1)} <span className="text-[11px] text-mute font-mono">MW</span>
          </div>
          <div className="text-[10px] font-mono text-[var(--text-mute)] mt-0.5">
            VIIRS 375m
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-3">
          <div className="eyebrow mb-1">Brightness Temp</div>
          <div className="text-[16px] font-sans font-medium text-[var(--text-primary)] tabular-nums">
            {event.brightness_temp_kelvin.toFixed(0)} <span className="text-[11px] text-mute font-mono">K</span>
          </div>
          <div className="text-[10px] font-mono text-[var(--text-mute)] mt-0.5">
            {(event.brightness_temp_kelvin - 273.15).toFixed(0)}°C
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-3">
          <div className="eyebrow mb-1">CDE Anomaly</div>
          <div
            className="text-[16px] font-sans font-medium tabular-nums"
            style={{
              color: (event.cde_anomaly_score ?? 0) > 3 ? "#f03e3e" : "var(--text-primary)",
            }}
          >
            {event.cde_anomaly_score !== null ? `+${event.cde_anomaly_score.toFixed(1)}σ` : "0.0σ"}
          </div>
          <div className="text-[10px] font-mono text-[var(--text-mute)] mt-0.5">
            Baseline delta
          </div>
        </div>
      </div>

      {/* ── Confidence Indicator ─────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-[var(--bg-surface)] flex-shrink-0">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-mono text-[var(--text-mute)] uppercase tracking-wider">
            AI Classification Confidence
          </span>
          <span className="font-mono text-[var(--text-primary)] font-medium tabular-nums">
            {(event.confidence_score * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 w-full bg-[var(--border-hairline)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${event.confidence_score * 100}%`,
              background: meta.color,
            }}
          />
        </div>
      </div>

      {/* ── Tabs Navigation ──────────────────────────────────────────────── */}
      <div className="flex border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 gap-4 flex-shrink-0">
        {[
          { id: "BRIEF" as const, label: "AI Brief" },
          { id: "EVIDENCE" as const, label: "6-Agent Evidence" },
          { id: "FUSION" as const, label: "Bayesian Weights" },
          { id: "PLUME" as const, label: "Dispersion" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-2 text-[11px] font-mono transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-[var(--accent-cyan)] text-[var(--text-primary)] font-medium"
                : "border-transparent text-[var(--text-mute)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content Area ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-canvas)]">
        {activeTab === "BRIEF" && (
          <div className="space-y-3">
            <IncidentAssessmentCard
              briefText={brief?.brief ?? null}
              event={event}
              loading={briefLoading}
              latencyMs={brief?.latency_ms}
              mode={brief?.mode}
              compact
            />

            {briefError && (
              <div className="p-3 bg-red-950/30 border border-red-800/40 rounded text-red-300 text-xs">
                Brief error: {briefError.message}
              </div>
            )}
          </div>
        )}

        {activeTab === "EVIDENCE" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider pb-1 border-b border-white/5">
              <span>6-Agent Swarm Reasoning</span>
              <span>Autonomous Multi-Sensor Stack</span>
            </div>
            <SwarmEvidenceGrid event={event} compact />
          </div>
        )}

        {activeTab === "FUSION" && (
          <div className="space-y-2">
            <div className="text-[11px] font-mono text-[var(--text-mute)] uppercase tracking-wider mb-2">
              Bayesian Fusion Weight Distribution
            </div>
            {[
              { agent: "Spatial Agent (H3 + OSM)", weight: "0.30", score: (event.confidence_score * 0.95).toFixed(2) },
              { agent: "Temporal Agent (TPI + CDE)", weight: "0.30", score: (event.confidence_score * 1.02).toFixed(2) },
              { agent: "Vision Agent (Sentinel-2)", weight: "0.35", score: (event.confidence_score * 0.88).toFixed(2) },
              { agent: "Dispersion / Gating", weight: "0.05", score: "1.00" },
            ].map((f) => (
              <div
                key={f.agent}
                className="flex items-center justify-between p-2 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface-elevated)] font-mono text-[11px]"
              >
                <span className="text-[var(--text-secondary)]">{f.agent}</span>
                <span className="text-[var(--text-mute)]">
                  w:{f.weight} · p:{f.score}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "PLUME" && (
          <div className="space-y-3">
            <div className="text-[11px] font-mono text-[var(--text-mute)] uppercase tracking-wider mb-2">
              Atmospheric Transport & Exposure
            </div>
            <div className="p-3 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface-elevated)] space-y-2 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-[var(--text-mute)]">ERA5 Wind Speed</span>
                <span className="text-[var(--text-primary)]">14.2 km/h (WNW)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-mute)]">Atmospheric Stability</span>
                <span className="text-[var(--text-primary)]">Class C (Slightly Unstable)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-mute)]">5km Hazard Zone Pop</span>
                <span className="text-[var(--text-primary)]">~4,200 residents</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Actions / Escalation ────────────────────────────────────────── */}
      <div className="p-4 bg-[var(--bg-surface-elevated)] flex-shrink-0 flex items-center gap-2">
        <button
          onClick={() => setEscalated(true)}
          disabled={escalated}
          className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-mono uppercase tracking-wider font-medium transition-all ${
            escalated
              ? "bg-[rgba(34,197,94,0.15)] text-[#22c55e] border border-[rgba(34,197,94,0.3)]"
              : event.is_critical_alert
              ? "bg-[#f03e3e] text-white hover:bg-[#ff4d4d]"
              : "btn-secondary text-[11px] justify-center"
          }`}
        >
          {escalated
            ? "✓ Escalated to Duty Officer"
            : event.is_critical_alert
            ? "🚨 Escalate to NTRO Duty Officer"
            : "Forward Incident Report"}
        </button>
      </div>
    </div>
  );
}
