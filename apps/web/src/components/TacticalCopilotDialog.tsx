"use client";

import { useState } from "react";
import { askCopilot, type CopilotAnswer } from "@/lib/api";

interface Props {
  onClose: () => void;
}

export function TacticalCopilotDialog({ onClose }: Props) {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<
    Array<{ q: string; a: string; mode: string; latency_ms: number; time: string }>
  >([
    {
      q: "System ready",
      a: "Tactical Copilot online and connected to live NASA FIRMS event feed. Ask about critical alerts, regional anomalies, facility deviations, or situation summaries.",
      mode: "DOCTRINE",
      latency_ms: 12,
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
      setAnswers((prev) => [
        {
          q,
          a: res.answer,
          mode: res.mode,
          latency_ms: res.latency_ms,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      setQuestion("");
    } catch (err: unknown) {
      setAnswers((prev) => [
        {
          q,
          a: `Query error: ${err instanceof Error ? err.message : String(err)}`,
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
    "List top thermal signatures by Fire Radiative Power",
    "Are there any anomalous flares in Gujarat?",
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface-card w-full max-w-2xl bg-[#060a11] border border-white/10 rounded-xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-cyan)] animate-pulse" />
            <span className="font-mono text-[12px] font-bold tracking-widest text-[var(--accent-cyan)] uppercase">
              NTRO Intelligence Copilot
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-mute hover:text-white font-mono text-[12px] px-2 py-1 rounded bg-white/5 hover:bg-white/10"
          >
            ✕ ESC
          </button>
        </div>

        {/* Quick query chips */}
        <div className="px-4 py-2 border-b border-white/5 bg-black/20 flex gap-2 overflow-x-auto">
          {sampleQueries.map((sq) => (
            <button
              key={sq}
              onClick={() => handleAsk(sq)}
              className="flex-shrink-0 text-[10px] font-mono bg-white/5 hover:bg-white/10 border border-white/5 text-white/70 hover:text-white px-2.5 py-1 rounded-full transition-all"
            >
              {sq}
            </button>
          ))}
        </div>

        {/* Conversation history */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {answers.map((item, i) => (
            <div key={i} className="space-y-1.5 font-mono text-[12px]">
              <div className="flex items-center justify-between text-[10px] text-mute">
                <span className="text-white/40">DUTY OFFICER · {item.time}</span>
                {item.latency_ms > 0 && (
                  <span>{item.latency_ms}ms · {item.mode}</span>
                )}
              </div>
              <div className="text-white font-medium pl-2 border-l-2 border-[var(--accent-cyan)]">
                {item.q}
              </div>
              <div className="p-3 bg-black/50 rounded-lg border border-white/5 text-white/85 whitespace-pre-wrap leading-relaxed text-[11px]">
                {item.a}
              </div>
            </div>
          ))}
        </div>

        {/* Input bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="p-3 border-t border-white/10 bg-black/40 flex gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask tactical intelligence copilot about live thermal events..."
            disabled={loading}
            className="flex-1 bg-black/80 border border-white/10 rounded-lg px-3 py-2 font-mono text-[12px] text-white focus:outline-none focus:border-[var(--accent-cyan)] placeholder:text-mute"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="btn-primary text-[12px] px-4 py-2 disabled:opacity-40"
          >
            {loading ? "ANALYZING..." : "QUERY"}
          </button>
        </form>
      </div>
    </div>
  );
}
