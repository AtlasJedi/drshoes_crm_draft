"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { createLogger } from "@/lib/log";
import { discardUnmatched, assignUnmatched } from "@/lib/messaging/api";
import type { ThreadDetailDto } from "@/lib/messaging/types";
import type { ClientDto } from "@/lib/clients/types";
import { AssignUnmatchedDialog } from "./AssignUnmatchedDialog";
import { ClientCreateModal } from "@/components/clients/ClientCreateModal";

const log = createLogger("messaging.unmatched");

interface Props {
  detail: ThreadDetailDto;
  onResolved: () => void;
}

/**
 * Panel for unmatched inbound threads. Shows sender info, last message bubble, and three CTAs:
 * Assign (existing client via AssignUnmatchedDialog), Create new (ClientCreateModal + auto-assign),
 * Discard (regular Dialog substituting AlertDialog — @radix-ui/react-alert-dialog not installed).
 * Accepts detail: ThreadDetailDto per errata #2; derives lastMsg from detail.messages.
 * ~100 LOC (JSX-density-not-logic-density — two embedded dialogs).
 */
export function UnmatchedThreadPanel({ detail, onResolved }: Props) {
  const { thread } = detail;
  const [assignOpen, setAssignOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  // Messages come back ordered ASC per M3/M5 contract; last entry is the most recent.
  const lastMsg = detail.messages[detail.messages.length - 1];

  async function handleDiscard() {
    log.info("op=discardUnmatched", { threadId: thread.id });
    setDiscarding(true);
    try {
      await discardUnmatched(thread.id);
      setDiscardOpen(false);
      onResolved();
    } catch (err) {
      log.error("op=discardUnmatched outcome=error", { threadId: thread.id, err: String(err) });
    } finally {
      setDiscarding(false);
    }
  }

  async function handleCreateAndAssign(client: ClientDto) {
    log.info("op=createAndAssign", { threadId: thread.id, clientId: client.id });
    setCreateOpen(false);
    try {
      await assignUnmatched(thread.id, client.id);
      onResolved();
    } catch (err) {
      log.error("op=createAndAssign outcome=error", { threadId: thread.id, err: String(err) });
    }
  }

  return (
    <div className="flex-1 bg-paper flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-admin-line bg-white flex items-center gap-3 shrink-0">
        <div
          className="bg-pink-100 text-pink-700 ring-1 ring-pink-300 flex items-center justify-center rounded-full font-semibold shrink-0 text-[14px]"
          style={{ width: 40, height: 40 }}
        >
          ?
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] font-semibold text-pink-800">{thread.rawSender}</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-pink-50 text-pink-700 border border-pink-200">
              niesparowane
            </span>
          </div>
          <div className="text-[11px] text-admin-mute mt-1.5">
            {thread.channel} · otrzymane {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleDateString("pl-PL") : "—"}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-5 space-y-4 overflow-auto">
        {lastMsg && (
          <div className="bg-white border border-admin-line rounded-lg px-3.5 py-2.5 text-[14px] max-w-[78%]">
            {lastMsg.body}
          </div>
        )}
        <div className="rounded-md border border-pink-200 bg-pink-50 p-4">
          <div className="text-[13px] font-semibold text-pink-900 mb-1">
            Ten nadawca nie jest przypisany do żadnego klienta
          </div>
          <div className="text-[12px] text-pink-800/80 mb-3 leading-relaxed">
            Zanim odpowiesz, wybierz akcję — composer pojawi się dopiero po przypisaniu.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAssignOpen(true)}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-ink text-paper text-[12.5px] font-semibold hover:bg-ink/90"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              Przypisz do klienta
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-white border border-admin-line text-[12.5px] font-semibold hover:bg-admin-hover"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" />
              </svg>
              Utwórz nowego klienta
            </button>
            <button
              onClick={() => setDiscardOpen(true)}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-medium text-admin-mute hover:text-ink hover:bg-admin-hover"
            >
              Odrzuć
            </button>
          </div>
        </div>
      </div>

      {/* Assign existing client */}
      <AssignUnmatchedDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        threadId={thread.id}
        onAssigned={onResolved}
      />

      {/* Create new client then auto-assign */}
      <ClientCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreateAndAssign}
      />

      {/* Discard confirm — regular Dialog substituting AlertDialog (not installed) */}
      <Dialog.Root open={discardOpen} onOpenChange={setDiscardOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-xl p-6 w-[380px] space-y-4">
            <Dialog.Title className="text-[16px] font-semibold">Odrzucić wątek?</Dialog.Title>
            <Dialog.Description className="text-[13px] text-admin-mute">
              Wątek zostanie ukryty z listy. Tej operacji nie można cofnąć.
            </Dialog.Description>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDiscardOpen(false)}
                className="h-9 px-4 rounded-md border border-admin-line text-[13px] hover:bg-admin-hover"
              >
                Anuluj
              </button>
              <button
                onClick={handleDiscard}
                disabled={discarding}
                className="h-9 px-4 rounded-md bg-red-600 text-white text-[13px] font-semibold disabled:opacity-50"
              >
                {discarding ? "Odrzucam…" : "Odrzuć"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
