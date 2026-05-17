/**
 * Full orders list filtered by clientId.
 * Server Component. Reads `page` + `orderId` from searchParams.
 * Rows open OrderDrawer overlay via ?orderId= (same pattern as list/calendar/kanban).
 * Spec §7.3.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { getClientServer, listOrdersServer as listClientOrders } from "@/lib/clients/api-server";
import { getOrderServer } from "@/lib/orders/api-server";
import { ClientHeader } from "../_components/ClientHeader";
import { OrderDrawer } from "../../../orders/_components/OrderDrawer";
import { ClientOrdersRows } from "./_components/ClientOrdersRows";
import type { OrderDto } from "@/lib/orders/types";

const log = createLogger("client-orders-page");

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; orderId?: string }>;
}

export default async function ClientOrdersPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  const orderId = sp.orderId;
  log.info("op=render", { clientId: id, page, hasDrawer: !!orderId });

  let client, ordersPage;
  let drawerOrder: OrderDto | null = null;
  try {
    const fetches: [
      ReturnType<typeof getClientServer>,
      ReturnType<typeof listClientOrders>,
      ...Array<ReturnType<typeof getOrderServer>>,
    ] = [
      getClientServer(id),
      listClientOrders({ clientId: id, page, size: 25 }),
    ];
    if (orderId) fetches.push(getOrderServer(orderId));
    const results = await Promise.all(fetches);
    client = results[0];
    ordersPage = results[1];
    drawerOrder = orderId ? (results[2] as OrderDto) : null;
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404) { notFound(); }
    log.error("op=render outcome=error", { clientId: id, err: String(err) });
    throw err;
  }

  // Guard: never show another client's order while on this client's page.
  if (drawerOrder && drawerOrder.clientId !== id) {
    log.warn("op=render drawerOrderId.clientMismatch", { orderId, expected: id, actual: drawerOrder.clientId });
    drawerOrder = null;
  }

  const { content: rows, totalPages, number: currentPage } = ordersPage;
  const thCls = "px-4 py-3 text-left text-[11px] font-semibold text-admin-mute uppercase tracking-[0.08em]";
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
            <ClientOrdersRows clientId={id} rows={rows} />
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

      {drawerOrder && <OrderDrawer initialOrder={drawerOrder} />}
    </div>
  );
}
