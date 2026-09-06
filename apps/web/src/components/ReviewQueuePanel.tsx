"use client";

/**
 * Tier A — Human-in-the-Loop Analyst Review Queue
 * ================================================
 * Displays events the swarm deferred due to model/agent uncertainty,
 * with per-event probability bars, uncertainty chips, and one-click
 * analyst confirmation / dismissal.
 */

import { useState } from "react";
import type { HotspotEvent } from "@/lib/types";
import { submitReview } from "@/lib/api";
import { CLASSIFICATION_META } from "@/lib/types";

const PROB_CLASS_ORDER = [
  "INDUSTRIAL_FIRE_EMERGENCY",
  "PERSISTENT_INDUSTRIAL_FLARE",
  "AGRICULTURAL_BURNING",
  "WILDFIRE",
] as const;

const PROB_BAR_COLORS: Record<string, string> = {
  INDUSTRIAL_FIRE_EMERGENCY: "#ff2047",
  PERSISTENT_INDUSTRIAL_FLARE: "#ff801f",
  AGRICULTURAL_BURNING: "#22d3ee",
  WILDFIRE: "#a78bfa",
};

type Decision = "CONFIRM_EMERGENCY" | "CONFIRM_FLARE" | "CONFIRM_AGRICULTURAL" | "CONFIRM_WILDFIRE" | "DISMISS";

export function ReviewQueuePanel({
  events,
  onResolved,
}: {
  events: HotspotEvent[];
  onResolved: (event: HotspotEvent) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (events.length === 0) return null;

  const handleDecision = async (ev: HotspotEvent, decision: Decision) => {
    setBusyId(ev.id);
    setError(null);
    try {
      const result = await submitReview(ev.id, decision, note[ev.id] || "");
      onResolved(result.event);
    } catch (e: any) {
      setError(e?.message || "Review submission failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="surface-card rounded-xl border border-amber-500/25 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-amber-500/[0.06]">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <h2 className="text-sm font-semibold text-amber-200">
            Analyst Review Queue
          </h2>
          <span className="font-mono text-[10px] text-amber-300/80 px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-500/10">
            {events.length} pending
          </span>
        </div>
        <p className="font-mono text-[10px] text-mute">
          machine deferred · human decides
        </p>
      </div>

      {error && (
        <div className="px-4 py-2 text-[11px] font-mono text-red-400 border-b border-red-500/20 bg-red-500/[0.05]">
          {error}
        </div>
      )}

      <div className="divide-y divide-white/[0.06]">
        {events.map((ev) => {
          const expanded = expandedId === ev.id;
          const probs = ev.model_probabilities || {};
          const reasons = ev.uncertainty_reasons || [];
          return (
            <div key={ev.id} className="px-4 py-3">
              <button
                onClick={() => setExpandedId(expanded ? null : ev.id)}
                className="w-full flex items-center justify-between gap-3 text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-mute shrink-0">
                    {ev.id.slice(0, 14)}
                  </span>
                  <span className="font-mono text-[11px] text-white truncate">
                    {ev.facility_name || `${ev.latitude.toFixed(3)}°, ${ev.longitude.toFixed(3)}°`}
                  </span>
                  <span className="font-mono text-[10px] text-mute shrink-0">
                    {ev.frp_megawatts?.toFixed(0)} MW
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[10px] text-amber-300">
                    conf {((ev.confidence_score ?? 0) * 100).toFixed(0)}%
                  </span>
                  <span className="text-mute text-[10px] group-hover:text-white transition-colors">
                    {expanded ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {expanded && (
                <div className="mt-3 space-y-3">
                  {/* Uncertainty reasons */}
                  {reasons.length > 0 && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-mute mb-1.5">
                        Why deferred
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {reasons.map((r, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-400/25 bg-amber-500/[0.08] text-amber-200"
                          >
                            ⚠ {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Class probability bars */}
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-mute mb-1.5">
                      Model class probabilities
                    </p>
                    <div className="space-y-1">
                      {PROB_CLASS_ORDER.map((cls) => {
                        const p = probs[cls] ?? 0;
                        return (
                          <div key={cls} className="flex items-center gap-2">
                            <span className="font-mono text-[9px] w-40 text-right text-mute truncate">
                              {CLASSIFICATION_META[cls]?.label || cls}
                            </span>
                            <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.max(p * 100, 1.5)}%`,
                                  background: PROB_BAR_COLORS[cls] || "#64748b",
                                }}
                              />
                            </div>
                            <span className="font-mono text-[10px] tabular-nums text-white w-10">
                              {(p * 100).toFixed(0)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Uncertainty metrics row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-mute">
                    {ev.model_agreement != null && (
                      <span>
                        XGB↔RF agreement:{" "}
                        <span className={ev.model_agreement < 0.7 ? "text-amber-300" : "text-emerald-300"}>
                          {ev.model_agreement.toFixed(2)}
                        </span>
                      </span>
                    )}
                    {ev.prediction_margin != null && (
                      <span>
                        margin: <span className="text-white">{ev.prediction_margin.toFixed(2)}</span>
                      </span>
                    )}
                    {ev.prediction_entropy != null && (
                      <span>
                        entropy: <span className="text-white">{ev.prediction_entropy.toFixed(2)}</span>
                      </span>
                    )}
                    {ev.agent_disagreement != null && (
                      <span>
                        agent disagreement: <span className="text-white">{ev.agent_disagreement.toFixed(2)}</span>
                      </span>
                    )}
                  </div>

                  {/* Analyst note */}
                  <input
                    type="text"
                    value={note[ev.id] || ""}
                    onChange={(e) => setNote((n) => ({ ...n, [ev.id]: e.target.value }))}
                    placeholder="Analyst note (optional)…"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 font-mono text-[11px] text-white placeholder:text-mute focus:outline-none focus:border-amber-400/50"
                  />

                  {/* Decision buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      disabled={busyId === ev.id}
                      onClick={() => handleDecision(ev, "CONFIRM_EMERGENCY")}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold text-white bg-red-500/80 hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      🚨 Confirm Emergency
                    </button>
                    <button
                      disabled={busyId === ev.id}
                      onClick={() => handleDecision(ev, "CONFIRM_FLARE")}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-mono text-white bg-orange-500/70 hover:bg-orange-500 disabled:opacity-50 transition-colors"
                    >
                      🏭 Confirm Flare
                    </button>
                    <button
                      disabled={busyId === ev.id}
                      onClick={() => handleDecision(ev, "CONFIRM_AGRICULTURAL")}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-mono text-white bg-cyan-500/60 hover:bg-cyan-500/80 disabled:opacity-50 transition-colors"
                    >
                      🌾 Confirm Agri
                    </button>
                    <button
                      disabled={busyId === ev.id}
                      onClick={() => handleDecision(ev, "CONFIRM_WILDFIRE")}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-mono text-white bg-purple-500/60 hover:bg-purple-500/80 disabled:opacity-50 transition-colors"
                    >
                      🔥 Confirm Wildfire
                    </button>
                    <button
                      disabled={busyId === ev.id}
                      onClick={() => handleDecision(ev, "DISMISS")}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-mono text-mute bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-50 transition-colors border border-white/10"
                    >
                      ✕ Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
