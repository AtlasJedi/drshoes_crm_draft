import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import type { TimelineEvent } from "./types";

const log = createLogger("timeline-api");

/**
 * GET /admin/orders/{orderId}/timeline
 * Returns curated list of timeline events for an order.
 * Returns empty array for unknown orderId (backend returns [] not 404).
 */
export async function getOrderTimeline(orderId: string): Promise<TimelineEvent[]> {
  log.info("op=getOrderTimeline", { orderId });
  return api.get<TimelineEvent[]>(`/admin/orders/${orderId}/timeline`);
}
