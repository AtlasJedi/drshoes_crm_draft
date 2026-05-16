import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { OrdersFilters } from "../OrdersFilters";

const mockReplace = vi.fn();
let mockSearchParamsString = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
  usePathname: () => "/admin/orders",
}));

describe("OrdersFilters — q-rewrite", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParamsString = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    initial: {},
    users: [],
  };

  function openSearch() {
    fireEvent.click(screen.getByRole("button", { name: /szukaj/i }));
  }

  it('rewrites q="pilne" to ?urgent=true and removes q', async () => {
    render(<OrdersFilters {...defaultProps} />);
    openSearch();

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "pilne" } });

    await act(async () => { vi.advanceTimersByTime(300); });

    expect(mockReplace).toHaveBeenCalledOnce();
    const url = mockReplace.mock.calls[0]![0] as string;
    expect(url).toContain("urgent=true");
    expect(url).not.toContain("q=");
  });

  it('rewrites q="Pilne" (uppercase) to ?urgent=true', async () => {
    render(<OrdersFilters {...defaultProps} />);
    openSearch();

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "Pilne" } });

    await act(async () => { vi.advanceTimersByTime(300); });

    const url = mockReplace.mock.calls[0]![0] as string;
    expect(url).toContain("urgent=true");
    expect(url).not.toContain("q=");
  });

  it('rewrites q="pilne na ten tydzień" to ?urgent=true', async () => {
    render(<OrdersFilters {...defaultProps} />);
    openSearch();

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "pilne na ten tydzień" } });

    await act(async () => { vi.advanceTimersByTime(300); });

    const url = mockReplace.mock.calls[0]![0] as string;
    expect(url).toContain("urgent=true");
    expect(url).not.toContain("q=");
  });

  it('does NOT rewrite q="pilnować" (only prefix match on "pilne na ")', async () => {
    render(<OrdersFilters {...defaultProps} />);
    openSearch();

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "pilnować" } });

    await act(async () => { vi.advanceTimersByTime(300); });

    const url = mockReplace.mock.calls[0]![0] as string;
    expect(url).not.toContain("urgent=true");
    expect(url).toContain("q=pilnowa%C4%87");
  });

  it('normal search q="buty" sets q and removes urgent', async () => {
    mockSearchParamsString = "urgent=true";
    render(<OrdersFilters {...defaultProps} />);
    openSearch();

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "buty" } });

    await act(async () => { vi.advanceTimersByTime(300); });

    const url = mockReplace.mock.calls[0]![0] as string;
    expect(url).toContain("q=buty");
    expect(url).not.toContain("urgent=true");
  });
});
