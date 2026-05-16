import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrderDrawerNoteComposer } from "../OrderDrawerNoteComposer";
import * as api from "@/lib/locations";

vi.mock("@/lib/locations", () => ({
  listLocations: vi.fn().mockResolvedValue([
    { id: 1, name: "półka 1", position: 0, active: true },
    { id: 2, name: "suszarka", position: 1, active: true },
  ]),
  addOrderNote: vi.fn().mockResolvedValue({
    auditEntryId: "x", note: "ok", locationFrom: null, locationTo: "suszarka", createdAt: "now",
  }),
}));

const baseProps = {
  orderId: "ord-1",
  currentLocation: "półka 1" as string | null,
  onSaved: vi.fn(),
};

describe("OrderDrawerNoteComposer", () => {
  // Fix 3 (2026-05-16): composer is always expanded — no toggle button.

  it("form body is always visible — textarea renders without any click", async () => {
    render(<OrderDrawerNoteComposer {...baseProps} />);
    await waitFor(() => expect(screen.getByLabelText(/co się stało/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /dodaj wpis$/i })).toBeInTheDocument();
  });

  it("section header 'Dodaj wpis do historii' is visible", () => {
    render(<OrderDrawerNoteComposer {...baseProps} />);
    expect(screen.getByText(/dodaj wpis do historii/i)).toBeInTheDocument();
  });

  it("submit button disabled when note empty AND location unchanged", async () => {
    render(<OrderDrawerNoteComposer {...baseProps} />);
    await waitFor(() => expect(screen.getByRole("option", { name: "suszarka" })).toBeInTheDocument());
    const btn = screen.getByRole("button", { name: /dodaj wpis$/i });
    expect(btn).toBeDisabled();
  });

  it("enables submit when only note is filled", async () => {
    render(<OrderDrawerNoteComposer {...baseProps} />);
    await waitFor(() => screen.getByRole("option", { name: "suszarka" }));
    fireEvent.change(screen.getByLabelText(/co się stało/i), { target: { value: "elo" } });
    expect(screen.getByRole("button", { name: /dodaj wpis$/i })).toBeEnabled();
  });

  it("enables submit when only location changed", async () => {
    render(<OrderDrawerNoteComposer {...baseProps} />);
    await waitFor(() => screen.getByRole("option", { name: "suszarka" }));
    fireEvent.change(screen.getByLabelText(/miejsce/i), { target: { value: "suszarka" } });
    expect(screen.getByRole("button", { name: /dodaj wpis$/i })).toBeEnabled();
  });

  it("calls addOrderNote with the payload and onSaved on success", async () => {
    const onSaved = vi.fn();
    render(<OrderDrawerNoteComposer {...baseProps} onSaved={onSaved} />);
    await waitFor(() => screen.getByRole("option", { name: "suszarka" }));
    fireEvent.change(screen.getByLabelText(/co się stało/i), { target: { value: "po cleaningu" } });
    fireEvent.change(screen.getByLabelText(/miejsce/i), { target: { value: "suszarka" } });
    fireEvent.click(screen.getByRole("button", { name: /dodaj wpis$/i }));
    await waitFor(() =>
      expect(api.addOrderNote).toHaveBeenCalledWith("ord-1", {
        note: "po cleaningu",
        location: "suszarka",
      })
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("successful submit clears the form and calls onSaved", async () => {
    const onSaved = vi.fn();
    render(<OrderDrawerNoteComposer {...baseProps} onSaved={onSaved} />);
    await waitFor(() => screen.getByRole("option", { name: "suszarka" }));

    fireEvent.change(screen.getByLabelText(/co się stało/i), { target: { value: "po cleaningu" } });
    fireEvent.click(screen.getByRole("button", { name: /dodaj wpis$/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    // form stays visible (always expanded) but textarea is cleared
    expect(screen.getByLabelText(/co się stało/i)).toHaveValue("");
  });

  it("shows error when at_least_one_required is returned", async () => {
    (api.addOrderNote as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error(), { code: "at_least_one_required" })
    );
    render(<OrderDrawerNoteComposer {...baseProps} />);
    await waitFor(() => screen.getByRole("option", { name: "suszarka" }));
    fireEvent.change(screen.getByLabelText(/co się stało/i), { target: { value: "elo" } });
    fireEvent.click(screen.getByRole("button", { name: /dodaj wpis$/i }));
    await waitFor(() => {
      expect(screen.getByText(/podaj notatkę/i)).toBeInTheDocument();
    });
  });
});
