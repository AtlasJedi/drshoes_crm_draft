"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { getTemplates, sendMessage } from "@/lib/messaging/api";
import type { TemplateDto, Channel } from "@/lib/messaging/types";
import { createLogger } from "@/lib/log";

const log = createLogger("messaging.composer");

interface Props {
  orderId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSent: () => void;
}

export function MessageComposerModal({ orderId, open, onOpenChange, onSent }: Props) {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Load active templates when modal opens; reset state on close.
  useEffect(() => {
    if (!open) {
      setFeedback(null);
      return;
    }
    getTemplates()
      .then((ts) => {
        const active = ts.filter((t) => t.active);
        setTemplates(active);
        const first = active[0];
        if (first) {
          setTemplateId(first.id);
          setChannel(first.channel === "SMS" ? "SMS" : "EMAIL");
        }
      })
      .catch((e) => {
        log.error("op=loadTemplates outcome=error", { err: String(e) });
      });
  }, [open]);

  // Selected template drives the channel auto-fill and subject preview.
  const selected = templates.find((t) => t.id === templateId);

  async function handleSend() {
    if (!templateId) return;
    setSending(true);
    setFeedback(null);
    try {
      await sendMessage(orderId, { templateId, channel });
      log.info("op=send outcome=success", { orderId, templateId, channel });
      onSent();
      onOpenChange(false);
    } catch (e) {
      setFeedback("Nie udało się wysłać wiadomości.");
      log.error("op=send outcome=error", { orderId, err: String(e) });
    } finally {
      setSending(false);
    }
  }

  function handleTemplateChange(id: string) {
    const t = templates.find((x) => x.id === id);
    setTemplateId(id);
    if (t) setChannel(t.channel === "SMS" ? "SMS" : "EMAIL");
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-paper p-6 rounded-lg shadow-xl max-w-lg w-full"
          aria-describedby="composer-desc"
        >
          <Dialog.Title className="text-base font-semibold mb-1">
            Wyślij wiadomość
          </Dialog.Title>
          <p id="composer-desc" className="text-xs text-admin-mute mb-4">
            Wybierz szablon i kanał, a następnie wyślij wiadomość do klienta.
          </p>

          {/* Template selector */}
          <label className="block mb-3">
            <span className="block text-xs font-medium text-admin-mute mb-1">Szablon</span>
            <select
              value={templateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full border border-admin-line rounded px-2 py-1.5 text-sm"
              disabled={templates.length === 0}
            >
              {templates.length === 0 && (
                <option value="">Brak aktywnych szablonów</option>
              )}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {/* Channel selector — auto-filled from template, user can override */}
          <label className="block mb-3">
            <span className="block text-xs font-medium text-admin-mute mb-1">Kanał</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className="w-full border border-admin-line rounded px-2 py-1.5 text-sm"
            >
              <option value="EMAIL">EMAIL</option>
              <option value="SMS">SMS</option>
            </select>
          </label>

          {/* Subject — only relevant for EMAIL */}
          {selected && channel === "EMAIL" && (
            <div className="mb-3">
              <span className="block text-xs font-medium text-admin-mute mb-1">Temat</span>
              <p className="text-sm text-ink border border-admin-line rounded px-2 py-1.5 bg-neutral-50">
                {selected.subject ?? "—"}
              </p>
            </div>
          )}

          {/* Body preview */}
          {selected && (
            <div className="mb-4">
              <span className="block text-xs font-medium text-admin-mute mb-1">Treść</span>
              <p className="text-sm whitespace-pre-wrap border border-admin-line rounded px-2 py-1.5 bg-neutral-50 max-h-32 overflow-y-auto">
                {selected.body}
              </p>
            </div>
          )}

          {/* Error feedback */}
          {feedback && (
            <p aria-live="polite" className="text-xs text-red-600 mb-3">
              {feedback}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded border border-admin-line hover:bg-neutral-50 transition-colors"
              >
                Anuluj
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || !templateId}
              className="px-3 py-1.5 text-sm rounded bg-acid text-paper hover:bg-acid/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? "Wysyłanie…" : "Wyślij"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
