/**
 * Server-only: server-side fetch for messaging resources, forwarding the request cookie.
 * Mirrors the pattern in lib/orders/api-server.ts.
 * Uses INTERNAL_API_BASE so the request goes directly to the backend container.
 */
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { TemplateDto, TriggerDto, MessageDto, MessageThreadDto, ThreadFilter } from "./types";

const log = createLogger("messaging.api-server");

async function cookieHeader(): Promise<string> {
  const c = await cookies();
  return c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
}

function base(): string {
  return process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
}

async function serverGet<T>(path: string, label: string): Promise<T> {
  const resp = await fetch(`${base()}${path}`, {
    headers: { cookie: await cookieHeader() },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.warn(`op=${label} outcome=error`, { status: resp.status });
    throw new Error(`${label} failed: ${resp.status}`);
  }
  return (await resp.json()) as T;
}

export async function getTemplatesServer(): Promise<TemplateDto[]> {
  log.info("op=getTemplatesServer");
  return serverGet<TemplateDto[]>("/api/admin/templates", "getTemplatesServer");
}

export async function getTemplateServer(id: string): Promise<TemplateDto> {
  log.info("op=getTemplateServer", { id });
  return serverGet<TemplateDto>(`/api/admin/templates/${id}`, "getTemplateServer");
}

export async function getTriggersServer(): Promise<TriggerDto[]> {
  log.info("op=getTriggersServer");
  return serverGet<TriggerDto[]>("/api/admin/triggers", "getTriggersServer");
}

export async function getTriggerServer(id: string): Promise<TriggerDto> {
  log.info("op=getTriggerServer", { id });
  return serverGet<TriggerDto>(`/api/admin/triggers/${id}`, "getTriggerServer");
}

export async function getOrderMessagesServer(orderId: string): Promise<MessageDto[]> {
  log.info("op=getOrderMessagesServer", { orderId });
  return serverGet<MessageDto[]>(`/api/admin/orders/${orderId}/messages`, "getOrderMessagesServer");
}

/**
 * Server-side fetch for message threads list.
 * Backend returns a plain array (not a Page); the panel slices to top-N.
 */
export async function listThreadsServer(
  filter: ThreadFilter = "ALL",
): Promise<MessageThreadDto[]> {
  log.info("op=listThreadsServer", { filter });
  return serverGet<MessageThreadDto[]>(
    `/api/admin/threads?filter=${filter}`,
    "listThreadsServer",
  );
}

/** GET /api/admin/threads?clientId= — threads for a single client, server-side. */
export async function listThreadsForClientServer(clientId: string): Promise<MessageThreadDto[]> {
  log.info("op=listThreadsForClientServer", { clientId });
  return serverGet<MessageThreadDto[]>(
    `/api/admin/threads?clientId=${encodeURIComponent(clientId)}`,
    "listThreadsForClientServer",
  );
}
