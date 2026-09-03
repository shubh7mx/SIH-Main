"use client";

import React, { useMemo } from "react";
import type { HotspotEvent } from "@/lib/types";

interface IncidentAssessmentCardProps {
  briefText?: string | null;
  event?: HotspotEvent | null;
  loading?: boolean;
  latencyMs?: number;
  mode?: string;
  compact?: boolean;
}

export function IncidentAssessmentCard({
  briefText,
  event,
  loading = false,
  latencyMs,
  mode,
  compact = false,
}: IncidentAssessmentCardProps) {
  // Parse structured sections from the brief or format fallback from event facts
  const parsed = useMemo(() => {
    if (!briefText && !event) return null;

    const raw = briefText || "";
    
    // Extract sections if markdown / bullet formatted
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

    // Classification & Severity
    const isCritical = event?.is_critical_alert || event?.classification === "INDUSTRIAL_FIRE_EMERGENCY";
    const classification = event?.classification ?? "UNMAPPED_THERMAL_ANOMALY";
    const frp = event?.frp_megawatts ?? 0;
    const bt = event?.brightness_temp_kelvin ?? 0;
    const btC = bt > 0 ? (bt - 273.15).toFixed(1) : "--";
    const cde = event?.cde_anomaly_score;
    const facility = event?.facility_name || "Unmapped Thermal Anomaly";

    // Clean text lines (remove repetitive headers if present)
    const cleanLines = lines.filter(
      (l) =>
        !l.startsWith("---") &&
        !l.toLowerCase().includes("tactical incident brief") &&
        !l.toLowerCase().includes("incident assessment")
    );

    return {
      isCritical,
      classification,
      facility,
      frp,
      bt,
      btC,
      cde,
      summaryLines: cleanLines.slice(0, 6),
      fullText: raw,
    };
  }, [briefText, event]);

  if (loading) {
    return (
      <div className="surface-card rounded-xl border border-white/10 p-5 space-y-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-36 bg-cyan-500/20 rounded"></div>
          <div className="h-3 w-16 bg-white/10 rounded"></div>
        </div>
        <div className="h-16 bg-white/[0.03] rounded-lg border border-white/5"></div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-12 bg-white/[0.03] rounded"></div>
          <div className="h-12 bg-white/[0.03] rounded"></div>
          <div className="h-12 bg-white/[0.03] rounded"></div>
        </div>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="surface-card rounded-xl border border-white/10 p-5 text-mute text-xs font-mono">
        No incident assessment available for this event.
      </div>
    );
  }

  return (
    <div className="surface-card rounded-xl border border-white/10 p-5 flex flex-col justify-between space-y-4 bg-gradient-to-b from-[#080d18] to-[#04070e] shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span className="text-xs font-bold tracking-wider text-slate-200 uppercase font-sans">
            Incident Assessment
          </span>
        </div>
        {(latencyMs != null || mode) && (
          <span className="font-mono text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
            {latencyMs != null ? `${latencyMs}ms` : ""} {mode ? `· ${mode}` : ""}
          </span>
        )}
      </div>

      {/* Primary Severity Banner */}
      <div
        className={`p-3.5 rounded-lg border ${
          parsed.isCritical
            ? "bg-red-500/10 border-red-500/30 text-red-100"
            : parsed.classification === "PERSISTENT_INDUSTRIAL_FLARE"
            ? "bg-amber-500/10 border-amber-500/30 text-amber-100"
            : parsed.classification === "WILDFIRE"
            ? "bg-blue-500/10 border-blue-500/30 text-blue-100"
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-100"
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[10px] font-bold tracking-wider uppercase opacity-80">
            {parsed.isCritical ? "🚨 Critical Emergency" : "Status & Classification"}
          </span>
          <span className="font-mono text-[11px] font-semibold">
            {parsed.classification.replace(/_/g, " ")}
          </span>
        </div>
        <p className="text-xs font-sans text-white/90 leading-relaxed font-normal">
          {parsed.facility && parsed.facility !== "Unmapped Thermal Anomaly" ? (
            <>
              Registered facility: <strong className="text-white font-semibold">{parsed.facility}</strong>.
            </>
          ) : (
            <>
              Detected in open coordinates. Classified via multi-spectral signature and land-cover baseline.
            </>
          )}
        </p>
      </div>

      {/* 3-Card Radiometry Strip */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Power (FRP)</div>
          <div className="text-sm font-bold font-mono text-cyan-400 mt-0.5">
            {parsed.frp} <span className="text-[10px] font-normal text-slate-400">MW</span>
          </div>
        </div>
        <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Brightness Temp</div>
          <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
            {parsed.btC}° <span className="text-[10px] font-normal text-slate-400">({parsed.bt}K)</span>
          </div>
        </div>
        <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Baseline Z-Score</div>
          <div
            className={`text-sm font-bold font-mono mt-0.5 ${
              parsed.cde && Math.abs(parsed.cde) >= 2.0 ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {parsed.cde != null ? `${parsed.cde > 0 ? "+" : ""}${parsed.cde.toFixed(1)}σ` : "0.0σ"}
          </div>
        </div>
      </div>

      {/* Formatted Assessment Details */}
      {parsed.summaryLines.length > 0 && (
        <div className="bg-black/30 rounded-lg border border-white/5 p-3 space-y-1.5 text-xs font-sans text-slate-300 leading-relaxed">
          {parsed.summaryLines.map((line, idx) => {
            const isHeading = line.includes(":") && !line.startsWith("-") && line.length < 50;
            if (isHeading) {
              const [k, ...v] = line.split(":");
              return (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-baseline gap-1 pt-1 border-t border-white/5 first:border-0 first:pt-0">
                  <span className="font-semibold text-slate-200 text-[11px] uppercase tracking-wide font-mono min-w-[140px]">
                    {k}:
                  </span>
                  <span className="text-slate-300 font-sans text-xs">
                    {v.join(":")}
                  </span>
                </div>
              );
            }
            return (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className="text-cyan-400 mt-1">•</span>
                <span>{line.replace(/^[-•*]\s*/, "")}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer explanation note */}
      <div className="font-mono text-[10px] text-slate-500 pt-2 border-t border-white/5 flex items-center justify-between">
        <span>Grounded in NASA VIIRS radiometry & CDE baseline model</span>
        <span className="text-cyan-500/80">NTRO Certified</span>
      </div>
    </div>
  );
}
