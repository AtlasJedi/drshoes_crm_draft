/**
 * Server Component.
 * Two-column preview grid: recent orders + recent threads.
 * Used by the client overview tab page.
 * ~70 LOC.
 */
import { AdminCard } from "@drshoes/ui";
import { STATUS_LABELS_PL, STATUS_PILL_CLASS } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";

interface OrderPreview {
  id: string;
  code: string;
  status: string;
  plannedPickupAt: string | null;
}

interface ThreadPreview {
  id: string;
  channel: string;
  lastMessagePreview: string | null;
  unreadCount: number;
}

interface Props {
  recentOrders: OrderPreview[];
  recentThreads: ThreadPreview[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  });
}

export function ClientPreviewCards({ recentOrders, recentThreads }: Props) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <AdminCard className="p-5">
        <h2 className="t-mono text-[11px] uppercase text-admin-mute mb-4">
          Ostatnie zlecenia (5)
        </h2>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-admin-mute py-4 text-center">Brak zleceń</p>
        ) : (
          <ul className="divide-y divide-admin-line">
            {recentOrders.map((o) => (
              <li key={o.id} className="py-2.5 flex items-center gap-3">
                <span className="font-mono text-[13px] text-admin-mute w-24 shrink-0">
                  {o.code}
                </span>
                <span className={`inline-block px-3 py-1 rounded-md text-[12px] font-semibold uppercase tracking-wide ${STATUS_PILL_CLASS[o.status as OrderStatus]}`}>
                  {STATUS_LABELS_PL[o.status as OrderStatus]}
                </span>
                <span className="ml-auto text-sm text-admin-mute">{fmtDate(o.plannedPickupAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard className="p-5">
        <h2 className="t-mono text-[11px] uppercase text-admin-mute mb-4">
          Ostatnie wątki (3)
        </h2>
        {recentThreads.length === 0 ? (
          <p className="text-sm text-admin-mute py-4 text-center">Brak wątków</p>
        ) : (
          <ul className="divide-y divide-admin-line">
            {recentThreads.map((t) => {
              const channelCls = t.channel === "EMAIL"
                ? "bg-blue/10 text-blue border-blue/20"
                : "bg-violet-50 text-violet-700 border-violet-200";
              return (
                <li key={t.id} className="py-2.5 flex items-center gap-3">
                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border shrink-0 ${channelCls}`}>
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
      </AdminCard>
    </div>
  );
}
