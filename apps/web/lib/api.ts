import { env } from "./env";
import { createLogger } from "./log";

const BASE = env.NEXT_PUBLIC_API_BASE;
const log = createLogger("api");

/**
 * Typed error thrown by ApiClient for non-2xx responses.
 * Carries the HTTP status code for caller-side branching (e.g., 401 vs 429 vs 5xx).
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Client-only: reads a cookie by name from document.cookie. */
function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(";").shift();
  return undefined;
}

export class ApiClient {
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const csrf = getCookie("XSRF-TOKEN");
    if (csrf && init.method && init.method !== "GET") {
      headers.set("X-XSRF-TOKEN", csrf);
    }

    const resp = await fetch(`${BASE}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });

    const requestId = resp.headers.get("X-Request-Id") ?? undefined;

    if (resp.status === 401 && typeof window !== "undefined" && !path.startsWith("/admin/auth/login")) {
      log.info("session expired — redirecting to login", { op: "request", path, status: 401, requestId });
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/admin/login?next=${next}`;
      throw new Error("UNAUTHORIZED");
    }

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      log.warn("non-2xx response", { op: "request", path, status: resp.status, requestId });
      throw new HttpError(resp.status, `API ${resp.status}: ${bodyText}`);
    }

    if (resp.status === 204) return undefined as unknown as T;
    return (await resp.json()) as T;
  }

  get<T>(path: string)                      { return this.request<T>(path, { method: "GET" }); }
  post<T>(path: string, body?: unknown)     { return this.request<T>(path, { method: "POST",  body: body ? JSON.stringify(body) : undefined }); }
  patch<T>(path: string, body?: unknown)    { return this.request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }); }
  delete<T>(path: string)                   { return this.request<T>(path, { method: "DELETE" }); }
}

export const api = new ApiClient();
