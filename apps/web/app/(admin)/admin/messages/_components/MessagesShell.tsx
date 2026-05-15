"use client";

// MessagesShell — 3-col grid: thread list (320px) | main (1fr) | client profile (280px).
// MessagesHeader removed in 9-30; topbar title set via usePageHeader through
// MessagesPageHeaderSetter (server component in page.tsx).
// < 70 LOC per granulate directive.

import { useState } from "react";
import { ThreadList } from "./ThreadList";
import { SelectedThread } from "./SelectedThread";
import { ClientMiniProfile } from "./ClientMiniProfile";
import { EmptyState } from "./EmptyState";
import { NewMessageDialog } from "./NewMessageDialog";
import { useThreadSelection } from "./useThreadSelection";
import type { MessageThreadDto } from "@/lib/messaging/types";

interface Props {
  initialThreadId: string | null;
}

/**
 * Top-level client shell for the messages page.
 * 3-col grid: ThreadList (left) | SelectedThread (centre) | ClientMiniProfile (right).
 * usePageHeader is called via MessagesPageHeaderSetter (server component) for the topbar.
 */
export function MessagesShell({ initialThreadId }: Props) {
  const sel = useThreadSelection(initialThreadId);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  // Lifted from SelectedThread via onLoaded; drives the right-rail ClientMiniProfile.
  const [loadedThread, setLoadedThread] = useState<MessageThreadDto | null>(null);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 grid grid-cols-admin-msg-3 overflow-hidden border-t-2 border-ink">
        {/* LEFT: thread list with search + filter chips + channel chips */}
        <ThreadList
          selectedId={sel.selectedId}
          filter={sel.filter}
          channel={sel.channel}
          q={sel.q}
          onSelect={sel.setSelectedId}
          onFilterChange={sel.setFilter}
          onChannelChange={sel.setChannel}
          onQChange={sel.setQ}
        />

        {/* CENTRE: active thread or empty state */}
        <main className="flex flex-col min-w-0 overflow-hidden" style={{ background: "var(--paper-2, #ebe4d4)" }}>
          {!sel.selectedId && <EmptyState variant="no-selection" />}
          {sel.selectedId && (
            <SelectedThread
              threadId={sel.selectedId}
              onLoaded={setLoadedThread}
              onResolved={() => sel.setSelectedId(null)}
            />
          )}
        </main>

        {/* RIGHT: client mini-profile (empty panel when no thread selected) */}
        <ClientMiniProfile clientId={loadedThread?.clientId ?? null} />
      </div>
      <NewMessageDialog
        open={newMsgOpen}
        onOpenChange={setNewMsgOpen}
        onSent={(threadId) => sel.setSelectedId(threadId)}
      />
    </div>
  );
}
