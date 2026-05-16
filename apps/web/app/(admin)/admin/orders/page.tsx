import Link from "next/link";
import { createLogger } from "@/lib/log";
import { listOrdersServer, listUsersServer, getOrderServer } from "@/lib/orders/api-server";
import type { OrderStatus, OrderItemKind, OrderDto } from "@/lib/orders/types";
import type { UserStubDto } from "@/lib/users/types";
import { OrdersFilters } from "./_components/OrdersFilters";
import { OrdersPageClient } from "./_components/OrdersPageClient";
import { OrderDrawer } from "./_components/OrderDrawer";
import { OrderViewTabs } from "./_components/OrderViewTabs";
import { SavedFilterPresets } from "./_components/SavedFilterPresets";
import { OrdersPageHeaderSetter } from "./_components/OrdersPageHeaderSetter";

const log = createLogger("admin-orders-page");

interface SearchParams {
  status?: string | string[];
  type?: string | string[];
  craftsmanId?: string;
  q?: string;
  page?: string;
  orderId?: string;
  tag?: string;
  plannedPickupAtFrom?: string;
  plannedPickupAtTo?: string;
  sort?: string;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // Coerce params
  const status = sp.status
    ? (Array.isArray(sp.status) ? sp.status : [sp.status]) as OrderStatus[]
    : undefined;
  const type = sp.type
    ? (Array.isArray(sp.type) ? sp.type : [sp.type]) as OrderItemKind[]
    : undefined;
  const craftsmanId = sp.craftsmanId;
  const q = sp.q;
  const tag = sp.tag;
  const plannedPickupAtFrom = sp.plannedPickupAtFrom;
  const plannedPickupAtTo = sp.plannedPickupAtTo;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  const orderId = sp.orderId;
  const sort = sp.sort;

  let pageData = null;
  let users: UserStubDto[] = [];
  let fetchError = false;
  let drawerOrder: OrderDto | null = null;

  try {
    const fetches: [
      ReturnType<typeof listOrdersServer>,
      ReturnType<typeof listUsersServer>,
      ...Array<Promise<OrderDto>>,
    ] = [
      listOrdersServer({ status, type, craftsmanId, q, tag, plannedPickupAtFrom, plannedPickupAtTo }, page, 25, sort),
      listUsersServer(),
    ];
    if (orderId) fetches.push(getOrderServer(orderId));
    const results = await Promise.all(fetches);
    pageData = results[0] as Awaited<ReturnType<typeof listOrdersServer>>;
    users = results[1] as UserStubDto[];
    drawerOrder = orderId ? (results[2] as OrderDto) : null;
  } catch (err) {
    log.error("op=fetchOrders outcome=error", { message: String(err) });
    fetchError = true;
  }

  const filtersInitial = {
    status: status ?? [],
    type: type ?? [],
    craftsmanId,
    q,
  };

  const newHref = "/admin/orders/new" as const;

  return (
    <div>
      <OrdersPageHeaderSetter
        activeCount={pageData?.totalElements ?? 0}
        readyCount={0}
      />
      <div className="mb-5">
        <OrderViewTabs active="list" />
      </div>

      {fetchError ? (
        <div className="p-6 border border-admin-line rounded text-admin-mute text-sm">
          Nie udało się załadować listy. Odśwież stronę.
        </div>
      ) : (
        <>
          <SavedFilterPresets />
          <OrdersFilters
            initial={filtersInitial}
            users={users}
            visible={pageData?.content.length ?? 0}
            total={pageData?.totalElements ?? 0}
          />

          {pageData && pageData.content.length === 0 ? (
            <div className="p-8 text-center border border-admin-line rounded text-admin-mute">
              <p className="mb-3">Brak zleceń. Załóż pierwsze.</p>
              <Link
                href={newHref}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-acid text-ink text-sm font-medium hover:bg-acid/80 transition-colors"
              >
                + Nowe zlecenie
              </Link>
            </div>
          ) : pageData ? (
            <OrdersPageClient
              rows={pageData.content}
              totalPages={pageData.totalPages}
              currentPage={page}
            />
          ) : null}
        </>
      )}

      {drawerOrder && (
        <OrderDrawer initialOrder={drawerOrder} />
      )}
    </div>
  );
}
