/**
 * Client overview tab — /admin/clients/[id]
 * Server Component. Parallel fetches: client, summary, recent orders, recent threads.
 * Renders: ClientHeader + ClientSummaryTiles + recent-orders card + recent-threads card.
 * Spec §7.2.
 * ~75 LOC.
 */
import { notFound } from "next/navigation";
import { createLogger } from "@/lib/log";
import {
  getClientServer,
  getClientSummaryServer,
  listOrdersServer as listClientOrders,
} from "@/lib/clients/api-server";
import { listThreadsForClientServer } from "@/lib/messaging/api-server";
import { ClientHeader } from "./_components/ClientHeader";
import { ClientSummaryTiles } from "./_components/ClientSummaryTiles";
import { STATUS_LABELS_PL, STATUS_PILL_CLASS } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";

const log = createLogger("client-overview-page");

interface Props {
  params: Promise<{ id: string }>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function ClientOverviewPage({ params }: Props) {
  const { id } = await params;
  log.info("op=render", { clientId: id });

  let results;
  try {
    results = await Promise.all([
      getClientServer(id),
      getClientSummaryServer(id),
      listClientOrders({ clientId: id, size: 5, page: 0 }),
      listThreadsForClientServer(id),
    ]);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      notFound();
    }
    log.error("op=render outcome=error", { clientId: id, err: String(err) });
    throw err;
  }

  const [client, summary, ordersPage, threads] = results;
  const recentOrders = ordersPage.content.slice(0, 5);
  const recentThreads = threads.slice(0, 3);

  return (
    <div>
      <ClientHeader client={client} />
      <ClientSummaryTiles summary={summary} />

      <div className="grid grid-cols-2 gap-6">
        {/* Recent orders preview */}
        <div className="admin-card p-5">
          <h2 className="t-mono text-[11px] uppercase text-admin-mute mb-4">
            Ostatnie zlecenia (5)
          </h2>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-admin-mute py-4 text-center">Brak zleceń</p>
          ) : (
            <ul className="divide-y divide-admin-line">
              {recentOrders.map((o) => (
                <li key={o.id} className="py-2.5 flex items-center gap-3">
                  <span className="font-mono text-xs text-admin-mute w-24 shrink-0">
                    {o.code}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_PILL_CLASS[o.status as OrderStatus]}`}
                  >
                    {STATUS_LABELS_PL[o.status as OrderStatus]}
                  </span>
                  <span className="ml-auto text-xs text-admin-mute">
                    {fmtDate(o.plannedPickupAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent threads preview */}
        <div className="admin-card p-5">
          <h2 className="t-mono text-[11px] uppercase text-admin-mute mb-4">
            Ostatnie wątki (3)
          </h2>
          {recentThreads.length === 0 ? (
            <p className="text-sm text-admin-mute py-4 text-center">Brak wątków</p>
          ) : (
            <ul className="divide-y divide-admin-line">
              {recentThreads.map((t) => {
                const channelCls =
                  t.channel === "EMAIL"
                    ? "bg-blue/10 text-blue border-blue/20"
                    : "bg-violet-50 text-violet-700 border-violet-200";
                return (
                  <li key={t.id} className="py-2.5 flex items-center gap-3">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border shrink-0 ${channelCls}`}
                    >
                      {t.channel}
                    </span>
                    <span className="text-sm text-admin-ink truncate flex-1">
                      {t.lastMessagePreview ?? "—"}
                    </span>
                    {t.unreadCount > 0 && (
                      <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-acid text-ink text-[10px] font-bold">
                        {t.unreadCount}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
