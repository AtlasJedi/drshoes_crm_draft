"use client";

import { useState, useRef } from "react";
import { createLogger } from "@/lib/log";
import { api } from "@/lib/api";
import type { TriggerDto } from "@/lib/messaging/types";

const log = createLogger("triggers.editform");

export type TriggerEditState = {
  name: string;
  event: string;
  delayMinutes: number;
  channels: string[];
  body: string;
  requiresManualConfirmation: boolean;
  saving: boolean;
  error: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  setName: (v: string) => void;
  setEvent: (v: string) => void;
  setDelayMinutes: (v: number) => void;
  toggleChannel: (ch: string) => void;
  setBody: (v: string) => void;
  setManualConfirm: (v: boolean) => void;
  insertPlaceholder: (p: string) => void;
  save: (triggerId: string, onSaved: () => void) => Promise<void>;
};

export function useTriggerEditForm(trigger: TriggerDto): TriggerEditState {
  const [name, setName] = useState(trigger.name);
  const [event, setEvent] = useState(trigger.event);
  const [delayMinutes, setDelayMinutes] = useState(trigger.delayMinutes);
  const [channels, setChannels] = useState<string[]>(() => {
    try { return JSON.parse(trigger.channels); } catch { return []; }
  });
  const [body, setBody] = useState("");
  const [requiresManualConfirmation, setManualConfirm] = useState(
    trigger.requiresManualConfirmation,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function toggleChannel(ch: string) {
    setChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch],
    );
  }

  function insertPlaceholder(p: string) {
    const ta = textareaRef.current;
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

  async function save(triggerId: string, onSaved: () => void) {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/admin/triggers/${triggerId}`, {
        name, event, delayMinutes, channels, requiresManualConfirmation,
      });
      log.info("op=saveTrigger outcome=ok", { triggerId });
      onSaved();
    } catch (err) {
      log.error("op=saveTrigger outcome=error", { triggerId, err: String(err) });
      setError("Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setSaving(false);
    }
  }

  return {
    name, event, delayMinutes, channels, body, requiresManualConfirmation,
    saving, error, textareaRef,
    setName, setEvent, setDelayMinutes, toggleChannel, setBody, setManualConfirm,
    insertPlaceholder, save,
  };
}
