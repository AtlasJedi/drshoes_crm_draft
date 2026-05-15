import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TemplateEditPanel } from "../_components/TemplateEditPanel";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/messaging/api", () => ({
  updateTemplate: vi.fn().mockResolvedValue({}),
}));

const TEMPLATE = {
  id: "tp1",
  name: "Potwierdzenie przyjęcia",
  channel: "SMS" as const,
  subject: null,
  body: "Cześć!",
  active: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("TemplateEditPanel", () => {
  it("renders template name in heading", () => {
    render(<TemplateEditPanel template={TEMPLATE} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("Potwierdzenie przyjęcia")).toBeInTheDocument();
  });

  it("renders edytujesz tape", () => {
    render(<TemplateEditPanel template={TEMPLATE} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("edytujesz")).toBeInTheDocument();
  });

  it("placeholder chip click inserts text in textarea", () => {
    render(<TemplateEditPanel template={TEMPLATE} onClose={vi.fn()} onSaved={vi.fn()} />);
    const ta = screen.getByRole("textbox", { name: /treść/i });
    fireEvent.change(ta, { target: { value: "Hej " } });
    fireEvent.click(screen.getByText("{imię_klienta}"));
    expect((ta as HTMLTextAreaElement).value).toContain("{imię_klienta}");
  });

  it("save button calls updateTemplate", async () => {
    const { updateTemplate } = await import("@/lib/messaging/api");
    render(<TemplateEditPanel template={TEMPLATE} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /zapisz/i }));
    await waitFor(() => expect(updateTemplate).toHaveBeenCalled());
  });

  it("close button calls onClose", () => {
    const onClose = vi.fn();
    render(<TemplateEditPanel template={TEMPLATE} onClose={onClose} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /zamknij/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
