import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { KpiTilesRow } from "../KpiTilesRow";
import type { DashboardKpiDto } from "@/lib/dashboard/types";

const kpis: DashboardKpiDto = {
  inProgressCount: 14,
  readyForPickupCount: 6,
  todayIntakeCount: 9,
  monthRevenueCents: 1824000,
  monthRevenueFormatted: "18 240 zł",
};

describe("KpiTilesRow", () => {
  it("renders all four tile labels", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByText("W realizacji")).toBeInTheDocument();
    expect(screen.getByText("Gotowe do odbioru")).toBeInTheDocument();
    expect(screen.getByText("Nowe rezerwacje (7d)")).toBeInTheDocument();
    expect(screen.getByText(/Przychód/)).toBeInTheDocument();
  });

  it("renders numeric values", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("18 240 zł")).toBeInTheDocument();
  });

  it("has data-testid attributes for each tile", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByTestId("kpi-tile-in-progress")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-tile-ready")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-tile-intake")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-tile-revenue")).toBeInTheDocument();
  });

  it("acid tile has data-accent=acid", () => {
    render(<KpiTilesRow kpis={kpis} />);
    // StatTile from @drshoes/ui sets data-accent on the tile root
    expect(screen.getByTestId("kpi-tile-in-progress")).toHaveAttribute("data-accent", "acid");
    expect(screen.getByTestId("kpi-tile-revenue")).toHaveAttribute("data-accent", "acid");
  });

  it("pink tile has data-accent=pink", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByTestId("kpi-tile-ready")).toHaveAttribute("data-accent", "pink");
  });

  it("blue tile has data-accent=blue", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByTestId("kpi-tile-intake")).toHaveAttribute("data-accent", "blue");
  });
});
