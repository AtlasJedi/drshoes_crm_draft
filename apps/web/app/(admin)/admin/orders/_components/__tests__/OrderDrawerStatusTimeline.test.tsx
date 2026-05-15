// apps/web/app/(admin)/admin/orders/_components/__tests__/OrderDrawerStatusTimeline.test.tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { OrderDrawerStatusTimeline } from "../OrderDrawerStatusTimeline";

function getStates(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-step-state]"))
    .map((el) => el.getAttribute("data-step-state") ?? "");
}

describe("OrderDrawerStatusTimeline", () => {
  it("PRZYJETE: step 0 active, steps 1-4 future", () => {
    const { container } = render(<OrderDrawerStatusTimeline currentStatus="PRZYJETE" />);
    const states = getStates(container);
    expect(states).toEqual(["active", "future", "future", "future", "future"]);
  });

  it("W_REALIZACJI: step 0 past, step 1 active, steps 2-4 future", () => {
    const { container } = render(<OrderDrawerStatusTimeline currentStatus="W_REALIZACJI" />);
    const states = getStates(container);
    expect(states).toEqual(["past", "active", "future", "future", "future"]);
  });

  it("CZEKA_NA_KLIENTA: steps 0-1 past, step 2 active, steps 3-4 future", () => {
    const { container } = render(<OrderDrawerStatusTimeline currentStatus="CZEKA_NA_KLIENTA" />);
    const states = getStates(container);
    expect(states).toEqual(["past", "past", "active", "future", "future"]);
  });

  it("GOTOWE_DO_ODBIORU: steps 0-2 past, step 3 active, step 4 future", () => {
    const { container } = render(<OrderDrawerStatusTimeline currentStatus="GOTOWE_DO_ODBIORU" />);
    const states = getStates(container);
    expect(states).toEqual(["past", "past", "past", "active", "future"]);
  });

  it("WYDANE: steps 0-3 past, step 4 active", () => {
    const { container } = render(<OrderDrawerStatusTimeline currentStatus="WYDANE" />);
    const states = getStates(container);
    expect(states).toEqual(["past", "past", "past", "past", "active"]);
  });

  it("WSTEPNIE_PRZYJETE: step 0 active (pre-step = przyjęte bucket)", () => {
    const { container } = render(<OrderDrawerStatusTimeline currentStatus="WSTEPNIE_PRZYJETE" />);
    const states = getStates(container);
    expect(states[0]).toBe("active");
  });

  it("renders exactly 5 step circles", () => {
    const { container } = render(<OrderDrawerStatusTimeline currentStatus="PRZYJETE" />);
    expect(container.querySelectorAll("[data-step-state]").length).toBe(5);
  });
});
