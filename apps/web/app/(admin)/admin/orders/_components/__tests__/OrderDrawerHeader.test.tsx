/**
 * Tests for OrderDrawerHeader (v2-F rework).
 * Verifies code display, sub-line, stepper, action buttons, and location in sub-line.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderDrawerHeader } from "../OrderDrawerHeader";

// @repo/ui is a workspace package not aliased in vitest — stub it out.
vi.mock("@drshoes/ui", () => ({
  Pill: ({ status }: { status: string }) => <span data-testid="pill">{status}</span>,
  I: {
    close: () => <svg data-testid="icon-close" />,
    more: () => <svg data-testid="icon-more" />,
  },
}));

// Minimal Radix Dialog context wrapper (Dialog.Close needs Dialog.Root)
import * as Dialog from "@radix-ui/react-dialog";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <Dialog.Root open>{children}</Dialog.Root>;
}

describe("OrderDrawerHeader — v2-F rework", () => {
  it("renders order code", () => {
    render(
      <Wrapper>
        <OrderDrawerHeader code="DR-1042" status="W_REALIZACJI" />
      </Wrapper>,
    );
    expect(screen.getByText("DR-1042")).toBeInTheDocument();
  });

  it("renders client name in sub-line when provided", () => {
    render(
      <Wrapper>
        <OrderDrawerHeader
          code="DR-1042"
          status="W_REALIZACJI"
          clientName="Jan Kowalski"
          receivedAt="2026-05-02T12:00:00Z"
        />
      </Wrapper>,
    );
    expect(screen.getByText(/Jan Kowalski/)).toBeInTheDocument();
    expect(screen.getByText(/przyjęte/)).toBeInTheDocument();
  });

  it("renders close button with aria-label", () => {
    render(
      <Wrapper>
        <OrderDrawerHeader code="DR-1042" status="PRZYJETE" />
      </Wrapper>,
    );
    expect(screen.getByRole("button", { name: "Zamknij" })).toBeInTheDocument();
  });

  it("renders more button with aria-label", () => {
    render(
      <Wrapper>
        <OrderDrawerHeader code="DR-1042" status="PRZYJETE" />
      </Wrapper>,
    );
    expect(screen.getByRole("button", { name: "Więcej opcji" })).toBeInTheDocument();
  });

  it("renders 5-step stepper", () => {
    render(
      <Wrapper>
        <OrderDrawerHeader code="DR-1042" status="W_REALIZACJI" />
      </Wrapper>,
    );
    expect(screen.getByLabelText("Etapy zlecenia")).toBeInTheDocument();
    // Steps 1-5
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders location in sub-line when location prop is provided", () => {
    render(
      <Wrapper>
        <OrderDrawerHeader
          code="DR-1042"
          status="W_REALIZACJI"
          clientName="Jan"
          location="półka 3"
        />
      </Wrapper>,
    );
    expect(screen.getByText(/półka 3/)).toBeInTheDocument();
  });

  it("does not show location text when location prop is absent", () => {
    render(
      <Wrapper>
        <OrderDrawerHeader code="DR-1042" status="W_REALIZACJI" clientName="Jan" />
      </Wrapper>,
    );
    expect(screen.queryByText(/półka/)).toBeNull();
  });
});
