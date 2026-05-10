/**
 * Unit tests for lib/kanban/api-server.ts.
 * Uses vi.stubGlobal to inject a fake fetch; does NOT hit the network.
 * Pattern: mirrors lib/calendar/api-server.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// next/headers must be mocked before importing the module under test
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [{ name: "SESSION", value: "test-session" }],
    }),
}));

// Preserve and restore INTERNAL_API_BASE
const originalEnv = process.env["INTERNAL_API_BASE"];
beforeEach(() => {
  process.env["INTERNAL_API_BASE"] = "http://localhost:8080";
});
afterEach(() => {
  if (originalEnv === undefined) delete process.env["INTERNAL_API_BASE"];
  else process.env["INTERNAL_API_BASE"] = originalEnv;
  vi.restoreAllMocks();
});

// --- helpers ---------------------------------------------------------------

function makeResp(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function makeBoardResponse() {
  return {
    columns: [
      {
        status: "PRZYJETE",
        total: 2,
        cards: [
          {
            id: "uuid-1",
            code: "DR-1001",
            clientName: "Jan Kowalski",
            itemSummary: "Vibram, DM 1460",
            plannedPickupAt: "2026-05-15T10:00:00Z",
            urgent: false,
          },
        ],
        hasMore: true,
      },
    ],
  };
}

// --- tests -----------------------------------------------------------------

describe("getKanbanBoardServer", () => {
  it("calls the correct URL with default limitPerColumn (no qs)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp(makeBoardResponse())));

    const { getKanbanBoardServer } = await import("./api-server");
    const result = await getKanbanBoardServer();

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl: string = fetchMock.mock.calls[0]![0] as string;
    expect(calledUrl).toBe("http://localhost:8080/api/admin/orders/kanban");
    expect(result.columns).toHaveLength(1);
    expect(result.columns[0]!.status).toBe("PRZYJETE");
  });

  it("appends limitPerColumn query param when provided", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp(makeBoardResponse())));

    const { getKanbanBoardServer } = await import("./api-server");
    await getKanbanBoardServer({ limitPerColumn: 10 });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrl: string = fetchMock.mock.calls[0]![0] as string;
    expect(calledUrl).toBe("http://localhost:8080/api/admin/orders/kanban?limitPerColumn=10");
  });

  it("forwards the session cookie in request headers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp(makeBoardResponse())));

    const { getKanbanBoardServer } = await import("./api-server");
    await getKanbanBoardServer();

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const options = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((options.headers as Record<string, string>)["cookie"]).toContain(
      "SESSION=test-session",
    );
  });

  it("throws when backend returns non-OK status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 503)));

    const { getKanbanBoardServer } = await import("./api-server");
    await expect(getKanbanBoardServer()).rejects.toThrow(
      "getKanbanBoardServer failed: 503",
    );
  });
});
