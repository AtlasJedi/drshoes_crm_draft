/**
 * Dashboard lower-left: orders with status GOTOWE_DO_ODBIORU.
 * Tape count badge header, PhImg thumbnail, bold client name, Pill per row, AdminCard wrapper.
 * Server component with inline try/catch error isolation.
 * ~70 LOC.
 */
import Link from "next/link";
import { Tape, PhImg, Pill, AdminCard } from "@drshoes/ui";
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
    <AdminCard padding={22}>
      <div className="flex justify-between items-center mb-[14px]">
        <div className="t-display text-[22px]">Gotowe do odbioru</div>
        {!fetchError && orders && orders.length > 0 && (
          <Tape angle={-2}>{orders.length} czeka</Tape>
        )}
      </div>

      {fetchError && <ErrorBanner message="Nie udało się załadować danych." />}

      {!fetchError && orders?.length === 0 && (
        <EmptyState message="Nic gotowego" sub="Brak zamówień gotowych do odbioru." />
      )}

      {!fetchError && orders && orders.length > 0 && (
        <div className="flex flex-col gap-[10px]">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-3 p-[10px] border border-[var(--line)]"
            >
              <PhImg
                label=""
                style={{ width: 44, height: 44, border: "1.5px solid var(--ink)" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="t-mono text-[11px] text-admin-mute">{o.code}</span>
                  <span className="font-semibold text-[13px]">{o.clientName ?? "—"}</span>
                </div>
                <div className="t-mono text-[11px] text-admin-mute mt-0.5 truncate">
                  {o.description ?? "—"}
                </div>
              </div>
              <Pill status={o.status as import("@/lib/orders/types").OrderStatus} />
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
    </AdminCard>
  );
}
