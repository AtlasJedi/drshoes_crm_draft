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
  inProgressMoneyCents: 350000,
  inProgressMoneyFormatted: "3 500,00 zł",
  pickedUpMoneyMonthCents: 400000,
  pickedUpMoneyMonthFormatted: "4 000,00 zł",
};

describe("KpiTilesRow", () => {
  it("renders all four tile labels", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByText("W realizacji")).toBeInTheDocument();
    expect(screen.getByText("Gotowe do odbioru")).toBeInTheDocument();
    expect(screen.getByText("Pieniądze w realizacji")).toBeInTheDocument();
    expect(screen.getByText(/Wydane/)).toBeInTheDocument();
  });

  it("renders numeric values", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("3 500,00 zł")).toBeInTheDocument();
    expect(screen.getByText("4 000,00 zł")).toBeInTheDocument();
  });

  it("has data-testid attributes for each tile", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByTestId("kpi-tile-in-progress")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-tile-ready")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-tile-in-progress-money")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-tile-picked-up-money")).toBeInTheDocument();
  });

  it("acid tile has data-accent=acid", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByTestId("kpi-tile-in-progress")).toHaveAttribute("data-accent", "var(--kpi-sage)");
    expect(screen.getByTestId("kpi-tile-picked-up-money")).toHaveAttribute("data-accent", "var(--kpi-stone)");
  });

  it("pink tile has data-accent=pink", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByTestId("kpi-tile-ready")).toHaveAttribute("data-accent", "var(--kpi-amber)");
  });

  it("blue tile has data-accent=blue", () => {
    render(<KpiTilesRow kpis={kpis} />);
    expect(screen.getByTestId("kpi-tile-in-progress-money")).toHaveAttribute("data-accent", "var(--kpi-steel)");
  });
});
