/**
 * LocationChip — shared acid-yellow location pill used in drawer header,
 * orders table, and kanban cards.
 *
 * Colours/tokens taken verbatim from OrderDrawerHeader.tsx:
 *   background: var(--acid, #d8ff3a), border: 1.5px solid var(--ink)
 */

interface Props {
  name: string | null;
  variant?: "sm" | "md";
}

export function LocationChip({ name, variant = "md" }: Props) {
  if (!name) return null;

  const baseStyle: React.CSSProperties =
    variant === "sm"
      ? {
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          padding: "1px 6px",
          background: "var(--acid, #d8ff3a)",
          border: "1.5px solid var(--ink)",
          fontSize: 10,
          lineHeight: 1.4,
          whiteSpace: "nowrap",
        }
      : {
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          background: "var(--acid, #d8ff3a)",
          border: "1.5px solid var(--ink)",
          fontSize: 11,
          lineHeight: 1.4,
          whiteSpace: "nowrap",
        };

  return (
    <span
      aria-label="Aktualne miejsce"
      className="t-mono"
      style={baseStyle}
    >
      <span aria-hidden>📍</span>
      {name}
    </span>
  );
}
