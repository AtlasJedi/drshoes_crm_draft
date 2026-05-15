import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TriggerEditPanel } from "../_components/TriggerEditPanel";
import { api } from "@/lib/api";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({
  api: { patch: vi.fn().mockResolvedValue({}) },
}));

const TRIGGER = {
  id: "t1",
  name: "Gotowe — przyjdź odebrać",
  enabled: true,
  event: "STATUS_CHANGE",
  eventParams: "{}",
  channels: '["EMAIL","SMS"]',
  templateId: "tmpl1",
  templateName: "Potwierdzenie",
  delayMinutes: 0,
  requiresManualConfirmation: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("TriggerEditPanel", () => {
  it("renders trigger name in display heading", () => {
    render(<TriggerEditPanel trigger={TRIGGER} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("Gotowe — przyjdź odebrać")).toBeInTheDocument();
  });

  it("renders Tape 'edytujesz' header", () => {
    render(<TriggerEditPanel trigger={TRIGGER} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("edytujesz")).toBeInTheDocument();
  });

  it("renders all placeholder chips", () => {
    render(<TriggerEditPanel trigger={TRIGGER} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("{imię_klienta}")).toBeInTheDocument();
    expect(screen.getByText("{numer_zlecenia}")).toBeInTheDocument();
  });

  it("clicking placeholder chip appends text to textarea", () => {
    render(<TriggerEditPanel trigger={TRIGGER} onClose={vi.fn()} onSaved={vi.fn()} />);
    const ta = screen.getByRole("textbox", { name: /treść/i });
    fireEvent.change(ta, { target: { value: "Cześć " } });
    fireEvent.click(screen.getByText("{imię_klienta}"));
    expect((ta as HTMLTextAreaElement).value).toContain("{imię_klienta}");
  });

  it("clicking zapisz calls api.patch", async () => {
    render(<TriggerEditPanel trigger={TRIGGER} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /zapisz zmiany/i }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
  });

  it("close button calls onClose", () => {
    const onClose = vi.fn();
    render(<TriggerEditPanel trigger={TRIGGER} onClose={onClose} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /zamknij/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
