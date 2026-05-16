import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocationsList } from "../LocationsList";

const ACTIVE = { id: 1, name: "półka 1", position: 0, active: true };
const INACTIVE = { id: 2, name: "stary kąt", position: 0, active: false };

describe("LocationsList", () => {
  it("renders active locations", () => {
    render(<LocationsList locations={[ACTIVE]} onEdit={vi.fn()} onDeactivate={vi.fn()} />);
    expect(screen.getByText("półka 1")).toBeInTheDocument();
  });

  it("renders inactive locations as muted", () => {
    render(<LocationsList locations={[INACTIVE]} onEdit={vi.fn()} onDeactivate={vi.fn()} />);
    const row = screen.getByText("stary kąt").closest("[data-active]");
    expect(row).toHaveAttribute("data-active", "false");
  });

  it("calls onEdit when edit button clicked", () => {
    const onEdit = vi.fn();
    render(<LocationsList locations={[ACTIVE]} onEdit={onEdit} onDeactivate={vi.fn()} />);
    screen.getByLabelText(/edytuj/i).click();
    expect(onEdit).toHaveBeenCalledWith(ACTIVE);
  });

  it("calls onDeactivate when deactivate button clicked", () => {
    const onDeactivate = vi.fn();
    render(<LocationsList locations={[ACTIVE]} onEdit={vi.fn()} onDeactivate={onDeactivate} />);
    screen.getByLabelText(/dezaktywuj/i).click();
    expect(onDeactivate).toHaveBeenCalledWith(ACTIVE);
  });

  it("shows empty state when list is empty", () => {
    render(<LocationsList locations={[]} onEdit={vi.fn()} onDeactivate={vi.fn()} />);
    expect(screen.getByText(/brak miejsc/i)).toBeInTheDocument();
  });
});
