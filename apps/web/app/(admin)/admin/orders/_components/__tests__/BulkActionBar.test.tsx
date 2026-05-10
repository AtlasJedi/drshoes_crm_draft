import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BulkActionBar } from "../BulkActionBar";

const mockPost = vi.fn();
vi.mock("@/lib/orders/bulk-api", () => ({
  bulkChangeStatus: (...args: unknown[]) => mockPost(...args),
}));

const baseProps = {
  selectedIds: ["id-1", "id-2"],
  onClear: vi.fn(),
};

describe("BulkActionBar", () => {
  beforeEach(() => {
    mockPost.mockReset();
    vi.mocked(baseProps.onClear).mockReset();
  });

  it("renders when selectedIds is non-empty", () => {
    render(<BulkActionBar {...baseProps} />);
    expect(screen.getByText("2 zaznaczone")).toBeInTheDocument();
  });

  it("does not render when selectedIds is empty", () => {
    const { container } = render(
      <BulkActionBar {...baseProps} selectedIds={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("Anuluj button clears selection", () => {
    render(<BulkActionBar {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /anuluj/i }));
    expect(baseProps.onClear).toHaveBeenCalled();
  });

  it("Wykonaj button calls bulkChangeStatus with selectedIds and chosen status", async () => {
    mockPost.mockResolvedValueOnce({
      succeeded: [{ orderId: "id-1", code: "DR-01", fromStatus: "PRZYJETE", toStatus: "W_REALIZACJI" }],
      failed: [],
    });
    render(<BulkActionBar {...baseProps} />);

    // Select a target status in the dropdown
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "W_REALIZACJI" },
    });

    fireEvent.click(screen.getByRole("button", { name: /wykonaj/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith({
        orderIds: ["id-1", "id-2"],
        newStatus: "W_REALIZACJI",
        sendTriggers: false, // default
      });
    });
  });

  it("result modal opens after submit and shows success count", async () => {
    mockPost.mockResolvedValueOnce({
      succeeded: [
        { orderId: "id-1", code: "DR-01", fromStatus: "PRZYJETE", toStatus: "W_REALIZACJI" },
        { orderId: "id-2", code: "DR-02", fromStatus: "PRZYJETE", toStatus: "W_REALIZACJI" },
      ],
      failed: [],
    });
    render(<BulkActionBar {...baseProps} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "W_REALIZACJI" } });
    fireEvent.click(screen.getByRole("button", { name: /wykonaj/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 sukces/i)).toBeInTheDocument();
    });
  });

  it("result modal shows mixed outcomes with failure reasons", async () => {
    mockPost.mockResolvedValueOnce({
      succeeded: [{ orderId: "id-1", code: "DR-01", fromStatus: "PRZYJETE", toStatus: "W_REALIZACJI" }],
      failed: [{ orderId: "id-2", code: "DR-02", fromStatus: "WYDANE", error: "ILLEGAL_TRANSITION" }],
    });
    render(<BulkActionBar {...baseProps} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "W_REALIZACJI" } });
    fireEvent.click(screen.getByRole("button", { name: /wykonaj/i }));

    await waitFor(() => {
      expect(screen.getByText(/DR-02/)).toBeInTheDocument();
      expect(screen.getByText(/ILLEGAL_TRANSITION/i)).toBeInTheDocument();
    });
  });
});
