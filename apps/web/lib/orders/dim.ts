import type { OrderStatus } from "./types";

const DAY_MS = 86_400_000;
const EXCLUDED: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "WYDANE",
  "ANULOWANE",
  "WSTEPNIE_PRZYJETE",
]);

interface OrderTime {
  receivedAt: string | null;
  status: OrderStatus;
  pickedUpAt?: string | null;
}

export function daysInShop(o: OrderTime): number | null {
  if (!o.receivedAt) return null;
  if (EXCLUDED.has(o.status)) return null;
  const recv = new Date(o.receivedAt).getTime();
  if (!Number.isFinite(recv)) return null;
  return Math.max(0, Math.floor((Date.now() - recv) / DAY_MS));
}

export function isUrgent(o: { receivedAt: string | null; status: OrderStatus }): boolean {
  const d = daysInShop({ receivedAt: o.receivedAt, status: o.status });
  return d !== null && d >= 14;
}
