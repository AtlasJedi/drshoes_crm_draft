// packages/ui/src/components/Chip.tsx
// Filter chip — toggleable pill with active/pink/dashed variants from globals.css.
// < 40 LOC per granulate directive. No log.debug (presentational, no lib/log.ts dep).

import React from "react";

export type ChipColor = "default" | "pink";
export type ChipVariant = "solid" | "dashed";

export interface ChipProps {
  children: React.ReactNode;
  active?: boolean;
  color?: ChipColor;
  variant?: ChipVariant;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function Chip({
  children,
  active = false,
  color = "default",
  variant = "solid",
  onClick,
  icon,
  className = "",
}: ChipProps) {
  const cls = [
    "chip",
    active ? "active" : "",
    color === "pink" ? "pink" : "",
    variant === "dashed" ? "dashed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={cls}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </span>
  );
}
