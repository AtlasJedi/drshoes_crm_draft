/**
 * Tests for the role-aware AdminPage dashboard.
 *
 * Strategy:
 * - AdminPage is an async RSC — we await it directly to get the resolved JSX tree.
 * - We inspect the JSX element tree (type + props) without rendering into JSDOM,
 *   avoiding the Suspense/async-RSC resolution problem entirely.
 * - Components used DIRECTLY in AdminPage's JSX (PilnePanel, RecentMessagesPanel)
 *   are assertable via collectTypes. Components inside local async sections
 *   (KpiSection, ChartsSection, MixDonutSection) are asserted by section
 *   function name or by absence of the local section in the non-owner layout.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──

vi.mock("@/lib/auth/session", () => ({
  getMe: vi.fn(),
}));

vi.mock("@/lib/dashboard/api-server", () => ({
  getDashboardKpisServer: vi.fn(),
  getDashboardChartsServer: vi.fn(),
}));

vi.mock("@/lib/orders/api-server", () => ({
  listOrdersServer: vi.fn(),
}));

vi.mock("@/lib/messaging/api-server", () => ({
  listThreadsServer: vi.fn(),
}));

vi.mock("@/app/(admin)/admin/_components/DashboardPageHeaderSetter", () => ({
  DashboardPageHeaderSetter: () => null,
}));

vi.mock("@/app/(admin)/admin/_components/KpiTilesRow", () => ({
  KpiTilesRow: () => null,
}));

vi.mock("@/app/(admin)/admin/_components/OrdersWeekChart", () => ({
  OrdersWeekChart: () => null,
}));

vi.mock("@/app/(admin)/admin/_components/MixDonut", () => ({
  MixDonut: () => null,
}));

vi.mock("@/app/(admin)/admin/_components/PilnePanel", () => ({
  PilnePanel: () => null,
}));

vi.mock("@/app/(admin)/admin/_components/RecentMessagesPanel", () => ({
  RecentMessagesPanel: () => null,
}));

vi.mock("@/components/state/Skeleton", () => ({
  Skeleton: () => null,
}));

vi.mock("@/components/state/ErrorBanner", () => ({
  ErrorBanner: () => null,
}));

vi.mock("@drshoes/ui", () => ({
  AdminCard: ({ children }: { children?: unknown }) => children,
  Tape: () => null,
  Pill: () => null,
  PhImg: () => null,
}));

// ── Imports after mocks ──
import React from "react";
import type { ReactElement } from "react";
import { getMe } from "@/lib/auth/session";
import { getDashboardKpisServer, getDashboardChartsServer } from "@/lib/dashboard/api-server";
import AdminPage from "../page";

// Import mocked components to get their identity for tree comparison
import { PilnePanel } from "@/app/(admin)/admin/_components/PilnePanel";
import { RecentMessagesPanel } from "@/app/(admin)/admin/_components/RecentMessagesPanel";

const mockGetMe = getMe as ReturnType<typeof vi.fn>;
const mockGetKpis = getDashboardKpisServer as ReturnType<typeof vi.fn>;
const mockGetCharts = getDashboardChartsServer as ReturnType<typeof vi.fn>;

const MOCK_KPIS = {
  inProgressCount: 5, readyForPickupCount: 2, todayIntakeCount: 1,
  monthRevenueCents: 10000, monthRevenueFormatted: "100 zł",
  inProgressMoneyCents: 5000, inProgressMoneyFormatted: "50 zł",
  pickedUpMoneyMonthCents: 3000, pickedUpMoneyMonthFormatted: "30 zł",
};

const MOCK_CHARTS = {
  ordersPerWeek: [],
  mixByType: [
    { kind: "CZYSZCZENIE", count: 3, percent: 60 },
    { kind: "NAPRAWA", count: 2, percent: 40 },
  ],
};

/** Recursively collect all component types and function names in the JSX tree. */
function collectTypes(node: unknown, out = new Set<unknown>()): Set<unknown> {
  if (!React.isValidElement(node)) return out;
  const el = node as ReactElement;
  out.add(el.type);
  const props = el.props as Record<string, unknown>;
  const children = props.children;
  if (Array.isArray(children)) children.forEach((c) => collectTypes(c, out));
  else if (children) collectTypes(children, out);
  for (const [k, v] of Object.entries(props)) {
    if (k === "children") continue;
    if (React.isValidElement(v)) collectTypes(v, out);
    if (Array.isArray(v)) v.forEach((c) => collectTypes(c, out));
  }
  return out;
}

function hasComponent(tree: unknown, component: unknown): boolean {
  return collectTypes(tree).has(component);
}

/** Check whether any element has a type whose .name matches the given string. */
function hasFunctionNamed(tree: unknown, name: string): boolean {
  for (const t of collectTypes(tree)) {
    if (typeof t === "function" && t.name === name) return true;
  }
  return false;
}

describe("AdminPage — role-based layout (JSX tree assertions)", () => {
  describe("OWNER role", () => {
    beforeEach(() => {
      mockGetMe.mockResolvedValue({ id: "u1", email: "owner@test.pl", fullName: "Owner", role: "OWNER", lastLoginAt: null });
      mockGetKpis.mockResolvedValue(MOCK_KPIS);
      mockGetCharts.mockResolvedValue(MOCK_CHARTS);
    });

    it("includes PilnePanel in JSX tree", async () => {
      const tree = await AdminPage({ searchParams: Promise.resolve({}) });
      expect(hasComponent(tree, PilnePanel)).toBe(true);
    });

    it("includes RecentMessagesPanel in JSX tree", async () => {
      const tree = await AdminPage({ searchParams: Promise.resolve({}) });
      expect(hasComponent(tree, RecentMessagesPanel)).toBe(true);
    });

    it("includes KpiSection (owner-only section) in JSX tree", async () => {
      const tree = await AdminPage({ searchParams: Promise.resolve({}) });
      expect(hasFunctionNamed(tree, "KpiSection")).toBe(true);
    });

    it("does NOT include FreshReservationsPanel (removed from page)", async () => {
      const tree = await AdminPage({ searchParams: Promise.resolve({}) });
      const types = collectTypes(tree);
      const typeNames = Array.from(types).map((t) =>
        typeof t === "function" ? t.name : String(t)
      );
      expect(typeNames).not.toContain("FreshReservationsPanel");
    });
  });

  describe("EMPLOYEE role (worker layout)", () => {
    beforeEach(() => {
      mockGetMe.mockResolvedValue({ id: "u2", email: "emp@test.pl", fullName: "Worker", role: "EMPLOYEE", lastLoginAt: null });
      mockGetKpis.mockResolvedValue(MOCK_KPIS);
      mockGetCharts.mockResolvedValue(MOCK_CHARTS);
    });

    it("includes PilnePanel in JSX tree", async () => {
      const tree = await AdminPage({ searchParams: Promise.resolve({}) });
      expect(hasComponent(tree, PilnePanel)).toBe(true);
    });

    it("includes MixDonutSection (stats card) in JSX tree", async () => {
      const tree = await AdminPage({ searchParams: Promise.resolve({}) });
      expect(hasFunctionNamed(tree, "MixDonutSection")).toBe(true);
    });

    it("does NOT include KpiSection in JSX tree", async () => {
      const tree = await AdminPage({ searchParams: Promise.resolve({}) });
      expect(hasFunctionNamed(tree, "KpiSection")).toBe(false);
    });

    it("does NOT include RecentMessagesPanel in JSX tree", async () => {
      const tree = await AdminPage({ searchParams: Promise.resolve({}) });
      expect(hasComponent(tree, RecentMessagesPanel)).toBe(false);
    });
  });

  describe("CRAFTSMAN role (worker layout)", () => {
    beforeEach(() => {
      mockGetMe.mockResolvedValue({ id: "u3", email: "craft@test.pl", fullName: "Craftsman", role: "CRAFTSMAN", lastLoginAt: null });
      mockGetKpis.mockResolvedValue(MOCK_KPIS);
      mockGetCharts.mockResolvedValue(MOCK_CHARTS);
    });

    it("has PilnePanel and MixDonutSection, excludes KpiSection", async () => {
      const tree = await AdminPage({ searchParams: Promise.resolve({}) });
      expect(hasComponent(tree, PilnePanel)).toBe(true);
      expect(hasFunctionNamed(tree, "MixDonutSection")).toBe(true);
      expect(hasFunctionNamed(tree, "KpiSection")).toBe(false);
    });
  });
});
