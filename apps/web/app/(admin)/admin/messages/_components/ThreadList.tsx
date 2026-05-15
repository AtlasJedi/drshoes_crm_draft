"use client";

// ThreadList — 320px left sidebar: search + filter chips + channel chips + rows.
// Design parity per 9-30: border-r-2 border-ink, Chip primitives, graffiti search box.
// < 80 LOC per granulate directive.

import { useState, useEffect, useRef } from "react";
import { createLogger } from "@/lib/log";
import { listThreads } from "@/lib/messaging/api";
import type { MessageThreadDto, ThreadFilter, Channel } from "@/lib/messaging/types";
import { ThreadListRow } from "./ThreadListRow";
import { ThreadListSkeleton } from "./ThreadListSkeleton";
import { Chip } from "@repo/ui";
import { I } from "@repo/ui";

const log = createLogger("messaging.threadlist");
const POLL_MS = 30_000;
const CHANNELS: Channel[] = ["WHATSAPP", "EMAIL", "SMS"];

interface Props {
  selectedId: string | null;
  filter: ThreadFilter;
  channel: Channel | null;
  q: string;
  onSelect: (id: string) => void;
  onFilterChange: (f: ThreadFilter) => void;
  onChannelChange: (ch: Channel | null) => void;
  onQChange: (q: string) => void;
}

export function ThreadList({ selectedId, filter, channel, q, onSelect, onFilterChange, onChannelChange, onQChange }: Props) {
  const [threads, setThreads] = useState<MessageThreadDto[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listThreads(filter, channel ?? undefined, q);
        if (!cancelled) setThreads(data);
      } catch (err) {
        log.error("op=listThreads outcome=error", { err: String(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => { cancelled = true; if (timerRef.current) clearInterval(timerRef.current); };
  }, [filter, channel, q]);

  const unreadCount = threads.filter((t) => t.unreadCount > 0).length;

  return (
    <aside className="shrink-0 border-r-2 border-ink flex flex-col bg-white overflow-hidden" style={{ width: 320 }}>
      <div className="px-3 pt-3 pb-2 border-b border-admin-line flex flex-col gap-2">
        {/* search box */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-[1.5px] border-ink">
          <span className="text-admin-mute shrink-0">{I.search}</span>
          <input
            type="text"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            aria-label="Szukaj wątków"
            placeholder="Szukaj…"
            style={{ border: 0, outline: 0, flex: 1, fontFamily: "var(--font-body)", fontSize: 12 }}
          />
        </div>
        {/* filter chips row 1 */}
        <div className="flex gap-1.5 flex-wrap">
          <Chip active={filter === "UNREAD"} onClick={() => onFilterChange("UNREAD")}>
            nieprzeczytane ({unreadCount})
          </Chip>
          {/* wymaga odp. — TODO: map to NEEDS_REPLY when backend adds filter param */}
          <Chip active={false} onClick={() => onFilterChange("ALL")}>wymaga odp.</Chip>
          <Chip active={filter === "ALL"} onClick={() => onFilterChange("ALL")}>wszystkie</Chip>
        </div>
        {/* channel chips row 2 */}
        <div className="flex gap-1.5">
          {CHANNELS.map((ch) => (
            <Chip key={ch} active={channel === ch} onClick={() => onChannelChange(channel === ch ? null : ch)}>
              {ch === "WHATSAPP" ? "WhatsApp" : ch}
            </Chip>
          ))}
          <Chip active={false} onClick={() => {}}>IG</Chip>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {loading && threads.length === 0 && <ThreadListSkeleton />}
        {!loading && threads.length === 0 && (
          <div className="flex items-center justify-center py-16 t-mono text-[12px] text-admin-mute">
            Brak wiadomości
          </div>
        )}
        {threads.map((t) => (
          <ThreadListRow key={t.id} thread={t} selected={t.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    </aside>
  );
}
