"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentLogEntry } from "@/lib/api";

interface Props {
  logs: AgentLogEntry[];
  wsState: string;
  onClear?: () => void;
}

export function SystemLogsTerminal({ logs, wsState, onClear }: Props) {
  const [filterSource, setFilterSource] = useState<string>("ALL");
  const [filterLevel, setFilterLevel] = useState<string>("ALL");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs.length]);

  const filteredLogs = logs.filter((l) => {
    if (filterSource !== "ALL" && l.source !== filterSource) return false;
    if (filterLevel !== "ALL" && l.level !== filterLevel) return false;
    return true;
  });

  const levelColor = (lvl: string) => {
    switch (lvl) {
      case "CRITICAL":
        return "text-red-400 font-bold bg-red-950/40 px-1 rounded";
      case "ERROR":
        return "text-rose-400 font-semibold";
      case "WARNING":
        return "text-amber-400";
      case "DEBUG":
        return "text-gray-500";
      default:
        return "text-emerald-400";
    }
  };

  const sourceColor = (src: string) => {
    switch (src) {
      case "ORCHESTRATOR":
        return "text-purple-300";
      case "SPATIAL_AGENT":
        return "text-cyan-300";
      case "TEMPORAL_AGENT":
        return "text-blue-300";
      case "VISION_AGENT":
        return "text-indigo-300";
      case "DISPERSION_AGENT":
        return "text-amber-300";
      case "DISPATCHER":
        return "text-red-300";
      case "FIRMS_POLLER":
        return "text-orange-300";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#03060a] border-t border-hairline font-mono text-[11px]">
      {/* Header & Filter Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent-cyan)] font-bold">⚡ SWARM AUDIT LOGS</span>
          <span className="text-white/20">|</span>
          <span className="text-mute text-[10px]">
            {filteredLogs.length} entries · stream:{" "}
            <span
              className={
                wsState === "open" ? "text-emerald-400 font-bold" : "text-amber-400"
              }
            >
              {wsState.toUpperCase()}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Source filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="bg-black border border-white/10 text-white/80 rounded px-2 py-0.5 text-[10px]"
          >
            <option value="ALL">All Agents</option>
            <option value="ORCHESTRATOR">Orchestrator</option>
            <option value="FIRMS_POLLER">FIRMS Poller</option>
            <option value="SPATIAL_AGENT">Spatial Agent</option>
            <option value="TEMPORAL_AGENT">Temporal Agent</option>
            <option value="VISION_AGENT">Vision Agent</option>
            <option value="DISPERSION_AGENT">Dispersion</option>
            <option value="DISPATCHER">Dispatcher</option>
          </select>

          {/* Level filter */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-black border border-white/10 text-white/80 rounded px-2 py-0.5 text-[10px]"
          >
            <option value="ALL">All Levels</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="ERROR">Errors</option>
            <option value="WARNING">Warnings</option>
            <option value="INFO">Info</option>
          </select>

          {onClear && (
            <button
              onClick={onClear}
              className="text-mute hover:text-white text-[10px] px-1.5 py-0.5"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Log list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-white/[0.03]"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center text-mute py-8 text-[11px]">
            No logs matching filter criteria.
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const timeStr = new Date(entry.timestamp).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            });
            return (
              <div key={entry.id} className="pt-1 flex items-start gap-2 leading-relaxed">
                <span className="text-mute flex-shrink-0 text-[10px]">{timeStr}</span>
                <span className={`flex-shrink-0 text-[10px] ${levelColor(entry.level)}`}>
                  [{entry.level}]
                </span>
                <span className={`flex-shrink-0 text-[10px] ${sourceColor(entry.source)}`}>
                  {entry.source}
                </span>
                <span className="text-white/90 flex-1">{entry.message}</span>
                {entry.event_id && (
                  <span className="text-[10px] text-mute hover:text-[var(--accent-cyan)] cursor-pointer">
                    #{entry.event_id.slice(0, 8)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
