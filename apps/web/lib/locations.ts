import { createLogger } from "./log";
import type {
  StorageLocation,
  AddOrderNotePayload,
  AddOrderNoteResult,
} from "./types";

const log = createLogger("lib/locations");

export class LocationsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    msg: string,
  ) {
    super(msg);
    this.name = "LocationsApiError";
  }
}

async function parseError(res: Response): Promise<LocationsApiError> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return new LocationsApiError(
      res.status,
      body.error ?? `http_${res.status}`,
      body.message ?? `request failed with ${res.status}`,
    );
  } catch {
    return new LocationsApiError(res.status, `http_${res.status}`, res.statusText);
  }
}

export async function listLocations(
  opts: { includeInactive?: boolean } = {},
): Promise<StorageLocation[]> {
  const qs = opts.includeInactive ? "?includeInactive=true" : "";
  log.debug("op=listLocations", { includeInactive: !!opts.includeInactive });
  const res = await fetch(`/api/admin/storage-locations${qs}`, { credentials: "include" });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as StorageLocation[];
}

export async function createLocation(name: string): Promise<StorageLocation> {
  log.debug("op=createLocation", { name });
  const res = await fetch(`/api/admin/storage-locations`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await parseError(res);
    if (res.status === 409) {
      throw Object.assign(new Error(`conflict: ${err.message}`), {
        code: err.code,
        status: 409,
      });
    }
    throw err;
  }
  return (await res.json()) as StorageLocation;
}

export async function updateLocation(
  id: number,
  patch: { name?: string; position?: number; active?: boolean },
): Promise<StorageLocation> {
  log.debug("op=updateLocation", { id });
  const res = await fetch(`/api/admin/storage-locations/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as StorageLocation;
}

export async function deactivateLocation(id: number): Promise<void> {
  log.debug("op=deactivateLocation", { id });
  const res = await fetch(`/api/admin/storage-locations/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw await parseError(res);
}

export async function addOrderNote(
  orderId: string,
  payload: AddOrderNotePayload,
): Promise<AddOrderNoteResult> {
  log.debug("op=addOrderNote", { orderId, hasNote: !!payload.note, hasLocation: !!payload.location });
  const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await parseError(res);
    throw Object.assign(new Error(err.message), { code: err.code, status: res.status });
  }
  return (await res.json()) as AddOrderNoteResult;
}
