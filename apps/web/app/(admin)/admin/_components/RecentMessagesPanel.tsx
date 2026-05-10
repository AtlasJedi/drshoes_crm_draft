/**
 * Dashboard lower-right panel: top-4 most recent message threads.
 * Layout: admin.jsx:176-200.
 * Server component with inline try/catch error isolation.
 * ~75 LOC.
 */
import Link from "next/link";
import { listThreadsServer } from "@/lib/messaging/api-server";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorBanner } from "@/components/state/ErrorBanner";
import type { MessageThreadDto } from "@/lib/messaging/types";

export async function RecentMessagesPanel() {
  let threads: MessageThreadDto[] | undefined;
  let fetchError = false;

  try {
    const all = await listThreadsServer("ALL");
    threads = all.slice(0, 4);
  } catch {
    fetchError = true;
  }

  return (
    <div className="admin-card p-[22px]">
      <div className="t-display text-[22px] mb-[14px]">Ostatnie wiadomości</div>

      {fetchError && (
        <ErrorBanner message="Nie udało się załadować danych." />
      )}

      {!fetchError && threads?.length === 0 && (
        <EmptyState message="Brak nowych wiadomości" />
      )}

      {!fetchError && threads && threads.length > 0 && (
        <div className="flex flex-col gap-3">
          {threads.map((t) => {
            const initials = t.clientName ? t.clientName[0] : "?";
            return (
              <Link
                key={t.id}
                href={`/admin/messages?thread=${t.id}`}
                className="flex gap-2.5 items-start hover:bg-[var(--paper-2)] transition-colors rounded-sm"
              >
                <div className="w-8 h-8 shrink-0 rounded-full bg-[var(--paper-2)] border-[1.5px] border-[var(--ink)] flex items-center justify-center text-[11px] font-mono font-bold">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-semibold">{t.clientName ?? t.rawSender ?? "—"}</span>
                    <span className="t-mono text-[10px] text-admin-mute shrink-0 ml-2">
                      {t.lastMessageAt
                        ? new Date(t.lastMessageAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </span>
                  </div>
                  <div className="text-[12px] text-admin-mute truncate">{t.lastMessagePreview ?? ""}</div>
                  <div className="t-mono text-[10px] text-admin-mute mt-0.5">{t.channel}</div>
                </div>
                {t.unreadCount > 0 && (
                  <span
                    data-testid="unread-dot"
                    className="shrink-0 w-2 h-2 rounded-full bg-[var(--pink)] mt-3"
                    aria-label="nieprzeczytane"
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
