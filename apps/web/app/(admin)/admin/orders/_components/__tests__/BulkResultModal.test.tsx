import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BulkResultModal } from "../BulkResultModal";
import type { BulkStatusResult } from "@/lib/orders/bulk-api";

const succeeded = [
  { orderId: "id-1", code: "DR-01", fromStatus: "PRZYJETE", toStatus: "W_REALIZACJI" },
];
const failed = [
  { orderId: "id-2", code: "DR-02", fromStatus: "WYDANE", error: "ILLEGAL_TRANSITION" as const },
];

describe("BulkResultModal", () => {
  it("renders success rows", () => {
    render(
      <BulkResultModal
        open
        result={{ succeeded, failed: [] } as BulkStatusResult}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("DR-01")).toBeInTheDocument();
    expect(screen.getByText(/W realizacji/i)).toBeInTheDocument();
  });

  it("renders failure rows with error reason", () => {
    render(
      <BulkResultModal
        open
        result={{ succeeded: [], failed } as BulkStatusResult}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("DR-02")).toBeInTheDocument();
    expect(screen.getByText(/ILLEGAL_TRANSITION/i)).toBeInTheDocument();
  });

  it("renders mixed outcomes", () => {
    render(
      <BulkResultModal
        open
        result={{ succeeded, failed } as BulkStatusResult}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("DR-01")).toBeInTheDocument();
    expect(screen.getByText("DR-02")).toBeInTheDocument();
  });

  it("calls onClose when Zamknij is clicked", () => {
    const onClose = vi.fn();
    render(
      <BulkResultModal
        open
        result={{ succeeded, failed } as BulkStatusResult}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /zamknij/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
