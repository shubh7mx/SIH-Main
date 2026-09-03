"use client";

import { toEvidenceCards, type HotspotEvent } from "@/lib/types";

interface SwarmEvidenceGridProps {
  event: HotspotEvent;
  compact?: boolean;
}

export function SwarmEvidenceGrid({ event, compact = false }: SwarmEvidenceGridProps) {
  const cards = toEvidenceCards(event.agent_reasoning);

  if (cards.length === 0) {
    return (
      <div className="text-center text-mute py-6 font-mono text-[11px] bg-white/[0.02] rounded-lg border border-white/5 p-4">
        No 6-agent swarm evidence attached to this detection.
      </div>
    );
  }

  return (
    <div className={`space-y-2.5 ${compact ? "" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 space-y-0"}`}>
      {cards.map((card) => (
        <div
          key={card.key}
          className="p-3 rounded-lg border border-white/5 bg-white/[0.025] hover:bg-white/[0.04] transition-colors flex flex-col justify-between gap-2"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-cyan-400 font-semibold tracking-wider uppercase">
                {card.title}
              </span>
              {card.score != null && (
                <span className="text-slate-400 tabular-nums">
                  score: {(card.score * 100).toFixed(0)}%
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
              {card.narrative}
            </p>
          </div>

          {card.fields.length > 0 && (
            <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-mono text-slate-400">
              {card.fields.slice(0, 4).map((f) => (
                <div key={f.label} className="truncate">
                  <span className="text-slate-500">{f.label}: </span>
                  <span className="text-slate-200 font-medium">
                    {String(f.value)}
                    {(f as any).suffix ?? ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
