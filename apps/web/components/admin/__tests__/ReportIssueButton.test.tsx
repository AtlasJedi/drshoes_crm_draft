import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReportIssueButton } from "../ReportIssueButton";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/orders",
}));

// Mock @opentelemetry/api — provide controllable traceId
const mockGetActiveSpan = vi.fn();
vi.mock("@opentelemetry/api", () => ({
  trace: {
    getActiveSpan: () => mockGetActiveSpan(),
  },
}));

// Mock fetch (used for trace-id warm-up when span is null/zero)
const mockFetch = vi.fn(() => Promise.resolve({ ok: true } as Response));
vi.stubGlobal("fetch", mockFetch);

// Mock navigator.clipboard
const mockClipboard = { writeText: vi.fn(() => Promise.resolve()) };
Object.defineProperty(navigator, "clipboard", {
  value: mockClipboard,
  configurable: true,
});

const VALID_TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const ZERO_TRACE  = "00000000000000000000000000000000";

function validSpan(traceId: string) {
  return { spanContext: () => ({ traceId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReportIssueButton", () => {
  it("renders Zgłoś problem button", () => {
    mockGetActiveSpan.mockReturnValue(validSpan(VALID_TRACE));
    render(<ReportIssueButton user="misza@drshoes.pl" />);
    expect(screen.getByRole("button", { name: /zgłoś problem/i })).toBeTruthy();
  });

  it("copies valid JSON payload on Kopiuj JSON click", async () => {
    mockGetActiveSpan.mockReturnValue(validSpan(VALID_TRACE));
    render(<ReportIssueButton user="misza@drshoes.pl" />);
    fireEvent.click(screen.getByRole("button", { name: /zgłoś problem/i }));
    await waitFor(() => screen.getByText(/kopiuj json/i));
    fireEvent.click(screen.getByText(/kopiuj json/i));
    await waitFor(() => expect(mockClipboard.writeText).toHaveBeenCalledOnce());
    const calls = mockClipboard.writeText.mock.calls as unknown as string[][];
    const rawCall = calls[0]?.[0] ?? "";
    const json = JSON.parse(rawCall) as Record<string, string>;
    expect(json.traceId).toBe(VALID_TRACE);
    expect(json.url).toBe("/admin/orders");
    expect(json.user).toBe("misza@drshoes.pl");
    expect(json.capturedAt).toBeTruthy();
    expect(json.jaegerUrl).toContain(VALID_TRACE);
  });

  it("renders Jaeger link with correct href", async () => {
    mockGetActiveSpan.mockReturnValue(validSpan(VALID_TRACE));
    render(<ReportIssueButton user="misza@drshoes.pl" />);
    fireEvent.click(screen.getByRole("button", { name: /zgłoś problem/i }));
    await waitFor(() => screen.getByRole("link", { name: /otwórz w jaeger/i }));
    const link = screen.getByRole("link", { name: /otwórz w jaeger/i });
    expect((link as HTMLAnchorElement).href).toContain(VALID_TRACE);
  });

  it("invokes fetch /api/health when traceId is all-zeros", async () => {
    // First call returns zero trace (no active span yet), second returns valid
    mockGetActiveSpan
      .mockReturnValueOnce(validSpan(ZERO_TRACE))
      .mockReturnValue(validSpan(VALID_TRACE));
    render(<ReportIssueButton user="misza@drshoes.pl" />);
    fireEvent.click(screen.getByRole("button", { name: /zgłoś problem/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/health"));
  });

  it("shows user email in modal", async () => {
    mockGetActiveSpan.mockReturnValue(validSpan(VALID_TRACE));
    render(<ReportIssueButton user="misza@drshoes.pl" />);
    fireEvent.click(screen.getByRole("button", { name: /zgłoś problem/i }));
    await waitFor(() => screen.getByText("misza@drshoes.pl"));
    expect(screen.getByText("misza@drshoes.pl")).toBeTruthy();
  });
});
