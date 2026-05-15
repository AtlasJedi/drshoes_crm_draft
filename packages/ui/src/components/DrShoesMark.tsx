// Brand wordmark — "Dr.Shoes" in display font with accent dot.
// Layout verbatim from handoff/design/shared.jsx DrShoesMark component.
// < 60 LOC per granulate directive.

import React from "react";

export interface DrShoesMarkProps {
  size?: number;
  color?: string;
  accent?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function DrShoesMark({
  size = 1,
  color = "var(--ink, #0a0a0a)",
  accent = "var(--acid, #d8ff3a)",
  style,
  className = "",
}: DrShoesMarkProps) {
  return (
    <div
      className={className}
      style={{
        display: "inline-block",
        position: "relative",
        fontFamily: "var(--font-display)",
        fontSize: `${64 * size}px`,
        lineHeight: 0.85,
        letterSpacing: "-0.02em",
        textTransform: "uppercase",
        color,
        zIndex: 1,
        ...style,
      }}
    >
      Dr
      <span style={{ color: accent, WebkitTextStroke: `2px ${color}` }}>.</span>
      Shoes
    </div>
  );
}
