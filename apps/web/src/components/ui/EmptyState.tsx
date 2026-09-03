"use client";

import { ReactNode } from "react";

interface Props {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ title, description, icon, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center surface-card rounded-xl border border-white/5 space-y-3">
      {icon ? (
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl text-mute">
          {icon}
        </div>
      ) : (
        <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-sm font-mono text-mute">
          ◎
        </div>
      )}
      <h3 className="font-mono text-xs uppercase tracking-widest text-white/90 font-semibold">
        {title}
      </h3>
      <p className="text-xs text-mute max-w-sm leading-relaxed">{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn-secondary text-xs mt-2">
          {action.label}
        </button>
      )}
    </div>
  );
}
