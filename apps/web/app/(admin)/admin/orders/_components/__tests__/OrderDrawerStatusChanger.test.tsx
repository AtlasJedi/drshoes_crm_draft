/**
 * Slice F — sendTriggers plumbing.
 * Verifies that OrderDrawerStatusChanger passes the sendTriggers flag from
 * StatusChangeTriggerDialog through to the changeStatus API call.
 *
 * Strategy: mock changeStatus, render the component with a seeded order, simulate
 * clicking a status chip to open the dialog, then click "PYK"
 * (sendTriggers=false) or "PYK & SEND" (sendTriggers=true) and assert the
 * mock was called with the correct flag.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrderDrawerStatusChanger } from "../OrderDrawerStatusChanger";
import * as ordersApi from "@/lib/orders/api";
import * as messagingApi from "@/lib/messaging/api";
import type { OrderDto } from "@/lib/orders/types";

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/orders/api", () => ({
  changeStatus: vi.fn(),
}));

vi.mock("@/lib/messaging/api", () => ({
  getTriggers: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/locations", () => ({
  listLocations: vi.fn().mockResolvedValue([]),
  addOrderNote: vi.fn().mockResolvedValue({}),
}));

// ── fixture ───────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<OrderDto> = {}): OrderDto {
  return {
    id: "order-uuid-1",
    code: "ZL-001",
    clientId: "client-uuid-1",
    clientName: "Jan Kowalski",
    status: "PRZYJETE",
    source: "ADMIN",
    receivedAt: null,
    plannedPickupAt: null,
    pickedUpAt: null,
    assignedCraftsmanId: null,
    currentStorageLocationId: null,
    location: null,
    tags: null,
    totalPriceCents: 0,
    currency: "PLN",
    description: null,
    cancelledReason: null,
    version: 0,
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-01T10:00:00Z",
    items: [],
    quotedPriceCents: 0,
    advancePaidCents: 0,
    ...overrides,
  };
}

function makeUpdatedOrder(order: OrderDto): OrderDto {
  return { ...order, status: "W_REALIZACJI", version: 1 };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("OrderDrawerStatusChanger — sendTriggers plumbing (Slice F)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("'PYK' calls changeStatus with sendTriggers=false", async () => {
    const order = makeOrder();
    const updatedOrder = makeUpdatedOrder(order);
    (ordersApi.changeStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      order: updatedOrder,
      triggerSuggestion: null,
    });

    render(<OrderDrawerStatusChanger order={order} onOrderUpdated={vi.fn()} />);

    // Click "W realizacji" chip to open the dialog
    fireEvent.click(screen.getByRole("button", { name: /w realizacji/i }));

    // Dialog should appear
    await waitFor(() => expect(screen.getByText("PYK")).toBeInTheDocument());

    fireEvent.click(screen.getByText("PYK"));

    await waitFor(() =>
      expect(ordersApi.changeStatus).toHaveBeenCalledWith(
        "order-uuid-1",
        "W_REALIZACJI",
        0,
        false,   // sendTriggers=false
        "",
      )
    );
  });

  it("'PYK & SEND' calls changeStatus with sendTriggers=true (when trigger matches)", async () => {
    // Seed a trigger so the dialog shows the "PYK & SEND" button.
    // NOTE: TriggerDto uses JSON-STRING fields for eventParams and channels — not arrays/objects.
    // previewForStatus calls JSON.parse(t.eventParams) and JSON.parse(t.channels).
    (messagingApi.getTriggers as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "trig-1",
        name: "Gotowe — EMAIL",
        event: "STATUS_CHANGE",
        eventParams: '{"toStatus":"GOTOWE_DO_ODBIORU"}',
        channels: '["EMAIL"]',
        templateId: "tpl-1",
        templateName: "Gotowe — EMAIL",
        delayMinutes: 0,
        enabled: true,
        requiresManualConfirmation: false,
        createdAt: "2026-01-01T10:00:00Z",
        updatedAt: "2026-01-01T10:00:00Z",
      },
    ]);

    const order = makeOrder({ status: "W_REALIZACJI", version: 0 });
    const updatedOrder = makeUpdatedOrder({ ...order, status: "GOTOWE_DO_ODBIORU" });
    (ordersApi.changeStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      order: updatedOrder,
      triggerSuggestion: null,
    });

    render(<OrderDrawerStatusChanger order={order} onOrderUpdated={vi.fn()} />);

    // Wait for trigger to load then click the "Gotowe" chip
    await waitFor(() => expect(messagingApi.getTriggers).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /gotowe do odbioru/i }));

    // "PYK & SEND" only appears when there is a matching trigger
    await waitFor(() => expect(screen.getByText("PYK & SEND")).toBeInTheDocument());

    fireEvent.click(screen.getByText("PYK & SEND"));

    await waitFor(() =>
      expect(ordersApi.changeStatus).toHaveBeenCalledWith(
        "order-uuid-1",
        "GOTOWE_DO_ODBIORU",
        0,
        true,   // sendTriggers=true
        "",
      )
    );
  });
});
