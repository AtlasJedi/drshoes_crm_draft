"use client";

import { useEffect, useRef } from "react";
import type { MessageThreadDto } from "@/lib/messaging/types";
import { ThreadHeader } from "./ThreadHeader";
import { MessageBubble } from "./MessageBubble";
import { ReplyComposer } from "./ReplyComposer";
import { useThreadPoller } from "./useThreadPoller";

interface Props {
  threadId: string;
  onLoaded: (t: MessageThreadDto) => void;
}

/** Renders the selected thread with 10s polling (poller hook) + scroll-to-bottom on new messages. */
export function SelectedThread({ threadId, onLoaded }: Props) {
  const { detail, loading, refetch } = useThreadPoller(threadId, onLoaded);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages?.length]);

  if (loading && !detail) {
    return <div className="flex-1 flex items-center justify-center text-admin-mute text-[13px]">Ładowanie…</div>;
  }
  if (!detail) return null;

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
