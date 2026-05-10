/**
 * RodoBadge — green pill when rodoConsentAt is set, amber pill when null.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RodoBadge } from "../RodoBadge";

describe("RodoBadge", () => {
  it("renders green consent badge with formatted month when rodoConsentAt is set", () => {
    render(<RodoBadge rodoConsentAt="2025-04-15T10:00:00Z" />);
    const badge = screen.getByTestId("rodo-badge");
    expect(badge).toHaveClass("bg-green");
    expect(badge).toHaveTextContent(/zgoda/i);
    // Month formatted as MM.YYYY — April 2025
    expect(badge).toHaveTextContent("04.2025");
  });

  it("renders amber no-consent badge when rodoConsentAt is null", () => {
    render(<RodoBadge rodoConsentAt={null} />);
    const badge = screen.getByTestId("rodo-badge");
    expect(badge).toHaveClass("bg-orange");
    expect(badge).toHaveTextContent(/brak zgody rodo/i);
  });
});
