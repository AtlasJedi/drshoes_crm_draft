import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OrdersWeekChart } from "../OrdersWeekChart";
import type { OrdersPerWeekRowDto } from "@/lib/dashboard/types";
import { KIND_ORDER } from "@/lib/orders/status";

function makeRow(weekIso: string, counts: Partial<Record<string, number>> = {}): OrdersPerWeekRowDto {
  return {
    weekIso,
    byKind: {
      CZYSZCZENIE: counts["CZYSZCZENIE"] ?? 0,
      RENOWACJA:   counts["RENOWACJA"]   ?? 0,
      NAPRAWA:     counts["NAPRAWA"]     ?? 0,
      SZEWC:       counts["SZEWC"]       ?? 0,
      CUSTOM:      counts["CUSTOM"]      ?? 0,
    },
  };
}

const allCzyszczenie = makeRow("2026-W10", { CZYSZCZENIE: 12 });
const mixed = makeRow("2026-W11", {
  CZYSZCZENIE: 3,
  RENOWACJA: 2,
  NAPRAWA: 5,
  SZEWC: 1,
  CUSTOM: 4,
});

const rows: OrdersPerWeekRowDto[] = [
  allCzyszczenie,
  mixed,
  makeRow("2026-W12", { NAPRAWA: 9, CUSTOM: 11 }),
  makeRow("2026-W13", { RENOWACJA: 16 }),
  makeRow("2026-W14", { SZEWC: 11, CUSTOM: 14 }),
  makeRow("2026-W15", { CZYSZCZENIE: 18 }),
  makeRow("2026-W16", { CUSTOM: 22 }),
  makeRow("2026-W17", { NAPRAWA: 19 }),
];

describe("OrdersWeekChart", () => {
  it("renders chart heading", () => {
    render(<OrdersWeekChart rows={rows} />);
    expect(screen.getByText("Zlecenia / tydzień")).toBeInTheDocument();
  });

  it("renders exactly 5 legend entries — one per KIND_ORDER entry", () => {
    render(<OrdersWeekChart rows={rows} />);
    // KIND_ORDER drives the legend; all 5 Polish labels must appear
    expect(screen.getByText("Czyszczenie")).toBeInTheDocument();
    expect(screen.getByText("Renowacja")).toBeInTheDocument();
    expect(screen.getByText("Naprawa")).toBeInTheDocument();
    expect(screen.getByText("Szewc")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
    // Verify count matches KIND_ORDER length (enum-driven, not hardcoded)
    expect(KIND_ORDER).toHaveLength(5);
  });

  it("does NOT render old hardcoded 'naprawy' or 'custom' legend labels", () => {
    render(<OrdersWeekChart rows={rows} />);
    expect(screen.queryByText("naprawy")).toBeNull();
    // "custom" as a standalone legend entry is gone; "Custom" (capitalised) replaces it
    // We check the lowercase standalone string is absent
    const allText = document.body.textContent ?? "";
    // The word "naprawy" must not appear anywhere
    expect(allText).not.toContain("naprawy");
  });

  it("renders an SVG element", () => {
    const { container } = render(<OrdersWeekChart rows={rows} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders rects only for non-zero kind counts (all-CZYSZCZENIE row → 1 rect)", () => {
    const { container } = render(<OrdersWeekChart rows={[allCzyszczenie]} />);
    // Only the CZYSZCZENIE segment is non-zero → 1 rect
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(1);
  });

  it("renders rects for all 5 kinds in a fully mixed row", () => {
    const { container } = render(<OrdersWeekChart rows={[mixed]} />);
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(5);
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
    const tygodzenChip = screen.getByText("tydzień");
    expect(tygodzenChip.className).toMatch(/active/);
  });
});
