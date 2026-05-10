/**
 * Unit tests for lib/calendar/api-server.ts.
 * Uses vi.stubGlobal to inject a fake `fetch`; does NOT hit the network.
 *
 * Reality note (6-13): the backend uses a single unified CalendarOrderDto for both
 * scheduled and unscheduled lists, so test payloads use the unified shape.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- stubs ---------------------------------------------------------------

// next/headers cookies() stub — must be wired before importing the module under test
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [{ name: "SESSION", value: "test-session" }],
    }),
}));

// INTERNAL_API_BASE
const originalEnv = process.env["INTERNAL_API_BASE"];
beforeEach(() => {
  process.env["INTERNAL_API_BASE"] = "http://test-backend:8080";
});
afterEach(() => {
  if (originalEnv === undefined) delete process.env["INTERNAL_API_BASE"];
  else process.env["INTERNAL_API_BASE"] = originalEnv;
  vi.restoreAllMocks();
});

// --- helpers -------------------------------------------------------------

function makeResp(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// --- tests ---------------------------------------------------------------

describe("fetchCalendarWindow", () => {
  it("builds the correct URL with from and to params", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({ scheduled: [], unscheduled: [] })));

    const { fetchCalendarWindow } = await import("./api-server");
    await fetchCalendarWindow("2026-05-01", "2026-05-31");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl: string = fetchMock.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("from=2026-05-01");
    expect(calledUrl).toContain("to=2026-05-31");
    expect(calledUrl).toContain("/api/admin/orders/calendar");
  });

  it("forwards session cookie in request headers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({ scheduled: [], unscheduled: [] })));

    const { fetchCalendarWindow } = await import("./api-server");
    await fetchCalendarWindow("2026-05-01", "2026-05-31");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const options = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((options.headers as Record<string, string>)["cookie"]).toContain("SESSION=test-session");
  });

  it("returns CalendarResponseDto on 200", async () => {
    const payload = {
      scheduled: [
        {
          id: "uuid-1",
          code: "DR-001",
          clientName: "Bartek W.",
          status: "GOTOWE_DO_ODBIORU",
          plannedPickupAt: "2026-05-15T12:00:00Z",
          receivedAt: null,
          itemSummary: "DM 1460",
          urgent: false,
        },
      ],
      unscheduled: [],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp(payload)));

    const { fetchCalendarWindow } = await import("./api-server");
    const result = await fetchCalendarWindow("2026-05-01", "2026-05-31");

    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]!.code).toBe("DR-001");
    expect(result.unscheduled).toHaveLength(0);
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 400)));

    const { fetchCalendarWindow } = await import("./api-server");
    await expect(fetchCalendarWindow("2026-05-01", "2026-05-31")).rejects.toThrow(
      "calendar fetch failed: 400",
    );
  });

  it("throws RangeError when date range exceeds 92 days", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const { fetchCalendarWindow } = await import("./api-server");
    // 2026-05-01 → 2026-08-02 is 93 days
    await expect(fetchCalendarWindow("2026-05-01", "2026-08-02")).rejects.toThrow(RangeError);

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws RangeError when from is after to", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const { fetchCalendarWindow } = await import("./api-server");
    await expect(fetchCalendarWindow("2026-05-31", "2026-05-01")).rejects.toThrow(RangeError);
  });
});
