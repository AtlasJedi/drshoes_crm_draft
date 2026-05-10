"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createLogger } from "@/lib/log";
import { getThread, markThreadRead } from "@/lib/messaging/api";
import type { MessageThreadDto, ThreadDetailDto } from "@/lib/messaging/types";

const log = createLogger("messaging.threadpoller");
const POLL_MS = 10_000;

export interface ThreadPollerState {
  detail: ThreadDetailDto | null;
  loading: boolean;
  refetch: () => void;
}

/**
 * Polls /threads/{id} every 10s with race-cancel guard.
 * Marks thread as read on initial mount / threadId change (fire-and-forget).
 * Notifies caller via onLoaded after each successful fetch (e.g. for sidebar refresh hints).
 */
export function useThreadPoller(
  threadId: string,
  onLoaded: (t: MessageThreadDto) => void,
): ThreadPollerState {
  const [detail, setDetail] = useState<ThreadDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const cancelledRef = useRef<{ v: boolean }>({ v: false });

  const load = useCallback(async () => {
    try {
      const data = await getThread(threadId);
      if (cancelledRef.current.v) return;
      setDetail(data);
      onLoaded(data.thread);
    } catch (err) {
      log.error("op=getThread outcome=error", { threadId, err: String(err) });
    } finally {
      if (!cancelledRef.current.v) setLoading(false);
    }
  }, [threadId, onLoaded]);

  useEffect(() => {
    const cancelled = { v: false };
    cancelledRef.current = cancelled;
    setLoading(true);
    setDetail(null);

    markThreadRead(threadId).catch(err =>
      log.warn("op=markRead outcome=error", { threadId, err: String(err) })
    );

    load();
    const timer = setInterval(load, POLL_MS);
    return () => { cancelled.v = true; clearInterval(timer); };
  }, [threadId, load]);

  return { detail, loading, refetch: load };
}
