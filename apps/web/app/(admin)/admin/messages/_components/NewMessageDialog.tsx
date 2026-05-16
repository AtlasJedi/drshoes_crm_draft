"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { createLogger } from "@/lib/log";
import { sendNewToClient } from "@/lib/messaging/api";
import { ClientPicker } from "@/components/clients/ClientPicker";
import type { ClientDto } from "@/lib/clients/types";
import type { Channel } from "@/lib/messaging/types";

const log = createLogger("messaging.newmsg");
const SMS_MAX = 160;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent: (threadId: string) => void;
}

/**
 * "Nowa wiadomość" cross-thread composer. Radix Dialog wrapping ClientPicker
 * + channel selector + body textarea + Send.
 * Subject input removed for EMAIL — backend pins subject via followup template (v2-E).
 * On success: closes dialog, calls onSent(threadId) to select new/found thread.
 */
export function NewMessageDialog({ open, onOpenChange, onSent }: Props) {
  const [client, setClient] = useState<ClientDto | null>(null);
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setClient(null);
      setChannel("EMAIL");
      setBody("");
      setError(null);
    }
  }, [open]);

  const hasEmail = !!client?.email;
  const hasPhone = !!client?.phone;
  const effectiveChannel: Channel = channel === "EMAIL" && !hasEmail && hasPhone ? "SMS" : channel;

  async function handleSend() {
    if (!client || !body.trim() || sending) return;
    log.info("op=sendNewToClient", { clientId: client.id, channel: effectiveChannel });
    setSending(true);
    setError(null);
    try {
      const result = await sendNewToClient(client.id, {
        channel: effectiveChannel,
        body,
      });
      onSent(result.threadId);
      onOpenChange(false);
    } catch (err) {
      log.error("op=sendNewToClient outcome=error", { clientId: client.id, err: String(err) });
      setError("Nie udało się wysłać. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-xl p-6 w-[500px] space-y-4">
          <Dialog.Title className="text-[16px] font-semibold">Nowa wiadomość</Dialog.Title>

          <div className="space-y-1">
            <label className="text-[12px] text-admin-mute uppercase">Klient</label>
            <ClientPicker value={client} onChange={setClient} />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] text-admin-mute uppercase">Kanał</label>
            <div className="flex bg-paper border border-admin-line rounded-md p-0.5 w-fit">
              {(["EMAIL", "SMS"] as Channel[]).map(ch => (
                <button key={ch} onClick={() => setChannel(ch)}
                  disabled={ch === "EMAIL" ? !hasEmail : !hasPhone}
                  className={"px-3 h-7 text-[12px] font-medium rounded disabled:opacity-40 disabled:cursor-not-allowed " + (effectiveChannel === ch ? "bg-white shadow-sm text-ink" : "text-admin-mute hover:text-ink")}>
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] text-admin-mute uppercase">Treść</label>
            <div className="relative">
              <textarea rows={4} value={body} onChange={e => setBody(e.target.value)}
                placeholder={effectiveChannel === "EMAIL" ? "Treść wiadomości…" : "Treść SMS (max 160 znaków)…"}
                className="w-full px-3 py-2.5 rounded-md border border-admin-line text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-acid/60"
              />
              {effectiveChannel === "SMS" && (
                <div className={"absolute bottom-2 right-3 text-[11px] " + (body.length > SMS_MAX ? "text-red-600" : "text-admin-mute")}>
                  {body.length} / {SMS_MAX}
                </div>
              )}
            </div>
          </div>

          {error && <div className="text-[12px] text-red-700">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => onOpenChange(false)} className="h-9 px-4 rounded-md border border-admin-line text-[13px] hover:bg-admin-hover">
              Anuluj
            </button>
            <button onClick={handleSend} disabled={!client || !body.trim() || sending}
              className="h-9 px-4 rounded-md bg-acid text-ink text-[13px] font-semibold border border-ink/10 disabled:opacity-50 disabled:cursor-not-allowed">
              {sending ? "Wysyłanie…" : "Wyślij"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
