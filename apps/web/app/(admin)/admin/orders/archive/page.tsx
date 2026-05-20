import { createLogger } from "@/lib/log";
import { listOrdersServer, getOrderServer } from "@/lib/orders/api-server";
import type { OrderDto } from "@/lib/orders/types";
import { OrderViewTabs } from "../_components/OrderViewTabs";
import { OrdersTable } from "../_components/OrdersTable";
import { OrderDrawer } from "../_components/OrderDrawer";
import { ArchiveFilters } from "./ArchiveFilters";

const log = createLogger("admin-orders-archive-page");

interface SearchParams {
  q?: string;
  plannedPickupAtFrom?: string;
  plannedPickupAtTo?: string;
  page?: string;
  orderId?: string;
}

export default async function OrdersArchivePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q;
  const plannedPickupAtFrom = sp.plannedPickupAtFrom;
  const plannedPickupAtTo = sp.plannedPickupAtTo;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  const orderId = sp.orderId;

  let pageData = null;
  let drawerOrder: OrderDto | null = null;
  let fetchError = false;

  try {
    const fetches: Promise<unknown>[] = [
      listOrdersServer({ archived: true, q, plannedPickupAtFrom, plannedPickupAtTo }, page, 25),
    ];
    if (orderId) fetches.push(getOrderServer(orderId));
    const [data, order] = await Promise.all(fetches);
    pageData = data as Awaited<ReturnType<typeof listOrdersServer>>;
    drawerOrder = orderId ? (order as OrderDto) : null;
  } catch (err) {
    log.error("op=fetchArchive outcome=error", { message: String(err) });
    fetchError = true;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 mb-3">
        <h1 className="t-display text-[32px]">ARCHIWUM</h1>
        <p className="t-mono text-admin-mute text-[12px]">
          {pageData?.totalElements ?? 0} zleceń
        </p>
      </div>
      <OrderViewTabs active="archive" />
      <ArchiveFilters
        q={q}
        plannedPickupAtFrom={plannedPickupAtFrom}
        plannedPickupAtTo={plannedPickupAtTo}
      />
      <div className="flex-1 min-h-0 overflow-auto mt-3">
        {fetchError ? (
          <p className="text-admin-mute text-sm p-4">Błąd ładowania archiwum.</p>
        ) : pageData ? (
          <OrdersTable
            rows={pageData.content}
            totalPages={pageData.totalPages}
            currentPage={page}
          />
        ) : null}
      </div>
      {drawerOrder && <OrderDrawer initialOrder={drawerOrder} />}
    </div>
  );
}
