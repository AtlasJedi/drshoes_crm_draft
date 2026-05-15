// packages/ui/src/components/Sticker.tsx
// Pill-shaped sticker badge with ink border + 2px ink box-shadow.
// < 30 LOC per granulate directive.

import React from "react";

export interface StickerProps {
  children: React.ReactNode;
  angle?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function Sticker({ children, angle = -1, style, className = "" }: StickerProps) {
  return (
    <span
      className={`sticker ${className}`.trim()}
      style={{ transform: `rotate(${angle}deg)`, ...style }}
    >
      {children}
    </span>
  );
}
