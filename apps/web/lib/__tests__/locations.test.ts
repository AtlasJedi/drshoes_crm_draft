import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listLocations,
  createLocation,
  updateLocation,
  deactivateLocation,
  addOrderNote,
} from "../locations";

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe("listLocations", () => {
  it("GETs /api/admin/storage-locations and returns parsed array", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, name: "półka 1", position: 0, active: true }],
    });
    const r = await listLocations();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/storage-locations",
      expect.objectContaining({ credentials: "include" })
    );
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("półka 1");
  });

  it("passes includeInactive=true when requested", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    await listLocations({ includeInactive: true });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/storage-locations?includeInactive=true",
      expect.any(Object)
    );
  });
});

describe("createLocation", () => {
  it("POSTs with name and returns body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 5, name: "x", position: 0, active: true }),
    });
    const r = await createLocation("x");
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].method).toBe("POST");
    expect(r.id).toBe(5);
  });

  it("throws on 409", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "location_name_conflict", message: "x" }),
    });
    await expect(createLocation("dup")).rejects.toThrow(/conflict|409/);
  });
});

describe("updateLocation", () => {
  it("PATCHes with partial body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, name: "renamed", position: 2, active: true }),
    });
    const r = await updateLocation(1, { name: "renamed", position: 2 });
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].method).toBe("PATCH");
    expect(r.name).toBe("renamed");
  });
});

describe("deactivateLocation", () => {
  it("sends DELETE and returns void", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 204 });
    await deactivateLocation(7);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].method).toBe("DELETE");
  });
});

describe("addOrderNote", () => {
  it("POSTs to /api/admin/orders/{id}/notes with body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        auditEntryId: "00000000-0000-0000-0000-000000000000",
        note: "x",
        locationFrom: null,
        locationTo: null,
        createdAt: "2026-05-16T10:00:00Z",
      }),
    });
    const r = await addOrderNote("oid-1", { note: "x" });
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "/api/admin/orders/oid-1/notes"
    );
    expect(r.note).toBe("x");
  });

  it("throws on 400 with error code from body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "at_least_one_required", message: "x" }),
    });
    await expect(addOrderNote("oid-1", {})).rejects.toMatchObject({
      code: "at_least_one_required",
    });
  });
});
