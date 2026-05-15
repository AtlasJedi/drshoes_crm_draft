// packages/ui/src/components/Toggle.tsx
// Ink ribbon toggle: off = muted dot, on = acid dot.
// Pure visual toggle; no Radix dependency — ARIA role=switch for accessibility.
// Keyboard: Space or Enter fires onChange.

import React from "react";

export interface ToggleProps {
  on: boolean;
  onChange?: (nextValue: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Toggle({
  on,
  onChange,
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
}: ToggleProps) {
  const track: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    width: 40,
    height: 22,
    borderRadius: 999,
    background: on ? "#0a0a0a" : "#e3ddcc",
    border: "1.5px solid #0a0a0a",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.15s",
    padding: "0 3px",
    position: "relative",
    opacity: disabled ? 0.5 : 1,
  };

  const dot: React.CSSProperties = {
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: on ? "#d8ff3a" : "#6b6960",
    transform: on ? "translateX(18px)" : "translateX(0)",
    transition: "transform 0.15s, background 0.15s",
  };

  function handleToggle() {
    if (!disabled) onChange?.(!on);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      tabIndex={disabled ? -1 : 0}
      className={className}
      style={track}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          handleToggle();
        }
      }}
    >
      <span style={dot} />
    </button>
  );
}
