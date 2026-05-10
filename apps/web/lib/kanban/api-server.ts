/**
 * Server-only: typed fetcher for GET /api/admin/orders/kanban.
 * Uses INTERNAL_API_BASE → no CORS; must only be imported in Server Components.
 * Pattern: mirrors lib/calendar/api-server.ts.
 */
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { KanbanResponseDto, KanbanFetchParams } from "./types";

const log = createLogger("kanban.api-server");

async function cookieHeader(): Promise<string> {
  const c = await cookies();
  return c
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
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

/**
 * Fetch the full Kanban board in one round-trip.
 * @param params.limitPerColumn - default 50; must be 1–200. WYDANE always capped at 10 backend-side.
 */
export async function getKanbanBoardServer(
  params: KanbanFetchParams = {},
): Promise<KanbanResponseDto> {
  const qs = params.limitPerColumn
    ? `?limitPerColumn=${params.limitPerColumn}`
    : "";
  log.info("op=getKanbanBoardServer", { limitPerColumn: params.limitPerColumn ?? 50 });
  return serverGet<KanbanResponseDto>(
    `/api/admin/orders/kanban${qs}`,
    "getKanbanBoardServer",
  );
}
