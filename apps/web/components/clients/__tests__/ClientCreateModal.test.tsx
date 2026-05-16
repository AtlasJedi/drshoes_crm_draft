/**
 * RTL tests for ClientCreateModal — RODO consent toggle.
 * Slice B acceptance criteria.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientCreateModal } from "../ClientCreateModal";
import * as clientsApi from "@/lib/clients/api";
import type { ClientDto } from "@/lib/clients/types";

vi.mock("@/lib/clients/api");

const CREATED_CLIENT: ClientDto = {
  id: "client-new-1",
  firstName: "Anna",
  lastName: null,
  phone: "+48600000001",
  email: null,
  preferredChannel: null,
  rodoConsentAt: "2026-05-16T10:00:00Z",
  notes: null,
  createdAt: "2026-05-16T10:00:00Z",
  updatedAt: "2026-05-16T10:00:00Z",
};

function setup() {
  const onCreate = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ClientCreateModal open={true} onOpenChange={onOpenChange} onCreate={onCreate} />
  );
  return { onCreate, onOpenChange };
}

describe("ClientCreateModal — RODO toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with RODO switch checked by default", () => {
    setup();
    const rodoSwitch = screen.getByRole("switch", { name: /rodo/i });
    expect(rodoSwitch).toBeChecked();
  });

  it("submits rodoConsent: true when toggle is checked (default)", async () => {
    const user = userEvent.setup();
    vi.mocked(clientsApi.createClient).mockResolvedValue(CREATED_CLIENT);
    const { onCreate } = setup();

    await user.type(screen.getByLabelText(/imię/i), "Anna");
    await user.type(screen.getByLabelText(/telefon/i), "+48600000001");
    await user.click(screen.getByRole("button", { name: /dodaj klienta/i }));

    await waitFor(() => {
      expect(clientsApi.createClient).toHaveBeenCalledWith(
        expect.objectContaining({ rodoConsent: true })
      );
    });
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(CREATED_CLIENT));
  });

  it("submits rodoConsent: false when toggle is unchecked", async () => {
    const user = userEvent.setup();
    vi.mocked(clientsApi.createClient).mockResolvedValue({
      ...CREATED_CLIENT,
      rodoConsentAt: null,
    });
    setup();

    await user.type(screen.getByLabelText(/imię/i), "Anna");
    await user.type(screen.getByLabelText(/telefon/i), "+48600000001");
    await user.click(screen.getByRole("switch", { name: /rodo/i }));
    await user.click(screen.getByRole("button", { name: /dodaj klienta/i }));

    await waitFor(() => {
      expect(clientsApi.createClient).toHaveBeenCalledWith(
        expect.objectContaining({ rodoConsent: false })
      );
    });
  });
});
