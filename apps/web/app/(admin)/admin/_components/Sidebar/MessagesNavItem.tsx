"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { createLogger } from "@/lib/log";
import { useUnreadCount } from "@/lib/messaging/useUnreadCount";

const log = createLogger("messaging.nav");

/**
 * Sidebar nav item for /admin/messages.
 * Shows an unread count badge (capped at 99+).
 * Polls via useUnreadCount (30s cadence).
 * ~35 LOC.
 */
export function MessagesNavItem() {
  const pathname = usePathname();
  const active   = pathname.startsWith("/admin/messages");
  const unread   = useUnreadCount();
  const fmt      = unread > 99 ? "99+" : String(unread);

  log.debug("op=MessagesNavItem.render", { unread, active });

  return (
    <Link
      href={"/admin/messages" as Route}
      className={
        "group flex items-center gap-2.5 px-3 h-9 rounded-md text-[13.5px] font-medium transition-colors " +
        (active
          ? "bg-white/10 text-paper"
          : "text-paper/75 hover:bg-white/5 hover:text-paper")
      }
    >
      <svg
        width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="flex-1">Wiadomości</span>
      {unread > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10.5px] font-bold leading-none">
          {fmt}
        </span>
      )}
    </Link>
  );
}
