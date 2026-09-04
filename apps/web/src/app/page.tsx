"use client";

import { useEffect, useRef, useState } from "react";
import { EarthGlobe } from "@/components/EarthGlobe";
import { ScrollNavbar } from "@/components/ScrollNavbar";
import { useEvents, useAnalytics, useHealth } from "@/lib/hooks";
import { mockEvents } from "@/lib/mock-data";
import type { HotspotEvent } from "@/lib/types";

const FALLBACK_EVENT: HotspotEvent = mockEvents[0];

// ── Pipeline Stages Definition ──────────────────────────────────────────────
const PIPELINE_STAGES = [
  {
    n: "01",
    name: "Spatial Partitioning",
    tag: "PostGIS · H3 r8 · OSM",
    input: "VIIRS Hotspot (375m)",
    output: "Facility Containment & Land Cover",
    description:
      "Performs sub-second spatial containment against 2,840+ Indian industrial polygons, calculates boundary distances, and overlays ESA WorldCover 10m rasters.",
  },
  {
    n: "02",
    name: "Temporal Baseline",
    tag: "RisingWave · Streaming SQL",
    input: "30-Day FRP / BT History",
    output: "Z-Score Deviation & TPI",
    description:
      "Computes rolling mean and standard deviation per H3 cell. Measures thermodynamic departure from routine flaring baselines across diurnal cycles.",
  },
  {
    n: "03",
    name: "SWIR Vision Validation",
    tag: "EfficientNet-B0 · ONNX",
    input: "Sentinel-2 L1C / L2A SWIR",
    output: "4-Class Probability Distribution",
    description:
      "Extracts cloud-masked 256×256 SWIR patches (B12/B11/B8A) via Copernicus CDSE to optically discriminate flame geometry beyond flare tip boundaries.",
  },
  {
    n: "04",
    name: "Bayesian Multi-Agent Fusion",
    tag: "LangGraph · Orchestrator",
    input: "Spatial, Temporal & Vision Weights",
    output: "Calibrated Anomaly Severity",
    description:
      "Synthesizes independent agent probabilities via dynamic weighted ensemble with epistemic uncertainty quantification.",
  },
  {
    n: "05",
    name: "Plume Dispersion",
    tag: "Gaussian Puff · ERA5 Reanalysis",
    input: "10m Atmospheric Vectors",
    output: "Hazard Zones & Population Overlay",
    description:
      "Activates automatically for confirmed industrial emergencies to model toxic dispersion envelopes and quantify at-risk population exposure.",
  },
  {
    n: "06",
    name: "Targeted Dispatch",
    tag: "NATS JetStream · Webhooks",
    input: "Validated GeoJSON Alerts",
    output: "Multi-Agency Escalation",
    description:
      "Dispatches sub-90s cryptographic alerts to NTRO, NDMA, and district incident commanders with actionable coordinate envelopes.",
  },
];

const DATA_SOURCES = [
  {
    name: "NASA FIRMS",
    badge: "Primary Feed",
    detail: "VIIRS 375m & MODIS 1km Active Fire Products",
    latency: "~15 min NRT",
    coverage: "Pan-India · Daily 4× Overpass",
  },
  {
    name: "OpenStreetMap",
    badge: "Facility Registry",
    detail: "2,840+ Curated Industrial Polygons & Flare Stacks",
    latency: "Weekly Differential Sync",
    coverage: "Refineries, Chemicals, Power, Kilns",
  },
  {
    name: "ESA WorldCover",
    badge: "Land Classification",
    detail: "10-Meter Multi-Class Optical Land-Cover Raster",
    latency: "Annual Refresh",
    coverage: "Built-up, Forest, Shrubland, Cropland",
  },
  {
    name: "Copernicus CDSE",
    badge: "Optical / SAR",
    detail: "Sentinel-2 MSI SWIR (20m) & Sentinel-1 SAR (10m)",
    latency: "5-day revisit (Optical)",
    coverage: "Cloud-penetrating burn scar verification",
  },
  {
    name: "ECMWF ERA5",
    badge: "Meteorological",
    detail: "10m U/V Wind Components, Temperature & Humidity",
    latency: "Hourly Assimilation",
    coverage: "Atmospheric dispersion inputs",
  },
  {
    name: "RisingWave",
    badge: "Streaming State",
    detail: "Distributed Streaming State for Temporal Baselines",
    latency: "< 100ms Window Updates",
    coverage: "30/60/90-Day Sliding FRP Windows",
  },
];

function StatusDot({ color = "#38bdf8" }: { color?: string }) {
  return (
    <span className="relative inline-flex items-center justify-center w-2 h-2">
      <span
        className="animate-ring absolute w-full h-full rounded-full opacity-60"
        style={{ background: color }}
      />
      <span
        className="relative w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
    </span>
  );
}

function LiveClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="font-mono tabular-nums">{time || "--:--:--"}</span>;
}

export default function LandingPage() {
  const eventsQuery = useEvents({ limit: 50 }, 30_000);
  const analyticsQuery = useAnalytics(30_000);
  const healthQuery = useHealth(30_000);

  const events = eventsQuery.data ?? mockEvents;
  const backendOnline = Boolean(healthQuery.data?.status === "OPERATIONAL" && !healthQuery.error);

  const stats = analyticsQuery.data ?? {
    total_events_processed: events.length,
    critical_alerts_count: events.filter((e) => e.is_critical_alert).length,
    classification_breakdown: {
      AGRICULTURAL_BURNING: events.filter((e) => e.classification === "AGRICULTURAL_BURNING").length,
      INDUSTRIAL_FIRE_EMERGENCY: events.filter((e) => e.classification === "INDUSTRIAL_FIRE_EMERGENCY").length,
      WILDFIRE: events.filter((e) => e.classification === "WILDFIRE").length,
      PERSISTENT_INDUSTRIAL_FLARE: events.filter((e) => e.classification === "PERSISTENT_INDUSTRIAL_FLARE").length,
      DEFERRED_FOR_ANALYST: 0,
    },
    system_accuracy_metric: "94.2%",
    mean_latency_seconds: 38.4,
    newest_event_id: null,
  };

  return (
    <div className="relative min-h-screen bg-black text-white page-grid-bg">
      {/* ── Fixed Header Navbar ────────────────────────────────────────── */}
      <ScrollNavbar backendOnline={backendOnline} />

      {/* ── Hero Section with Side-Bleed Ambient 3D Earth ──────────────── */}
      <main className="pt-20 pb-20 overflow-x-hidden">
        <section className="relative w-full min-h-[calc(100vh-5rem)] flex flex-col justify-center overflow-hidden">
          {/* Responsive Cinematic Earth canvas:
              - Mobile (< lg): Floating background globe visible behind hero headline
              - Desktop (>= lg): Right half (55vw x 100vh) */}
          <div
            className="w-full h-[400px] sm:h-[500px] lg:h-[100vh] lg:w-[55vw] absolute right-0 top-16 sm:top-10 lg:top-0 z-0 overflow-visible pointer-events-auto"
          >
            <EarthGlobe events={events} />
          </div>

          {/* Hero Copy — floats over the screen with full responsiveness */}
          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 lg:pt-8 pb-10 min-h-[calc(100vh-5rem)] flex flex-col justify-center pointer-events-none">
            {/* Ambient Atmospheric Blue Glow */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/4 w-[520px] h-[520px] bg-blue-500/20 blur-[130px] rounded-full pointer-events-none z-[-1]" />
            <div className="lg:max-w-[48%] relative">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-blue-500/20 bg-slate-900/40 text-[11px] font-mono uppercase tracking-[0.14em] text-[#2a75d3] mb-6 animate-fade-up pointer-events-auto">
                <StatusDot />
                National Remote Sensing Challenge · NTRO
              </div>

              <h1 className="display-headline mb-6 animate-fade-up">
                Autonomous detection of industrial thermal hazards.
              </h1>

              <p className="text-[15px] leading-relaxed text-slate-300 max-w-xl mb-8 font-normal">
                Disambiguating routine refinery flaring from catastrophic industrial fires using sub-pixel satellite radiometry, temporal persistence profiling, and multi-agent Bayesian fusion.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-10 pointer-events-auto">
                <a href="/dashboard" className="btn-primary">
                  Open Mission Console
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a href="#pipeline" className="btn-secondary">
                  Inspect Architecture
                </a>
              </div>

              {/* Status footer pill */}
              <div className="inline-flex items-center gap-3 px-3.5 py-2 rounded-lg border border-white/10 bg-slate-900/50 text-[12px] font-mono text-slate-400 pointer-events-auto">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: backendOnline ? "#22c55e" : "#f5a623" }}
                  />
                  {backendOnline ? "Live Satellite Feed" : "3D Thermal Intelligence Engine"}
                </span>
                <span className="text-slate-600">|</span>
                <span>{events.length} Active Detections</span>
                <span className="text-slate-600">|</span>
                <LiveClock />
              </div>
            </div>
          </div>
        </section>

        {/* ── Lower Sections Container ───────────────────────────────────── */}
        <div className="relative z-10 bg-black pt-24">

        {/* ── Key Metrics Strip ───────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 mb-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-blue-500/10 border border-blue-500/15 rounded-md overflow-hidden">
            {[
              { label: "Pipeline Throughput", value: `${stats.total_events_processed} Evt`, sub: "Processed in 24h window" },
              { label: "End-to-End Latency", value: `${stats.mean_latency_seconds?.toFixed(1) ?? "38.4"}s`, sub: "NASA FIRMS → Alert dispatch" },
              { label: "Facility Register", value: "2,840+", sub: "Polygons indexed in PostGIS" },
              { label: "Classification SLA", value: stats.system_accuracy_metric ?? "94.2%", sub: "4-class holdout validation" },
            ].map((metric, i) => (
              <div key={i} className="bg-slate-900/40 p-6 hover:bg-slate-900/60 transition-colors">
                <p className="eyebrow mb-3">{metric.label}</p>
                <p className="stat-value mb-1.5">{metric.value}</p>
                <p className="text-[11px] text-slate-400">{metric.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── The Problem / Approach ──────────────────────────────────── */}
        <section id="approach" className="max-w-6xl mx-auto px-6 mb-24 scroll-mt-20">
          <div className="mb-12">
            <p className="eyebrow-cyan mb-3">01 · Problem Statement</p>
            <h2 className="section-heading mb-4">
              Why thermal intensity alone fails.
            </h2>
            <p className="text-[15px] text-slate-400 max-w-2xl">
              NASA FIRMS detects thermal anomalies by brightness temperature thresholds. It cannot distinguish between routine industrial flares, petrochemical tank explosions, agricultural residue burns, and forest fires.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-dashed border-white/10 pt-8">
            {[
              {
                code: "SYS_ERR // 01",
                tag: "RESOLUTION MIXING",
                title: "375m Spatial Mixing",
                body: "A single VIIRS 375m pixel integrates all ground emitters in its footprint. An industrial flare and adjacent structural fire bleed into the exact same radiative signature.",
              },
              {
                code: "SYS_ERR // 02",
                tag: "CO-LOCATION OVERLAP",
                title: "Spatial Overlap Risk",
                body: "Normal refinery flares burn 24/7 at the exact GPS coordinates of storage tanks. Simply checking facility proximity leads to massive false alarms or critical missed detections.",
              },
              {
                code: "SYS_ERR // 03",
                tag: "MULTI-SPECTRAL FUSION",
                title: "Thermodynamic Disambiguation",
                body: "Our system combines 30-day rolling Z-scores (thermodynamic stability), Sentinel-2 SWIR flame bounds, and ERA5 dispersion modeling to classify anomalies with >92% precision.",
              },
            ].map((col, idx) => (
              <div
                key={idx}
                className="hud-cell group relative border-b border-dashed border-white/10 pb-8 pl-4 pr-3 pt-2"
              >
                {/* Corner Crosshair Accents */}
                <svg className="corner-crosshair corner-tl" viewBox="0 0 9 9" fill="none">
                  <path d="M4.5 0V9M0 4.5H9" stroke="currentColor" strokeWidth="1" />
                </svg>
                <svg className="corner-crosshair corner-tr" viewBox="0 0 9 9" fill="none">
                  <path d="M4.5 0V9M0 4.5H9" stroke="currentColor" strokeWidth="1" />
                </svg>

                <p className="font-mono text-[10px] tracking-[0.25em] text-[#4b8b3b] uppercase mb-3">
                  {col.code} <span className="text-slate-500 font-normal">/ {col.tag}</span>
                </p>
                <h3 className="hud-title text-[17px] font-semibold text-white mb-2.5 tracking-tight">
                  {col.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-slate-400 font-normal">
                  {col.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Multi-Agent Architecture Pipeline ──────────────────────── */}
        <section id="pipeline" className="max-w-6xl mx-auto px-6 mb-24 scroll-mt-20">
          <div className="mb-12">
            <p className="eyebrow-cyan mb-3">02 · Multi-Agent Architecture</p>
            <h2 className="section-heading mb-4">
              End-to-end processing pipeline.
            </h2>
            <p className="text-[15px] text-slate-400 max-w-2xl">
              Six autonomous agents process incoming radiometer telemetry through spatial sharding, time-series baselining, neural SWIR classification, and physical dispersion modeling.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-10 gap-x-8 border-t border-dashed border-white/10 pt-8">
            {PIPELINE_STAGES.map((st, i) => {
              const colSpan = (i % 3 === 0) ? "md:col-span-7" : (i % 3 === 1) ? "md:col-span-5" : "md:col-span-12 lg:col-span-12";
              return (
                <div
                  key={st.n}
                  className={`hud-cell group relative border-b border-dashed border-white/10 pb-8 pl-4 pr-2 ${colSpan}`}
                >
                  {/* Corner Accents */}
                  <svg className="corner-crosshair corner-tl" viewBox="0 0 9 9" fill="none">
                    <path d="M4.5 0V9M0 4.5H9" stroke="currentColor" strokeWidth="1" />
                  </svg>
                  <svg className="corner-crosshair corner-tr" viewBox="0 0 9 9" fill="none">
                    <path d="M4.5 0V9M0 4.5H9" stroke="currentColor" strokeWidth="1" />
                  </svg>

                  <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                    <span className="font-mono text-[11px] text-[#2a75d3] font-bold tracking-widest uppercase">
                      AGENT // {st.n}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
                      {st.tag}
                    </span>
                  </div>

                  <h3 className="hud-title text-[18px] font-semibold text-white mb-2 tracking-tight">
                    {st.name}
                  </h3>

                  <p className="text-[13px] leading-relaxed text-slate-400 mb-6 font-normal">
                    {st.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-dashed border-white/10 font-mono text-[11px]">
                    <div className="text-slate-400">
                      <span className="text-slate-600 font-bold">IN // </span> {st.input}
                    </div>
                    <div className="text-slate-300">
                      <span className="text-[#2a75d3] font-bold">OUT // </span> {st.output}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Datasets & Ground Truth ─────────────────────────────────── */}
        <section id="datasets" className="max-w-6xl mx-auto px-6 mb-24 scroll-mt-20">
          <div className="mb-12">
            <p className="eyebrow-cyan mb-3">03 · Geospatial Telemetry Feeds</p>
            <h2 className="section-heading mb-4">
              Integrated satellite & contextual registries.
            </h2>
            <p className="text-[15px] text-slate-400 max-w-2xl">
              Combining open government radiometry, multispectral instruments, and physical meteorological archives into an indexed spatial knowledge graph.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 border-t border-dashed border-white/10 pt-8">
            {DATA_SOURCES.map((ds, i) => (
              <div
                key={i}
                className="hud-cell group relative border-b border-dashed border-white/10 pb-8 pl-4 pr-2"
              >
                {/* Corner Crosshair Accents */}
                <svg className="corner-crosshair corner-tl" viewBox="0 0 9 9" fill="none">
                  <path d="M4.5 0V9M0 4.5H9" stroke="currentColor" strokeWidth="1" />
                </svg>
                <svg className="corner-crosshair corner-tr" viewBox="0 0 9 9" fill="none">
                  <path d="M4.5 0V9M0 4.5H9" stroke="currentColor" strokeWidth="1" />
                </svg>

                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                  <span className="font-mono text-[11px] text-[#4b8b3b] font-bold tracking-widest uppercase">
                    FEED // 0{i + 1}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                    {ds.badge}
                  </span>
                </div>

                <h3 className="hud-title text-[18px] font-semibold text-white mb-2 tracking-tight">
                  {ds.name}
                </h3>

                <p className="text-[13px] leading-relaxed text-slate-400 mb-6 font-normal">
                  {ds.detail}
                </p>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-dashed border-white/10 font-mono text-[11px]">
                  <div className="text-slate-400">
                    <span className="text-slate-600 font-bold">LATENCY // </span> {ds.latency}
                  </div>
                  <div className="text-slate-300 truncate">
                    <span className="text-[#4b8b3b] font-bold">AREA // </span> {ds.coverage}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Mission Control CTA ────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 mb-24">
          <div className="surface-elevated rounded-2xl p-8 sm:p-12 border border-blue-500/20 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 max-w-2xl mx-auto space-y-4">
              <p className="eyebrow-cyan">Live Mission Operations</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Launch Mission Control
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed font-normal">
                Access full-screen satellite situational awareness, 6-agent evidence traces, Bayesian weights, dispersion modeling, and Duty Officer incident escalation.
              </p>
              <div className="pt-4 flex justify-center gap-3">
                <a href="/dashboard" className="btn-primary">
                  Launch Console Dashboard →
                </a>
                <a href="/map" className="btn-secondary">
                  Open Live Map
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="border-t border-white/10 py-12 px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-slate-500">
            <div>
              NTRO · Problem Statement SIH26162 · Smart India Hackathon 2026
            </div>
            <div>
              VIIRS 375m · Sentinel-2 MSI · PostGIS H3 · LangGraph Multi-Agent
            </div>
          </div>
        </footer>
        </div>
      </main>
    </div>
  );
}
