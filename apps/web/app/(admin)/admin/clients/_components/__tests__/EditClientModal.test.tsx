/**
 * RTL tests for EditClientModal.
 * vi.mock is used to isolate updateClient from network.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditClientModal } from "../EditClientModal";
import * as clientsApi from "@/lib/clients/api";
import type { ClientDto } from "@/lib/clients/types";

vi.mock("@/lib/clients/api");
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const BASE_CLIENT: ClientDto = {
  id: "client-1",
  firstName: "Marek",
  lastName: "Kowalski",
  phone: "+48111222333",
  email: "marek@example.com",
  preferredChannel: "EMAIL",
  rodoConsentAt: "2026-04-01T10:00:00Z",
  notes: "Stały klient",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function setup(client = BASE_CLIENT) {
  const onOpenChange = vi.fn();
  render(
    <EditClientModal open={true} onOpenChange={onOpenChange} client={client} />
  );
  return { onOpenChange };
}

describe("EditClientModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pre-fills all fields from client prop", () => {
    setup();
    expect(screen.getByDisplayValue("Marek")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Kowalski")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+48111222333")).toBeInTheDocument();
    expect(screen.getByDisplayValue("marek@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Stały klient")).toBeInTheDocument();
    // RODO switch — checked because rodoConsentAt is non-null
    const rodoSwitch = screen.getByRole("switch", { name: /rodo/i });
    expect(rodoSwitch).toBeChecked();
    // EMAIL radio selected
    expect(screen.getByRole("radio", { name: /email/i })).toBeChecked();
  });

  it("happy path — submits correctly and closes modal", async () => {
    const user = userEvent.setup();
    vi.mocked(clientsApi.updateClient).mockResolvedValue({
      ...BASE_CLIENT,
      firstName: "Marcin",
    });
    const { onOpenChange } = setup();

    await user.clear(screen.getByLabelText(/imię/i));
    await user.type(screen.getByLabelText(/imię/i), "Marcin");
    await user.click(screen.getByRole("button", { name: /zapisz/i }));

    await waitFor(() => {
      expect(clientsApi.updateClient).toHaveBeenCalledWith("client-1", expect.objectContaining({
        firstName: "Marcin",
        preferredChannel: "EMAIL",
      }));
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows validation error when both phone and email are cleared", async () => {
    const user = userEvent.setup();
    setup();

    await user.clear(screen.getByLabelText(/telefon/i));
    await user.clear(screen.getByLabelText(/e-mail/i));
    await user.click(screen.getByRole("button", { name: /zapisz/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/musi być telefon lub e-mail/i);
    expect(clientsApi.updateClient).not.toHaveBeenCalled();
  });

  it("RODO toggle off sends rodoConsent: false", async () => {
    const user = userEvent.setup();
    vi.mocked(clientsApi.updateClient).mockResolvedValue(BASE_CLIENT);
    setup();

    await user.click(screen.getByRole("switch", { name: /rodo/i }));
    await user.click(screen.getByRole("button", { name: /zapisz/i }));

    await waitFor(() => {
      expect(clientsApi.updateClient).toHaveBeenCalledWith(
        "client-1",
        expect.objectContaining({ rodoConsent: false })
      );
    });
  });

  it("RODO toggle on (was null) sends rodoConsent: true", async () => {
    const user = userEvent.setup();
    vi.mocked(clientsApi.updateClient).mockResolvedValue({
      ...BASE_CLIENT,
      rodoConsentAt: null,
    });
    setup({ ...BASE_CLIENT, rodoConsentAt: null });
    vi.mocked(clientsApi.updateClient).mockResolvedValue(BASE_CLIENT);

    await user.click(screen.getByRole("switch", { name: /rodo/i }));
    await user.click(screen.getByRole("button", { name: /zapisz/i }));

    await waitFor(() => {
      expect(clientsApi.updateClient).toHaveBeenCalledWith(
        "client-1",
        expect.objectContaining({ rodoConsent: true })
      );
    });
  });

  it("channel radio group — switching to SMS updates payload", async () => {
    const user = userEvent.setup();
    vi.mocked(clientsApi.updateClient).mockResolvedValue(BASE_CLIENT);
    setup();

    await user.click(screen.getByRole("radio", { name: /sms/i }));
    await user.click(screen.getByRole("button", { name: /zapisz/i }));

    await waitFor(() => {
      expect(clientsApi.updateClient).toHaveBeenCalledWith(
        "client-1",
        expect.objectContaining({ preferredChannel: "SMS" })
      );
    });
  });

  it("ESC key closes modal without submitting", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = setup();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(clientsApi.updateClient).not.toHaveBeenCalled();
  });
});
