// packages/ui/src/components/Button.tsx
// Graffiti-style button with primary/acid/pink/paper/ghost variants and sm/md/lg size.
// CSS-driven via .btn, .btn-acid, .btn-pink, .btn-paper, .btn-ghost, .btn-sm from globals.css.
// Renders as <a> when href prop is present; otherwise renders <button>.
// < 60 LOC per granulate directive.

import React from "react";

export type ButtonVariant = "primary" | "acid" | "pink" | "paper" | "ghost";
export type ButtonSize = "md" | "sm" | "lg";

export interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  onClick?: React.MouseEventHandler;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn",
  acid:    "btn btn-acid",
  pink:    "btn btn-pink",
  paper:   "btn btn-paper",
  ghost:   "btn btn-ghost",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "",
  lg: "",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  onClick,
  type = "button",
  disabled = false,
  className = "",
  style,
}: ButtonProps) {
  const cls = [
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
  ].filter(Boolean).join(" ");

  if (href) {
    return (
      <a href={href} className={cls} style={style}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} className={cls} style={style} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
