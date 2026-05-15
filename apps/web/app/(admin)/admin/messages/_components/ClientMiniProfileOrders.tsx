// ClientMiniProfileOrders — active orders mini-list with PhImg + DR code + Pill.
// < 50 LOC per granulate directive.
import { Pill } from "@repo/ui";
import { PhImg } from "@repo/ui";
import type { OrderListRow } from "@/lib/orders/types";

interface Props {
  orders: OrderListRow[];
}

export function ClientMiniProfileOrders({ orders }: Props) {
  return (
    <div className="px-4 py-4">
      <div className="t-stencil mb-2" style={{ fontSize: 11, letterSpacing: ".08em" }}>
        Aktywne zlecenia
      </div>
      {orders.length === 0 && (
        <div className="t-mono opacity-55" style={{ fontSize: 11 }}>Brak aktywnych zleceń</div>
      )}
      <div className="flex flex-col gap-2">
        {orders.map((o) => (
          <div key={o.id} className="flex gap-2 items-center border-[1.5px] border-ink p-2">
            <PhImg label="" style={{ width: 36, height: 36, flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="t-mono font-bold" style={{ fontSize: 11 }}>{o.code}</div>
              <div className="truncate" style={{ fontSize: 12, fontWeight: 600 }}>
                {o.description ?? "—"}
              </div>
            </div>
            <Pill status={o.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
