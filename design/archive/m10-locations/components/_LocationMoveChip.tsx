// LocationMoveChip — inline chip on note rows that announce a storage location move.
"use client";
import { createLogger } from "@/lib/log";

const log = createLogger("LocationMoveChip");

type Props = { from: string | null; to: string | null };

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1.5px solid var(--ink)",
  background: "var(--paper-2)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  padding: "2px 8px",
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};

export function LocationMoveChip({ from, to }: Props) {
  log.debug("op=render", { from, to });
  if (from == null && to == null) return null;

  if (from != null && to != null) {
    return (
      <span style={chip}>
        <span aria-hidden>📍</span>
        <span style={{ fontStyle: "italic", color: "var(--admin-mute)" }}>{from}</span>
        <span aria-hidden>→</span>
        <strong>{to}</strong>
      </span>
    );
  }

  return (
    <span style={chip}>
      <span aria-hidden>📍</span>
      <span>
        do <strong>{to}</strong>
      </span>
    </span>
  );
}
