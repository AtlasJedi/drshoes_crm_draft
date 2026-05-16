// OrderDrawerHeader — PATCH ONLY. Adds an optional `location` prop and renders an
// acid-pill next to the existing status pill. Do not rewrite the whole header.

// ─── 1. Extend Props ──────────────────────────────────────────────
type Props = {
  // ...existing fields stay as-is...
  /** Current storage location for this order, e.g. "półka 1". */
  location?: string | null;
};

// ─── 2. Inside the header row, BESIDE the status pill: ────────────
{props.location && (
  <span
    aria-label="Aktualne miejsce"
    className="t-mono"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      marginLeft: 6,
      padding: "2px 8px",
      background: "var(--acid, #d8ff3a)",
      border: "1.5px solid var(--ink)",
      fontSize: 11,
      lineHeight: 1.4,
      whiteSpace: "nowrap",
    }}
  >
    <span aria-hidden>📍</span>
    {props.location}
  </span>
)}
