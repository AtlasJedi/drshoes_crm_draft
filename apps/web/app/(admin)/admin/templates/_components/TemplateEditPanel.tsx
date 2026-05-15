"use client";

// TemplateEditPanel — sticky right-column editor for a single template.
// Tape "edytujesz" header + name/channel/body fields + placeholder chips.
// < 80 LOC per granulate directive.

import { useState, useRef } from "react";
import { createLogger } from "@/lib/log";
import { Tape } from "@repo/ui";
import { I } from "@repo/ui";
import { updateTemplate } from "@/lib/messaging/api";
import type { TemplateDto, Channel } from "@/lib/messaging/types";

const log = createLogger("templates.editpanel");

const PLACEHOLDERS = [
  "{imię_klienta}",
  "{numer_zlecenia}",
  "{typ_pracy}",
  "{data_odbioru}",
  "{link_do_zdjęć}",
];

interface Props {
  template: TemplateDto;
  onClose: () => void;
  onSaved: () => void;
}

export function TemplateEditPanel({ template, onClose, onSaved }: Props) {
  const [name, setName] = useState(template.name);
  const [channel, setChannel] = useState<Channel>(template.channel);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  log.debug("op=TemplateEditPanel.render", { id: template.id });

  function insertPlaceholder(p: string) {
    const ta = taRef.current;
    if (!ta) { setBody(b => b + p); return; }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const next = body.slice(0, start) + p + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + p.length;
      ta.focus();
    });
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      await updateTemplate(template.id, { name, channel, body });
      log.info("op=saveTemplate outcome=ok", { id: template.id });
      onSaved();
    } catch (err) {
      log.error("op=saveTemplate outcome=error", { id: template.id, err: String(err) });
      setError("Nie udało się zapisać.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card sticky" style={{ padding: 22, top: 20, alignSelf: "flex-start" }}>
      <div className="flex justify-between items-center mb-3.5">
        <Tape angle={-2}>edytujesz</Tape>
        <button className="btn-clean" style={{ padding: 4 }} onClick={onClose} aria-label="zamknij">
          {I.close}
        </button>
      </div>
      <div className="t-display mb-4" style={{ fontSize: 22, lineHeight: 1 }}>{template.name}</div>

      <div className="flex flex-col gap-3">
        <div className="field">
          <label>Nazwa</label>
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Kanał</label>
          <select value={channel} onChange={e => setChannel(e.target.value as Channel)}>
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="tmpl-body">Treść</label>
          <textarea
            id="tmpl-body"
            aria-label="treść"
            ref={taRef}
            rows={7}
            value={body}
            onChange={e => setBody(e.target.value)}
            style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PLACEHOLDERS.map(p => (
            <button
              key={p}
              className="chip"
              style={{ fontSize: 10, padding: "2px 8px" }}
              onClick={() => insertPlaceholder(p)}
              type="button"
            >
              {p}
            </button>
          ))}
        </div>
        {error && <div className="text-[12px] text-red-700">{error}</div>}
        <div className="flex gap-2">
          <button
            className="btn-clean primary"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={handleSave}
            disabled={saving}
            aria-label="zapisz"
          >
            {saving ? "zapisywanie…" : "zapisz"}
          </button>
          <button
            className="btn-clean"
            style={{ flex: 1, justifyContent: "center" }}
            type="button"
          >
            podgląd
          </button>
          <button className="btn-clean" type="button">
            {I.send} test do siebie
          </button>
        </div>
      </div>
    </div>
  );
}
