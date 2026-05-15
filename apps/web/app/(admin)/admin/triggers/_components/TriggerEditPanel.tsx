"use client";

import { createLogger } from "@/lib/log";
import { Tape, Toggle, Chip, I } from "@repo/ui";
import { useTriggerEditForm } from "./useTriggerEditForm";
import type { TriggerDto } from "@/lib/messaging/types";

const log = createLogger("triggers.editpanel");

const PLACEHOLDERS = [
  "{imię_klienta}",
  "{numer_zlecenia}",
  "{typ_pracy}",
  "{data_odbioru}",
  "{link_do_zdjęć}",
];
const CHANNELS_ALL = ["Email", "SMS", "WhatsApp"];

interface Props {
  trigger: TriggerDto;
  onClose: () => void;
  onSaved: () => void;
}

export function TriggerEditPanel({ trigger, onClose, onSaved }: Props) {
  const f = useTriggerEditForm(trigger);
  log.debug("op=TriggerEditPanel.render", { triggerId: trigger.id });

  return (
    <div
      className="admin-card sticky"
      style={{ padding: 22, top: 20, alignSelf: "flex-start" }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3.5">
        <Tape angle={-2}>edytujesz</Tape>
        <button
          className="btn-clean"
          style={{ padding: 4 }}
          onClick={onClose}
          aria-label="zamknij"
        >
          {I.close}
        </button>
      </div>
      <div className="t-display" style={{ fontSize: 26, lineHeight: 1 }}>
        {trigger.name}
      </div>
      <div className="t-mono mt-1 mb-4" style={{ fontSize: 11, color: "rgba(0,0,0,0.55)" }}>
        0 wysłanych · 0 odpowiedzi
      </div>

      <div className="flex flex-col gap-3.5">
        {/* name */}
        <div className="field">
          <label>Nazwa</label>
          <input value={f.name} onChange={e => f.setName(e.target.value)} />
        </div>

        {/* event + delay */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label>Zdarzenie</label>
            <select value={f.event} onChange={e => f.setEvent(e.target.value)}>
              <option value="STATUS_CHANGE">zmiana statusu</option>
              <option value="ORDER_RECEIVED">zlecenie przyjęte</option>
              <option value="BEFORE_PICKUP_X_DAYS">X dni przed odbiorem</option>
              <option value="AFTER_HANDOVER_Y_DAYS">Y dni po wydaniu</option>
            </select>
          </div>
          <div className="field">
            <label>Opóźnienie</label>
            <select
              value={f.delayMinutes}
              onChange={e => f.setDelayMinutes(Number(e.target.value))}
            >
              <option value={0}>natychmiast</option>
              <option value={120}>+2h</option>
              <option value={1440}>+1 dzień</option>
              <option value={4320}>+3 dni</option>
              <option value={7200}>+5 dni</option>
            </select>
          </div>
        </div>

        {/* channels */}
        <div className="field">
          <label>Kanał</label>
          <div className="flex gap-2 flex-wrap">
            {CHANNELS_ALL.map(ch => (
              <Chip
                key={ch}
                active={f.channels.some(c => c.toLowerCase() === ch.toLowerCase())}
                onClick={() => f.toggleChannel(ch.toUpperCase())}
              >
                {ch}
              </Chip>
            ))}
          </div>
        </div>

        {/* body textarea */}
        <div className="field">
          <label htmlFor="trigger-body">Treść · placeholdery klikalne</label>
          <textarea
            id="trigger-body"
            aria-label="treść"
            ref={f.textareaRef}
            rows={6}
            value={f.body}
            onChange={e => f.setBody(e.target.value)}
            style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
          />
        </div>

        {/* placeholder chips */}
        <div className="flex gap-1.5 flex-wrap">
          {PLACEHOLDERS.map(p => (
            <button
              key={p}
              className="chip"
              style={{ fontSize: 10, padding: "2px 8px" }}
              onClick={() => f.insertPlaceholder(p)}
              type="button"
            >
              {p}
            </button>
          ))}
        </div>

        {/* manual confirm toggle */}
        <div
          className="flex justify-between items-center"
          style={{
            padding: "10px 12px",
            background: "var(--paper-2)",
            border: "1px dashed var(--ink)",
          }}
        >
          <div className="flex flex-col">
            <span className="t-mono font-bold" style={{ fontSize: 11 }}>
              Wymaga ręcznego potwierdzenia
            </span>
            <span className="t-mono opacity-55" style={{ fontSize: 10 }}>
              trafia do skrzynki „do wysłania"
            </span>
          </div>
          <Toggle
            on={f.requiresManualConfirmation}
            onChange={() => f.setManualConfirm(!f.requiresManualConfirmation)}
          />
        </div>

        {/* error */}
        {f.error && (
          <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
            {f.error}
          </div>
        )}

        {/* actions */}
        <div className="flex gap-2">
          <button
            className="btn-clean primary"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => f.save(trigger.id, onSaved)}
            disabled={f.saving}
            aria-label="zapisz zmiany"
          >
            {f.saving ? "zapisywanie…" : "zapisz zmiany"}
          </button>
          <button
            className="btn-clean"
            style={{ flex: 1, justifyContent: "center" }}
            type="button"
            onClick={() => console.warn("test do siebie wkrótce")}
          >
            {I.send} test do siebie
          </button>
        </div>
      </div>
    </div>
  );
}
