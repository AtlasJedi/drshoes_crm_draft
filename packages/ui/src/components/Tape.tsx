// packages/ui/src/components/Tape.tsx
// Masking-tape decoration strip. Inherits .tape + color variant from globals.css.
// < 40 LOC per granulate directive.

import React from "react";

export type TapeColor = "acid" | "pink" | "blue" | "paper";

export interface TapeProps {
  children: React.ReactNode;
  color?: TapeColor;
  angle?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function Tape({
  children,
  color = "acid",
  angle = -1.5,
  style,
  className = "",
}: TapeProps) {
  const colorClass =
    color === "pink"  ? " tape-pink"  :
    color === "blue"  ? " tape-blue"  :
    color === "paper" ? " tape-paper" :
    "";

  return (
    <span
      className={`tape${colorClass} ${className}`.trim()}
      style={{ transform: `rotate(${angle}deg)`, ...style }}
    >
      {children}
    </span>
  );
}
