"use client";

interface Props {
  confidence: number; // 0 to 1
  label?: string;
  size?: "sm" | "md";
}

export function ConfidenceMeter({ confidence, label = "AI Classification Confidence", size = "md" }: Props) {
  const pct = Math.min(100, Math.max(0, Math.round(confidence * 100)));

  // Color bands based on confidence level
  const getColor = (val: number) => {
    if (val >= 85) return { bar: "#10b981", text: "text-emerald-400" }; // High confidence
    if (val >= 65) return { bar: "#06b6d4", text: "text-cyan-400" };    // Medium-high
    if (val >= 45) return { bar: "#f59e0b", text: "text-amber-400" };   // Moderate
    return { bar: "#ef4444", text: "text-red-400" };                    // Low / uncertain
  };

  const { bar, text } = getColor(pct);

  return (
    <div className="w-full space-y-1.5 font-mono">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-mute uppercase tracking-wider text-[10px]">{label}</span>
        <span className={`font-semibold tabular-nums ${text}`}>{pct}%</span>
      </div>

      <div
        className={`w-full bg-white/[0.06] rounded-full overflow-hidden border border-white/5 ${
          size === "sm" ? "h-1.5" : "h-2"
        }`}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: bar,
            boxShadow: `0 0 10px ${bar}60`,
          }}
        />
      </div>

      <div className="flex justify-between text-[9px] text-mute/60 px-0.5">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
