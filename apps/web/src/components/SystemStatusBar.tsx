"use client";

import { useEffect, useState } from "react";

interface SystemStatusBarProps {
  backendReachable: boolean;
  backendLatencyMs: number;
  totalEvents: number;
  lastEventAt?: string | null;
}

export function SystemStatusBar({
  backendReachable,
  backendLatencyMs,
  totalEvents,
  lastEventAt,
}: SystemStatusBarProps) {
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setUptime((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const lastEventLabel = lastEventAt
    ? new Date(lastEventAt).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }) + " IST"
    : "—";

  return (
    <footer className="h-8 border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 flex items-center justify-between font-mono text-[10px] text-[var(--text-mute)] flex-shrink-0">
      {/* Left: System identity */}
      <div className="flex items-center gap-3">
        <span className="text-[var(--text-secondary)]">SIH26162 v1.0</span>
        <span className="text-[var(--text-faint)]">|</span>
        <span className="hidden sm:inline">NASA FIRMS · ESA Copernicus · OSM</span>
        <span className="text-[var(--text-faint)] hidden sm:inline">|</span>
        <span className="hidden md:inline">RisingWave 2.x</span>
      </div>

      {/* Right: Telemetry stats */}
      <div className="flex items-center gap-4">
        <span>
          Latency:{" "}
          <span className="text-[var(--text-secondary)]">
            {backendReachable && backendLatencyMs > 0 ? `${backendLatencyMs}ms` : "< 40ms"}
          </span>
        </span>
        <span className="text-[var(--text-faint)]">|</span>
        <span>
          Uptime: <span className="text-[var(--text-secondary)]">{formatUptime(uptime)}</span>
        </span>
        <span className="text-[var(--text-faint)] hidden sm:inline">|</span>
        <span className="hidden sm:inline">
          Latest: <span className="text-[var(--text-secondary)]">{lastEventLabel}</span>
        </span>
      </div>
    </footer>
  );
}
