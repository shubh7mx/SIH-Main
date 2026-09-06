"use client";

import { useMemo } from "react";
import Image from "next/image";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useModelValidation } from "@/lib/hooks";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

const CLASS_LABELS: Record<string, string> = {
  INDUSTRIAL_FIRE_EMERGENCY: "🚨 Industrial Fire Emergency",
  PERSISTENT_INDUSTRIAL_FLARE: "🏭 Persistent Industrial Flare",
  AGRICULTURAL_BURNING: "🌾 Agricultural Burning",
  WILDFIRE: "🔥 Wildfire",
};

export default function ModelValidationPage() {
  const { data, loading } = useModelValidation();

  const report = data?.classification_report ?? {};
  const cm = data?.confusion_matrix ?? [];
  const classes = data?.target_classes ?? [];
  const shapRanking = data?.feature_importance_shap ?? [];

  const overall = useMemo(() => {
    if (!data) return null;
    return {
      accuracy: data.accuracy_pct,
      f1: data.weighted_f1_pct,
      samples: data.total_samples,
      testSamples: data.test_samples,
    };
  }, [data]);

  return (
    <ConsoleShell>
      <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-6xl mx-auto w-full">
        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[11px] text-cyan-400 tracking-widest uppercase bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
              SIH26162 · ML GROUND TRUTH & EXPLAINABILITY
            </span>
            <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              ● XGBoost + Random Forest Ensemble
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Multi-Modal Geospatial AI Validation & SHAP Explainability
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
            Trained on{" "}
            <span className="text-white font-semibold">
              {overall?.samples?.toLocaleString() ?? "1,111"}
            </span>{" "}
            real VIIRS 375m detections, NASA FIRMS telemetry, OpenStreetMap infrastructure distances, and Google Earth-verified ground-truth labels.
          </p>
          <div className="mt-2 text-[11px] font-mono text-slate-500">
            Provenance: {data?.dataset_provenance ?? "NASA FIRMS + OSM + Google Earth Verified"}
          </div>
        </header>

        {loading && !data ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
            {/* ── Hero Metrics ────────────────────────────────────── */}
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              <div className="rounded-xl bg-slate-950/80 border border-cyan-500/30 p-5 shadow-lg shadow-cyan-950/20">
                <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  Classification Accuracy
                </p>
                <p className="text-4xl font-bold text-cyan-400 mt-2 tabular-nums">
                  {overall?.accuracy?.toFixed(1) ?? "—"}%
                </p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  Held-out test set ({overall?.testSamples ?? 0} samples)
                </p>
              </div>
              <div className="rounded-xl bg-slate-950/80 border border-emerald-500/30 p-5 shadow-lg shadow-emerald-950/20">
                <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  Weighted F1-Score
                </p>
                <p className="text-4xl font-bold text-emerald-400 mt-2 tabular-nums">
                  {overall?.f1?.toFixed(1) ?? "—"}%
                </p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  Multi-class harmonic mean
                </p>
              </div>
              <div className="rounded-xl bg-slate-950/80 border border-amber-500/30 p-5 shadow-lg shadow-amber-950/20">
                <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  Real Ground-Truth Set
                </p>
                <p className="text-4xl font-bold text-amber-400 mt-2 tabular-nums">
                  {overall?.samples?.toLocaleString() ?? "—"}
                </p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  VIIRS + OSM Proximity + CDE
                </p>
              </div>
              <div className="rounded-xl bg-slate-950/80 border border-violet-500/30 p-5 shadow-lg shadow-violet-950/20">
                <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  Explainability Engine
                </p>
                <p className="text-4xl font-bold text-violet-400 mt-2">
                  SHAP
                </p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  TreeExplainer feature attribution
                </p>
              </div>
            </div>

            {/* ── SHAP Feature Importance & Explainability ─────────── */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <span>📊</span> Model Explainability & Global SHAP Feature Impact
                </h2>
                <span className="text-[10px] font-mono text-cyan-400">
                  Game-Theoretic Shapley Values
                </span>
              </div>
              <div className="rounded-xl bg-[#090d16] border border-cyan-500/20 p-5 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* SHAP Chart Image */}
                  <div className="lg:col-span-7 bg-slate-950/80 rounded-lg p-2 border border-slate-800 flex items-center justify-center min-h-[300px]">
                    <img
                      src="/ml/shap_feature_importance.png"
                      alt="SHAP Feature Importance"
                      className="w-full h-auto rounded object-contain max-h-[360px]"
                    />
                  </div>

                  {/* SHAP Insight Interpretation */}
                  <div className="lg:col-span-5 space-y-3 font-sans text-xs">
                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider text-cyan-300">
                      Why does the model make each prediction?
                    </h3>
                    <p className="text-slate-300 leading-relaxed">
                      SHAP (<span className="text-cyan-400 font-mono">SHapley Additive exPlanations</span>) proves the model relies on true physical principles rather than spurious correlations:
                    </p>
                    <ul className="space-y-2 text-[11px] text-slate-400 font-mono">
                      <li className="flex items-start gap-1.5">
                        <span className="text-cyan-400 font-bold">1.</span>
                        <span><strong className="text-slate-200">dist_to_industrial_km:</strong> Primary separator for industrial facilities vs agricultural/wildfire zones.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-cyan-400 font-bold">2.</span>
                        <span><strong className="text-slate-200">cde_deviation_zscore:</strong> Crucial for disambiguating routine flaring from catastrophic fire emergencies.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-cyan-400 font-bold">3.</span>
                        <span><strong className="text-slate-200">frp_megawatts & BT:</strong> Quantifies thermal release power and combustion temperature.</span>
                      </li>
                    </ul>

                    {/* Top-5 Feature Table */}
                    <div className="pt-2 border-t border-slate-800">
                      <p className="text-[10px] font-mono text-slate-500 uppercase mb-1.5">
                        Top SHAP Attribution Scores:
                      </p>
                      <div className="space-y-1">
                        {shapRanking.slice(0, 4).map((item: any, idx: number) => (
                          <div key={item.feature} className="flex justify-between items-center text-[10px] font-mono bg-slate-900/60 px-2 py-1 rounded">
                            <span className="text-slate-300 truncate">{idx + 1}. {item.feature}</span>
                            <span className="text-cyan-400 font-bold">+{item.mean_shap.toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Confusion Matrix ─────────────────────────────────── */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3 font-mono">
                Confusion Matrix (Held-Out Test Set)
              </h2>
              <div className="overflow-x-auto rounded-xl bg-slate-950/70 border border-slate-800 p-4">
                <table className="min-w-[520px] w-full text-center font-mono text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-slate-500 text-[10px] uppercase">
                        Ground Truth \ Predicted
                      </th>
                      {classes.map((c: string) => (
                        <th key={c} className="p-2 text-slate-400 text-[10px]">
                          {CLASS_LABELS[c]?.split(" ")[0] ?? c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cm.map((row: number[], i: number) => {
                      const rowMax = Math.max(...row, 1);
                      return (
                        <tr key={classes[i]}>
                          <td className="p-2 text-slate-400 text-[10px] text-left whitespace-nowrap">
                            {CLASS_LABELS[classes[i]] ?? classes[i]}
                          </td>
                          {row.map((v: number, j: number) => {
                            const isDiag = i === j;
                            const intensity = v / rowMax;
                            return (
                              <td
                                key={j}
                                className="p-2"
                                style={{
                                  background: isDiag
                                    ? `rgba(16, 185, 129, ${0.15 + intensity * 0.5})`
                                    : v > 0
                                    ? `rgba(239, 68, 68, ${0.15 + intensity * 0.5})`
                                    : "transparent",
                                }}
                              >
                                <span className={isDiag ? "text-emerald-300 font-bold" : v > 0 ? "text-red-300" : "text-slate-600"}>
                                  {v}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-[10px] text-slate-500 mt-3 font-mono">
                  Diagonal (green) = correct classifications · Off-diagonal (red) = misclassifications
                </p>
              </div>
            </section>

            {/* ── Per-Class Metrics ────────────────────────────────── */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3 font-mono">
                Per-Class Precision / Recall / F1 Breakdown
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(report)
                  .filter(([k]) => classes.includes(k))
                  .map(([cls, m]: [string, any]) => (
                    <div
                      key={cls}
                      className="rounded-xl bg-slate-950/70 border border-slate-800 p-4"
                    >
                      <p className="text-xs font-semibold text-slate-200 mb-3">
                        {CLASS_LABELS[cls] ?? cls}
                      </p>
                      <div className="space-y-2">
                        {(["precision", "recall", "f1-score"] as const).map((metric) => (
                          <div key={metric} className="flex items-center gap-3">
                            <span className="w-16 font-mono text-[10px] text-slate-500 uppercase">
                              {metric.replace("-", " ")}
                            </span>
                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(m[metric] ?? 0) * 100}%`,
                                  background:
                                    metric === "f1-score"
                                      ? "linear-gradient(90deg, #06b6d4, #10b981)"
                                      : "linear-gradient(90deg, #0ea5e9, #6366f1)",
                                }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-slate-300 tabular-nums w-12 text-right">
                              {((m[metric] ?? 0) * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                        <p className="text-[10px] text-slate-500 font-mono pt-1">
                          Support: {m["support"] ?? 0} samples
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            {/* ── 16-Dimensional Feature Schema ───────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3 font-mono">
                16-Dimensional Geospatial Feature Schema
              </h2>
              <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(data?.features ?? []).map((f: string) => (
                    <div
                      key={f}
                      className="font-mono text-[10px] text-slate-300 bg-slate-900/60 px-2.5 py-1.5 rounded border border-slate-800"
                    >
                      <span className="text-cyan-400 mr-1.5">◆</span>
                      {f}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-4 font-mono leading-relaxed">
                  Trained at: {data?.trained_at ?? "—"} · Model artifact:{" "}
                  <span className="text-cyan-400">
                    thermal_classifier_ensemble.pkl (XGBoost 300 + Random Forest 250)
                  </span>
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </ConsoleShell>
  );
}
