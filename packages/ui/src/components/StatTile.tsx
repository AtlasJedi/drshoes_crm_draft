// packages/ui/src/components/StatTile.tsx
// Dashboard KPI stat tile: label (mono) + large display value + optional sub + accent blob.
// Design verbatim from handoff/design/shared.jsx Stat component.
// < 50 LOC per granulate directive.

import React from "react";

export interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  className?: string;
}

export function StatTile({ label, value, sub, accent, className = "" }: StatTileProps) {
  return (
    <div
      className={`admin-card ${className}`.trim()}
      style={{ padding: 18, position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "rgba(0,0,0,0.55)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 44,
          lineHeight: 1,
          marginTop: 6,
          color: "var(--ink, #0a0a0a)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          data-sub
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "rgba(0,0,0,0.55)",
            marginTop: 8,
          }}
        >
          {sub}
        </div>
      )}
      <div
        data-accent
        style={{
          position: "absolute",
          top: -10,
          right: -10,
          width: 60,
          height: 60,
          background: accent,
          transform: "rotate(15deg)",
        }}
      />
    </div>
  );
}
