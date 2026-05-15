/**
 * Dashboard lower-middle: top-4 most recent message threads.
 * Circular initial avatar, channel chip (t-mono ink/paper border), pink unread dot.
 * Server component with inline try/catch error isolation.
 * ~75 LOC.
 */
import Link from "next/link";
import { AdminCard } from "@drshoes/ui";
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
    <AdminCard padding={22}>
      <div className="t-display text-[22px] mb-[14px]">Ostatnie wiadomości</div>

      {fetchError && <ErrorBanner message="Nie udało się załadować danych." />}
      {!fetchError && threads?.length === 0 && (
        <EmptyState message="Brak nowych wiadomości" />
      )}

      {!fetchError && threads && threads.length > 0 && (
        <div className="flex flex-col gap-3">
          {threads.map((t) => {
            const name = t.clientName ?? t.rawSender ?? "?";
            const initial = name[0] ?? "?";
            return (
              <Link
                key={t.id}
                href={`/admin/messages?thread=${t.id}`}
                className="flex gap-[10px] items-start hover:bg-[var(--paper-2)] transition-colors rounded-sm"
              >
                {/* Circular initial avatar */}
                <div
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--paper-2)", border: "1.5px solid var(--ink)",
                    fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11,
                  }}
                  className="shrink-0 flex items-center justify-center"
                >
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-semibold">{name}</span>
                    <span className="t-mono text-[10px] text-admin-mute shrink-0 ml-2">
                      {t.lastMessageAt
                        ? new Date(t.lastMessageAt).toLocaleTimeString("pl-PL", {
                            hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw",
                          })
                        : ""}
                    </span>
                  </div>
                  <div className="text-[12px] text-admin-mute truncate">
                    {t.lastMessagePreview ?? ""}
                  </div>
                  {/* Channel chip: t-mono ink bg paper border-ink */}
                  <span className="t-mono text-[9px] bg-[var(--ink)] text-[var(--paper)] border border-[var(--ink)] px-1.5 py-0.5 inline-block mt-1">
                    {t.channel}
                  </span>
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
    </AdminCard>
  );
}
