// packages/ui/src/components/Chip.tsx
// Filter chip — toggleable pill with active/pink/dashed variants from globals.css.
// < 50 LOC per granulate directive. No log.debug (presentational, no lib/log.ts dep).

import React from "react";

export type ChipColor = "default" | "pink";
export type ChipVariant = "solid" | "dashed";

export interface ChipProps {
  children: React.ReactNode;
  active?: boolean;
  color?: ChipColor;
  variant?: ChipVariant;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "aria-pressed"?: boolean;
  "aria-label"?: string;
}

export function Chip({
  children,
  active = false,
  color = "default",
  variant = "solid",
  onClick,
  disabled = false,
  title,
  icon,
  className = "",
  style,
  "aria-pressed": ariaPressedProp,
  "aria-label": ariaLabel,
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

  const ariaPressed = ariaPressedProp ?? (onClick ? active : undefined);

  // Render as button when interactive or disabled (so :disabled state works)
  if (onClick || disabled) {
    return (
      <button
        type="button"
        className={cls}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        title={title}
        data-color={color}
        style={style}
        aria-pressed={ariaPressed}
        aria-label={ariaLabel}
      >
        {icon && <span className="flex items-center">{icon}</span>}
        {children}
      </button>
    );
  }

  return (
    <span
      className={cls}
      title={title}
      data-color={color}
      style={style}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </span>
  );
}
