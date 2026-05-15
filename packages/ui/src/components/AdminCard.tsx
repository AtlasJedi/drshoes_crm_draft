// packages/ui/src/components/AdminCard.tsx
// White admin surface card with 1.5px ink border + 3px pop-card shadow.
// CSS class .admin-card is defined in apps/web/app/globals.css (shipped in 9-1).
// < 30 LOC per granulate directive.

import React from "react";

export interface AdminCardProps {
  children: React.ReactNode;
  /** Optional explicit padding in px. When omitted, CSS handles spacing. */
  padding?: number;
  /** Extra Tailwind / utility classes for layout overrides (e.g. col-span-2). */
  className?: string;
  /** Escape hatch for one-off inline styles layered on top of padding. */
  style?: React.CSSProperties;
}

export function AdminCard({ children, padding, className = "", style }: AdminCardProps) {
  return (
    <div
      className={`admin-card ${className}`.trim()}
      style={{ padding: padding !== undefined ? `${padding}px` : undefined, ...style }}
    >
      {children}
    </div>
  );
}
