import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SavedFilterPresets } from "../SavedFilterPresets";

// ── Controllable next/navigation mock ───────────────────────────────────────
// mockSearchParamsString is read at render time via useSearchParams().
// Tests can set it before rendering to simulate active URL params.
const mockReplace = vi.fn();
let mockSearchParamsString = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
  usePathname: () => "/admin/orders",
}));

describe("SavedFilterPresets", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParamsString = "";
    vi.useFakeTimers();
    // Fix today's date for deterministic URL assertions
    vi.setSystemTime(new Date("2026-06-02T08:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all three preset chips + the disabled save chip", () => {
    render(<SavedFilterPresets />);
    expect(screen.getByText(/pilne na ten tydzień/i)).toBeInTheDocument();
    expect(screen.getByText(/gotowe do odbioru/i)).toBeInTheDocument();
    expect(screen.getByText(/zaległe/i)).toBeInTheDocument();
    expect(screen.getByText(/\+ zapisz widok/i)).toBeInTheDocument();
  });

  it("clicking Pilne na ten tydzień pushes correct URL params", () => {
    render(<SavedFilterPresets />);
    fireEvent.click(screen.getByText(/pilne na ten tydzień/i));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("tag=pilne"),
    );
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("plannedPickupAtFrom=2026-06-02"),
    );
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("plannedPickupAtTo=2026-06-09"),
    );
  });

  it("clicking Gotowe do odbioru pushes status=GOTOWE_DO_ODBIORU", () => {
    render(<SavedFilterPresets />);
    fireEvent.click(screen.getByText(/gotowe do odbioru/i));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("status=GOTOWE_DO_ODBIORU"),
    );
  });

  it("clicking Zaległe pushes plannedPickupAtTo=yesterday + two statuses", () => {
    render(<SavedFilterPresets />);
    fireEvent.click(screen.getByText(/zaległe/i));
    const arg = mockReplace.mock.calls[0]?.[0] as string;
    expect(arg).toContain("plannedPickupAtTo=2026-06-01");
    expect(arg).toContain("status=W_REALIZACJI");
    expect(arg).toContain("status=GOTOWE_DO_ODBIORU");
  });

  it("+ zapisz widok chip is disabled and not clickable", () => {
    render(<SavedFilterPresets />);
    const saveChip = screen.getByText(/\+ zapisz widok/i).closest("button");
    expect(saveChip).toBeDisabled();
    fireEvent.click(saveChip!);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("active chip has visual highlight class when its params match current URL", () => {
    mockSearchParamsString = "status=GOTOWE_DO_ODBIORU";
    render(<SavedFilterPresets />);
    const chip = screen.getByText(/gotowe do odbioru/i).closest("button");
    expect(chip?.className).toMatch(/bg-ink|text-paper/);
  });
});

// ── Preset toggle-off + Wszystkie chip ─────────────────────────────────────

describe("SavedFilterPresets — toggle-off and Wszystkie chip", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParamsString = "";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-02T08:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("'Wszystkie' reset chip is hidden when no filter params are active", () => {
    mockSearchParamsString = "";
    render(<SavedFilterPresets />);
    expect(
      screen.queryByRole("button", { name: /wyczyść wszystkie filtry/i }),
    ).not.toBeInTheDocument();
  });

  it("'Wszystkie' reset chip is visible when a filter param is present", () => {
    mockSearchParamsString = "status=PRZYJETE";
    render(<SavedFilterPresets />);
    expect(
      screen.getByRole("button", { name: /wyczyść wszystkie filtry/i }),
    ).toBeInTheDocument();
  });

  it("clicking 'Wszystkie' reset chip navigates to /admin/orders (no query)", () => {
    mockSearchParamsString = "status=PRZYJETE";
    render(<SavedFilterPresets />);
    fireEvent.click(screen.getByRole("button", { name: /wyczyść wszystkie filtry/i }));
    expect(mockReplace).toHaveBeenCalledWith("/admin/orders");
  });

  it("clicking a non-active preset applies its params", () => {
    mockSearchParamsString = "";
    render(<SavedFilterPresets />);
    fireEvent.click(screen.getByText(/gotowe do odbioru/i));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("status=GOTOWE_DO_ODBIORU"),
    );
  });

  it("clicking an active preset a second time clears the URL (toggle-off)", () => {
    // Simulate "Gotowe do odbioru" preset being active
    mockSearchParamsString = "status=GOTOWE_DO_ODBIORU";
    render(<SavedFilterPresets />);
    const chip = screen.getByText(/gotowe do odbioru/i).closest("button")!;
    // chip should be aria-pressed=true (active)
    expect(chip).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chip);
    // Should navigate to /admin/orders (no query) — toggle-off
    expect(mockReplace).toHaveBeenCalledWith("/admin/orders");
  });

  it("clicking an inactive preset does NOT clear the URL", () => {
    mockSearchParamsString = "";
    render(<SavedFilterPresets />);
    fireEvent.click(screen.getByText(/pilne na ten tydzień/i));
    // Should apply the preset, not clear
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("tag=pilne"));
  });
});
