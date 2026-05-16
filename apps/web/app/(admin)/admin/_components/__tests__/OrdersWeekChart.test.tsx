import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OrdersWeekChart } from "../OrdersWeekChart";
import type { OrdersPerWeekRowDto } from "@/lib/dashboard/types";

const rows: OrdersPerWeekRowDto[] = [
  { weekIso: "2026-W10", repairs: 12, custom: 8 },
  { weekIso: "2026-W11", repairs: 14, custom: 6 },
  { weekIso: "2026-W12", repairs: 9,  custom: 11 },
  { weekIso: "2026-W13", repairs: 16, custom: 10 },
  { weekIso: "2026-W14", repairs: 11, custom: 14 },
  { weekIso: "2026-W15", repairs: 18, custom: 9 },
  { weekIso: "2026-W16", repairs: 22, custom: 12 },
  { weekIso: "2026-W17", repairs: 19, custom: 16 },
];

describe("OrdersWeekChart", () => {
  it("renders chart heading", () => {
    render(<OrdersWeekChart rows={rows} />);
    expect(screen.getByText("Zlecenia / tydzień")).toBeInTheDocument();
  });

  it("renders legend labels", () => {
    render(<OrdersWeekChart rows={rows} />);
    expect(screen.getByText("naprawy")).toBeInTheDocument();
    expect(screen.getByText("custom")).toBeInTheDocument();
  });

  it("renders an SVG element", () => {
    const { container } = render(<OrdersWeekChart rows={rows} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders a bar for each row", () => {
    const { container } = render(<OrdersWeekChart rows={rows} />);
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(rows.length * 2);
  });

  it("handles empty rows gracefully", () => {
    render(<OrdersWeekChart rows={[]} />);
    expect(screen.getByText("Zlecenia / tydzień")).toBeInTheDocument();
  });

  it("renders three chip toggles", () => {
    render(<OrdersWeekChart rows={rows} />);
    expect(screen.getByText("tydzień")).toBeInTheDocument();
    expect(screen.getByText("miesiąc")).toBeInTheDocument();
    expect(screen.getByText("kwartał")).toBeInTheDocument();
  });

  it("first chip has active class by default", () => {
    render(<OrdersWeekChart rows={rows} />);
    // Chip component is a span (no onClick — visual-only in RSC) with className "chip active"
    const tygodzenChip = screen.getByText("tydzień");
    expect(tygodzenChip.className).toMatch(/active/);
  });
});
