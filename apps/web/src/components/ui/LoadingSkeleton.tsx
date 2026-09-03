"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
  return <div className={`bg-white/[0.06] rounded animate-pulse ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="surface-card p-4 rounded-xl border border-white/5 space-y-3 animate-pulse">
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <Skeleton className="h-6 w-3/4" />
      <div className="grid grid-cols-3 gap-2 pt-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="surface-card rounded-xl border border-white/5 overflow-hidden p-4 space-y-3 animate-pulse">
      <div className="flex justify-between border-b border-white/5 pb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center py-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
