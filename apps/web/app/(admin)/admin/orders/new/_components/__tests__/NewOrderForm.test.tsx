/**
 * Tests for NewOrderForm — Slice A:
 *   - Wycena derived from items sum (read-only display)
 *   - Default one row on mount
 *   - Submit sends quotedPriceCents = sum of item prices
 *
 * Also covers money util units (plnToCents, centsToPlnDisplay, balanceDueCents).
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
// Integration: NewOrderForm — derived Wycena + default row
// ----------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockCreateOrder = vi.fn();
vi.mock("@/lib/orders/api", () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));

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

// Controlled mock: renders price inputs so the form can sum them.
// Each instance exposes an <input aria-label="item-price-{index}"> that
// calls onChange with the updated pricePln when changed.
vi.mock("../NewOrderItemRow", () => ({
  NewOrderItemRow: ({
    index,
    item,
    onChange,
  }: {
    index: number;
    item: { kind: string; description: string; pricePln: string };
    onChange: (i: number, next: { kind: string; description: string; pricePln: string }) => void;
  }) => (
    <input
      aria-label={`item-price-${index}`}
      data-testid={`item-row-${index}`}
      value={item.pricePln}
      onChange={(e) => onChange(index, { ...item, pricePln: e.target.value })}
    />
  ),
}));

import { NewOrderForm } from "../NewOrderForm";

describe("NewOrderForm — derived Wycena from items", () => {
  beforeEach(() => {
    mockCreateOrder.mockReset();
    mockCreateOrder.mockResolvedValue({ id: "order-uuid-1" });
  });

  it("renders exactly one item row by default", () => {
    render(<NewOrderForm users={[]} />);
    expect(screen.getAllByTestId(/item-row-/)).toHaveLength(1);
  });

  it("Wycena shows 0,00 zł when default item price is empty", () => {
    render(<NewOrderForm users={[]} />);
    const wycena = screen.getByRole("generic", { name: /wycena/i });
    expect(wycena.textContent).toBe("0,00 zł");
  });

  it("Wycena reflects sum after setting one item price to 200,00", async () => {
    render(<NewOrderForm users={[]} />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("item-price-0"), {
        target: { value: "200" },
      });
    });

    const wycena = screen.getByRole("generic", { name: /wycena/i });
    expect(wycena.textContent).toBe("200,00 zł");
  });

  it("Wycena = 350,00 zł for two items at 100 + 250", async () => {
    render(<NewOrderForm users={[]} />);

    // Set first row price
    await act(async () => {
      fireEvent.change(screen.getByLabelText("item-price-0"), {
        target: { value: "100" },
      });
    });

    // Add second row
    await act(async () => {
      fireEvent.click(screen.getByText("+ Dodaj pozycję"));
    });

    // Set second row price
    await act(async () => {
      fireEvent.change(screen.getByLabelText("item-price-1"), {
        target: { value: "250" },
      });
    });

    const wycena = screen.getByRole("generic", { name: /wycena/i });
    expect(wycena.textContent).toBe("350,00 zł");
  });

  it("submit sends quotedPriceCents equal to sum of item prices", async () => {
    render(<NewOrderForm users={[]} />);

    // Select client
    fireEvent.click(screen.getByText("Wybierz klienta"));

    // Set item price
    await act(async () => {
      fireEvent.change(screen.getByLabelText("item-price-0"), {
        target: { value: "250" },
      });
    });

    const form = document.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockCreateOrder).toHaveBeenCalledOnce();
    const req = mockCreateOrder.mock.calls[0]![0]!;
    expect(req.quotedPriceCents).toBe(25000);
  });

  it("submit sends advancePaidCents from the Zaliczka field", async () => {
    render(<NewOrderForm users={[]} />);

    fireEvent.click(screen.getByText("Wybierz klienta"));

    const advanceInput = screen.getByLabelText(/zaliczka/i);
    await act(async () => {
      fireEvent.change(advanceInput, { target: { value: "50" } });
    });

    const form = document.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockCreateOrder).toHaveBeenCalledOnce();
    const req = mockCreateOrder.mock.calls[0]![0]!;
    expect(req.advancePaidCents).toBe(5000);
  });

  it("Wycena display is not an editable input", () => {
    render(<NewOrderForm users={[]} />);
    // There should be no input with label matching /wycena/
    expect(screen.queryByRole("textbox", { name: /wycena/i })).toBeNull();
    expect(screen.queryByRole("spinbutton", { name: /wycena/i })).toBeNull();
  });

  it("shows helper text 'Suma z pozycji zlecenia' under Wycena", () => {
    render(<NewOrderForm users={[]} />);
    expect(screen.getByText(/suma z pozycji zlecenia/i)).toBeTruthy();
  });
});
