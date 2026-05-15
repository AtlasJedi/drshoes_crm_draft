import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TriggerCard } from "../_components/TriggerCard";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/messaging/api", () => ({
  toggleTrigger: vi.fn().mockResolvedValue({}),
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

describe("TriggerCard", () => {
  it("renders trigger name", () => {
    render(<TriggerCard trigger={TRIGGER} onEdit={vi.fn()} />);
    expect(screen.getByText("Gotowe — przyjdź odebrać")).toBeInTheDocument();
  });

  it("renders manual chip when requiresManualConfirmation", () => {
    render(<TriggerCard trigger={TRIGGER} onEdit={vi.fn()} />);
    expect(screen.getByText(/wymaga potwierdzenia/i)).toBeInTheDocument();
  });

  it("calls onEdit when edytuj button is clicked", () => {
    const onEdit = vi.fn();
    render(<TriggerCard trigger={TRIGGER} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: /edytuj/i }));
    expect(onEdit).toHaveBeenCalledWith(TRIGGER);
  });

  it("renders disabled opacity when trigger is inactive", () => {
    render(<TriggerCard trigger={{ ...TRIGGER, enabled: false }} onEdit={vi.fn()} />);
    const card = screen.getByText("Gotowe — przyjdź odebrać").closest("[data-testid='trigger-card']");
    expect(card).toHaveStyle({ opacity: "0.55" });
  });
});
