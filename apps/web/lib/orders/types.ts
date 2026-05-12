/**
 * TypeScript mirror of backend order DTOs.
 * Source of truth: backend/app/src/main/java/com/drshoes/app/order/dto/
 *                  backend/app/src/main/java/com/drshoes/app/order/domain/OrderStatus.java
 *                  backend/app/src/main/java/com/drshoes/app/order/domain/OrderItemKind.java
 *                  backend/app/src/main/java/com/drshoes/app/order/domain/OrderSource.java
 *
 * WSTEPNIE_PRZYJETE is included in the enum per errata (reserved for PUBLIC_INTAKE source).
 * UI components may hide it from manual-selection UI but must handle it in display logic.
 */

import type { Page } from "@/lib/clients/types";
export type { Page };

// ---------- Enums ----------

/** All 7 order lifecycle statuses. Matches DB CHECK and OrderStatus.java. */
export type OrderStatus =
  | "WSTEPNIE_PRZYJETE"
  | "PRZYJETE"
  | "W_REALIZACJI"
  | "CZEKA_NA_KLIENTA"
  | "GOTOWE_DO_ODBIORU"
  | "WYDANE"
  | "ANULOWANE";

/** 3 item kinds. Matches DB CHECK and OrderItemKind.java. */
export type OrderItemKind = "NAPRAWA" | "CUSTOM_BUTY" | "CUSTOM_KURTKA";

/** Order source channel. Matches OrderSource.java. */
export type OrderSource = "ADMIN" | "PUBLIC_INTAKE" | "IMPORT";

// ---------- DTOs ----------

/** Single order item — mirrors OrderItemDto.java. */
export interface OrderItemDto {
  id: string;
  orderId: string;
  position: number;
  kind: OrderItemKind;
  description: string | null;
  craftsmanNotes: string | null;
  priceCents: number;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

/** Full order detail — mirrors OrderDto.java. */
export interface OrderDto {
  id: string;
  code: string;
  clientId: string;
  status: OrderStatus;
  source: OrderSource;
  receivedAt: string | null;    // ISO-8601
  plannedPickupAt: string | null; // ISO-8601
  pickedUpAt: string | null;    // ISO-8601
  assignedCraftsmanId: string | null;
  currentStorageLocationId: string | null;
  tags: string | null;          // JSONB stored as serialized string
  totalPriceCents: number;
  currency: string;
  description: string | null;
  cancelledReason: string | null;
  version: number;              // optimistic locking
  createdAt: string;            // ISO-8601
  updatedAt: string;            // ISO-8601
  items: OrderItemDto[];
  quotedPriceCents: number;     // workshop quoted price in PLN cents; 0 = TBD
  advancePaidCents: number;     // advance already collected; 0 = none
}

/** Paginated list row — mirrors OrderListRow.java. */
export interface OrderListRow {
  id: string;
  code: string;
  clientId: string;
  status: OrderStatus;
  totalPriceCents: number;
  currency: string;
  description: string | null;
  plannedPickupAt: string | null; // ISO-8601
  version: number;
  updatedAt: string;              // ISO-8601 — always set
  createdAt: string;              // ISO-8601 — always set at creation
  receivedAt: string | null;      // ISO-8601 — null until status leaves WSTEPNIE_PRZYJETE
  pickedUpAt: string | null;      // ISO-8601 — null until status becomes WYDANE
  quotedPriceCents: number;       // workshop quoted price in PLN cents; 0 = TBD
  advancePaidCents: number;       // advance already collected; 0 = none
}

/**
 * Placeholder trigger suggestion — mirrors TriggerSuggestion.java (empty record for M1).
 * Populated in a later milestone with SMS/email preview fields.
 */
export type TriggerSuggestion = Record<string, never>;

/** Response from POST /orders/{id}/status — mirrors ChangeStatusResponse.java. */
export interface ChangeStatusResponse {
  order: OrderDto;
  triggerSuggestion: TriggerSuggestion | null;
}

// ---------- Request bodies ----------

/** POST /admin/orders — mirrors CreateOrderRequest.java. */
export interface CreateOrderItemRequest {
  kind: OrderItemKind;
  description?: string | null;
  craftsmanNotes?: string | null;
  priceCents: number;
}

/** POST /admin/orders — mirrors CreateOrderRequest.java. */
export interface CreateOrderRequest {
  clientId: string;
  description?: string | null;
  receivedAt?: string | null;       // ISO-8601
  plannedPickupAt?: string | null;  // ISO-8601
  assignedCraftsmanId?: string | null;
  source?: OrderSource;
  items?: CreateOrderItemRequest[];
  quotedPriceCents?: number;        // PLN cents; omit = 0 in service
  advancePaidCents?: number;        // PLN cents; omit = 0 in service
}

/** PATCH /admin/orders/{id} — mirrors UpdateOrderRequest.java. All fields optional. */
export interface UpdateOrderRequest {
  description?: string | null;
  plannedPickupAt?: string | null;  // ISO-8601
  assignedCraftsmanId?: string | null;
  currentStorageLocationId?: string | null;
  cancelledReason?: string | null;
  tags?: string | null;
  version?: number;
  quotedPriceCents?: number;        // PLN cents; patch only when provided
  advancePaidCents?: number;        // PLN cents; patch only when provided
}

/** POST /admin/orders/{id}/status — mirrors ChangeStatusRequest.java. */
export interface ChangeStatusRequest {
  targetStatus: OrderStatus;
  expectedVersion: number;
  /** Optional operator note (max 1000 chars). Omit or pass undefined to send no note. */
  note?: string;
}

/** PATCH /admin/orders/{id}/items/{itemId} — mirrors UpdateOrderItemRequest.java. */
export interface UpdateOrderItemRequest {
  kind?: OrderItemKind;
  description?: string | null;
  craftsmanNotes?: string | null;
  priceCents?: number;
}

// ---------- Query filters ----------

/**
 * Query params for GET /admin/orders.
 * Maps to @RequestParam in OrderController: status (multi), type (kinds), craftsmanId, q,
 * tag (JSONB containment), plannedPickupAtFrom/To (LocalDate), + Pageable.
 */
export interface OrderListFilters {
  /** Single status or array — backend accepts multi-value status= params. */
  status?: OrderStatus | OrderStatus[];
  /** Filters by item kind — maps to ?type= repeated param. */
  type?: OrderItemKind[];
  craftsmanId?: string;
  q?: string;
  /** Matches orders whose tags JSONB array contains this value. */
  tag?: string;
  /** Lower bound for planned_pickup_at (inclusive), format YYYY-MM-DD. */
  plannedPickupAtFrom?: string;
  /** Upper bound for planned_pickup_at (exclusive next day), format YYYY-MM-DD. */
  plannedPickupAtTo?: string;
}
