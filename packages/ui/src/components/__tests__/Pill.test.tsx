import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Pill } from "../Pill";

// Polish human-readable labels per status key (design spec)
const LABEL: Record<string, string> = {
  WSTEPNIE_PRZYJETE: "wstępnie przyjęte",
  PRZYJETE:          "przyjęte",
  W_REALIZACJI:      "w realizacji",
  CZEKA_NA_KLIENTA:  "czeka na klienta",
  GOTOWE_DO_ODBIORU: "gotowe do odbioru",
  WYDANE:            "wydane",
  ANULOWANE:         "anulowane",
};

const STATUS_CLASS: Record<string, string> = {
  WSTEPNIE_PRZYJETE: "pill-wstepne",
  PRZYJETE:          "pill-przyjete",
  W_REALIZACJI:      "pill-realizacja",
  CZEKA_NA_KLIENTA:  "pill-czeka",
  GOTOWE_DO_ODBIORU: "pill-gotowe",
  WYDANE:            "pill-wydane",
  ANULOWANE:         "pill-anulowane",
};

const statuses = Object.keys(LABEL) as (keyof typeof LABEL)[];

describe("Pill", () => {
  it("renders the Polish label for each status", () => {
    for (const s of statuses) {
      const { unmount } = render(<Pill status={s as any} />);
      expect(screen.getByText(LABEL[s])).toBeInTheDocument();
      unmount();
    }
  });

  it("applies the correct CSS class for each status", () => {
    for (const s of statuses) {
      const { container, unmount } = render(<Pill status={s as any} />);
      expect((container.firstChild as HTMLElement).className).toContain(STATUS_CLASS[s]);
      unmount();
    }
  });

  it("has .pill base class always", () => {
    const { container } = render(<Pill status="PRZYJETE" />);
    expect((container.firstChild as HTMLElement).className).toContain("pill");
  });
});
