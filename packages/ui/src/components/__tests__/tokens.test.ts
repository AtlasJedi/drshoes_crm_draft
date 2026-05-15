import { describe, it, expect } from "vitest";
import { colors, orderStatusColor } from "../../tokens";

describe("colors", () => {
  it("acid is #d8ff3a per design spec", () => {
    expect(colors.acid).toBe("#d8ff3a");
  });
  it("magenta is #ff2e7e", () => {
    expect(colors.magenta).toBe("#ff2e7e");
  });
  it("ink is #0a0a0a", () => {
    expect(colors.ink).toBe("#0a0a0a");
  });
  it("ink2 is #1a1a1a", () => {
    expect(colors.ink2).toBe("#1a1a1a");
  });
  it("ink3 is #2a2a2a", () => {
    expect(colors.ink3).toBe("#2a2a2a");
  });
  it("paper is #f4efe6", () => {
    expect(colors.paper).toBe("#f4efe6");
  });
  it("paper2 is #ebe4d4", () => {
    expect(colors.paper2).toBe("#ebe4d4");
  });
  it("paper3 is #ddd3bd", () => {
    expect(colors.paper3).toBe("#ddd3bd");
  });
  it("blue is #2b5cff", () => {
    expect(colors.blue).toBe("#2b5cff");
  });
  it("orange is #ff5a1f", () => {
    expect(colors.orange).toBe("#ff5a1f");
  });
  it("green is #18b06b", () => {
    expect(colors.green).toBe("#18b06b");
  });
  it("red is #e1342b", () => {
    expect(colors.red).toBe("#e1342b");
  });
  it("adminMute is #6b6960", () => {
    expect(colors.adminMute).toBe("#6b6960");
  });
});

describe("orderStatusColor", () => {
  it("WSTEPNIE_PRZYJETE maps to adminMute", () => {
    expect(orderStatusColor.WSTEPNIE_PRZYJETE).toBe("#6b6960");
  });
  it("PRZYJETE maps to blue", () => {
    expect(orderStatusColor.PRZYJETE).toBe("#2b5cff");
  });
  it("W_REALIZACJI maps to orange", () => {
    expect(orderStatusColor.W_REALIZACJI).toBe("#ff5a1f");
  });
  it("CZEKA_NA_KLIENTA maps to dark yellow #a17a00", () => {
    expect(orderStatusColor.CZEKA_NA_KLIENTA).toBe("#a17a00");
  });
  it("GOTOWE_DO_ODBIORU maps to green (NOT magenta)", () => {
    expect(orderStatusColor.GOTOWE_DO_ODBIORU).toBe("#18b06b");
  });
  it("WYDANE maps to ink3", () => {
    expect(orderStatusColor.WYDANE).toBe("#2a2a2a");
  });
  it("ANULOWANE maps to red", () => {
    expect(orderStatusColor.ANULOWANE).toBe("#e1342b");
  });
});
