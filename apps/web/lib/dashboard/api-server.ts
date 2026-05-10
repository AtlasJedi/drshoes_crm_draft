/**
 * Server-only: typed fetchers for Dashboard KPI and Chart endpoints.
 * Mirrors the pattern in lib/orders/api-server.ts and lib/messaging/api-server.ts.
 * Uses INTERNAL_API_BASE; forwards the request session cookie.
 */
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { DashboardKpiDto, DashboardChartsDto } from "./types";

const log = createLogger("dashboard.api-server");

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
    log.error(`op=${label} outcome=error`, { status: resp.status });
    throw new Error(`${label} failed: ${resp.status}`);
  }
  return (await resp.json()) as T;
}

export async function getDashboardKpisServer(): Promise<DashboardKpiDto> {
  log.info("op=getDashboardKpisServer");
  return serverGet<DashboardKpiDto>("/api/admin/dashboard/kpis", "dashboard/kpis");
}

export async function getDashboardChartsServer(): Promise<DashboardChartsDto> {
  log.info("op=getDashboardChartsServer");
  return serverGet<DashboardChartsDto>("/api/admin/dashboard/charts", "dashboard/charts");
}
