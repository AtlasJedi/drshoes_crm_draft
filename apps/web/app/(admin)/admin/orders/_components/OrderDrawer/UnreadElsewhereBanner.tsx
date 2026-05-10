import Link from "next/link";
import type { Route } from "next";

interface Props {
  count: number;
  threadId: string;
}

function pluralUnread(n: number): string {
  if (n === 1) return "Klient ma 1 nieprzeczytaną wiadomość";
  if (n >= 2 && n <= 4) return `Klient ma ${n} nieprzeczytane wiadomości`;
  return `Klient ma ${n} nieprzeczytanych wiadomości`;
}

/**
 * Amber banner linking to the client's unread thread on /admin/messages.
 * Rendered at the top of OrderDrawerMessages when client has unread elsewhere.
 * ~32 LOC.
 */
export function UnreadElsewhereBanner({ count, threadId }: Props) {
  return (
    <Link
      href={`/admin/messages?thread=${threadId}` as Route}
      className="group flex items-center gap-3 mb-4 px-3.5 py-2.5 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors"
    >
      <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-200 text-amber-900">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <path d="m22 6-10 7L2 6" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-amber-900 leading-tight">
          {pluralUnread(count)}
        </div>
        <div className="text-[11.5px] text-amber-800/80 mt-0.5 leading-tight">
          na innym wątku — niezwiązanym z tym zleceniem
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-amber-900 group-hover:text-amber-950">
        Otwórz wątek
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
