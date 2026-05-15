/**
 * Full threads list filtered by clientId.
 * Server Component. No polling (RSC pattern) — snapshot at page load.
 * ThreadList CC is not reusable (holds poll + state); thread row rendering ported inline.
 * Spec §7.4.
 * ~70 LOC.
 */
import { notFound } from "next/navigation";
import { createLogger } from "@/lib/log";
import { getClientServer } from "@/lib/clients/api-server";
import { listThreadsForClientServer } from "@/lib/messaging/api-server";
import { ClientHeader } from "../_components/ClientHeader";

const log = createLogger("client-threads-page");

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientThreadsPage({ params }: Props) {
  const { id } = await params;
  log.info("op=render", { clientId: id });

  let client, threads;
  try {
    [client, threads] = await Promise.all([
      getClientServer(id),
      listThreadsForClientServer(id),
    ]);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404) { notFound(); }
    log.error("op=render outcome=error", { clientId: id, err: String(err) });
    throw err;
  }

  return (
    <div>
      <ClientHeader client={client} />

      {threads.length === 0 ? (
        <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
          Brak wątków wiadomości dla tego klienta.
        </div>
      ) : (
        <div className="border border-admin-line rounded divide-y divide-admin-line">
          {threads.map((t) => {
            const isUnread = t.unreadCount > 0;
            const channelCls = t.channel === "EMAIL"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-violet-50 text-violet-700 border-violet-200";
            const lastAt = t.lastMessageAt
              ? new Date(t.lastMessageAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" })
              : "—";

            return (
              <div key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-acid/5 transition-colors">
                <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border shrink-0 ${channelCls}`}>
                  {t.channel}
                </span>
                <span className={`flex-1 text-sm truncate ${isUnread ? "font-semibold text-admin-ink" : "text-admin-mute"}`}>
                  {t.lastMessagePreview ?? "—"}
                </span>
                <span className="text-xs text-admin-mute shrink-0">{lastAt}</span>
                {isUnread && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-acid text-ink text-[10px] font-bold shrink-0">
                    {t.unreadCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
