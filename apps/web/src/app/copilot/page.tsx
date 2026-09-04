"use client";

import { useState } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { askCopilot } from "@/lib/api";

// Robust client-side cleaner to strip any raw model scratchpads or thinking artifacts
function cleanCopilotAnswer(raw: string): string {
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

export default function CopilotPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<
    Array<{ q: string; a: string; mode: string; latency_ms: number; time: string }>
  >([
    {
      q: "System initialized",
      a: "Intelligence Copilot online and connected to live NASA FIRMS thermal anomaly feed. Ask questions regarding critical thermal alerts, facility baseline deviations, or regional hazard distributions.",
      mode: "DOCTRINE",
      latency_ms: 10,
      time: new Date().toLocaleTimeString(),
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (qText?: string) => {
    const q = (qText || question).trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await askCopilot(q);
      const cleanAnswer = cleanCopilotAnswer(res.answer);

      setMessages((prev) => [
        {
          q,
          a: cleanAnswer || res.answer,
          mode: res.mode,
          latency_ms: res.latency_ms,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      setQuestion("");
    } catch (err) {
      setMessages((prev) => [
        {
          q,
          a: `Query processing failed: ${err instanceof Error ? err.message : String(err)}`,
          mode: "ERROR",
          latency_ms: 0,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    "Summarize current thermal anomalies across India",
    "Show all critical industrial fires and nearest facilities",
    "List top thermal signatures by Fire Radiative Power (MW)",
    "Are there any anomalous flares in Gujarat?",
    "Give an operational brief on agricultural burning in Punjab",
  ];

  return (
    <ConsoleShell>
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 max-w-[1200px] w-full mx-auto flex flex-col flex-1 h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Tactical Copilot Assistant
            </h1>
            <p className="text-xs text-mute mt-0.5 font-mono">
              Natural language intelligence grounded in VIIRS observations & facility baselines
            </p>
          </div>
          <div className="font-mono text-[10px] px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            INTELLIGENCE CORE: READY
          </div>
        </div>

        {/* Quick query chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 flex-shrink-0">
          {sampleQueries.map((sq) => (
            <button
              key={sq}
              onClick={() => handleAsk(sq)}
              className="flex-shrink-0 text-[10px] font-mono bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-white/80 hover:text-white px-3 py-1.5 rounded-full transition-all"
            >
              {sq}
            </button>
          ))}
        </div>

        {/* Conversation stream */}
        <div className="surface-card rounded-xl border border-white/5 flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((item, i) => (
            <div key={i} className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-[10px] text-mute">
                <span className="text-white/40">DUTY OFFICER · {item.time}</span>
                {item.latency_ms > 0 && (
                  <span>
                    {item.latency_ms}ms · {item.mode}
                  </span>
                )}
              </div>
              <div className="text-white font-medium pl-3 border-l-2 border-cyan-400 bg-white/[0.02] p-2 rounded-r">
                {item.q}
              </div>
              <div className="p-4 bg-black/50 rounded-lg border border-white/5 text-white/90 whitespace-pre-wrap leading-relaxed text-[11px] shadow-inner">
                {item.a}
              </div>
            </div>
          ))}
        </div>

        {/* Query Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="surface-card rounded-xl border border-white/5 p-2 flex gap-2 flex-shrink-0"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask tactical copilot about thermal events, facility deviations, or situation briefs…"
            disabled={loading}
            className="flex-1 bg-transparent px-3 py-2 font-mono text-xs text-white focus:outline-none placeholder:text-mute"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="btn-primary px-5 py-2 disabled:opacity-40"
          >
            {loading ? "ANALYZING…" : "QUERY"}
          </button>
        </form>
      </div>
    </ConsoleShell>
  );
}
