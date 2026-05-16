"use client";

import { createLogger } from "@/lib/log";
import { Toggle, Chip, I } from "@drshoes/ui";
import { toggleTrigger } from "@/lib/messaging/api";
import type { TriggerDto } from "@/lib/messaging/types";

const log = createLogger("triggers.card");

const EVENT_LABELS: Record<string, string> = {
  STATUS_CHANGE: "zmiana statusu",
  ORDER_RECEIVED: "zlecenie przyjęte",
  BEFORE_PICKUP_X_DAYS: "X dni przed odbiorem",
  AFTER_HANDOVER_Y_DAYS: "Y dni po wydaniu",
  RESERVATION_EXPIRING: "wygasająca rezerwacja",
};

interface Props {
  trigger: TriggerDto;
  onEdit: (t: TriggerDto) => void;
}

export function TriggerCard({ trigger: t, onEdit }: Props) {
  const channels = (() => {
    try { return (JSON.parse(t.channels) as string[]).join(" + "); }
    catch { return t.channels; }
  })();
  const delay =
    t.delayMinutes === 0 ? "natychmiast" :
    t.delayMinutes < 60  ? `+${t.delayMinutes}m` :
    `+${t.delayMinutes / 60}h`;

  async function handleToggle() {
    try {
      await toggleTrigger(t.id, !t.enabled);
      log.info("op=toggleTrigger", { id: t.id, enabled: !t.enabled });
    } catch (err) {
      log.error("op=toggleTrigger outcome=error", { id: t.id, err: String(err) });
    }
  }

  return (
    <div
      data-testid="trigger-card"
      className="admin-card flex gap-3.5 items-start"
      style={{
        padding: 16,
        opacity: t.enabled ? 1 : 0.55,
        borderLeftWidth: 5,
        borderLeftStyle: "solid",
        borderLeftColor: t.requiresManualConfirmation ? "var(--pink)" : "var(--blue)",
      }}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: 38, height: 38, background: "var(--ink)", color: "var(--acid)" }}
      >
        {I.zap}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="t-display" style={{ fontSize: 18 }}>{t.name}</div>
          {t.requiresManualConfirmation && (
            <Chip color="pink" style={{ fontSize: 10, padding: "2px 8px" }}>
              wymaga potwierdzenia
            </Chip>
          )}
        </div>
        <div className="t-mono mt-1" style={{ fontSize: 11, color: "rgba(0,0,0,0.6)" }}>
          <strong>kiedy:</strong> {EVENT_LABELS[t.event] ?? t.event}{" "}
          · <strong>kanał:</strong> {channels}{" "}
          · <strong>opóźnienie:</strong> {delay}
        </div>
        <div className="flex gap-4 mt-2">
          <span className="t-mono" style={{ fontSize: 11 }}><b>0</b> wysłane</span>
          <span className="t-mono" style={{ fontSize: 11 }}><b>0</b> otwarte</span>
          <span className="t-mono" style={{ fontSize: 11 }}><b>0</b> odpowiedzi</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <Toggle on={t.enabled} onChange={handleToggle} />
        <button
          className="btn-clean"
          style={{ fontSize: 11, padding: "3px 8px" }}
          onClick={() => onEdit(t)}
          aria-label="edytuj"
        >
          edytuj
        </button>
      </div>
    </div>
  );
}
