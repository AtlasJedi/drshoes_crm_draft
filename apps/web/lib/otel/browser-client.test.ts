import { describe, it, expect, vi, beforeEach } from "vitest";

describe("browser-client SSR guard", () => {
  beforeEach(() => {
    // Simulate SSR environment: no window
    vi.stubGlobal("window", undefined);
  });

  it("module loads without throwing in SSR environment", async () => {
    await expect(import("@/lib/otel/browser-client")).resolves.toBeDefined();
  });
});

describe("browser-client browser environment", () => {
  beforeEach(() => {
    // Simulate browser environment
    vi.stubGlobal("window", {
      location: { hostname: "localhost" },
      navigator: { userAgent: "vitest" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  it("exports init function", async () => {
    const mod = await import("@/lib/otel/browser-client");
    expect(mod).toBeDefined();
  });
});
