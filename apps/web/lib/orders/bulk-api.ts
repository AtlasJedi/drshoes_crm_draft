/**
 * Client-side wrapper for the bulk status endpoint (6-9).
 * POST /api/admin/orders/bulk/status
 */
import { createLogger } from "@/lib/log";
import type { OrderStatus } from "./types";

const log = createLogger("orders.bulk-api");

export interface BulkStatusRequest {
  orderIds: string[];
  newStatus: OrderStatus;
  reason?: string;
  sendTriggers: boolean;
}

export type BulkFailureReason =
  | "ILLEGAL_TRANSITION"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "UNKNOWN";

export interface BulkSuccessRow {
  orderId: string;
  code: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
}

export interface BulkFailureRow {
  orderId: string;
  code: string;
  fromStatus: OrderStatus;
  error: BulkFailureReason;
}

export interface BulkStatusResult {
  succeeded: BulkSuccessRow[];
  failed: BulkFailureRow[];
}

export async function bulkChangeStatus(
  req: BulkStatusRequest,
): Promise<BulkStatusResult> {
  log.info("op=bulkChangeStatus", {
    count: req.orderIds.length,
    newStatus: req.newStatus,
    sendTriggers: req.sendTriggers,
  });
  const resp = await fetch("/api/admin/orders/bulk/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    log.warn("op=bulkChangeStatus outcome=error", { status: resp.status });
    throw new Error(`bulk/status failed: ${resp.status}`);
  }
  const result = (await resp.json()) as BulkStatusResult;
  log.info("op=bulkChangeStatus outcome=ok", {
    succeeded: result.succeeded.length,
    failed: result.failed.length,
  });
  return result;
}
