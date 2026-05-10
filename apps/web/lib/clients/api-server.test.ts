/**
 * Unit tests for lib/clients/api-server.ts.
 * Stubs fetch + next/headers; does NOT hit the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [{ name: "SESSION", value: "test-session" }],
    }),
}));

const origEnv = process.env["INTERNAL_API_BASE"];
beforeEach(() => { process.env["INTERNAL_API_BASE"] = "http://test-backend:8080"; });
afterEach(() => {
  if (origEnv === undefined) delete process.env["INTERNAL_API_BASE"];
  else process.env["INTERNAL_API_BASE"] = origEnv;
  vi.restoreAllMocks();
});

function makeResp(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: () => Promise.resolve(body) } as unknown as Response;
}

describe("listClientsServer", () => {
  it("builds URL with page and size params", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      makeResp({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20, last: true }),
    ));
    const { listClientsServer } = await import("./api-server");
    await listClientsServer({ page: 2, size: 20 });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const url: string = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("/api/admin/clients");
    expect(url).toContain("page=2");
    expect(url).toContain("size=20");
  });

  it("forwards session cookie", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      makeResp({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20, last: true }),
    ));
    const { listClientsServer } = await import("./api-server");
    await listClientsServer({});
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const opts = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((opts.headers as Record<string, string>)["cookie"]).toContain("SESSION=test-session");
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 500)));
    const { listClientsServer } = await import("./api-server");
    await expect(listClientsServer({})).rejects.toThrow("clients/list failed: 500");
  });
});

describe("getClientServer", () => {
  it("fetches /api/admin/clients/{id}", async () => {
    const id = "abc-123";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      makeResp({ id, firstName: "Jan", lastName: "Kowalski" }),
    ));
    const { getClientServer } = await import("./api-server");
    const result = await getClientServer(id);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const url: string = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain(`/api/admin/clients/${id}`);
    expect(result.firstName).toBe("Jan");
  });
});

describe("getClientSummaryServer", () => {
  it("fetches /api/admin/clients/{id}/summary", async () => {
    const id = "abc-123";
    const payload = { clientId: id, orderCount: 5, openOrderCount: 2, lastOrderAt: null, unreadThreadCount: 1 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp(payload)));
    const { getClientSummaryServer } = await import("./api-server");
    const result = await getClientSummaryServer(id);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const url: string = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain(`/api/admin/clients/${id}/summary`);
    expect(result.orderCount).toBe(5);
  });

  it("throws on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 404)));
    const { getClientSummaryServer } = await import("./api-server");
    await expect(getClientSummaryServer("missing")).rejects.toThrow("clients/summary failed: 404");
  });
});
