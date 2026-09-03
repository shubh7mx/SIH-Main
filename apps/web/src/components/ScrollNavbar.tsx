"use client";

import React, { useState, useEffect } from "react";

interface NavbarProps {
  onLaunchConsole?: () => void;
  backendOnline?: boolean;
}

export function ScrollNavbar({ onLaunchConsole, backendOnline = true }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-50 flex justify-center pointer-events-none">
      <nav
        className={`pointer-events-auto transition-all duration-300 ease-in-out flex items-center justify-between ${
          isScrolled
            ? "w-[92%] max-w-5xl mx-auto mt-4 px-6 h-12 bg-black/40 backdrop-blur-xl border-none rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.8)]"
            : "w-full px-8 h-16 bg-transparent border-none rounded-none"
        }`}
      >
        {/* Left: Text-based bold monospaced SIH26162 logo with live status indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline ? "bg-[#2a75d3] shadow-[0_0_8px_#2a75d3]" : "bg-[#f5a623] shadow-[0_0_8px_#f5a623]"
              }`}
            />
            <span className="font-mono text-[14px] font-bold tracking-[0.08em] text-white uppercase">
              SIH26162
            </span>
          </div>
          <span className="text-slate-600">·</span>
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-slate-400 font-medium hidden sm:inline-block">
            NTRO GEOINT
          </span>
        </div>

        {/* Center: Navigation Links */}
        <div className="hidden md:flex items-center gap-6 lg:gap-8">
          {[
            { label: "Mission Console", href: "/dashboard", onClick: undefined },
            { label: "Pipeline", href: "#pipeline", onClick: undefined },
            { label: "Architecture", href: "#approach", onClick: undefined },
            { label: "Datasets", href: "#datasets", onClick: undefined },
            { label: "Docs", href: "#docs", onClick: undefined },
          ].map((item) =>
            item.onClick ? (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className="text-[13px] font-medium text-slate-400 hover:text-[#2a75d3] transition-colors duration-150 cursor-pointer"
              >
                {item.label}
              </button>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="text-[13px] font-medium text-slate-400 hover:text-[#2a75d3] transition-colors duration-150"
              >
                {item.label}
              </a>
            )
          )}
        </div>

        {/* Right: Launch Console CTA */}
        <div className="flex items-center gap-4">
          <a
            type="button"
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#2a75d3] hover:bg-[#3b86e8] text-white text-[12px] font-semibold tracking-tight shadow-[0_0_18px_rgba(42,117,211,0.35)] hover:shadow-[0_0_24px_rgba(42,117,211,0.55)] transition-all duration-180 cursor-pointer"
          >
            Launch
 Console
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 7H12M8 3L12 7L8 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </nav>
    </header>
  );
}
