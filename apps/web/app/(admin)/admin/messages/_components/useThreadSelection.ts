"use client";

import { useState, useCallback } from "react";
import { createLogger } from "@/lib/log";
import type { ThreadFilter, Channel } from "@/lib/messaging/types";

const log = createLogger("messaging.selection");

export type { ThreadFilter };

export interface ThreadSelectionState {
  selectedId: string | null;
  filter: ThreadFilter;
  channel: Channel | null;
  q: string;
  setSelectedId: (id: string | null) => void;
  setFilter: (f: ThreadFilter) => void;
  setChannel: (c: Channel | null) => void;
  setQ: (q: string) => void;
}

export function useThreadSelection(
  initialThreadId: string | null,
): ThreadSelectionState {
  const [selectedId, setSelectedIdRaw] = useState<string | null>(initialThreadId);
  const [filter, setFilter] = useState<ThreadFilter>("ALL");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [q, setQ] = useState("");

  const setSelectedId = useCallback((id: string | null) => {
    log.info("op=selectThread", { threadId: id });
    setSelectedIdRaw(id);
  }, []);

  return { selectedId, filter, channel, q, setSelectedId, setFilter, setChannel, setQ };
}
