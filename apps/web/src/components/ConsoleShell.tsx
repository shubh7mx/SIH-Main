"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "◈" },
  { href: "/map", label: "Live Map", icon: "◉" },
  { href: "/events", label: "Events", icon: "▤" },
  { href: "/analytics", label: "Analytics", icon: "▦" },
  { href: "/audit-logs", label: "Audit Logs", icon: "≡" },
  { href: "/copilot", label: "Copilot", icon: "⚡" },
];

interface Props {
  wsState?: "connecting" | "open" | "closed" | "error";
  eventCount?: number;
  criticalCount?: number;
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      setNow(
        new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#03060a] text-white flex flex-col">
      {/* ── Persistent Top Nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-12 border-b border-white/[0.07] bg-[#04070c]/95 backdrop-blur-md flex items-center justify-between px-3 sm:px-4 flex-shrink-0">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#06b6d4]" />
          <span className="font-mono text-[11px] font-bold tracking-[0.15em] text-white uppercase">
            NTRO GEOINT
          </span>
          <span className="hidden md:inline text-white/20 font-mono text-[10px]">SIH26162</span>
        </Link>

        {/* Page switcher */}
        <nav className="flex items-center gap-0.5 overflow-x-auto" aria-label="Console sections">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md font-mono text-[11px] transition-all whitespace-nowrap focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
                  isActive
                    ? "bg-white/[0.10] text-white border border-white/[0.12]"
                    : "text-mute hover:text-white/90 hover:bg-white/[0.05] border border-transparent"
                }`}
              >
                <span className="text-[10px] opacity-70">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Clock */}
        <div className="font-mono text-[10px] text-mute tabular-nums hidden sm:flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{now} IST</span>
        </div>
      </header>

      {/* ── Page content ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-0">{children}</main>
    </div>
  );
}
