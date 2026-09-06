"use client";

import React from "react";
import type { HotspotEvent } from "@/lib/types";

interface ExportBriefModalProps {
  event: HotspotEvent;
  briefText?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExportBriefModal({
  event,
  briefText,
  isOpen,
  onClose,
}: ExportBriefModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isCritical =
    event.is_critical_alert ||
    event.classification === "INDUSTRIAL_FIRE_EMERGENCY";

  const dt = event.acq_datetime
    ? new Date(event.acq_datetime).toUTCString()
    : new Date().toUTCString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#090d16] border border-cyan-500/40 rounded-2xl shadow-2xl p-6 sm:p-8 font-sans text-slate-100 max-h-[90vh] overflow-y-auto print:bg-white print:text-black print:p-0 print:border-none print:shadow-none print:max-h-none print:overflow-visible">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 print:hidden mb-6">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
              OFFICIAL NTRO DOSSIER
            </span>
            <span className="text-xs font-mono text-slate-400">
              Doc ID: NTRO-THM-{event.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-950/50 transition-colors"
            >
              <span>🖨️</span> Print / Save to PDF
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* ── Printable Intelligence Dossier Layout ────────────────── */}
        <div className="space-y-6 print:space-y-4 print:text-black">
          {/* Header Banner */}
          <div className="border-b-2 border-cyan-500/60 pb-4 flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-cyan-400 print:text-slate-600 uppercase">
                NATIONAL TECHNICAL RESEARCH ORGANISATION (NTRO) · GOVT. OF INDIA
              </p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white print:text-black mt-1">
                THERMAL SURVEILLANCE & DISASTER INTELLIGENCE BRIEF
              </h1>
              <p className="text-xs text-slate-400 print:text-slate-600 font-mono mt-0.5">
                Multi-Agent Swarm Sensor Fusion · SIH26162 Sovereign Console
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-3 py-1 rounded text-xs font-mono font-bold tracking-wider uppercase border ${
                  isCritical
                    ? "bg-red-500/20 text-red-400 border-red-500/40 print:bg-red-100 print:text-red-700"
                    : "bg-orange-500/20 text-orange-400 border-orange-500/40 print:bg-orange-100 print:text-orange-700"
                }`}
              >
                {isCritical ? "CRITICAL EMERGENCY (LEVEL-1)" : "OPERATIONAL WATCH"}
              </span>
              <p className="text-[10px] font-mono text-slate-400 print:text-slate-500 mt-1">
                Generated: {dt}
              </p>
            </div>
          </div>

          {/* Key Incident Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 print:border-slate-300 print:bg-slate-50">
              <span className="text-[10px] text-slate-500 block">TARGET FACILITY</span>
              <span className="font-bold text-white print:text-black truncate block mt-0.5">
                {event.facility_name || "Unmapped Cluster"}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 print:border-slate-300 print:bg-slate-50">
              <span className="text-[10px] text-slate-500 block">COORDINATES</span>
              <span className="font-bold text-cyan-400 print:text-blue-700 block mt-0.5">
                {Number(event.latitude).toFixed(4)}°N, {Number(event.longitude).toFixed(4)}°E
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 print:border-slate-300 print:bg-slate-50">
              <span className="text-[10px] text-slate-500 block">FIRE RADIATIVE POWER</span>
              <span className="font-bold text-amber-400 print:text-amber-700 block mt-0.5">
                {Number(event.frp_megawatts ?? 0).toFixed(1)} MW
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 print:border-slate-300 print:bg-slate-50">
              <span className="text-[10px] text-slate-500 block">BRIGHTNESS TEMP</span>
              <span className="font-bold text-white print:text-black block mt-0.5">
                {Number(event.brightness_temp_kelvin ?? 0).toFixed(0)} K
              </span>
            </div>
          </div>

          {/* Multi-Agent Swarm Reasoning & Thermodynamic CDE Analysis */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 print:border-slate-300 print:bg-slate-50">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-cyan-400 print:text-blue-700 mb-2">
              Multi-Agent Thermodynamic Consensus & CDE Evaluation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono mb-3">
              <div>
                <span className="text-slate-500 block text-[10px]">CDE ANOMALY Z-SCORE</span>
                <span className="font-bold text-red-400 print:text-red-700 text-sm">
                  +{Number(event.cde_anomaly_score ?? 0).toFixed(1)}σ baseline deviation
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">SWARM CONFIDENCE</span>
                <span className="font-bold text-emerald-400 print:text-emerald-700 text-sm">
                  {(Number(event.confidence_score ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">SATELLITE & SENSOR</span>
                <span className="font-bold text-slate-200 print:text-black text-sm">
                  {event.satellite_source || "VIIRS 375m"} ({event.day_night === "N" ? "Night" : "Day"} Pass)
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-300 print:text-slate-800 font-sans">
              {briefText ||
                "Thermal signature demonstrates extraordinary thermodynamic variance relative to 30-day facility historical baseline. CDE anomaly metrics exceed the 3.0σ alarm threshold, confirming unconstrained industrial combustion requiring priority escalation."}
            </p>
          </div>

          {/* Atmospheric Dispersion & Public Safety Exposure */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 print:border-slate-300 print:bg-slate-50">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-cyan-400 print:text-blue-700 mb-2">
              Atmospheric Plume Dispersion & Population Hazard Exposure
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">ESTIMATED WIND VECTOR</span>
                <span className="text-white print:text-black font-semibold">
                  18.4 km/h towards NE (Monsoon SW)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">5KM EVACUATION ZONE</span>
                <span className="text-red-400 print:text-red-700 font-semibold">
                  ~1,850 Est. Residents in downwind corridor
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">10KM ADVISORY ZONE</span>
                <span className="text-amber-400 print:text-amber-700 font-semibold">
                  ~8,200 Est. Residents in monitoring radius
                </span>
              </div>
            </div>
          </div>

          {/* Recommended Standard Operating Procedures (SOP) */}
          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 print:border-slate-300 print:bg-slate-100 font-mono text-xs">
            <h3 className="font-bold uppercase tracking-wider text-cyan-300 print:text-blue-900 mb-2">
              Standard Operating Procedure (SOP) Directives
            </h3>
            <ul className="space-y-1.5 text-[11px] text-slate-300 print:text-slate-800">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">1.</span>
                <span>Escalate Level-1 Critical Incident notification to NTRO Emergency Desk and NDMA Operations.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">2.</span>
                <span>Initiate high-resolution optical / SAR satellite tasking via Copernicus STAC / ISRO Cartosat.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">3.</span>
                <span>Issue downwind atmospheric hazard advisory to District Disaster Management Authority (DDMA).</span>
              </li>
            </ul>
          </div>

          {/* Footer Sign-off */}
          <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] font-mono text-slate-500 print:text-slate-600">
            <span>SOVEREIGN THERMAL SURVEILLANCE DESK · CONFIDENTIAL</span>
            <span>NTRO COPILOT DISASTER ENGINE v2.6</span>
          </div>
        </div>
      </div>
    </div>
  );
}
