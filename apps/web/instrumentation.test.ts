// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

// Stub NEXT_RUNTIME so the sdk.start() branch is skipped in test environment
vi.stubEnv("NEXT_RUNTIME", "edge");

describe("instrumentation", () => {
  it("exports a register function", async () => {
    const mod = await import("./instrumentation");
    expect(typeof mod.register).toBe("function");
  });

  it("register() is a no-op when NEXT_RUNTIME is not nodejs", async () => {
    const mod = await import("./instrumentation");
    // Should not throw
    expect(() => mod.register()).not.toThrow();
  });
});
