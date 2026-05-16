import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

  it("shows 'PYK & SEND' button when trigger matches", () => {
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
    expect(screen.getByText("PYK & SEND")).toBeTruthy();
  });

  it("always shows 'PYK' button", () => {
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
    expect(screen.getByText("PYK")).toBeTruthy();
  });

  it("calls onConfirm(true, '', undefined) when PYK & SEND is clicked with no note/location", () => {
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
    fireEvent.click(screen.getByText("PYK & SEND"));
    expect(onConfirm).toHaveBeenCalledWith(true, "", undefined);
  });

  it("calls onConfirm(false, '', undefined) when PYK is clicked with no note/location", () => {
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
    fireEvent.click(screen.getByText("PYK"));
    expect(onConfirm).toHaveBeenCalledWith(false, "", undefined);
  });

  it("renders note textarea with correct label", () => {
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
    expect(screen.getByLabelText("Notatka (opcjonalnie)")).toBeTruthy();
    const textarea = screen.getByRole("textbox");
    expect((textarea as HTMLTextAreaElement).maxLength).toBe(1000);
  });

  it("passes note value to onConfirm when submitted", () => {
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
    const textarea = screen.getByRole("textbox");
    act(() => { fireEvent.change(textarea, { target: { value: "Klient zapłacił z góry" } }); });
    fireEvent.click(screen.getByText("PYK"));
    expect(onConfirm).toHaveBeenCalledWith(false, "Klient zapłacił z góry", undefined);
  });

  it("renders location picker for W_REALIZACJI / CZEKA / GOTOWE only", () => {
    const locations = [
      { id: 1, name: "Półka A", position: 1, active: true },
      { id: 2, name: "Półka B", position: 2, active: true },
    ];

    const { rerender } = render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        currentLocation={null}
        locations={locations}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Miejsce (opcjonalnie)")).toBeTruthy();

    // PRZYJETE is NOT in the picker set
    rerender(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="WSTEPNIE_PRZYJETE"
        toStatus="PRZYJETE"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        currentLocation={null}
        locations={locations}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Miejsce (opcjonalnie)")).toBeNull();
  });

  it("passes chosen location to onConfirm when changed", () => {
    const onConfirm = vi.fn();
    const locations = [
      { id: 1, name: "Półka A", position: 1, active: true },
      { id: 2, name: "Półka B", position: 2, active: true },
    ];
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        currentLocation={null}
        locations={locations}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("Miejsce (opcjonalnie)") as HTMLSelectElement;
    act(() => { fireEvent.change(select, { target: { value: "Półka B" } }); });
    fireEvent.click(screen.getByText("PYK"));
    expect(onConfirm).toHaveBeenCalledWith(false, "", "Półka B");
  });

  it("omits location from onConfirm when unchanged", () => {
    const onConfirm = vi.fn();
    const locations = [{ id: 1, name: "Półka A", position: 1, active: true }];
    render(
      <StatusChangeTriggerDialog
        open={true}
        fromStatus="PRZYJETE"
        toStatus="W_REALIZACJI"
        orderId="uuid-1"
        triggerPreview={noopPreview}
        currentLocation="Półka A"
        locations={locations}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("PYK"));
    expect(onConfirm).toHaveBeenCalledWith(false, "", undefined);
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
