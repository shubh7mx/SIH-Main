"use client";

import { getClassificationSeverity } from "@/lib/design-tokens";
import type { ThermalClassification } from "@/lib/types";

interface Props {
  classification: ThermalClassification | string;
  size?: "sm" | "md" | "lg";
  showDot?: boolean;
}

export function SeverityBadge({ classification, size = "md", showDot = true }: Props) {
  const sev = getClassificationSeverity(classification);

  const sizeClasses = {
    sm: "text-[10px] px-2 py-0.5 gap-1",
    md: "text-[11px] px-2.5 py-1 gap-1.5",
    lg: "text-[12px] px-3 py-1.5 gap-2",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-full border transition-all ${sizeClasses}`}
      style={{
        backgroundColor: sev.bg,
        borderColor: sev.borderSoft,
        color: sev.text,
      }}
    >
      {showDot && (
        <span
          className="rounded-full flex-shrink-0 animate-pulse"
          style={{
            backgroundColor: sev.dot,
            width: size === "sm" ? 4 : 6,
            height: size === "sm" ? 4 : 6,
            boxShadow: `0 0 8px ${sev.glow}`,
          }}
        />
      )}
      <span className="truncate">{sev.shortLabel}</span>
    </span>
  );
}
