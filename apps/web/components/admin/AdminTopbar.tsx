"use client";

/**
 * AdminTopbar — page title + global search + bell.
 * Title/subtitle pulled from PageHeaderContext (set per-page via usePageHeader).
 * Search submits on Enter → /admin/orders?q=… (matches order code, description, client first/last name).
 * Bell dot lights up when useUnreadCount() > 0.
 */
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { usePageHeaderContext } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { useUnreadCount } from "@/lib/messaging/useUnreadCount";
import { createLogger } from "@/lib/log";

const log = createLogger("admin.topbar");

export function AdminTopbar() {
  const { current } = usePageHeaderContext();
  const unread = useUnreadCount();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(urlQ);

  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  function submitSearch() {
    const trimmed = q.trim();
    const target = trimmed
      ? `/admin/orders?q=${encodeURIComponent(trimmed)}`
      : "/admin/orders";
    log.info("op=AdminTopbar.search", { q: trimmed });
    router.push(target as Route);
  }

  log.debug("op=AdminTopbar.render", { title: current?.title, unread });

  return (
    <header className="flex items-center px-7 py-4 bg-paper border-b-2 border-ink gap-4">
      {/* Left: title + subtitle */}
      <div className="flex-1 flex items-center gap-3">
        {current?.title && (
          <h1 className="t-display m-0" style={{ fontSize: 38 }}>
            {current.title}
          </h1>
        )}
        {current?.subtitle && (
          <span
            className="t-mono"
            style={{ fontSize: 12, opacity: 0.55, letterSpacing: ".05em" }}
          >
            {current.subtitle}
          </span>
        )}
      </div>

      {/* Right: search + bell + optional right slot */}
      <div className="flex items-center gap-3">
        {/* Search — placeholder only, M10 wires the handler */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-[1.5px] border-ink bg-white shadow-pop-sm"
          style={{ width: 280 }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-[rgba(0,0,0,0.45)]"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitSearch();
              }
            }}
            placeholder="Szukaj zlecenia, klienta…"
            className="border-0 outline-none bg-transparent flex-1 text-[13px]"
            style={{ fontFamily: "var(--font-body)" }}
            aria-label="Szukaj"
          />
          <span className="t-mono text-[10px] text-[rgba(0,0,0,0.4)] border border-[rgba(0,0,0,0.2)] px-[5px] py-[1px]">
            ⌘K
          </span>
        </div>

        {/* Bell */}
        <button className="btn-clean relative p-2" aria-label="Powiadomienia">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unread > 0 && (
            <span
              data-testid="bell-dot"
              className="absolute top-1 right-1 w-[6px] h-[6px] rounded-full bg-[var(--pink)]"
            />
          )}
        </button>

        {current?.right}
      </div>
    </header>
  );
}
