/**
 * Unit tests for lib/clients/api.ts — URL composition + body shape.
 * Stubs the api ApiClient via vi.mock.
 */
import { describe, it, expect, vi } from "vitest";

const mockGet = vi.fn();
const mockPatch = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: mockGet, post: vi.fn(), patch: mockPatch, delete: vi.fn() },
}));

describe("listClients", () => {
  it("passes page and size as query params", async () => {
    mockGet.mockResolvedValueOnce({ content: [] });
    const { listClients } = await import("./api");
    await listClients({ page: 1, size: 10 });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("page=1"));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("size=10"));
  });

  it("defaults page=0 size=20 when opts omitted", async () => {
    mockGet.mockResolvedValueOnce({ content: [] });
    const { listClients } = await import("./api");
    await listClients({});
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("page=0"));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("size=20"));
  });
});

describe("updateClient", () => {
  it("sends preferredChannel and rodoConsent in body via PATCH", async () => {
    mockPatch.mockResolvedValueOnce({ id: "c1" });
    const { updateClient } = await import("./api");
    await updateClient("c1", { preferredChannel: "SMS", rodoConsent: true });
    expect(mockPatch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/clients/c1"),
      expect.objectContaining({ preferredChannel: "SMS", rodoConsent: true }),
    );
  });
});

describe("getClientSummary", () => {
  it("fetches /admin/clients/{id}/summary", async () => {
    mockGet.mockResolvedValueOnce({ clientId: "c2", orderCount: 3 });
    const { getClientSummary } = await import("./api");
    await getClientSummary("c2");
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("/admin/clients/c2/summary"));
  });
});
