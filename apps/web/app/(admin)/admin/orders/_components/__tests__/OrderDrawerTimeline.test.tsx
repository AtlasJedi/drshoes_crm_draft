/**
 * Tests for OrderDrawerTimeline note rendering (M8 task m8-fb-1b).
 * Verifies that a note blockquote appears when ev.note is present,
 * and is absent when ev.note is null/undefined.
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
};

describe("OrderDrawerTimeline — note rendering", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

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
