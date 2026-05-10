import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SavedFilterPresets } from "../SavedFilterPresets";

// next/navigation stub
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/orders",
}));

describe("SavedFilterPresets", () => {
  beforeEach(() => {
    mockReplace.mockReset();
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
    vi.mock("next/navigation", () => ({
      useRouter: () => ({ replace: mockReplace }),
      useSearchParams: () => new URLSearchParams("status=GOTOWE_DO_ODBIORU"),
      usePathname: () => "/admin/orders",
    }));
    render(<SavedFilterPresets />);
    const chip = screen.getByText(/gotowe do odbioru/i).closest("button");
    expect(chip?.className).toMatch(/active|bg-ink|text-paper/);
  });
});
