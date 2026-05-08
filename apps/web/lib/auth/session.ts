import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import type { MeResponse } from "./types";

const log = createLogger("auth:session");

/** Server-only: fetches /api/admin/auth/me using the request's session cookie. */
export async function getMe(): Promise<MeResponse | null> {
  const internalApi = process.env["INTERNAL_API_BASE"] ?? "http://localhost:8080";
  const c = await cookies();
  const cookieHeader = c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");

  if (!cookieHeader.includes("dr_session")) {
    log.info("op=getMe outcome=no-session");
    return null;
  }

  const resp = await fetch(`${internalApi}/api/admin/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (resp.status === 401) {
    log.info("op=getMe outcome=unauthorized");
    return null;
  }

  if (!resp.ok) {
    log.warn("op=getMe outcome=error", { status: resp.status });
    throw new Error(`auth/me failed: ${resp.status}`);
  }

  const me = (await resp.json()) as MeResponse;
  log.info("op=getMe outcome=ok", { userId: me.id, role: me.role });
  return me;
}
