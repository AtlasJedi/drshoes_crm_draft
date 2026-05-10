import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarCell } from "../CalendarCell";
import type { CalendarOrderDto } from "@/lib/calendar/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function makeOrder(id: string, status: CalendarOrderDto["status"] = "PRZYJETE"): CalendarOrderDto {
  return {
    id,
    code: `DR-00${id}`,
    clientName: "Bartek W.",
    status,
    plannedPickupAt: "2026-05-15T10:00:00Z",
    receivedAt: null,
    itemSummary: "DM 1460",
    urgent: false,
  };
}

describe("CalendarCell", () => {
  it("renders the day number", () => {
    render(<CalendarCell day={7} isToday={false} orders={[]} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows 'dziś' tape when isToday=true", () => {
    render(<CalendarCell day={7} isToday={true} orders={[]} />);
    expect(screen.getByText("dziś")).toBeInTheDocument();
  });

  it("does not show 'dziś' tape when isToday=false", () => {
    render(<CalendarCell day={8} isToday={false} orders={[]} />);
    expect(screen.queryByText("dziś")).not.toBeInTheDocument();
  });

  it("renders up to 3 orders", () => {
    const orders = [makeOrder("1"), makeOrder("2"), makeOrder("3"), makeOrder("4")];
    render(<CalendarCell day={5} isToday={false} orders={orders} />);
    expect(screen.getByText(/DR-001/)).toBeInTheDocument();
    expect(screen.getByText(/DR-002/)).toBeInTheDocument();
    expect(screen.getByText(/DR-003/)).toBeInTheDocument();
    expect(screen.queryByText(/DR-004/)).not.toBeInTheDocument();
  });

  it("shows overflow indicator when more than 3 orders", () => {
    const orders = [makeOrder("1"), makeOrder("2"), makeOrder("3"), makeOrder("4"), makeOrder("5")];
    render(<CalendarCell day={5} isToday={false} orders={orders} />);
    expect(screen.getByText(/\+ 2 więcej/)).toBeInTheDocument();
  });

  it("clicking an order pill pushes ?orderId= to URL", () => {
    const orders = [makeOrder("42")];
    render(<CalendarCell day={5} isToday={false} orders={orders} />);
    fireEvent.click(screen.getByText(/DR-0042/));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("orderId=42"));
  });

  it("today cell has a distinct background class", () => {
    const { container } = render(<CalendarCell day={7} isToday={true} orders={[]} />);
    // The root div should carry a today-highlight class or data attribute
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/today|acid/);
  });
});
