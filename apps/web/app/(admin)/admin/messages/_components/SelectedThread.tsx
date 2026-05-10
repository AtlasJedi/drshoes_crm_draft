"use client";

import { useEffect, useRef } from "react";
import type { MessageThreadDto } from "@/lib/messaging/types";
import { ThreadHeader } from "./ThreadHeader";
import { MessageBubble } from "./MessageBubble";
import { ReplyComposer } from "./ReplyComposer";
import { UnmatchedThreadPanel } from "./UnmatchedThreadPanel";
import { useThreadPoller } from "./useThreadPoller";

interface Props {
  threadId: string;
  onLoaded: (t: MessageThreadDto) => void;
  /** Called after assign/discard resolves an unmatched thread; shell resets selection. */
  onResolved: () => void;
}

/** Renders the selected thread with 10s polling (poller hook) + scroll-to-bottom on new messages. */
export function SelectedThread({ threadId, onLoaded, onResolved }: Props) {
  const { detail, loading, refetch } = useThreadPoller(threadId, onLoaded);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages?.length]);

  if (loading && !detail) {
    return <div className="flex-1 flex items-center justify-center text-admin-mute text-[13px]">Ładowanie…</div>;
  }
  if (!detail) return null;

  // Unmatched threads get the resolution panel instead of the normal composer flow.
  if (detail.thread.unmatched) {
    return <UnmatchedThreadPanel detail={detail} onResolved={onResolved} />;
  }

  const msgs = detail.messages ?? [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <ThreadHeader thread={detail.thread} onReadMarked={refetch} />
      <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
        {msgs.map(m => (
          <MessageBubble
            key={m.id}
            message={m}
            clientName={detail.thread.clientName}
            onRetried={refetch}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <ReplyComposer thread={detail.thread} onSent={refetch} />
    </div>
  );
}
