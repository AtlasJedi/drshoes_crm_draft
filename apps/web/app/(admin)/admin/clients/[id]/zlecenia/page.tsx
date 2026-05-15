/**
 * Full orders list filtered by clientId.
 * Server Component. Reads `page` from searchParams.
 * Ported table rendering (read-only, no checkbox/bulk/drawer) — OrdersTable
 * is not reusable here because its router calls target /admin/orders.
 * Spec §7.3.
 * ~75 LOC.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { getClientServer, listOrdersServer as listClientOrders } from "@/lib/clients/api-server";
import { ClientHeader } from "../_components/ClientHeader";
import { STATUS_LABELS_PL, STATUS_PILL_CLASS } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";

const log = createLogger("client-orders-page");

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Warsaw" });
}

function pricePLN(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " zł";
}

export default async function ClientOrdersPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  log.info("op=render", { clientId: id, page });

  let client, ordersPage;
  try {
    [client, ordersPage] = await Promise.all([
      getClientServer(id),
      listClientOrders({ clientId: id, page, size: 25 }),
    ]);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404) { notFound(); }
    log.error("op=render outcome=error", { clientId: id, err: String(err) });
    throw err;
  }

  const { content: rows, totalPages, number: currentPage } = ordersPage;
  const thCls = "px-4 py-3 text-left text-[11px] font-semibold text-admin-mute uppercase tracking-[0.08em]";
  const tdCls = "px-4 py-3.5 text-[15px] text-admin-ink";
  const baseHref = `/admin/clients/${id}/zlecenia` as Route;

  return (
    <div>
      <ClientHeader client={client} />

      {rows.length === 0 ? (
        <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
          Brak zleceń dla tego klienta.
        </div>
      ) : (
        <div className="overflow-x-auto border border-admin-line rounded">
          <table className="w-full border-collapse">
            <thead className="bg-admin-surface border-b border-admin-line">
              <tr>
                <th className={thCls}>Kod</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Termin odbioru</th>
                <th className={thCls + " text-right"}>Suma</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-admin-line hover:bg-acid/5 transition-colors">
                  <td className={tdCls + " font-mono text-[13px]"}>{row.code}</td>
                  <td className={tdCls}>
                    <span className={`inline-block px-3 py-1 rounded-md text-[12px] font-semibold uppercase tracking-wide ${STATUS_PILL_CLASS[row.status as OrderStatus]}`}>
                      {STATUS_LABELS_PL[row.status as OrderStatus]}
                    </span>
                  </td>
                  <td className={tdCls}>{fmtDate(row.plannedPickupAt)}</td>
                  <td className={tdCls + " text-right font-mono"}>{pricePLN(row.totalPriceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 text-[15px]">
          <Link
            href={currentPage === 0 ? ("#" as Route) : (`${baseHref}?page=${currentPage - 1}` as Route)}
            aria-disabled={currentPage === 0}
            className={`px-4 py-2 rounded-md border border-admin-line text-admin-ink font-medium ${currentPage === 0 ? "opacity-40 pointer-events-none" : "hover:bg-acid/10"}`}
          >
            ← Poprzednia
          </Link>
          <span className="text-admin-mute">Strona {currentPage + 1} z {totalPages}</span>
          <Link
            href={currentPage >= totalPages - 1 ? ("#" as Route) : (`${baseHref}?page=${currentPage + 1}` as Route)}
            aria-disabled={currentPage >= totalPages - 1}
            className={`px-4 py-2 rounded-md border border-admin-line text-admin-ink font-medium ${currentPage >= totalPages - 1 ? "opacity-40 pointer-events-none" : "hover:bg-acid/10"}`}
          >
            Następna →
          </Link>
        </div>
      )}
    </div>
  );
}
