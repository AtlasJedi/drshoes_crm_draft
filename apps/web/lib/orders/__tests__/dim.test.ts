import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { daysInShop, isUrgent } from "@/lib/orders/dim";

const NOW = new Date("2026-06-01T12:00:00Z").getTime();

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe("daysInShop", () => {
  it("returns null when receivedAt is null", () => {
    expect(daysInShop({ receivedAt: null, status: "W_REALIZACJI", pickedUpAt: null })).toBeNull();
  });
  it("returns null for WYDANE", () => {
    expect(daysInShop({ receivedAt: "2026-05-01T00:00:00Z", status: "WYDANE", pickedUpAt: null })).toBeNull();
  });
  it("returns null for ANULOWANE", () => {
    expect(daysInShop({ receivedAt: "2026-05-01T00:00:00Z", status: "ANULOWANE", pickedUpAt: null })).toBeNull();
  });
  it("returns null for WSTEPNIE_PRZYJETE", () => {
    expect(daysInShop({ receivedAt: "2026-05-01T00:00:00Z", status: "WSTEPNIE_PRZYJETE", pickedUpAt: null })).toBeNull();
  });
  it("returns 5 when 5 days elapsed", () => {
    const recv = new Date(NOW - 5 * 86_400_000).toISOString();
    expect(daysInShop({ receivedAt: recv, status: "W_REALIZACJI", pickedUpAt: null })).toBe(5);
  });
});

describe("isUrgent", () => {
  it("true at exactly 14 days", () => {
    const recv = new Date(NOW - 14 * 86_400_000).toISOString();
    expect(isUrgent({ receivedAt: recv, status: "W_REALIZACJI" })).toBe(true);
  });
  it("false at 13 days", () => {
    const recv = new Date(NOW - 13 * 86_400_000).toISOString();
    expect(isUrgent({ receivedAt: recv, status: "W_REALIZACJI" })).toBe(false);
  });
  it("false when WYDANE regardless of age", () => {
    const recv = new Date(NOW - 100 * 86_400_000).toISOString();
    expect(isUrgent({ receivedAt: recv, status: "WYDANE" })).toBe(false);
  });
});
