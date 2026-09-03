"use client";

import { ReactNode } from "react";

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  delta?: {
    value: string | number;
    trend: "up" | "down" | "neutral";
    label?: string;
  };
  icon?: ReactNode;
  accentColor?: string;
  loading?: boolean;
}

export function KpiStatTile({
  label,
  value,
  unit,
  subtext,
  delta,
  icon,
  accentColor = "#06b6d4",
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="surface-card p-4 rounded-xl border border-white/5 animate-pulse space-y-2">
        <div className="h-3 bg-white/10 rounded w-24" />
        <div className="h-8 bg-white/15 rounded w-32 mt-2" />
        <div className="h-3 bg-white/5 rounded w-16" />
      </div>
    );
  }

  return (
    <div className="surface-card p-4 rounded-xl border border-white/5 relative overflow-hidden flex flex-col justify-between hover:border-white/15 transition-all">
      {/* Ambient background glow */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none opacity-10 blur-xl"
        style={{ backgroundColor: accentColor }}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {icon && <div className="text-mute text-sm">{icon}</div>}
      </div>

      {/* Value & Unit */}
      <div className="my-2 flex items-baseline gap-1.5">
        <span
          className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white tabular-nums"
          style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
        >
          {value}
        </span>
        {unit && <span className="font-mono text-xs text-mute font-medium">{unit}</span>}
      </div>

      {/* Subtext or Trend Delta */}
      <div className="flex items-center justify-between text-[11px] font-mono mt-1">
        {delta ? (
          <div className="flex items-center gap-1">
            <span
              className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                delta.trend === "up"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : delta.trend === "down"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-white/5 text-mute"
              }`}
            >
              {delta.trend === "up" ? "▲" : delta.trend === "down" ? "▼" : "•"}{" "}
              {delta.value}
            </span>
            {delta.label && <span className="text-mute text-[10px]">{delta.label}</span>}
          </div>
        ) : subtext ? (
          <span className="text-mute text-[10px] truncate">{subtext}</span>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
