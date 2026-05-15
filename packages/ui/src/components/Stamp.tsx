// packages/ui/src/components/Stamp.tsx
// Stencil spray-stamp badge. Inherits .stamp + color variant from globals.css.
// < 40 LOC per granulate directive.

import React from "react";

export type StampColor = "green" | "pink" | "ink" | "blue";

export interface StampProps {
  children: React.ReactNode;
  color?: StampColor;
  angle?: number;
  className?: string;
}

export function Stamp({
  children,
  color = "ink",
  angle = -2,
  className = "",
}: StampProps) {
  return (
    <span
      className={`stamp stamp-${color} ${className}`.trim()}
      style={{ transform: `rotate(${angle}deg)` }}
    >
      {children}
    </span>
  );
}
