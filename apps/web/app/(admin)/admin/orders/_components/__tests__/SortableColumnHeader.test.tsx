import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SortableColumnHeader, parseSortParam } from "../SortableColumnHeader";

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

describe("parseSortParam", () => {
  it("returns createdAt,desc when no sort param", () => {
    expect(parseSortParam(new URLSearchParams())).toEqual({ field: "createdAt", dir: "desc" });
  });

  it("parses a valid sort param", () => {
    expect(parseSortParam(new URLSearchParams("sort=receivedAt,asc"))).toEqual({
      field: "receivedAt",
      dir: "asc",
    });
  });

  it("falls back to default on invalid field", () => {
    expect(parseSortParam(new URLSearchParams("sort=badField,desc"))).toEqual({
      field: "createdAt",
      dir: "desc",
    });
  });
});

describe("SortableColumnHeader", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  it("renders label text", () => {
    render(<SortableColumnHeader field="createdAt" label="Utworzono" />);
    expect(screen.getByText("Utworzono")).toBeInTheDocument();
  });

  it("shows ↓ caret on default active column (createdAt, no sort param)", () => {
    render(<SortableColumnHeader field="createdAt" label="Utworzono" />);
    expect(screen.getByText("↓")).toBeInTheDocument();
  });

  it("does not show caret on inactive column", () => {
    render(<SortableColumnHeader field="receivedAt" label="Przyjęto" />);
    expect(screen.queryByText("↓")).not.toBeInTheDocument();
    expect(screen.queryByText("↑")).not.toBeInTheDocument();
  });

  it("clicking inactive column sets sort=<field>,desc in URL", () => {
    render(<SortableColumnHeader field="receivedAt" label="Przyjęto" />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("sort=receivedAt%2Cdesc"),
    );
  });

  it("clicking active DESC column toggles to ASC", () => {
    mockSearchParams = new URLSearchParams("sort=receivedAt,desc");
    render(<SortableColumnHeader field="receivedAt" label="Przyjęto" />);
    expect(screen.getByText("↓")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("sort=receivedAt%2Casc"),
    );
  });

  it("clicking active ASC column toggles to DESC", () => {
    mockSearchParams = new URLSearchParams("sort=code,asc");
    render(<SortableColumnHeader field="code" label="Kod" />);
    expect(screen.getByText("↑")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("sort=code%2Cdesc"),
    );
  });

  it("clicking a column resets page param", () => {
    mockSearchParams = new URLSearchParams("page=3");
    render(<SortableColumnHeader field="status" label="Status" />);
    fireEvent.click(screen.getByRole("button"));
    const calledUrl = mockReplace.mock.calls[0]?.[0] as string;
    expect(calledUrl).not.toContain("page=");
    expect(calledUrl).toContain("sort=status");
  });
});
