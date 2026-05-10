import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MixDonut } from "../MixDonut";
import type { MixByTypeRowDto } from "@/lib/dashboard/types";

const mix: MixByTypeRowDto[] = [
  { kind: "NAPRAWA", count: 19, percent: 45 },
  { kind: "CUSTOM_BUTY", count: 14, percent: 33 },
  { kind: "CUSTOM_KURTKA", count: 9, percent: 22 },
];

describe("MixDonut", () => {
  it("renders heading", () => {
    render(<MixDonut mix={mix} totalActive={42} />);
    expect(screen.getByText("Mix zleceń")).toBeInTheDocument();
  });

  it("renders legend labels in Polish", () => {
    render(<MixDonut mix={mix} totalActive={42} />);
    expect(screen.getByText("Naprawy")).toBeInTheDocument();
    expect(screen.getByText("Custom buty")).toBeInTheDocument();
    expect(screen.getByText("Custom kurtki")).toBeInTheDocument();
  });

  it("renders total active count in SVG center", () => {
    render(<MixDonut mix={mix} totalActive={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders an SVG element", () => {
    const { container } = render(<MixDonut mix={mix} totalActive={42} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders zero state without crashing", () => {
    render(<MixDonut mix={[]} totalActive={0} />);
    expect(screen.getByText("Mix zleceń")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
