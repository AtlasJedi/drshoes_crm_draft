import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import type {
  OrderDto,
  OrderListRow,
  OrderItemDto,
  CreateOrderRequest,
  UpdateOrderRequest,
  ChangeStatusRequest,
  ChangeStatusResponse,
  CreateOrderItemRequest,
  UpdateOrderItemRequest,
  OrderListFilters,
  Page,
} from "./types";

const log = createLogger("orders-api");

/** Build query string from OrderListFilters + pagination. */
function buildOrdersQuery(filters: OrderListFilters, page: number, size: number): string {
  const params = new URLSearchParams();
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      filters.status.forEach((s) => params.append("status", s));
    } else {
      params.set("status", filters.status);
    }
  }
  if (filters.craftsmanId) params.set("craftsmanId", filters.craftsmanId);
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.q) params.set("q", filters.q);
  if (filters.type?.length) filters.type.forEach((k) => params.append("type", k));
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.plannedPickupAtFrom) params.set("plannedPickupAtFrom", filters.plannedPickupAtFrom);
  if (filters.plannedPickupAtTo) params.set("plannedPickupAtTo", filters.plannedPickupAtTo);
  params.set("page", String(page));
  params.set("size", String(size));
  return params.toString();
}

/** GET /admin/orders — paginated list with optional filters. */
export async function listOrders(
  filters: OrderListFilters = {},
  page = 0,
  size = 20,
): Promise<Page<OrderListRow>> {
  const qs = buildOrdersQuery(filters, page, size);
  log.info("op=listOrders", { page, size, ...filters });
  return api.get<Page<OrderListRow>>(`/admin/orders?${qs}`);
}

/** GET /admin/orders/{id} — full order with items. */
export async function getOrder(id: string): Promise<OrderDto> {
  log.info("op=getOrder", { id });
  return api.get<OrderDto>(`/admin/orders/${id}`);
}

/** POST /admin/orders — create order, returns full OrderDto (201). */
export async function createOrder(req: CreateOrderRequest): Promise<OrderDto> {
  log.info("op=createOrder");
  return api.post<OrderDto>("/admin/orders", req);
}

/** PATCH /admin/orders/{id} — update order fields, returns updated OrderDto. */
export async function updateOrder(id: string, req: UpdateOrderRequest): Promise<OrderDto> {
  log.info("op=updateOrder", { id });
  return api.patch<OrderDto>(`/admin/orders/${id}`, req);
}

/** DELETE /admin/orders/{id} — soft-delete (OWNER only). Returns 204 void. */
export async function softDeleteOrder(id: string): Promise<void> {
  log.info("op=softDeleteOrder", { id });
  return api.delete<void>(`/admin/orders/${id}`);
}

/** POST /admin/orders/{id}/status — transition status with optimistic lock check. */
export async function changeStatus(
  id: string,
  targetStatus: ChangeStatusRequest["targetStatus"],
  expectedVersion: number,
  note?: string,
): Promise<ChangeStatusResponse> {
  const req: ChangeStatusRequest = {
    targetStatus,
    expectedVersion,
    ...(note && note.trim() ? { note: note.trim() } : {}),
  };
  log.info("op=changeStatus", { id, targetStatus, expectedVersion, hasNote: !!note });
  return api.post<ChangeStatusResponse>(`/admin/orders/${id}/status`, req);
}

/** POST /admin/orders/{id}/items — add item to order, returns new OrderItemDto (201). */
export async function addOrderItem(
  orderId: string,
  req: CreateOrderItemRequest,
): Promise<OrderItemDto> {
  log.info("op=addOrderItem", { orderId });
  return api.post<OrderItemDto>(`/admin/orders/${orderId}/items`, req);
}

/** PATCH /admin/orders/{id}/items/{itemId} — update item, returns updated OrderItemDto. */
export async function updateOrderItem(
  orderId: string,
  itemId: string,
  req: UpdateOrderItemRequest,
): Promise<OrderItemDto> {
  log.info("op=updateOrderItem", { orderId, itemId });
  return api.patch<OrderItemDto>(`/admin/orders/${orderId}/items/${itemId}`, req);
}

/** DELETE /admin/orders/{id}/items/{itemId} — remove item. Returns 204 void. */
export async function removeOrderItem(orderId: string, itemId: string): Promise<void> {
  log.info("op=removeOrderItem", { orderId, itemId });
  return api.delete<void>(`/admin/orders/${orderId}/items/${itemId}`);
}
