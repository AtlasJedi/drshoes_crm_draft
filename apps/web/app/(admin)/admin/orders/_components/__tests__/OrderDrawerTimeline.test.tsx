/**
 * Tests for OrderDrawerTimeline (v2-F rework).
 * Verifies HistoryIcon-based rendering, DONE kind label, note blockquote,
 * and LocationMoveChip integration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OrderDrawerTimeline } from "../OrderDrawerTimeline";
import * as timelineApi from "@/lib/timeline/api";
import type { TimelineEvent } from "@/lib/timeline/types";

vi.mock("@/lib/timeline/api");

const baseEvent: TimelineEvent = {
  id: "evt-1",
  kind: "STATUS_CHANGED",
  occurredAt: "2026-05-12T10:00:00Z",
  actorFullName: "Anna K.",
  labels: {},
  note: null,
  locationFrom: null,
  locationTo: null,
};

describe("OrderDrawerTimeline — DONE kind (v2-F)", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("renders 'Wydane klientowi' label for DONE events", async () => {
    const doneEvent: TimelineEvent = { ...baseEvent, kind: "DONE" };
    vi.mocked(timelineApi.getOrderTimeline).mockResolvedValue([doneEvent]);

    render(<OrderDrawerTimeline orderId="order-1" refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Wydane klientowi")).toBeTruthy();
    });
  });

  it("renders 'Status zmieniony' label for STATUS_CHANGED events", async () => {
    vi.mocked(timelineApi.getOrderTimeline).mockResolvedValue([baseEvent]);

    render(<OrderDrawerTimeline orderId="order-2" refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Status zmieniony")).toBeTruthy();
    });
  });
});

describe("OrderDrawerTimeline — note rendering", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("renders note blockquote when ev.note is present", async () => {
    const eventWithNote: TimelineEvent = { ...baseEvent, note: "Klient zapłacił z góry" };
    vi.mocked(timelineApi.getOrderTimeline).mockResolvedValue([eventWithNote]);

    render(<OrderDrawerTimeline orderId="order-1" refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Klient zapłacił z góry")).toBeTruthy();
    });

    const blockquote = screen.getByText("Klient zapłacił z góry").closest("blockquote");
    expect(blockquote).toBeTruthy();
  });

  it("does not render blockquote when ev.note is null", async () => {
    const eventNoNote: TimelineEvent = { ...baseEvent, note: null };
    vi.mocked(timelineApi.getOrderTimeline).mockResolvedValue([eventNoNote]);

    render(<OrderDrawerTimeline orderId="order-2" refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Status zmieniony")).toBeTruthy();
    });

    expect(screen.queryByRole("blockquote")).toBeNull();
  });

  it("does not render blockquote when ev.note is undefined", async () => {
    const eventUndefinedNote: TimelineEvent = { ...baseEvent };
    vi.mocked(timelineApi.getOrderTimeline).mockResolvedValue([eventUndefinedNote]);

    render(<OrderDrawerTimeline orderId="order-3" refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Status zmieniony")).toBeTruthy();
    });

    expect(screen.queryByRole("blockquote")).toBeNull();
  });
});

describe("OrderDrawerTimeline — LocationMoveChip rendering", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("renders LocationMoveChip when both locationFrom and locationTo are set", async () => {
    const eventWithLocation: TimelineEvent = {
      ...baseEvent,
      locationFrom: "półka 1",
      locationTo: "suszarka",
    };
    vi.mocked(timelineApi.getOrderTimeline).mockResolvedValue([eventWithLocation]);

    render(<OrderDrawerTimeline orderId="order-loc-1" refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText(/półka 1/)).toBeTruthy();
    });
    expect(screen.getByText(/suszarka/)).toBeTruthy();
    expect(screen.getByText(/→/)).toBeTruthy();
  });

  it("does not render LocationMoveChip when both locationFrom and locationTo are null", async () => {
    const eventNoLocation: TimelineEvent = {
      ...baseEvent,
      locationFrom: null,
      locationTo: null,
    };
    vi.mocked(timelineApi.getOrderTimeline).mockResolvedValue([eventNoLocation]);

    render(<OrderDrawerTimeline orderId="order-loc-2" refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText("Status zmieniony")).toBeTruthy();
    });

    expect(screen.queryByText(/📍/)).toBeNull();
  });
});
