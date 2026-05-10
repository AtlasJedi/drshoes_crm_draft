/**
 * Server-only: server-side fetch for orders, forwarding the request cookie.
 * Mirrors the getMe pattern in lib/auth/session.ts.
 * Uses INTERNAL_API_BASE so the request goes directly to the backend container.
 */
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { Page } from "@/lib/clients/types";
import type { OrderListRow, OrderListFilters } from "./types";

const log = createLogger("orders-api-server");

function buildQuery(filters: OrderListFilters, page: number, size: number): string {
  const p = new URLSearchParams();
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      filters.status.forEach((s) => p.append("status", s));
    } else {
      p.set("status", filters.status);
    }
  }
  if (filters.craftsmanId) p.set("craftsmanId", filters.craftsmanId);
  if (filters.q) p.set("q", filters.q);
  if (filters.type?.length) filters.type.forEach((k) => p.append("type", k));
  if (filters.tag) p.set("tag", filters.tag);
  if (filters.plannedPickupAtFrom) p.set("plannedPickupAtFrom", filters.plannedPickupAtFrom);
  if (filters.plannedPickupAtTo) p.set("plannedPickupAtTo", filters.plannedPickupAtTo);
  p.set("page", String(page));
  p.set("size", String(size));
  return p.toString();
}

export async function listOrdersServer(
  filters: OrderListFilters = {},
  page = 0,
  size = 25,
): Promise<Page<OrderListRow>> {
  const base = process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
  const c = await cookies();
  const cookieHeader = c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
  const qs = buildQuery(filters, page, size);

  log.info("op=listOrdersServer", { page, size, ...filters });

  const resp = await fetch(`${base}/api/admin/orders?${qs}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!resp.ok) {
    log.warn("op=listOrdersServer outcome=error", { status: resp.status });
    throw new Error(`orders/list failed: ${resp.status}`);
  }

  return (await resp.json()) as Page<OrderListRow>;
}

export async function getOrderServer(id: string): Promise<import("./types").OrderDto> {
  const base = process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
  const c = await cookies();
  const cookieHeader = c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");

  log.info("op=getOrderServer", { id });

  const resp = await fetch(`${base}/api/admin/orders/${id}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!resp.ok) {
    log.warn("op=getOrderServer outcome=error", { id, status: resp.status });
    throw new Error(`orders/get failed: ${resp.status}`);
  }

  return (await resp.json()) as import("./types").OrderDto;
}

export async function listUsersServer(): Promise<import("@/lib/users/types").UserStubDto[]> {
  const base = process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
  const c = await cookies();
  const cookieHeader = c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");

  log.info("op=listUsersServer");

  const resp = await fetch(`${base}/api/admin/users`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!resp.ok) {
    log.warn("op=listUsersServer outcome=error", { status: resp.status });
    throw new Error(`users/list failed: ${resp.status}`);
  }

  return (await resp.json()) as import("@/lib/users/types").UserStubDto[];
}
