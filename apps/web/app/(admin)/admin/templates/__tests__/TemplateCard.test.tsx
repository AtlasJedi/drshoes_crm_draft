import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TemplateCard } from "../_components/TemplateCard";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const TEMPLATE = {
  id: "tp1",
  name: "Potwierdzenie przyjęcia",
  channel: "EMAIL" as const,
  subject: "Dr Shoes — przyjęliśmy zlecenie",
  body: "Cześć {imię_klienta}!",
  active: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("TemplateCard", () => {
  it("renders template name", () => {
    render(<TemplateCard template={TEMPLATE} onEdit={vi.fn()} />);
    expect(screen.getByText("Potwierdzenie przyjęcia")).toBeInTheDocument();
  });

  it("renders channel chip", () => {
    render(<TemplateCard template={TEMPLATE} onEdit={vi.fn()} />);
    expect(screen.getByText("EMAIL")).toBeInTheDocument();
  });

  it("calls onEdit when edytuj is clicked", () => {
    const onEdit = vi.fn();
    render(<TemplateCard template={TEMPLATE} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: /edytuj/i }));
    expect(onEdit).toHaveBeenCalledWith(TEMPLATE);
  });

  it("renders inactive indicator when active=false", () => {
    render(<TemplateCard template={{ ...TEMPLATE, active: false }} onEdit={vi.fn()} />);
    expect(screen.getByText(/nieaktywny/i)).toBeInTheDocument();
  });
});
