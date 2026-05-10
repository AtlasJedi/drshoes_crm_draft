"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { createLogger } from "@/lib/log";
import { assignUnmatched } from "@/lib/messaging/api";
import { ClientPicker } from "@/components/clients/ClientPicker";
import type { ClientDto } from "@/lib/clients/types";

const log = createLogger("messaging.assign-dialog");

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  threadId: string;
  onAssigned: () => void;
}

/**
 * Radix Dialog wrapping ClientPicker for assigning an unmatched thread to an existing client.
 * ~50 LOC.
 */
export function AssignUnmatchedDialog({ open, onOpenChange, threadId, onAssigned }: Props) {
  const [client, setClient] = useState<ClientDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!client) return;
    log.info("op=assignUnmatched", { threadId, clientId: client.id });
    setSaving(true);
    setError(null);
    try {
      await assignUnmatched(threadId, client.id);
      onAssigned();
      onOpenChange(false);
    } catch (err) {
      log.error("op=assignUnmatched outcome=error", { threadId, clientId: client.id, err: String(err) });
      setError("Nie udało się przypisać. Spróbuj ponownie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-xl p-6 w-[420px] space-y-4">
          <Dialog.Title className="text-[16px] font-semibold">Przypisz do klienta</Dialog.Title>
          <Dialog.Description className="text-[13px] text-admin-mute">
            Wybierz istniejącego klienta. Wszystkie wiadomości z tego wątku zostaną do niego przypisane.
          </Dialog.Description>
          <ClientPicker value={client} onChange={setClient} />
          {error && <div className="text-[12px] text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-md border border-admin-line text-[13px] hover:bg-admin-hover"
            >
              Anuluj
            </button>
            <button
              onClick={handleConfirm}
              disabled={!client || saving}
              className="h-9 px-4 rounded-md bg-ink text-paper text-[13px] font-semibold disabled:opacity-50"
            >
              {saving ? "Przypisuję…" : "Przypisz"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
