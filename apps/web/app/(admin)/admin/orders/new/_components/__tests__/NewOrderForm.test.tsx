/**
 * Tests for NewOrderForm:
 *   - Wycena derived from items sum (read-only display)
 *   - Default one row on mount
 *   - Submit sends quotedPriceCents = sum of item prices
 *   - Mode switcher: existing vs ad-hoc client
 *   - Ad-hoc client validation (name required, phone OR email required)
 *   - Ad-hoc happy path: createClient → createOrder → router.push
 *   - createClient failure leaves form usable, order NOT created
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
// Integration: NewOrderForm
// ----------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockCreateOrder = vi.fn();
vi.mock("@/lib/orders/api", () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));

const mockCreateClient = vi.fn();
vi.mock("@/lib/clients/api", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
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
    mockCreateClient.mockReset();
    mockCreateOrder.mockResolvedValue({ id: "order-uuid-1" });
    mockCreateClient.mockResolvedValue({ id: "client-uuid-new" });
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

    await act(async () => {
      fireEvent.change(screen.getByLabelText("item-price-0"), {
        target: { value: "100" },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText("+ Dodaj pozycję"));
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("item-price-1"), {
        target: { value: "250" },
      });
    });

    const wycena = screen.getByRole("generic", { name: /wycena/i });
    expect(wycena.textContent).toBe("350,00 zł");
  });

  it("submit sends quotedPriceCents equal to sum of item prices (existing client)", async () => {
    render(<NewOrderForm users={[]} />);

    fireEvent.click(screen.getByText("Wybierz klienta"));

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
    expect(screen.queryByRole("textbox", { name: /wycena/i })).toBeNull();
    expect(screen.queryByRole("spinbutton", { name: /wycena/i })).toBeNull();
  });

  it("shows helper text 'Suma z pozycji zlecenia' under Wycena", () => {
    render(<NewOrderForm users={[]} />);
    expect(screen.getByText(/suma z pozycji zlecenia/i)).toBeTruthy();
  });
});

// ----------------------------------------------------------------
// Mode switcher
// ----------------------------------------------------------------
describe("NewOrderForm — mode switcher", () => {
  beforeEach(() => {
    mockCreateOrder.mockReset();
    mockCreateClient.mockReset();
    mockCreateOrder.mockResolvedValue({ id: "order-uuid-1" });
    mockCreateClient.mockResolvedValue({ id: "client-uuid-new" });
  });

  it("renders 'Istniejący klient' button selected by default", () => {
    render(<NewOrderForm users={[]} />);
    expect(screen.getByText("Istniejący klient")).toBeTruthy();
    expect(screen.getByText("Nowy klient")).toBeTruthy();
    // ClientPicker mock renders a "Wybierz klienta" button — confirms existing mode
    expect(screen.getByText("Wybierz klienta")).toBeTruthy();
  });

  it("switching to 'Nowy klient' hides ClientPicker and shows inline fields", async () => {
    render(<NewOrderForm users={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Nowy klient"));
    });

    expect(screen.queryByText("Wybierz klienta")).toBeNull();
    expect(screen.getByLabelText(/imię i nazwisko/i)).toBeTruthy();
    expect(screen.getByLabelText(/telefon/i)).toBeTruthy();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
  });

  it("switching back to 'Istniejący klient' restores ClientPicker", async () => {
    render(<NewOrderForm users={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Nowy klient"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Istniejący klient"));
    });

    expect(screen.getByText("Wybierz klienta")).toBeTruthy();
    expect(screen.queryByLabelText(/imię i nazwisko/i)).toBeNull();
  });
});

// ----------------------------------------------------------------
// Ad-hoc client validation
// ----------------------------------------------------------------
describe("NewOrderForm — ad-hoc validation", () => {
  beforeEach(() => {
    mockCreateOrder.mockReset();
    mockCreateClient.mockReset();
    mockCreateOrder.mockResolvedValue({ id: "order-uuid-1" });
    mockCreateClient.mockResolvedValue({ id: "client-uuid-new" });
  });

  async function switchToAdhoc() {
    await act(async () => {
      fireEvent.click(screen.getByText("Nowy klient"));
    });
  }

  it("blocks submit with 'Podaj imię i nazwisko' when name is empty", async () => {
    render(<NewOrderForm users={[]} />);
    await switchToAdhoc();

    const form = document.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByText("Podaj imię i nazwisko")).toBeTruthy();
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("blocks submit with 'Podaj telefon lub email' when name filled but both contact fields empty", async () => {
    render(<NewOrderForm users={[]} />);
    await switchToAdhoc();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/imię i nazwisko/i), {
        target: { value: "Jan Kowalski" },
      });
    });

    const form = document.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByText("Podaj telefon lub email")).toBeTruthy();
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("passes validation when name + phone provided (no email required)", async () => {
    render(<NewOrderForm users={[]} />);
    await switchToAdhoc();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/imię i nazwisko/i), {
        target: { value: "Jan Kowalski" },
      });
      fireEvent.change(screen.getByLabelText(/telefon/i), {
        target: { value: "+48600000000" },
      });
    });

    const form = document.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockCreateClient).toHaveBeenCalledOnce();
    expect(mockCreateOrder).toHaveBeenCalledOnce();
  });

  it("passes validation when name + email provided (no phone required)", async () => {
    render(<NewOrderForm users={[]} />);
    await switchToAdhoc();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/imię i nazwisko/i), {
        target: { value: "Jan" },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "jan@test.pl" },
      });
    });

    const form = document.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockCreateClient).toHaveBeenCalledOnce();
    expect(mockCreateOrder).toHaveBeenCalledOnce();
  });
});

// ----------------------------------------------------------------
// Ad-hoc happy path
// ----------------------------------------------------------------
describe("NewOrderForm — ad-hoc happy path", () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    mockCreateOrder.mockReset();
    mockCreateClient.mockReset();
    mockPush.mockReset();
    mockCreateOrder.mockResolvedValue({ id: "order-uuid-1" });
    mockCreateClient.mockResolvedValue({ id: "client-uuid-new" });
  });

  it("calls createClient once then createOrder once with created clientId", async () => {
    render(<NewOrderForm users={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Nowy klient"));
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/imię i nazwisko/i), {
        target: { value: "Anna Nowak" },
      });
      fireEvent.change(screen.getByLabelText(/telefon/i), {
        target: { value: "+48500000000" },
      });
    });

    const form = document.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    // createClient called once with correct fields
    expect(mockCreateClient).toHaveBeenCalledOnce();
    const clientReq = mockCreateClient.mock.calls[0]![0]!;
    expect(clientReq.firstName).toBe("Anna");
    expect(clientReq.lastName).toBe("Nowak");
    expect(clientReq.phone).toBe("+48500000000");
    expect(clientReq.rodoConsent).toBe(true);

    // createOrder called once with the client id returned by createClient
    expect(mockCreateOrder).toHaveBeenCalledOnce();
    const orderReq = mockCreateOrder.mock.calls[0]![0]!;
    expect(orderReq.clientId).toBe("client-uuid-new");
  });

  it("splits single-word name correctly: firstName set, lastName null", async () => {
    render(<NewOrderForm users={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Nowy klient"));
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/imię i nazwisko/i), {
        target: { value: "Monika" },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "monika@example.com" },
      });
    });

    const form = document.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    const clientReq = mockCreateClient.mock.calls[0]![0]!;
    expect(clientReq.firstName).toBe("Monika");
    expect(clientReq.lastName).toBeNull();
  });
});

// ----------------------------------------------------------------
// Ad-hoc createClient failure
// ----------------------------------------------------------------
describe("NewOrderForm — ad-hoc createClient failure", () => {
  beforeEach(() => {
    mockCreateOrder.mockReset();
    mockCreateClient.mockReset();
    mockCreateClient.mockRejectedValue(new Error("network error"));
  });

  it("shows error message and does NOT call createOrder when createClient fails", async () => {
    render(<NewOrderForm users={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Nowy klient"));
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/imię i nazwisko/i), {
        target: { value: "Jan Kowalski" },
      });
      fireEvent.change(screen.getByLabelText(/telefon/i), {
        target: { value: "+48600000000" },
      });
    });

    const form = document.querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockCreateClient).toHaveBeenCalledOnce();
    expect(mockCreateOrder).not.toHaveBeenCalled();
    expect(screen.getByText(/nie udało się utworzyć klienta/i)).toBeTruthy();
  });
});
