import { describe, it, expect } from "vitest";
import { shortCode } from "../format";

describe("shortCode", () => {
  it("strips the DR-YYYY- prefix", () => {
    expect(shortCode("DR-2026-0013")).toBe("0013");
    expect(shortCode("DR-2025-0001")).toBe("0001");
    expect(shortCode("DR-2024-9999")).toBe("9999");
  });

  it("returns code unchanged when prefix does not match (legacy safety net)", () => {
    expect(shortCode("0013")).toBe("0013");
    expect(shortCode("LEGACY-CODE")).toBe("LEGACY-CODE");
    expect(shortCode("")).toBe("");
  });
});
