/**
 * Tests for ux-4: quoted price + advance payment fields.
 * Covers plnToCents util, "Do zapłaty" computation, and CreateOrderRequest payload.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { plnToCents, centsToPlnDisplay } from "@/lib/orders/money";

// ----------------------------------------------------------------
// Unit: plnToCents
// ----------------------------------------------------------------
describe("plnToCents", () => {
  it("converts Polish comma decimal correctly", () => {
    expect(plnToCents("3,50")).toBe(350);
  });

  it("converts dot decimal correctly", () => {
    expect(plnToCents("3.50")).toBe(350);
  });

  it("returns 0 for empty string", () => {
    expect(plnToCents("")).toBe(0);
  });

  it("returns 0 for invalid input", () => {
    expect(plnToCents("abc")).toBe(0);
  });

  it("returns 0 for negative input", () => {
    expect(plnToCents("-5")).toBe(0);
  });

  it("handles whole number correctly", () => {
    expect(plnToCents("350")).toBe(35000);
  });

  it("rounds correctly for sub-cent values", () => {
    expect(plnToCents("3,505")).toBe(351);
  });
});

// ----------------------------------------------------------------
// Unit: "Do zapłaty" computation (balanceDueCents = quoted - advance, clamped to 0)
// ----------------------------------------------------------------
describe("balanceDueCents computation", () => {
  function balance(quotedStr: string, advanceStr: string): number {
    return Math.max(0, plnToCents(quotedStr) - plnToCents(advanceStr));
  }

  it("normal case: 350 zł quoted, 100 zł advance → 250 zł balance", () => {
    expect(balance("350", "100")).toBe(25000);
  });

  it("no advance: full amount due", () => {
    expect(balance("350", "")).toBe(35000);
  });

  it("fully paid: 0 due", () => {
    expect(balance("350", "350")).toBe(0);
  });

  it("overpayment: clamps to 0 (no negative balance)", () => {
    expect(balance("100", "200")).toBe(0);
  });

  it("both empty: 0 due", () => {
    expect(balance("", "")).toBe(0);
  });
});

// ----------------------------------------------------------------
// Unit: centsToPlnDisplay
// ----------------------------------------------------------------
describe("centsToPlnDisplay", () => {
  it("formats 35000 cents as '350,00 zł'", () => {
    expect(centsToPlnDisplay(35000)).toBe("350,00 zł");
  });

  it("formats 0 cents as '0,00 zł'", () => {
    expect(centsToPlnDisplay(0)).toBe("0,00 zł");
  });

  it("formats 350 cents as '3,50 zł'", () => {
    expect(centsToPlnDisplay(350)).toBe("3,50 zł");
  });
});

// ----------------------------------------------------------------
// Integration: NewOrderForm sends quotedPriceCents + advancePaidCents
// ----------------------------------------------------------------

// Mock next/navigation before importing the component
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock the orders API
const mockCreateOrder = vi.fn();
vi.mock("@/lib/orders/api", () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));

// Mock ClientPicker — just renders a button that selects a fixed client
vi.mock("@/components/clients/ClientPicker", () => ({
  ClientPicker: ({ onChange }: { onChange: (c: { id: string }) => void }) => (
    <button
      type="button"
      onClick={() => onChange({ id: "client-uuid-1" })}
    >
      Wybierz klienta
    </button>
  ),
}));

// Mock NewOrderItemRow
vi.mock("../NewOrderItemRow", () => ({
  NewOrderItemRow: () => null,
}));

import { NewOrderForm } from "../NewOrderForm";

describe("NewOrderForm — quote/advance fields", () => {
  beforeEach(() => {
    mockCreateOrder.mockReset();
    mockCreateOrder.mockResolvedValue({ id: "order-uuid-1" });
  });

  it("submits quotedPriceCents and advancePaidCents in CreateOrderRequest", async () => {
    render(<NewOrderForm users={[]} />);

    // Select a client
    fireEvent.click(screen.getByText("Wybierz klienta"));

    // Fill Wycena
    const quotedInput = screen.getByLabelText(/wycena/i);
    fireEvent.change(quotedInput, { target: { value: "350" } });

    // Fill Zaliczka
    const advanceInput = screen.getByLabelText(/zaliczka/i);
    fireEvent.change(advanceInput, { target: { value: "100" } });

    // Submit
    const form = document.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockCreateOrder).toHaveBeenCalledOnce();
    const req = mockCreateOrder.mock.calls[0]![0]!;
    expect(req.quotedPriceCents).toBe(35000);
    expect(req.advancePaidCents).toBe(10000);
  });

  it("sends quotedPriceCents=0 and advancePaidCents=0 when inputs left empty", async () => {
    render(<NewOrderForm users={[]} />);

    fireEvent.click(screen.getByText("Wybierz klienta"));

    const form = document.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockCreateOrder).toHaveBeenCalledOnce();
    const req = mockCreateOrder.mock.calls[0]![0]!;
    expect(req.quotedPriceCents).toBe(0);
    expect(req.advancePaidCents).toBe(0);
  });

  it("shows 'Do zapłaty' preview when Wycena is filled", async () => {
    render(<NewOrderForm users={[]} />);

    const quotedInput = screen.getByLabelText(/wycena/i);
    await act(async () => {
      fireEvent.change(quotedInput, { target: { value: "350" } });
    });

    const advanceInput = screen.getByLabelText(/zaliczka/i);
    await act(async () => {
      fireEvent.change(advanceInput, { target: { value: "100" } });
    });

    expect(screen.getByText(/do zapłaty przy odbiorze/i)).toBeTruthy();
    expect(screen.getByText(/250,00 zł/)).toBeTruthy();
  });

  it("does not show 'Do zapłaty' when Wycena is empty", () => {
    render(<NewOrderForm users={[]} />);
    expect(screen.queryByText(/do zapłaty przy odbiorze/i)).toBeNull();
  });
});
