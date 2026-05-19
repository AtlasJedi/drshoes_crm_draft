import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarMonthGrid } from "../CalendarMonthGrid";
import type { CalendarOrderDto } from "@/lib/calendar/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/** Build a CalendarOrderDto with explicit plannedPickupAt (not defaulted). */
function makeOrder(
  id: string,
  receivedDayOfMonth: number,
  pickupDayOfMonth: number,
  pickupAtDefaulted = false,
  urgent = false,
): CalendarOrderDto {
  return {
    id,
    code: `DR-00${id}`,
    clientName: "Test Client",
    status: "W_REALIZACJI",
    plannedPickupAt: pickupAtDefaulted
      ? null
      : `2026-05-${String(pickupDayOfMonth).padStart(2, "0")}T12:00:00Z`,
    receivedAt: `2026-05-${String(receivedDayOfMonth).padStart(2, "0")}T09:00:00Z`,
    effectivePickupAt: `2026-05-${String(pickupDayOfMonth).padStart(2, "0")}T12:00:00Z`,
    pickupAtDefaulted,
    itemSummary: "Test item",
    urgent,
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
    expect(screen.getByTestId("cell-1")).toBeInTheDocument();
    expect(screen.getByTestId("cell-31")).toBeInTheDocument();
  });

  it("renders leading empty cells for the month start offset", () => {
    const { container } = render(<CalendarMonthGrid date={MAY_2026} scheduled={[]} />);
    const emptyCells = container.querySelectorAll("[data-empty='true']");
    // May 2026 starts on Friday → 4 leading empties (Mon offset)
    expect(emptyCells.length).toBe(4);
  });

  it("v2-B: places a GREEN received chip on receivedAt day", () => {
    const orders = [makeOrder("7", 7, 25)];
    render(<CalendarMonthGrid date={MAY_2026} scheduled={orders} />);
    const cell7 = screen.getByTestId("cell-7");
    expect(cell7).toHaveTextContent("DR-007");
    // Green received chip
    const chip = cell7.querySelector("[data-testid='chip-7-received']");
    expect(chip).toBeTruthy();
  });

  it("v2-B: places a RED due chip on effectivePickupAt day", () => {
    const orders = [makeOrder("7", 7, 25)];
    render(<CalendarMonthGrid date={MAY_2026} scheduled={orders} />);
    const cell25 = screen.getByTestId("cell-25");
    expect(cell25).toHaveTextContent("DR-007");
    const chip = cell25.querySelector("[data-testid='chip-7-due']");
    expect(chip).toBeTruthy();
  });

  it("v2-B: defaulted red chip gets due-defaulted marker type", () => {
    // received May 1, no plannedPickupAt → effectivePickupAt = May 15 (+14d)
    const orders = [makeOrder("1", 1, 15, true)];
    render(<CalendarMonthGrid date={MAY_2026} scheduled={orders} />);
    const cell15 = screen.getByTestId("cell-15");
    expect(cell15).toHaveTextContent("DR-001");
    const dueChip = cell15.querySelector("[data-testid='chip-1-due-defaulted']");
    expect(dueChip).toBeTruthy();
  });

  it("v2-B: same order appears in two different cells (received + due)", () => {
    const orders = [makeOrder("3", 3, 20)];
    render(<CalendarMonthGrid date={MAY_2026} scheduled={orders} />);
    expect(screen.getByTestId("cell-3")).toHaveTextContent("DR-003");
    expect(screen.getByTestId("cell-20")).toHaveTextContent("DR-003");
  });

  it("highlights today's cell", () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    render(<CalendarMonthGrid date={thisMonth} scheduled={[]} />);
    const todayCell = screen.queryByText("dziś");
    if (now.getMonth() === thisMonth.getMonth()) {
      expect(todayCell).toBeInTheDocument();
    }
  });

  it("urgent chip contains '!' marker", () => {
    const orders = [makeOrder("9", 9, 20, false, true)];
    render(<CalendarMonthGrid date={MAY_2026} scheduled={orders} />);
    // Both chips (received on day 9, due on day 20) should show "!"
    const cell9 = screen.getByTestId("cell-9");
    const marker = cell9.querySelector(".t-pilne-marker");
    expect(marker).toBeTruthy();
    expect(marker?.textContent).toBe("!");
  });

  it("non-urgent chip has no '!' marker", () => {
    const orders = [makeOrder("8", 8, 22, false, false)];
    render(<CalendarMonthGrid date={MAY_2026} scheduled={orders} />);
    const cell8 = screen.getByTestId("cell-8");
    const marker = cell8.querySelector(".t-pilne-marker");
    expect(marker).toBeNull();
  });
});
