"use client";

/**
 * HistoryIcon — 5 stencil icon variants for the order timeline.
 * Each variant is a 28×28 SVG tile on a colored background with pop-shadow ink.
 * Ported from design/handoff/order-drawer-redesign/index.html .hist-icon spec.
 *
 * Props:
 *  kind         — one of the 5 timeline icon kinds
 *  statusColor  — only used for "status_change"; tile background color (e.g. "#ff5a1f")
 *
 * < 40 LOC per granulated-code rule.
 */

export type HistoryIconKind =
  | "creation"
  | "status_change"
  | "note"
  | "message"
  | "done";

interface Props {
  kind: HistoryIconKind;
  /** Tile bg color for status_change. Falls back to orange if omitted. */
  statusColor?: string;
}

// Default tile colors per kind (status_change uses prop).
const TILE_COLOR: Record<HistoryIconKind, string> = {
  creation:      "#2b5cff",
  status_change: "#ff5a1f",
  note:          "#d8ff3a",
  message:       "#ff2e7e",
  done:          "#0a0a0a",
};

export function HistoryIcon({ kind, statusColor }: Props) {
  const bg = kind === "status_change" && statusColor ? statusColor : TILE_COLOR[kind];

  return (
    <svg
      viewBox="0 0 24 24"
      width={28}
      height={28}
      aria-hidden="true"
      style={{
        display: "block",
        border: "1.5px solid #0a0a0a",
        boxShadow: "2px 2px 0 #0a0a0a",
        flexShrink: 0,
      }}
    >
      <rect width={24} height={24} fill={bg} />
      {kind === "creation" && (
        <path d="M12 6v12M6 12h12" stroke="#f4efe6" strokeWidth="2.6" strokeLinecap="square" />
      )}
      {kind === "status_change" && (
        <path d="M6 9h11l-3-3M18 15H7l3 3" fill="none" stroke="#f4efe6" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
      )}
      {kind === "note" && (
        <path d="M6 8h12M6 12h12M6 16h7" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="square" />
      )}
      {kind === "message" && (
        <>
          <path d="M4 7h16v10H4z" fill="none" stroke="#f4efe6" strokeWidth="2" />
          <path d="M4 7l8 6 8-6" fill="none" stroke="#f4efe6" strokeWidth="2" strokeLinejoin="miter" />
        </>
      )}
      {kind === "done" && (
        <path d="M5 12l5 6 9-12" fill="none" stroke="#d8ff3a" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
      )}
    </svg>
  );
}
