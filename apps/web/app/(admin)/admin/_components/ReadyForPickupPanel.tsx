/**
 * Dashboard lower-left panel: top-4 orders with status GOTOWE_DO_ODBIORU.
 * Layout: admin.jsx:154-174.
 * Server component with inline try/catch error isolation.
 * ~70 LOC.
 */
import Link from "next/link";
import { listOrdersServer } from "@/lib/orders/api-server";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorBanner } from "@/components/state/ErrorBanner";

export async function ReadyForPickupPanel() {
  let orders: import("@/lib/orders/types").OrderListRow[] | undefined;
  let fetchError = false;

  try {
    const page = await listOrdersServer({ status: "GOTOWE_DO_ODBIORU" }, 0, 4);
    orders = page.content;
  } catch {
    fetchError = true;
  }

  return (
    <div className="admin-card p-[22px]">
      <div className="flex justify-between items-center mb-[14px]">
        <div className="t-display text-[22px]">Gotowe do odbioru</div>
        {!fetchError && orders && orders.length > 0 && (
          <span className="t-mono text-[11px] bg-[var(--pink)] text-[var(--ink)] px-2 py-0.5">
            {orders.length} czeka
          </span>
        )}
      </div>

      {fetchError && (
        <ErrorBanner message="Nie udało się załadować danych." />
      )}

      {!fetchError && orders?.length === 0 && (
        <EmptyState message="Nic gotowego" sub="Brak zamówień gotowych do odbioru." />
      )}

      {!fetchError && orders && orders.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-3 p-2.5 border border-[var(--line)]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="t-mono text-[11px] text-admin-mute">{o.code}</span>
                </div>
                <div className="t-mono text-[11px] text-admin-mute mt-0.5 truncate">
                  {o.description ?? "—"}
                </div>
              </div>
              <Link
                href={`/admin/orders?orderId=${o.id}`}
                className="btn-clean text-[11px] px-2 py-1"
              >
                otwórz
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
