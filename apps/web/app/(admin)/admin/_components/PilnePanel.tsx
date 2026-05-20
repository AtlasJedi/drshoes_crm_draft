/**
 * Dashboard panel: urgent orders (Pilne).
 * Cloned from ReadyForPickupPanel; data source: listOrdersServer({ urgent: true }).
 * Displays: short code (truncated DR-year), client name, days-in-shop badge.
 * Subtitle: "Status przyjęte > 4 dni"
 * Server component with inline try/catch error isolation.
 * ~75 LOC.
 */
import Link from "next/link";
import type { Route } from "next";
import { Tape, AdminCard } from "@drshoes/ui";
import { listOrdersServer } from "@/lib/orders/api-server";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorBanner } from "@/components/state/ErrorBanner";

/** Truncate "DR-2026-0042" → "0042" (last segment after final "-"). */
function shortCode(code: string): string {
  const parts = code.split("-");
  return parts[parts.length - 1] ?? code;
}

/** Days between receivedAt and now, floored. */
function daysInShop(receivedAt: string | null): number | null {
  if (!receivedAt) return null;
  return Math.floor((Date.now() - new Date(receivedAt).getTime()) / 86_400_000);
}

export async function PilnePanel() {
  let orders: import("@/lib/orders/types").OrderListRow[] | undefined;
  let fetchError = false;

  try {
    const page = await listOrdersServer({ urgent: true, limit: 12 } as import("@/lib/orders/types").OrderListFilters, 0, 12);
    orders = page.content;
  } catch {
    fetchError = true;
  }

  return (
    <AdminCard padding={22}>
      <div className="flex justify-between items-center mb-[14px]">
        <div>
          <div className="t-display text-[22px]">Pilne</div>
          <div className="t-mono text-[11px] text-admin-mute mt-0.5">Status przyjęte &gt; 4 dni</div>
        </div>
        {!fetchError && orders && orders.length > 0 && (
          <Tape angle={-2}>{orders.length} zleceń</Tape>
        )}
      </div>

      {fetchError && <ErrorBanner message="Nie udało się załadować danych." />}

      {!fetchError && orders?.length === 0 && (
        <EmptyState message="Brak pilnych zleceń" sub="Żadne zlecenia nie przekroczyły 4 dni w warsztacie." />
      )}

      {!fetchError && orders && orders.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          {orders.map((o) => {
            const days = daysInShop(o.receivedAt);
            return (
              <Link
                key={o.id}
                href={`/admin/orders?orderId=${o.id}` as Route}
                className="flex items-center gap-3 p-[10px] border border-[var(--line)] hover:bg-[var(--paper-2)] transition-colors"
              >
                {/* Short code */}
                <span className="t-mono text-[11px] text-admin-mute shrink-0 w-[36px]">
                  {shortCode(o.code)}
                </span>
                {/* Client name */}
                <span className="flex-1 min-w-0 font-semibold text-[13px] truncate">
                  {o.clientName ?? "—"}
                </span>
                {/* Days-in-shop badge */}
                {days !== null && (
                  <span
                    className="t-mono text-[10px] shrink-0 px-[6px] py-[2px] border border-[var(--ink)]"
                    style={{ background: "#F0C896", color: "var(--ink)" }}
                  >
                    {days} dni
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </AdminCard>
  );
}
