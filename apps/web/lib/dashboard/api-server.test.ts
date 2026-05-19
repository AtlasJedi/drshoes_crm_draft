/**
 * Unit tests for lib/dashboard/api-server.ts.
 * Uses vi.stubGlobal to inject a fake `fetch`; does NOT hit the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- helpers -----------------------------------------------------------

function makeResp(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// --- stubs -------------------------------------------------------------

// next/headers cookies() stub — must resolve before importing the module under test
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [{ name: "dr_session", value: "test-token" }],
    }),
}));

// INTERNAL_API_BASE
const originalEnv = process.env["INTERNAL_API_BASE"];
beforeEach(() => {
  process.env["INTERNAL_API_BASE"] = "http://backend-test:8080";
});
afterEach(() => {
  if (originalEnv === undefined) delete process.env["INTERNAL_API_BASE"];
  else process.env["INTERNAL_API_BASE"] = originalEnv;
  vi.restoreAllMocks();
});

// --- tests -------------------------------------------------------------

describe("getDashboardKpisServer", () => {
  it("returns parsed DashboardKpiDto on 200", async () => {
    const payload = {
      inProgressCount: 14,
      readyForPickupCount: 6,
      todayIntakeCount: 3,
      monthRevenueCents: 1824000,
      monthRevenueFormatted: "18 240 zł",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp(payload)));

    const { getDashboardKpisServer } = await import("./api-server");
    const result = await getDashboardKpisServer();

    expect(result.inProgressCount).toBe(14);
    expect(result.monthRevenueFormatted).toBe("18 240 zł");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend-test:8080/api/admin/dashboard/kpis",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws on 4xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 403)));
    const { getDashboardKpisServer } = await import("./api-server");
    await expect(getDashboardKpisServer()).rejects.toThrow("dashboard/kpis failed: 403");
  });

  it("throws on 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 500)));
    const { getDashboardKpisServer } = await import("./api-server");
    await expect(getDashboardKpisServer()).rejects.toThrow("dashboard/kpis failed: 500");
  });
});

describe("getDashboardChartsServer", () => {
  it("returns parsed DashboardChartsDto on 200", async () => {
    const payload = {
      ordersPerWeek: [
        {
          weekIso: "2026-W10",
          byKind: { CZYSZCZENIE: 12, RENOWACJA: 0, NAPRAWA: 8, SZEWC: 0, CUSTOM: 0 },
        },
        {
          weekIso: "2026-W11",
          byKind: { CZYSZCZENIE: 0, RENOWACJA: 3, NAPRAWA: 14, SZEWC: 2, CUSTOM: 6 },
        },
      ],
      mixByType: [
        { kind: "CZYSZCZENIE", count: 19, percent: 55 },
        { kind: "CUSTOM",      count: 23, percent: 45 },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp(payload)));

    const { getDashboardChartsServer } = await import("./api-server");
    const result = await getDashboardChartsServer();

    expect(result.ordersPerWeek).toHaveLength(2);
    expect(result.ordersPerWeek[0]!.weekIso).toBe("2026-W10");
    expect(result.ordersPerWeek[0]!.byKind["CZYSZCZENIE"]).toBe(12);
    expect(result.ordersPerWeek[1]!.byKind["NAPRAWA"]).toBe(14);
    expect(result.mixByType[0]!.kind).toBe("CZYSZCZENIE");
  });

  it("throws on 4xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeResp({}, 401)));
    const { getDashboardChartsServer } = await import("./api-server");
    await expect(getDashboardChartsServer()).rejects.toThrow("dashboard/charts failed: 401");
  });
});
