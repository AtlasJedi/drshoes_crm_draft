"use client";

/**
 * AdminTopbar — page title + global search.
 * Title/subtitle pulled from PageHeaderContext (set per-page via usePageHeader).
 * Search:
 *   - On /admin/orders (and its sub-tabs): debounced 250ms live filter via
 *     router.replace, preserving other URL params. useEffect sync from URL is
 *     guarded by a "lastSentQ" ref to prevent clobbering mid-type input.
 *   - On any other page: Enter → push to /admin/orders?q=…
 */
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { usePageHeaderContext } from "@/app/(admin)/admin/_components/PageHeaderContext";
import { createLogger } from "@/lib/log";

const log = createLogger("admin.topbar");

export function AdminTopbar() {
  const { current } = usePageHeaderContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  // Tracks the last q value we synced FROM the URL so we don't clobber mid-type input.
  const lastSentQ = useRef(urlQ);

  const isOrdersPage = pathname.startsWith("/admin/orders");

  // Sync input from URL only when the URL changes externally (e.g. browser back).
  // Guard: skip if we were the ones who caused this URL change.
  useEffect(() => {
    if (urlQ !== lastSentQ.current) {
      setQ(urlQ);
      lastSentQ.current = urlQ;
    }
  }, [urlQ]);

  // Debounced live filter when on the orders page.
  useEffect(() => {
    if (!isOrdersPage) return;
    const timer = setTimeout(() => {
      const trimmed = q.trim();
      if (trimmed === lastSentQ.current) return; // no change
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      // Reset to page 0 on new search.
      params.delete("page");
      lastSentQ.current = trimmed;
      log.info("op=AdminTopbar.liveSearch", { q: trimmed });
      router.replace(`/admin/orders?${params.toString()}` as Route);
    }, 250);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, isOrdersPage]);

  function submitSearch() {
    const trimmed = q.trim();
    if (isOrdersPage) {
      // On orders page, Enter triggers immediately (skip debounce).
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      params.delete("page");
      lastSentQ.current = trimmed;
      log.info("op=AdminTopbar.search", { q: trimmed });
      router.replace(`/admin/orders?${params.toString()}` as Route);
    } else {
      const target = trimmed
        ? `/admin/orders?q=${encodeURIComponent(trimmed)}`
        : "/admin/orders";
      log.info("op=AdminTopbar.search", { q: trimmed });
      router.push(target as Route);
    }
  }

  log.debug("op=AdminTopbar.render", { title: current?.title });

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

        {current?.right}
      </div>
    </header>
  );
}
