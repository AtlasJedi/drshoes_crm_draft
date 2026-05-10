import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BezTerminuPanel } from "../BezTerminuPanel";
import type { CalendarOrderDto } from "@/lib/calendar/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function makeUnscheduled(id: string): CalendarOrderDto {
  return {
    id,
    code: `DR-0${id}`,
    clientName: "Maciek N.",
    status: "PRZYJETE",
    plannedPickupAt: null,
    receivedAt: "2026-05-01T09:00:00Z",
    itemSummary: "Custom AF1",
    urgent: false,
  };
}

describe("BezTerminuPanel", () => {
  it("renders panel title 'Bez terminu'", () => {
    render(<BezTerminuPanel unscheduled={[]} />);
    expect(screen.getByText("Bez terminu")).toBeInTheDocument();
  });

  it("shows count badge with the number of unscheduled orders", () => {
    const orders = [makeUnscheduled("1"), makeUnscheduled("2"), makeUnscheduled("3")];
    render(<BezTerminuPanel unscheduled={orders} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders empty state when no unscheduled orders", () => {
    render(<BezTerminuPanel unscheduled={[]} />);
    expect(screen.getByText("Brak zleceń bez terminu")).toBeInTheDocument();
  });

  it("renders each unscheduled order row", () => {
    const orders = [makeUnscheduled("7"), makeUnscheduled("8")];
    render(<BezTerminuPanel unscheduled={orders} />);
    expect(screen.getAllByText("Maciek N.")).toHaveLength(2);
    expect(screen.getAllByText(/Custom AF1/)).toHaveLength(2);
  });

  it("clicking an order row pushes ?orderId= to URL", () => {
    const orders = [makeUnscheduled("42")];
    render(<BezTerminuPanel unscheduled={orders} />);
    // Click the row button
    fireEvent.click(
      screen.getAllByRole("button").find((b) => b.textContent?.includes("Maciek N."))!
    );
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("orderId=42"));
  });

  it("renders the 'przeciągnij' disabled hint", () => {
    render(<BezTerminuPanel unscheduled={[makeUnscheduled("1")]} />);
    expect(screen.getByText(/przeciągnij na dzień by zaplanować/)).toBeInTheDocument();
  });

  it("renders the legend section", () => {
    render(<BezTerminuPanel unscheduled={[]} />);
    expect(screen.getByText("Legenda")).toBeInTheDocument();
  });

  it("legend contains entries for each main status", () => {
    render(<BezTerminuPanel unscheduled={[]} />);
    // Spot-check a few Polish status labels
    expect(screen.getByText(/Przyjęte/i)).toBeInTheDocument();
    expect(screen.getByText(/W realizacji/i)).toBeInTheDocument();
    expect(screen.getByText(/Gotowe do odbioru/i)).toBeInTheDocument();
  });
});
