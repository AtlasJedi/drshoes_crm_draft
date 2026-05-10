"use client";

import { useState } from "react";
import { MessagesHeader } from "./MessagesHeader";
import { ThreadList } from "./ThreadList";
import { SelectedThread } from "./SelectedThread";
import { useThreadSelection } from "./useThreadSelection";

interface Props {
  initialThreadId: string | null;
}

/**
 * Top-level client shell for the messages page.
 * Composes: MessagesHeader, ThreadList (sidebar), and SelectedThread in the main area.
 * NewMessageDialog will be wired in task 5-18.
 */
export function MessagesShell({ initialThreadId }: Props) {
  const sel = useThreadSelection(initialThreadId);
  // newMsgOpen state is kept here so MessagesHeader can trigger it;
  // actual dialog is wired in task 5-18.
  const [newMsgOpen, setNewMsgOpen] = useState(false);

  // suppress unused warning until task 5-18 wires the dialog
  void newMsgOpen;

  return (
    <div className="flex flex-col h-screen bg-paper">
      <MessagesHeader onNewMessage={() => setNewMsgOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <ThreadList
          selectedId={sel.selectedId}
          filter={sel.filter}
          channel={sel.channel}
          q={sel.q}
          onSelect={sel.setSelectedId}
          onFilterChange={sel.setFilter}
          onQChange={sel.setQ}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!sel.selectedId && (
            <div className="flex-1 flex items-center justify-center text-[13px] text-admin-mute">
              Wybierz wątek, aby zobaczyć wiadomości
            </div>
          )}
          {sel.selectedId && (
            <SelectedThread
              threadId={sel.selectedId}
              onLoaded={() => { /* sidebar refresh handled by ThreadList polling */ }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
