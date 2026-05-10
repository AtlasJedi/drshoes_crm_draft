"use client";

import { useEffect, useState } from "react";
import { createLogger } from "@/lib/log";
import { listThreads } from "@/lib/messaging/api";

const log = createLogger("messaging.unread");
const POLL_MS = 30_000;

/**
 * Polls GET /api/admin/threads?filter=UNREAD every 30 s.
 * Returns total unread count across all unread threads.
 * Uses race-cancel guard to prevent stale updates after unmount.
 * ~40 LOC.
 */
export function useUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const threads = await listThreads("UNREAD");
        if (!cancelled) {
          const total = threads.reduce((sum, t) => sum + t.unreadCount, 0);
          setCount(total);
          log.debug("op=unreadCount.poll outcome=ok", { total });
        }
      } catch (e) {
        if (!cancelled) {
          log.warn("op=unreadCount.poll outcome=error", { err: String(e) });
        }
      }
    }

    void fetch();
    const id = setInterval(() => { void fetch(); }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return count;
}
