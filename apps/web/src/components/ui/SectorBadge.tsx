"use client";

import { getSectorTag } from "@/lib/design-tokens";

interface SectorBadgeProps {
  facilityType?: string | null;
  facilityName?: string | null;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function SectorBadge({
  facilityType,
  facilityName,
  size = "sm",
  showIcon = true,
}: SectorBadgeProps) {
  const sector = getSectorTag(facilityType, facilityName);
  if (!sector) return null;

  const sizeClasses = size === "sm" ? "text-[9px] px-1.5 py-0.5 gap-1" : "text-[10px] px-2 py-0.5 gap-1.5";

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded border transition-all ${sizeClasses}`}
      style={{
        backgroundColor: sector.bg,
        borderColor: sector.border,
        color: sector.color,
      }}
      title={`${sector.label} (OSM Industrial Classification)`}
    >
      {showIcon && <span className="text-[10px] leading-none">{sector.icon}</span>}
      <span className="truncate">{sector.shortLabel}</span>
    </span>
  );
}
