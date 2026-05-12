import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusMultiSelect, buildLabel } from "../StatusMultiSelect";
import type { OrderStatus } from "@/lib/orders/types";

// ── label helper unit tests ──────────────────────────────────────────────────

describe("buildLabel", () => {
  it("returns 'Wszystkie' for empty selection", () => {
    expect(buildLabel([])).toBe("Wszystkie");
  });

  it("returns the Polish label for a single selection", () => {
    expect(buildLabel(["PRZYJETE"])).toBe("Przyjęte");
    expect(buildLabel(["WYDANE"])).toBe("Wydane");
  });

  it("returns 'X statusów' for 2 or more selections", () => {
    expect(buildLabel(["PRZYJETE", "W_REALIZACJI"])).toBe("2 statusów");
    expect(buildLabel(["PRZYJETE", "W_REALIZACJI", "WYDANE"])).toBe("3 statusów");
  });

  it("returns the Polish label for WSTEPNIE_PRZYJETE defensively", () => {
    // Even though it's not in the selectable set, it can arrive from the URL
    expect(buildLabel(["WSTEPNIE_PRZYJETE"])).toBe("Wstępnie przyjęte");
  });
});

// ── component interaction tests ───────────────────────────────────────────────

describe("StatusMultiSelect component", () => {
  let onSelect: (statuses: OrderStatus[]) => void;

  beforeEach(() => {
    onSelect = vi.fn<(statuses: OrderStatus[]) => void>();
  });

  it("shows 'Wszystkie' trigger label when nothing selected", () => {
    render(<StatusMultiSelect selected={[]} onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /wszystkie/i })).toBeInTheDocument();
  });

  it("shows correct label for 1 selection", () => {
    render(<StatusMultiSelect selected={["PRZYJETE"]} onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /przyjęte/i })).toBeInTheDocument();
  });

  it("shows '2 statusów' label for 2 selections", () => {
    render(
      <StatusMultiSelect selected={["PRZYJETE", "WYDANE"]} onSelect={onSelect} />,
    );
    expect(screen.getByRole("button", { name: /2 statusów/i })).toBeInTheDocument();
  });

  it("popover is closed by default", () => {
    render(<StatusMultiSelect selected={[]} onSelect={onSelect} />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens popover on trigger click", () => {
    render(<StatusMultiSelect selected={[]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /wszystkie/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes popover on Escape", () => {
    render(<StatusMultiSelect selected={[]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /wszystkie/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes popover on outside click", () => {
    render(
      <div>
        <StatusMultiSelect selected={[]} onSelect={onSelect} />
        <div data-testid="outside">outside</div>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /wszystkie/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("checking an unchecked status calls onSelect with that status added", () => {
    render(<StatusMultiSelect selected={[]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /wszystkie/i }));
    const przyjeteCheckbox = screen.getByRole("checkbox", { name: /przyjęte/i });
    expect(przyjeteCheckbox).not.toBeChecked();
    fireEvent.click(przyjeteCheckbox);
    expect(onSelect).toHaveBeenCalledWith(["PRZYJETE"]);
  });

  it("unchecking an active status calls onSelect with that status removed (URL param removed)", () => {
    render(
      <StatusMultiSelect selected={["PRZYJETE", "WYDANE"]} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /2 statusów/i }));
    const przyjeteCheckbox = screen.getByRole("checkbox", { name: /przyjęte/i });
    expect(przyjeteCheckbox).toBeChecked();
    fireEvent.click(przyjeteCheckbox);
    expect(onSelect).toHaveBeenCalledWith(["WYDANE"]);
  });

  it("Wyczyść button calls onSelect([]) and closes popover", () => {
    render(<StatusMultiSelect selected={["PRZYJETE"]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /przyjęte/i }));
    fireEvent.click(screen.getByText("Wyczyść"));
    expect(onSelect).toHaveBeenCalledWith([]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Zamknij button closes popover without calling onSelect", () => {
    render(<StatusMultiSelect selected={[]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /wszystkie/i }));
    fireEvent.click(screen.getByText("Zamknij"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("WSTEPNIE_PRZYJETE is NOT in the selectable options", () => {
    render(<StatusMultiSelect selected={[]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /wszystkie/i }));
    expect(screen.queryByText("Wstępnie przyjęte")).not.toBeInTheDocument();
  });

  it("trigger has aria-expanded=false when closed and aria-haspopup=listbox", () => {
    render(<StatusMultiSelect selected={[]} onSelect={onSelect} />);
    const btn = screen.getByRole("button", { name: /wszystkie/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("trigger has aria-expanded=true when open", () => {
    render(<StatusMultiSelect selected={[]} onSelect={onSelect} />);
    const btn = screen.getByRole("button", { name: /wszystkie/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});
