"use client";

import { useMemo, useState } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useLogStream } from "@/lib/hooks";

export default function AuditLogsPage() {
  const { logs, state: wsState, clearLogs } = useLogStream({ enabled: true });
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<unknown | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (sourceFilter !== "ALL" && l.source !== sourceFilter) return false;
      if (levelFilter !== "ALL" && l.level !== levelFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !l.message.toLowerCase().includes(q) &&
          !l.source.toLowerCase().includes(q) &&
          !(l.event_id && l.event_id.toLowerCase().includes(q))
        )
          return false;
      }
      return true;
    });
  }, [logs, sourceFilter, levelFilter, query]);

  const levelColor = (lvl: string) => {
    switch (lvl) {
      case "CRITICAL":
        return "text-red-400 bg-red-950/40 border border-red-500/30";
      case "ERROR":
        return "text-rose-400 bg-rose-950/30 border border-rose-500/20";
      case "WARNING":
        return "text-amber-400 bg-amber-950/30 border border-amber-500/20";
      case "DEBUG":
        return "text-gray-500 bg-white/5";
      default:
        return "text-emerald-400 bg-emerald-950/20";
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
    <ConsoleShell>
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 max-w-[1600px] w-full mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Swarm Audit & Reasoning Logs
            </h1>
            <p className="text-xs text-mute mt-1 font-mono">
              Live telemetry stream of multi-agent inference traces and ingestion pipeline
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span
              className={`px-2.5 py-1 rounded border ${
                wsState === "open"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              STREAM: {wsState.toUpperCase()}
            </span>
            <button onClick={clearLogs} className="btn-secondary text-[10px]">
              Clear Buffer
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 surface-card p-3 rounded-xl border border-white/5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search log messages or event IDs…"
            className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 font-mono text-[11px] text-white placeholder:text-mute focus:outline-none focus:border-cyan-400/50 flex-1 min-w-[200px]"
          />

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 font-mono text-[11px] text-white focus:outline-none focus:border-cyan-400/50"
          >
            <option value="ALL">All Agents / Sources</option>
            <option value="ORCHESTRATOR">Orchestrator</option>
            <option value="FIRMS_POLLER">FIRMS Poller</option>
            <option value="SPATIAL_AGENT">Spatial Agent</option>
            <option value="TEMPORAL_AGENT">Temporal Agent</option>
            <option value="VISION_AGENT">Vision Agent</option>
            <option value="DISPERSION_AGENT">Dispersion Agent</option>
            <option value="DISPATCHER">Dispatcher</option>
          </select>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 font-mono text-[11px] text-white focus:outline-none focus:border-cyan-400/50"
          >
            <option value="ALL">All Severity Levels</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="ERROR">Errors</option>
            <option value="WARNING">Warnings</option>
            <option value="INFO">Info</option>
          </select>
        </div>

        {/* Log Stream Terminal Table */}
        <div className="surface-card rounded-xl border border-white/5 overflow-hidden font-mono text-xs">
          <div className="px-4 py-2.5 bg-black/40 border-b border-white/[0.07] flex items-center justify-between text-mute text-[10px]">
            <span>LOG TRACE BUFFER ({filteredLogs.length} entries)</span>
            <span>TIME (IST)</span>
          </div>

          <div className="divide-y divide-white/[0.03] max-h-[640px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-mute">No logs matching criteria.</div>
            ) : (
              filteredLogs.map((l) => {
                const timeStr = new Date(l.timestamp).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                });
                return (
                  <div
                    key={l.id}
                    onClick={() => setSelectedLog(l)}
                    className="p-3 hover:bg-white/[0.03] transition-colors flex items-start gap-3 cursor-pointer"
                  >
                    <span className="text-mute text-[10px] whitespace-nowrap">{timeStr}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${levelColor(
                        l.level
                      )}`}
                    >
                      {l.level}
                    </span>
                    <span
                      className={`font-semibold text-[10px] whitespace-nowrap ${sourceColor(
                        l.source
                      )}`}
                    >
                      {l.source}
                    </span>
                    <span className="text-white/85 text-[11px] flex-1 leading-relaxed">
                      {l.message}
                    </span>
                    {l.event_id && (
                      <a
                        href={`/event?id=${l.event_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-cyan-400 hover:text-cyan-300 text-[10px] whitespace-nowrap"
                      >
                        #{l.event_id.slice(0, 8)} →
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
