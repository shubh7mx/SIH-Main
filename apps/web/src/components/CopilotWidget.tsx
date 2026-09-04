"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { askCopilot, type CopilotAnswer, type CopilotRelatedEvent } from "@/lib/api";
import { useEvents } from "@/lib/hooks";
import { getClassificationSeverity } from "@/lib/design-tokens";

interface MessageItem {
  id: string;
  q: string;
  a: string;
  mode: "NEURAL" | "DOCTRINE" | "ERROR" | "PENDING";
  latency_ms: number;
  time: string;
  cached?: boolean;
  related_events?: CopilotRelatedEvent[];
}

const SAMPLE_CHIPS = [
  { label: "🚨 Critical Threats", query: "Show all active critical industrial fire emergencies and nearest infrastructure" },
  { label: "🏭 Jamnagar & Refineries", query: "Check CDE baseline deviation and thermal flaring metrics at Jamnagar Refinery" },
  { label: "⚡ Top 5 FRP Energy", query: "List top 5 thermal signatures by Fire Radiative Power (MW) and coordinates" },
  { label: "🌾 Punjab Agricultural", query: "Summarize agricultural stubble burning across Punjab and Haryana regions" },
  { label: "🛰️ Satellite Sensors", query: "Which satellite sensors (VIIRS/Sentinel/MODIS) are detecting thermal events?" },
  { label: "📊 National Summary", query: "Provide an executive operational summary of all thermal anomalies across India" },
];

// Robust cleaner to strip any raw model scratchpads or thinking artifacts
function cleanWidgetAnswer(raw: string): string {
  if (!raw) return "";
  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<!--[\s\S]*?-->/gi, "");

  // Strip transition markers like "Let's craft:", "Let's write:", "Final Response:", etc.
  const pivotRegex =
    /(?:^|\n)(?:let's (?:craft|draft|write|produce|format|summarize|output|answer)(?:[:\s\S]*?:|\.{1,3}|\n)|final (?:response|answer|brief|summary)[:\s]*\n*|here (?:is|are) the (?:tactical brief|brief|response|summary)[:\s]*\n*)/gi;
  const matches = Array.from(text.matchAll(pivotRegex));
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    if (last.index !== undefined) {
      const candidate = text.slice(last.index + last[0].length).trim();
      if (candidate.length > 20) {
        text = candidate;
      }
    }
  }

  // Strip line-by-line preamble thinking patterns
  const lines = text.split("\n");
  let startIdx = 0;
  let inPreamble = true;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const isScratchpad =
      /^(?:thinking(?:\s*process)?[:\s]|thought[:\s]|analysis[:\s]|we need to|we have|we must|we should|i need to|i will|let's|note that|we'll parse|list entries|each heading|we cannot)\b/i.test(
        trimmed
      ) ||
      (trimmed.startsWith("[") &&
        trimmed.endsWith("]") &&
        i + 1 < lines.length &&
        lines[i + 1].trim().startsWith("["));

    if (!isScratchpad) {
      startIdx = i;
      inPreamble = false;
      break;
    }
  }

  if (!inPreamble) {
    text = lines.slice(startIdx).join("\n").trim();
  }

  return text.trim() || raw;
}

// Lightweight, resilient Markdown renderer for dark-tactical copilot briefs (supports tables, callouts, bold, code)
function FormattedBrief({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  const flushTable = (keyPrefix: number) => {
    if (tableBuffer.length === 0) return;
    const headerLine = tableBuffer[0];
    const dataLines = tableBuffer.slice(2); // Skip header & delimiter
    const headers = headerLine.split("|").map((c) => c.trim()).filter(Boolean);

    elements.push(
      <div key={`table-${keyPrefix}`} className="my-2.5 overflow-x-auto rounded-lg border border-white/10 bg-black/40">
        <table className="w-full text-left font-mono text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-cyan-300 font-semibold">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-1.5 whitespace-nowrap">
                  {renderInlineMarkdown(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {dataLines.map((rowStr, rIdx) => {
              const cells = rowStr.split("|").map((c) => c.trim()).filter(Boolean);
              return (
                <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
                  {cells.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-slate-200">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line is a markdown table row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      tableBuffer.push(trimmed);
      continue;
    } else if (inTable) {
      flushTable(i);
    }

    if (!trimmed) {
      elements.push(<div key={`empty-${i}`} className="h-2" />);
      continue;
    }

    // Callout / Warning Quote Block
    if (trimmed.startsWith(">")) {
      const quoteText = trimmed.replace(/^>\s*/, "");
      elements.push(
        <div
          key={`quote-${i}`}
          className="my-2 p-2.5 rounded-lg bg-amber-500/10 border-l-4 border-amber-400 text-amber-200 font-sans text-xs flex items-start gap-2 shadow-sm"
        >
          <div className="flex-1 leading-relaxed">{renderInlineMarkdown(quoteText)}</div>
        </div>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={`h4-${i}`} className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider mt-3 mb-1">
          {renderInlineMarkdown(trimmed.slice(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-sans font-bold text-white tracking-wide mt-3 mb-1.5 flex items-center gap-1.5 border-b border-white/5 pb-1">
          {renderInlineMarkdown(trimmed.slice(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-sans font-bold text-white tracking-wide mt-2 mb-2">
          {renderInlineMarkdown(trimmed.slice(2))}
        </h2>
      );
      continue;
    }

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 text-xs text-slate-200 font-sans ml-1 my-0.5">
          <span className="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
          <div className="flex-1 leading-relaxed">{renderInlineMarkdown(trimmed.slice(2))}</div>
        </div>
      );
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={`p-${i}`} className="text-xs text-slate-200 font-sans leading-relaxed my-1">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  }

  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{elements}</div>;
}

// Inline Markdown parser (bold, inline code, links)
function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return text;
  // Tokens: `code`, **bold**, *italic*
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for inline code `...`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/);
    // Check for bold **...**
    const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/);

    if (boldMatch && (!codeMatch || boldMatch[1].length < codeMatch[1].length)) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(
        <strong key={key++} className="font-semibold text-white">
          {renderInlineMarkdown(boldMatch[2])}
        </strong>
      );
      remaining = boldMatch[3];
    } else if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono text-[11px]">
          {codeMatch[2]}
        </code>
      );
      remaining = codeMatch[3];
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}


export function CopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "init",
      q: "System Init",
      a: "Tactical Intelligence Copilot online. Ask questions about thermal anomalies, critical alerts, or facility baselines. Click any target card below to view directly on the Live Map or open full incident dossiers.",
      mode: "DOCTRINE",
      latency_ms: 12,
      time: "ACTIVE",
    },
  ]);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K / Cmd+J / Ctrl+J
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "j")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input on open & scroll to bottom
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [isOpen]);

  const eventsQuery = useEvents({ limit: 100 });
  const allEvents = eventsQuery.data ?? [];

  const handleAsk = async (textToAsk?: string) => {
    const q = (textToAsk || query).trim();
    if (!q || loading) return;
    setLoading(true);
    setQuery("");

    // Append the user bubble IMMEDIATELY (optimistic rendering, before network)
    const pendingId = `user-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: pendingId,
        q,
        a: "",
        mode: "PENDING",
        latency_ms: 0,
        time: new Date().toLocaleTimeString("en-IN", { hour12: false }),
      },
    ]);
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 30);

    try {
      const res: CopilotAnswer = await askCopilot(q);
      const cleanAnswer = cleanWidgetAnswer(res.answer);

      // Collect related events strictly from backend response
      const related: CopilotRelatedEvent[] = [...(res.related_events ?? [])];
      const seenIds = new Set(related.map((r) => r.id));

      // Match referenced event IDs (e.g. 9d773dc2, c55ef691, or full UUIDs) in the text only if explicitly mentioned
      const hexPattern = /\b[0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\b/gi;
      const idMatches = Array.from(cleanAnswer.matchAll(hexPattern)).map((m) => m[0].toLowerCase());

      for (const rawId of idMatches) {
        const found = allEvents.find((e) => e.id.toLowerCase().startsWith(rawId));
        if (found && !seenIds.has(found.id)) {
          seenIds.add(found.id);
          related.push({
            id: found.id,
            facility_name: found.facility_name || "Unmapped Cluster",
            classification: found.classification,
            frp_megawatts: Number(found.frp_megawatts?.toFixed(1) ?? 0),
            brightness_temp_kelvin: Number(found.brightness_temp_kelvin?.toFixed(1) ?? 0),
            latitude: found.latitude,
            longitude: found.longitude,
            is_critical_alert: Boolean(found.is_critical_alert),
          });
        }
      }

      // Replace the pending placeholder with the completed answer
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                a: cleanAnswer || res.answer,
                mode: res.mode,
                latency_ms: res.latency_ms,
                cached: res.cached,
                related_events: related.slice(0, 4),
              }
            : m
        )
      );
    } catch (err) {
      const errMsg = `Intelligence query failed: ${err instanceof Error ? err.message : String(err)}`;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                a: errMsg,
                mode: "ERROR",
                latency_ms: 0,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
    }
  };

  const handleRedirectToMap = (eventId: string) => {
    setIsOpen(false);
    // Push new timestamp / query param so map page picks it up cleanly even if already on /map
    router.push(`/map?event=${eventId}&t=${Date.now()}`);
  };

  const handleRedirectToDossier = (eventId: string) => {
    setIsOpen(false);
    router.push(`/event?id=${eventId}`);
  };

  return (
    <>
      {/* ── Persistent Floating On-Demand Trigger Badge (Bottom Right) ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 bg-[#080d18]/95 hover:bg-[#0f172a] text-cyan-300 hover:text-white backdrop-blur-xl border border-cyan-500/30 hover:border-cyan-400/60 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.18)] transition-all cursor-pointer font-mono text-xs group"
        title="Open AI Copilot (⌘K or Ctrl+K)"
        aria-label="Open AI Copilot"
      >
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#06b6d4]" />
        <span className="font-semibold tracking-wider">AI COPILOT</span>
        <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 text-[10px] font-mono group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-colors">
          ⌘K
        </kbd>
      </button>

      {/* ── Modal Dialog Overlay ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-3xl h-[80vh] max-h-[720px] bg-[#040812]/98 border border-cyan-500/30 rounded-xl shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Top Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#080d18] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#06b6d4]" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                      Tactical Intelligence Copilot
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[9px] border border-cyan-500/30">
                      LIVE CONSOLE
                    </span>
                  </div>
                  <div className="text-[10px] text-mute font-mono">
                    Grounded in real-time satellite telemetry & facility registries
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/10 text-slate-400 text-[10px] font-mono">
                  ESC to close
                </kbd>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-mono"
                  aria-label="Close Copilot"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* ── Quick Query Suggestion Chips ── */}
            <div className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.02] border-b border-white/[0.05] overflow-x-auto no-scrollbar flex-shrink-0">
              <span className="text-[10px] font-mono text-mute uppercase tracking-wider shrink-0 mr-1">
                Quick Prompts:
              </span>
              {SAMPLE_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleAsk(chip.query)}
                  disabled={loading}
                  className="shrink-0 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/5 hover:border-cyan-500/40 text-[11px] font-mono transition-all cursor-pointer disabled:opacity-50"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* ── Messages Stream Area ── */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs min-h-0 bg-gradient-to-b from-[#040812] to-[#02050b]"
            >
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-3">
                  {/* ── User Message (Right-Aligned Cyan Bubble) ── */}
                  {msg.id !== "init" && (
                    <div className="flex justify-end items-end gap-2.5 group">
                      <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 bg-gradient-to-br from-cyan-600/90 to-cyan-700/80 text-white shadow-lg shadow-cyan-900/30 border border-cyan-400/30">
                        <div className="font-sans text-[13px] leading-snug text-white">{msg.q}</div>
                        <div className="text-[9px] text-cyan-200/70 mt-1 text-right font-mono">
                          You · {msg.time}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-700/80 border border-white/20 flex items-center justify-center text-xs shrink-0 shadow-md">
                        👤
                      </div>
                    </div>
                  )}

                  {/* ── Copilot Message (Left-Aligned with Avatar) ── */}
                  {msg.a && (
                    <div className="flex justify-start items-end gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 border border-cyan-300/40 flex items-center justify-center text-[13px] shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.45)]">
                        🛰️
                      </div>
                      <div className="max-w-[88%] rounded-2xl rounded-bl-md px-4 py-3 bg-[#0b1220]/95 border border-white/10 shadow-lg shadow-black/40 backdrop-blur-sm space-y-3">
                        {/* Meta badge */}
                        <div className="flex items-center justify-between text-[10px] text-mute border-b border-white/5 pb-1.5 gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-cyan-400 font-bold tracking-wide">NTRO COPILOT</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                              msg.mode === "NEURAL"
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                : msg.mode === "ERROR"
                                ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {msg.mode}
                          </span>
                          {msg.cached && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              ⚡ CACHE HIT
                            </span>
                          )}
                        </div>
                        <div className="tabular-nums shrink-0">
                          {msg.latency_ms > 0 && `${msg.latency_ms}ms`}
                        </div>
                      </div>

                      {/* Content formatted brief */}
                      <div className="leading-relaxed">
                        <FormattedBrief content={msg.a} />
                      </div>

                      {/* ── Related Tactical Target Action Cards (One-Click Redirects) ── */}
                      {msg.related_events && msg.related_events.length > 0 && (
                        <div className="pt-2 border-t border-white/[0.06] space-y-2">
                          <div className="text-[10px] font-mono text-cyan-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <span>🎯</span>
                            <span>Identified Tactical Targets ({msg.related_events.length}):</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.related_events.map((ev) => {
                              const sev = getClassificationSeverity(ev.classification);
                              return (
                                <div
                                  key={ev.id}
                                  className="p-2.5 rounded-lg bg-black/40 border border-white/10 hover:border-cyan-500/40 transition-colors flex flex-col justify-between gap-2"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="font-mono text-[10px] text-white font-medium truncate">
                                        {ev.facility_name}
                                      </span>
                                      <span
                                        className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase shrink-0"
                                        style={{ backgroundColor: `${sev.dot}20`, color: sev.dot }}
                                      >
                                        {sev.shortLabel}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3 text-[10px] text-mute font-mono">
                                      <span className="text-cyan-400 font-bold">
                                        {ev.frp_megawatts} MW
                                      </span>
                                      <span>{ev.brightness_temp_kelvin} K</span>
                                      {ev.cde_anomaly_score !== undefined && (
                                        <span className="text-amber-400 font-semibold">
                                          {ev.cde_anomaly_score > 0 ? `+${ev.cde_anomaly_score}` : ev.cde_anomaly_score}σ CDE
                                        </span>
                                      )}
                                      <span className="text-slate-400">
                                        {ev.latitude.toFixed(2)}°, {ev.longitude.toFixed(2)}°
                                      </span>
                                    </div>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                                    <button
                                      onClick={() => handleRedirectToMap(ev.id)}
                                      className="flex-1 px-2 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 font-mono text-[10px] text-center border border-cyan-500/30 transition-all cursor-pointer"
                                      title="Focus this event on Live Map"
                                    >
                                      🗺️ View on Map
                                    </button>
                                    <button
                                      onClick={() => handleRedirectToDossier(ev.id)}
                                      className="flex-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-mono text-[10px] text-center border border-white/10 transition-all cursor-pointer"
                                      title="Open full incident dossier"
                                    >
                                      📋 Dossier
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              ))}

              {/* ── Animated Typing Indicator ── */}
              {loading && (
                <div className="flex justify-start items-end gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 border border-cyan-300/40 flex items-center justify-center text-[13px] shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.45)] animate-pulse">
                    🛰️
                  </div>
                  <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-[#0b1220]/95 border border-cyan-500/25 shadow-lg shadow-black/40 flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-cyan-300 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-cyan-200 animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span className="text-[11px] text-cyan-300/90 font-mono tracking-wide">
                      Copilot is analyzing live telemetry…
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Input Bar ── */}
            <div className="p-3 border-t border-white/[0.08] bg-[#080d18] flex-shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAsk();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask Copilot about any anomaly, facility, or critical alert…"
                    disabled={loading}
                    className="w-full bg-[#03060c] border border-white/10 focus:border-cyan-500/60 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 font-sans focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-slate-500 text-[9px] font-mono">
                      Enter ↵
                    </kbd>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-40 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  {loading ? "…" : "Ask"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
