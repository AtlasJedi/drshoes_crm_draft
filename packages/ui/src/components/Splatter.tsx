// packages/ui/src/components/Splatter.tsx
// SVG spray splatter blob — absolute-positioned decorative accent.
// Circle coordinates verbatim from handoff/design/shared.jsx.
// < 50 LOC per granulate directive.

import React from "react";

export interface SplatterProps {
  color: string;
  size?: number;
  opacity?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function Splatter({
  color,
  size = 220,
  opacity = 1,
  style,
  className = "",
}: SplatterProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      style={{ position: "absolute", pointerEvents: "none", opacity, ...style }}
    >
      <g fill={color}>
        <circle cx="100" cy="100" r="48" />
        <circle cx="40"  cy="60"  r="9"  />
        <circle cx="170" cy="80"  r="6"  />
        <circle cx="160" cy="160" r="11" />
        <circle cx="50"  cy="170" r="7"  />
        <circle cx="20"  cy="120" r="4"  />
        <circle cx="180" cy="40"  r="3"  />
        <circle cx="135" cy="40"  r="5"  />
        <circle cx="75"  cy="30"  r="3"  />
        <circle cx="190" cy="120" r="4"  />
        <circle cx="100" cy="190" r="3"  />
        <circle cx="65"  cy="105" r="2.5"/>
        <circle cx="145" cy="120" r="2"  />
      </g>
    </svg>
  );
}
