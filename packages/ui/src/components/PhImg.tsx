// packages/ui/src/components/PhImg.tsx
// Diagonal-stripe image placeholder. Inherits .ph-img / .ph-img.dark from globals.css.
// < 40 LOC per granulate directive.

import React from "react";

export interface PhImgProps {
  label?: string;
  dark?: boolean;
  aspectRatio?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function PhImg({
  label = "IMG",
  dark = false,
  aspectRatio,
  style,
  className = "",
}: PhImgProps) {
  return (
    <div
      className={`ph-img ${dark ? "dark" : ""} ${className}`.trim()}
      style={{ aspectRatio, ...style }}
    >
      <span style={{ padding: "0 12px" }}>{label}</span>
    </div>
  );
}
