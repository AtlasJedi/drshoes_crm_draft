import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("ClientListSearchBox", () => {
  beforeEach(() => {
    mockPush.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a text input", async () => {
    const { ClientListSearchBox } = await import("../ClientListSearchBox");
    render(<ClientListSearchBox initialQ="" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("does not push immediately on keystroke (debounce)", async () => {
    const { ClientListSearchBox } = await import("../ClientListSearchBox");
    render(<ClientListSearchBox initialQ="" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "kowal" } });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("pushes with encoded q param after 250ms", async () => {
    const { ClientListSearchBox } = await import("../ClientListSearchBox");
    render(<ClientListSearchBox initialQ="" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "kowal" } });
    vi.advanceTimersByTime(250);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("q=kowal"),
    );
  });

  it("pushes /admin/clients (no q) when input cleared", async () => {
    const { ClientListSearchBox } = await import("../ClientListSearchBox");
    render(<ClientListSearchBox initialQ="kowal" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    vi.advanceTimersByTime(250);
    expect(mockPush).toHaveBeenCalledWith("/admin/clients");
  });

  it("encodes special characters in q param", async () => {
    const { ClientListSearchBox } = await import("../ClientListSearchBox");
    render(<ClientListSearchBox initialQ="" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Józef Nowak" } });
    vi.advanceTimersByTime(250);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("q=J%C3%B3zef"),
    );
  });

  it("search input has t-mono and border-ink classes", async () => {
    const { ClientListSearchBox } = await import("../ClientListSearchBox");
    render(<ClientListSearchBox initialQ="" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toMatch(/t-mono/);
    expect(input.className).toMatch(/border-ink/);
  });
});
