import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Toggle } from "../Toggle";

describe("Toggle", () => {
  it("renders without crashing", () => {
    render(<Toggle on={false} />);
  });

  it("has role=switch", () => {
    render(<Toggle on={false} />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("aria-checked=true when on=true", () => {
    render(<Toggle on={true} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("aria-checked=false when on=false", () => {
    render(<Toggle on={false} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange when clicked", () => {
    const handler = vi.fn();
    render(<Toggle on={false} onChange={handler} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(handler).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when on=true and clicked", () => {
    const handler = vi.fn();
    render(<Toggle on={true} onChange={handler} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(handler).toHaveBeenCalledWith(false);
  });

  it("does not call onChange when disabled", () => {
    const handler = vi.fn();
    render(<Toggle on={false} onChange={handler} disabled />);
    fireEvent.click(screen.getByRole("switch"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("on=true has acid-dot background (#d8ff3a)", () => {
    render(<Toggle on={true} />);
    const btn = screen.getByRole("switch");
    const dot = btn.querySelector("span") as HTMLElement;
    expect(dot.style.background).toBe("rgb(216, 255, 58)");
  });

  it("on=false has muted-dot background (#6b6960)", () => {
    render(<Toggle on={false} />);
    const btn = screen.getByRole("switch");
    const dot = btn.querySelector("span") as HTMLElement;
    expect(dot.style.background).toBe("rgb(107, 105, 96)");
  });
});
