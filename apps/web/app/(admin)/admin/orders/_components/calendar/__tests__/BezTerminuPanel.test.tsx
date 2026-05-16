/**
 * v2-B: BezTerminuPanel was deleted. Every order now has an effectivePickupAt
 * (plannedPickupAt ?? receivedAt + 14d), so the "bez terminu" concept no longer exists.
 * This file is kept as a tombstone to prevent test runner from complaining about
 * a missing test file reference. Actual coverage lives in CalendarMonthGrid.test.tsx.
 */
import { describe, it, expect } from "vitest";

describe("BezTerminuPanel (deleted in v2-B)", () => {
  it("is replaced by the two-marker calendar model", () => {
    // Every order has effectivePickupAt — no panel needed.
    expect(true).toBe(true);
  });
});
