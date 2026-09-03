"use client";

import { useEffect, useState } from "react";

export function TacticalNav() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Kolkata",
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="nav-bar justify-between">
      <div className="flex items-center gap-3">
        <div className="status-dot status-dot-live" />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)] font-medium">
          SIH26162
        </span>
        <span className="text-[var(--text-faint)]">·</span>
        <span className="text-[12px] text-[var(--text-primary)] font-normal">
          Thermal Intelligence Console
        </span>
        <span className="text-[var(--text-faint)] hidden md:inline">·</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--text-mute)] hidden md:inline">
          NTRO Operations
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
          <span className="font-mono text-[10px] text-[var(--accent-green)] uppercase">
            LIVE
          </span>
        </div>
        <span className="text-[var(--text-faint)]">|</span>
        <span className="font-mono text-[11px] text-[var(--text-secondary)] tabular-nums">
          {time} IST
        </span>
      </div>
    </header>
  );
}
