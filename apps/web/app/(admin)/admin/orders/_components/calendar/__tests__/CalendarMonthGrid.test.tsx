import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarMonthGrid } from "../CalendarMonthGrid";
import type { CalendarOrderDto } from "@/lib/calendar/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeOrder(id: string, dayOfMonth: number): CalendarOrderDto {
  return {
    id,
    code: `DR-00${id}`,
    clientName: "Test Client",
    status: "W_REALIZACJI",
    plannedPickupAt: `2026-05-${String(dayOfMonth).padStart(2, "0")}T12:00:00Z`,
    receivedAt: null,
    itemSummary: "Test item",
    urgent: false,
  };
}

// 2026-05-01 is a Friday; ISO week Mon=0, so offset = 4 (Mon,Tue,Wed,Thu = 4 leading empties).
const MAY_2026 = new Date(2026, 4, 1); // month is 0-indexed

describe("CalendarMonthGrid", () => {
  it("renders 7 day-of-week headers", () => {
    render(<CalendarMonthGrid date={MAY_2026} scheduled={[]} />);
    expect(screen.getByText("Pon")).toBeInTheDocument();
    expect(screen.getByText("Nd")).toBeInTheDocument();
  });

  it("renders a cell for every day of the month", () => {
    render(<CalendarMonthGrid date={MAY_2026} scheduled={[]} />);
    // Day 1 and day 31 should both appear
    expect(screen.getByTestId("cell-1")).toBeInTheDocument();
    expect(screen.getByTestId("cell-31")).toBeInTheDocument();
  });

  it("renders leading empty cells for the month start offset", () => {
    const { container } = render(<CalendarMonthGrid date={MAY_2026} scheduled={[]} />);
    const emptyCells = container.querySelectorAll("[data-empty='true']");
    // May 2026 starts on Friday → 4 leading empties (Mon offset)
    expect(emptyCells.length).toBe(4);
  });

  it("places an order in the correct day cell", () => {
    const orders = [makeOrder("7", 7)];
    render(<CalendarMonthGrid date={MAY_2026} scheduled={orders} />);
    const cell7 = screen.getByTestId("cell-7");
    expect(cell7).toHaveTextContent("DR-007");
  });

  it("highlights today's cell", () => {
    // Render with a date where today is within the month
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    render(<CalendarMonthGrid date={thisMonth} scheduled={[]} />);
    const todayCell = screen.queryByText("dziś");
    // todayCell exists only if today is within this month
    if (now.getMonth() === thisMonth.getMonth()) {
      expect(todayCell).toBeInTheDocument();
    }
  });
});
