"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createLogger } from "@/lib/log";
import { getThread, markThreadRead } from "@/lib/messaging/api";
import type { MessageThreadDto, ThreadDetailDto } from "@/lib/messaging/types";
import { ThreadHeader } from "./ThreadHeader";
import { MessageBubble } from "./MessageBubble";
import { ReplyComposer } from "./ReplyComposer";

const log = createLogger("messaging.selectedthread");
const POLL_MS = 10_000;

interface Props {
  threadId: string;
  onLoaded: (t: MessageThreadDto) => void;
}

/** 10s polling + race-cancel guard. Calls markThreadRead on mount/threadId change. */
export function SelectedThread({ threadId, onLoaded }: Props) {
  const [detail, setDetail] = useState<ThreadDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (cancelled: { v: boolean }) => {
    try {
      const data = await getThread(threadId);
      if (cancelled.v) return;
      setDetail(data);
      onLoaded(data.thread);
    } catch (err) {
      log.error("op=getThread outcome=error", { threadId, err: String(err) });
    } finally {
      if (!cancelled.v) setLoading(false);
    }
  }, [threadId, onLoaded]);

  useEffect(() => {
    const cancelled = { v: false };
    setLoading(true);
    setDetail(null);

    // mark-read on selection; fire-and-forget
    markThreadRead(threadId).catch(err =>
      log.warn("op=markRead outcome=error", { threadId, err: String(err) })
    );

    load(cancelled);
    timerRef.current = setInterval(() => load(cancelled), POLL_MS);

    return () => {
      cancelled.v = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [threadId, load]);

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
      <ThreadHeader thread={detail.thread} onReadMarked={() => load({ v: false })} />
      <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
        {msgs.map(m => (
          <MessageBubble
            key={m.id}
            message={m}
            clientName={detail.thread.clientName}
            onRetried={() => load({ v: false })}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <ReplyComposer thread={detail.thread} onSent={() => load({ v: false })} />
    </div>
  );
}
