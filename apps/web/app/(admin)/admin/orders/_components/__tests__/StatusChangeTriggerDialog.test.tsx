import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusChangeTriggerDialog } from "../StatusChangeTriggerDialog";
import type { TriggerPreview } from "../StatusChangeTriggerDialog";

const noopPreview: TriggerPreview = { kind: "none" };
const matchPreview: TriggerPreview = {
  kind: "match",
  templateName: "Gotowe — SMS",
  channels: ["SMS"],
  delayMinutes: 0,
  requiresManualConfirmation: false,
};

describe("StatusChangeTriggerDialog", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <StatusChangeTriggerDialog
        open={false}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders from/to status labels when open", () => {
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/w realizacji/i)).toBeTruthy();
  });

  it("shows 'Wyślij wiadomość' button when trigger matches", () => {
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="W_REALIZACJI"
        toStatus="GOTOWE_DO_ODBIORU"
        orderId="uuid-1"
        triggerPreview={matchPreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Wyślij wiadomość")).toBeTruthy();
  });

  it("always shows 'Tylko zmień status' button", () => {
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Tylko zmień status")).toBeTruthy();
  });

  it("calls onConfirm(true) when Wyślij is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="W_REALIZACJI"
        toStatus="GOTOWE_DO_ODBIORU"
        orderId="uuid-1"
        triggerPreview={matchPreview}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Wyślij wiadomość"));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it("calls onConfirm(false) when Tylko-zmień is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Tylko zmień status"));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it("calls onCancel when Anuluj is clicked", () => {
    const onCancel = vi.fn();
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Anuluj"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("renders clientName when provided", () => {
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        clientName="Magdalena K."
        triggerPreview={noopPreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/magdalena k\./i)).toBeTruthy();
  });
});
