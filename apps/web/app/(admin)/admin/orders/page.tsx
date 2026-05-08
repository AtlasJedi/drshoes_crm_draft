import Link from "next/link";
import { createLogger } from "@/lib/log";
import { listOrdersServer, listUsersServer } from "@/lib/orders/api-server";
import type { OrderStatus, OrderItemKind } from "@/lib/orders/types";
import type { UserStubDto } from "@/lib/users/types";
import { OrdersFilters } from "./_components/OrdersFilters";
import { OrdersTable } from "./_components/OrdersTable";

const log = createLogger("admin-orders-page");

interface SearchParams {
  status?: string;
  type?: string | string[];
  craftsmanId?: string;
  q?: string;
  page?: string;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // Coerce params
  const status = sp.status as OrderStatus | undefined;
  const type = sp.type
    ? (Array.isArray(sp.type) ? sp.type : [sp.type]) as OrderItemKind[]
    : undefined;
  const craftsmanId = sp.craftsmanId;
  const q = sp.q;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);

  let pageData = null;
  let users: UserStubDto[] = [];
  let fetchError = false;

  try {
    [pageData, users] = await Promise.all([
      listOrdersServer({ status, type, craftsmanId, q }, page, 25),
      listUsersServer(),
    ]);
  } catch (err) {
    log.error("op=fetchOrders outcome=error", { message: String(err) });
    fetchError = true;
  }

  const filtersInitial = {
    status,
    type: type ?? [],
    craftsmanId,
    q,
  };

  const newHref = "/admin/orders/new" as const;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-admin-ink">Zlecenia</h1>
        <Link
          href={newHref}
          className="inline-flex items-center gap-1 px-4 py-2 rounded bg-acid text-ink text-sm font-medium hover:bg-acid/80 transition-colors"
        >
          + Nowe zlecenie
        </Link>
      </div>

      {fetchError ? (
        <div className="p-6 border border-admin-line rounded text-admin-mute text-sm">
          Nie udało się załadować listy. Odśwież stronę.
        </div>
      ) : (
        <>
          <OrdersFilters initial={filtersInitial} users={users} />

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
            <OrdersTable
              rows={pageData.content}
              totalPages={pageData.totalPages}
              currentPage={page}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
