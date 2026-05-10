"use client";

import { useState } from "react";
import { MessagesHeader } from "./MessagesHeader";
import { ThreadList } from "./ThreadList";
import { SelectedThread } from "./SelectedThread";
import { ThreadClientPanel } from "./ThreadClientPanel";
import { EmptyState } from "./EmptyState";
import { NewMessageDialog } from "./NewMessageDialog";
import { useThreadSelection } from "./useThreadSelection";
import type { MessageThreadDto } from "@/lib/messaging/types";

interface Props {
  initialThreadId: string | null;
}

/**
 * Top-level client shell for the messages page.
 * Composes: MessagesHeader, ThreadList (sidebar), SelectedThread (main column),
 * ThreadClientPanel (right rail — task 5-18), and NewMessageDialog (task 5-20).
 */
export function MessagesShell({ initialThreadId }: Props) {
  const sel = useThreadSelection(initialThreadId);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  // Lifted from SelectedThread via onLoaded; drives the right-rail panel.
  const [loadedThread, setLoadedThread] = useState<MessageThreadDto | null>(null);

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
          {!sel.selectedId && <EmptyState variant="no-selection" />}
          {sel.selectedId && (
            <SelectedThread
              threadId={sel.selectedId}
              onLoaded={setLoadedThread}
              onResolved={() => sel.setSelectedId(null)}
            />
          )}
        </main>

        {/* Right rail: only for matched threads (clientId non-null) */}
        {sel.selectedId && loadedThread && loadedThread.clientId && (
          <ThreadClientPanel thread={loadedThread} />
        )}
      </div>
      <NewMessageDialog
        open={newMsgOpen}
        onOpenChange={setNewMsgOpen}
        onSent={(threadId) => sel.setSelectedId(threadId)}
      />
    </div>
  );
}
