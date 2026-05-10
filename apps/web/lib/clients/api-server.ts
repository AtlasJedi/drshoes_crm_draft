/**
 * Server-only: server-side fetch for clients, forwarding request cookie.
 * Uses INTERNAL_API_BASE for direct backend access from Next.js server.
 */
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { ClientDto, ClientSummary, Page } from "./types";

const log = createLogger("apps/web/lib/clients/api-server");

async function cookieHeader(): Promise<string> {
  const c = await cookies();
  return c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
}

function base(): string {
  return process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
}

/** GET /api/admin/clients?page=&size= — paginated list, server-side. */
export async function listClientsServer(opts: {
  page?: number;
  size?: number;
}): Promise<Page<ClientDto>> {
  const page = opts.page ?? 0;
  const size = opts.size ?? 20;
  const cookie = await cookieHeader();
  log.info("op=listClientsServer", { page, size });
  const resp = await fetch(`${base()}/api/admin/clients?page=${page}&size=${size}`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.warn("op=listClientsServer outcome=error", { status: resp.status });
    throw new Error(`clients/list failed: ${resp.status}`);
  }
  return (await resp.json()) as Page<ClientDto>;
}

/** GET /api/admin/clients/search?q= — typeahead, server-side. */
export async function searchClientsServer(q: string): Promise<import("./types").ClientSearchResult[]> {
  const cookie = await cookieHeader();
  log.info("op=searchClientsServer", { qLen: q.length });
  const resp = await fetch(
    `${base()}/api/admin/clients/search?q=${encodeURIComponent(q)}`,
    { headers: { cookie }, cache: "no-store" },
  );
  if (!resp.ok) {
    log.warn("op=searchClientsServer outcome=error", { status: resp.status });
    throw new Error(`clients/search failed: ${resp.status}`);
  }
  return (await resp.json()) as import("./types").ClientSearchResult[];
}

/** GET /api/admin/clients/{id} — single client, server-side. */
export async function getClientServer(id: string): Promise<ClientDto> {
  const cookie = await cookieHeader();
  log.info("op=getClientServer", { id });
  const resp = await fetch(`${base()}/api/admin/clients/${id}`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.warn("op=getClientServer outcome=error", { id, status: resp.status });
    const err = new Error(`clients/get failed: ${resp.status}`) as Error & { status: number };
    err.status = resp.status;
    throw err;
  }
  return (await resp.json()) as ClientDto;
}

/** GET /api/admin/clients/{id}/summary — summary tiles, server-side. */
export async function getClientSummaryServer(id: string): Promise<ClientSummary> {
  const cookie = await cookieHeader();
  log.info("op=getClientSummaryServer", { id });
  const resp = await fetch(`${base()}/api/admin/clients/${id}/summary`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!resp.ok) {
    log.warn("op=getClientSummaryServer outcome=error", { id, status: resp.status });
    throw new Error(`clients/summary failed: ${resp.status}`);
  }
  return (await resp.json()) as ClientSummary;
}
