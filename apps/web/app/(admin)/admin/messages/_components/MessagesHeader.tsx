"use client";

import { useState, useEffect } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("messaging.header");

interface Props { onNewMessage: () => void }

export function MessagesHeader({ onNewMessage }: Props) {
  const [refreshTs, setRefreshTs] = useState<string>("");

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    setRefreshTs(fmt());
  }, []);

  function handleRefresh() {
    log.info("op=manualRefresh");
    setRefreshTs(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
    window.location.reload();
  }

  return (
    <div className="flex items-end justify-between border-b border-admin-line px-6 py-4 bg-white shrink-0">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight leading-none">Wiadomości</h1>
        {refreshTs && (
          <div className="text-[11px] text-admin-mute mt-1.5">odświeżono · {refreshTs} · live</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          className="h-8 px-3 text-[13px] inline-flex items-center gap-1.5 rounded-md border border-admin-line bg-white hover:bg-admin-hover"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>
          </svg>
          Odśwież
        </button>
        <button
          type="button"
          onClick={onNewMessage}
          className="h-8 px-3 text-[13px] font-semibold inline-flex items-center gap-1.5 rounded-md bg-ink text-paper hover:bg-ink/90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Nowa wiadomość
        </button>
      </div>
    </div>
  );
}
