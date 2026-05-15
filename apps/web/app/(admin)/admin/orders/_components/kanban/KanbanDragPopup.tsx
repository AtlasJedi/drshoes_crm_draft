"use client";

// KanbanDragPopup — fixed-position post-drag status-change popup.
// Non-modal: renders as a fixed div (no Radix Portal/Overlay).
// ~60 LOC.

import { I } from "@repo/ui";
import { STATUS_LABELS_PL } from "@/lib/orders/status";
import type { PendingMove } from "./useKanbanDnd";

interface Props {
  pendingMove: PendingMove;
  onConfirm: (sendTriggers: boolean) => Promise<void>;
  onCancel: () => void;
}

function triggerText(preview: PendingMove["triggerPreview"]): string {
  if (preview.kind === "match")
    return `Trigger „${preview.templateName}" gotowy do wysyłki.`;
  if (preview.kind === "disabled")
    return `Trigger „${preview.triggerName}" wyłączony.`;
  return "Brak triggera dla tej zmiany statusu.";
}

export function KanbanDragPopup({ pendingMove, onConfirm, onCancel }: Props) {
  return (
    <div
      role="dialog"
      aria-label="Zmiana statusu"
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        width: 320,
        background: "#fff",
        border: "2px solid var(--ink)",
        boxShadow: "5px 5px 0 var(--pink), 5px 5px 0 1.5px var(--ink)",
        padding: 16,
        zIndex: 60,
      }}
    >
      <div
        className="t-stencil"
        style={{ fontSize: 12, letterSpacing: ".1em", color: "var(--pink)" }}
      >
        Status zmieniony
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>
        {pendingMove.cardCode} → {STATUS_LABELS_PL[pendingMove.toStatus]}
      </div>

      <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)", marginTop: 6 }}>
        {triggerText(pendingMove.triggerPreview)}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        <button
          className="btn-clean primary"
          style={{ fontSize: 12 }}
          onClick={() => { void onConfirm(true); }}
          aria-label="wyślij"
        >
          {I.send} wyślij
        </button>
        <button className="btn-clean" style={{ fontSize: 12 }}>
          podgląd
        </button>
        <div style={{ flex: 1 }} />
        <button
          className="btn-clean"
          style={{ fontSize: 12, padding: 6 }}
          onClick={onCancel}
          aria-label="Zamknij"
        >
          {I.close}
        </button>
      </div>
    </div>
  );
}
