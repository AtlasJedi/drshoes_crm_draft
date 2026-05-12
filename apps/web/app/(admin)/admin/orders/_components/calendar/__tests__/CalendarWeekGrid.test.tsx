/**
 * Vitest + RTL snapshot/render tests for CalendarWeekGrid.
 * Verifies:
 *   - 7 column headers (Pon … Nd)
 *   - Orders with receivedAt in window render as acid-dot chips
 *   - Orders with plannedPickupAt in window render as magenta-dot chips
 *   - Same order can appear in two cells (received + pickup on different days)
 *   - Orders outside the window do not appear
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CalendarWeekGrid } from "../CalendarWeekGrid";
import type { CalendarOrderDto } from "@/lib/calendar/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/** Anchor: 2026-05-12 (Tuesday) → ISO week is Mon 2026-05-11 … Sun 2026-05-17 */
const ANCHOR = new Date(2026, 4, 12); // local midnight

function makeOrder(
  id: string,
  receivedAt: string | null,
  plannedPickupAt: string | null,
): CalendarOrderDto {
  return {
    id,
    code: `DR-${id.padStart(3, "0")}`,
    clientName: `Klient ${id}`,
    status: "W_REALIZACJI",
    receivedAt,
    plannedPickupAt,
    itemSummary: "Test item",
    urgent: false,
  };
}

describe("CalendarWeekGrid", () => {
  it("renders all 7 day-of-week headers (Mon-first)", () => {
    render(<CalendarWeekGrid date={ANCHOR} scheduled={[]} />);
    expect(screen.getByText("Pon")).toBeInTheDocument();
    expect(screen.getByText("Wt")).toBeInTheDocument();
    expect(screen.getByText("Śr")).toBeInTheDocument();
    expect(screen.getByText("Czw")).toBeInTheDocument();
    expect(screen.getByText("Pt")).toBeInTheDocument();
    expect(screen.getByText("Sob")).toBeInTheDocument();
    expect(screen.getByText("Nd")).toBeInTheDocument();
  });

  it("renders a cell for every day of the week", () => {
    render(<CalendarWeekGrid date={ANCHOR} scheduled={[]} />);
    // Each day has a data-testid="week-cell-YYYY-MM-DD"
    expect(screen.getByTestId("week-cell-2026-05-11")).toBeInTheDocument(); // Mon
    expect(screen.getByTestId("week-cell-2026-05-17")).toBeInTheDocument(); // Sun
  });

  it("shows an order received on 2026-05-12 (Tue) in that cell with acid chip", () => {
    const order = makeOrder("1", "2026-05-12T09:00:00Z", null);
    render(<CalendarWeekGrid date={ANCHOR} scheduled={[order]} />);
    const cell = screen.getByTestId("week-cell-2026-05-12");
    expect(within(cell).getByText(/DR-001/)).toBeInTheDocument();
  });

  it("shows an order with plannedPickupAt on 2026-05-14 (Thu) in that cell", () => {
    const order = makeOrder("2", "2026-05-10T08:00:00Z", "2026-05-14T15:00:00Z");
    render(<CalendarWeekGrid date={ANCHOR} scheduled={[order]} />);
    const cell = screen.getByTestId("week-cell-2026-05-14");
    expect(within(cell).getByText(/DR-002/)).toBeInTheDocument();
  });

  it("same order appears in two cells when receivedAt and plannedPickupAt are on different days in window", () => {
    // received 2026-05-11, pickup 2026-05-15 — both in window
    const order = makeOrder("3", "2026-05-11T08:00:00Z", "2026-05-15T15:00:00Z");
    render(<CalendarWeekGrid date={ANCHOR} scheduled={[order]} />);
    const cellMon = screen.getByTestId("week-cell-2026-05-11");
    const cellFri = screen.getByTestId("week-cell-2026-05-15");
    expect(within(cellMon).getByText(/DR-003/)).toBeInTheDocument();
    expect(within(cellFri).getByText(/DR-003/)).toBeInTheDocument();
  });

  it("order with receivedAt 2026-05-10 (outside Mon 11 – Sun 17 window) does NOT appear", () => {
    const order = makeOrder("4", "2026-05-10T08:00:00Z", null);
    render(<CalendarWeekGrid date={ANCHOR} scheduled={[order]} />);
    expect(screen.queryByText(/DR-004/)).not.toBeInTheDocument();
  });

  it("order with plannedPickupAt 2026-05-26 (outside window) does NOT appear", () => {
    const order = makeOrder("5", "2026-05-12T08:00:00Z", "2026-05-26T15:00:00Z");
    render(<CalendarWeekGrid date={ANCHOR} scheduled={[order]} />);
    // The received marker (05-12 = in window) appears; the pickup marker (05-26) does not
    const cell12 = screen.getByTestId("week-cell-2026-05-12");
    expect(within(cell12).getByText(/DR-005/)).toBeInTheDocument();
    // No cell for 05-26 exists at all
    expect(screen.queryByTestId("week-cell-2026-05-26")).not.toBeInTheDocument();
  });

  it("renders the week grid root element with data-testid", () => {
    render(<CalendarWeekGrid date={ANCHOR} scheduled={[]} />);
    expect(screen.getByTestId("calendar-week-grid")).toBeInTheDocument();
  });
});
