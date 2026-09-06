"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";

interface EscalateButtonProps {
  eventId: string;
  facilityName?: string | null;
  isCritical?: boolean;
  escalated?: boolean;
  onComplete?: () => void;
  className?: string;
}

/**
 * Self-contained escalation trigger: button becomes an inline loader with
 * dynamic dispatch-stage text while the multi-agency escalation runs,
 * then settles into a "✓ Dispatched" state. No modal popup needed.
 */
export function EscalateButton({
  eventId,
  facilityName,
  isCritical = false,
  escalated = false,
  onComplete,
  className = "",
}: EscalateButtonProps) {
  const [phase, setPhase] = useState<"idle" | "dispatching" | "done" | "error">("idle");
  const [stageIdx, setStageIdx] = useState(0);
  const stageRef = useRef<number | null>(null);

  // Dynamic dispatch stages — one per defense channel in the escalation chain
  const STAGES = [
    "Establishing secure uplink…",
    "Telegram Emergency Desk…",
    "NDMA OGC GeoJSON Webhook…",
    "Civil Defense GSM Broadcast…",
    "SDMA Incident Queue…",
    "ISRO Satellite Tasking…",
  ];

  // Compute label for current state
  const label = () => {
    if (escalated) return "✓ Multi-Agency Dispatched";
    if (phase === "dispatching") return STAGES[stageIdx % STAGES.length];
    if (phase === "done") return "✓ Dispatch Complete";
    if (phase === "error") return "⚠ Retry Dispatch";
    return isCritical ? "🚨 Escalate to NTRO" : "Forward to Incident Report";
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (stageRef.current) window.clearInterval(stageRef.current);
    };
  }, []);

  const handleEscalate = async () => {
    if (phase === "dispatching" || escalated) return;
    setPhase("dispatching");
    setStageIdx(0);

    // Cycle dispatch-stage text every 550ms for a live execution feel
    stageRef.current = window.setInterval(() => {
      setStageIdx((i) => i + 1);
    }, 550);

    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: `Manual escalation of ${facilityName || "event"}` }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Let the final stage linger briefly so the cadence feels complete
      await new Promise((r) => setTimeout(r, 700));
      setPhase("done");
      onComplete?.();
    } catch {
      setPhase("error");
    } finally {
      if (stageRef.current) window.clearInterval(stageRef.current);
      stageRef.current = null;
    }
  };

  const isDispatching = phase === "dispatching";
  const isDone = phase === "done" || escalated;
  const isError = phase === "error";

  return (
    <button
      onClick={handleEscalate}
      disabled={isDispatching || isDone}
      className={`relative py-2 px-4 rounded-lg font-mono text-xs font-semibold uppercase tracking-wider transition-all overflow-hidden ${
        isDone
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
          : isError
          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
          : isDispatching
          ? "bg-red-500/90 text-white border border-red-300/30"
          : isCritical
          ? "bg-red-500 text-white hover:bg-red-400"
          : "btn-secondary"
      } ${className}`}
    >
      {/* Animated scanning progress bar while dispatching */}
      {isDispatching && (
        <span
          className="absolute inset-y-0 left-0 animate-[escalate-sweep_1.1s_linear_infinite]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
            width: "50%",
          }}
        />
      )}
      <span className="relative flex items-center gap-1.5 whitespace-nowrap">
        {isDispatching && (
          <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        )}
        {isDone && <span>✓</span>}
        {label()}
      </span>
    </button>
  );
}
