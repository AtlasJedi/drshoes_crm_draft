"use client";

import { useState, useEffect, useRef } from "react";
import { createLogger } from "@/lib/log";
import { listThreads } from "@/lib/messaging/api";
import type { MessageThreadDto, ThreadFilter, Channel } from "@/lib/messaging/types";
import { ThreadListRow } from "./ThreadListRow";
import { FilterChip } from "./FilterChip";
import { ThreadListSkeleton } from "./ThreadListSkeleton";

const log = createLogger("messaging.threadlist");
const POLL_MS = 30_000;

interface Props {
  selectedId: string | null;
  filter: ThreadFilter;
  channel: Channel | null;
  q: string;
  onSelect: (id: string) => void;
  onFilterChange: (f: ThreadFilter) => void;
  onQChange: (q: string) => void;
}

export function ThreadList({ selectedId, filter, channel, q, onSelect, onFilterChange, onQChange }: Props) {
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
  const unmatchedCount = threads.filter((t) => t.unmatched).length;
  const empty = !loading && threads.length === 0;

  return (
    <aside className="w-[380px] shrink-0 border-r border-admin-line bg-white flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-admin-line">
        <div className="relative mb-3">
          <input type="text" value={q} onChange={(e) => onQChange(e.target.value)}
            placeholder="Szukaj klienta, treści, numeru…"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-admin-line bg-paper text-[13px] focus:outline-none focus:ring-2 focus:ring-acid/60 focus:border-ink/40" />
          <svg className="absolute left-3 top-2.5 text-admin-mute" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filter === "ALL"} label="Wszystkie" count={threads.length} onClick={() => onFilterChange("ALL")} />
          <FilterChip active={filter === "UNREAD"} label="Nieprzeczytane" count={unreadCount} onClick={() => onFilterChange("UNREAD")} />
          <FilterChip active={filter === "UNMATCHED"} label="Niesparowane" count={unmatchedCount} onClick={() => onFilterChange("UNMATCHED")} />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {loading && threads.length === 0 && <ThreadListSkeleton />}
        {empty && filter === "UNREAD" && <div className="flex items-center justify-center py-16 text-[13px] text-admin-mute">Brak nieprzeczytanych wiadomości</div>}
        {empty && filter !== "UNREAD" && <div className="flex items-center justify-center py-16 text-[13px] text-admin-mute">Brak wątków wiadomości</div>}
        {threads.map((t) => <ThreadListRow key={t.id} thread={t} selected={t.id === selectedId} onSelect={onSelect} />)}
      </div>
    </aside>
  );
}
