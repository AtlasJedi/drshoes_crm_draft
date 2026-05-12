/**
 * Unit tests for lib/calendar/window.ts — pure date math.
 * No DOM / no network. Exercises: mondayOfWeek, weekDays, weekWindow, dayWindow, isoToDateStr.
 */
import { describe, it, expect } from "vitest";
import {
  mondayOfWeek,
  sundayOfWeek,
  weekDays,
  weekWindow,
  dayWindow,
  isoToDateStr,
  toLocalDate,
  parseLocalDate,
} from "../window";

// Fixed reference dates:
//   2026-05-12 is a Tuesday
//   2026-05-11 is the Monday of that week
//   2026-05-17 is the Sunday of that week
//
//   2026-05-10 is a Sunday → its Monday is 2026-05-04, Sunday is 2026-05-10

describe("toLocalDate", () => {
  it("formats a date as YYYY-MM-DD using local components", () => {
    expect(toLocalDate(new Date(2026, 4, 12))).toBe("2026-05-12");
    expect(toLocalDate(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(toLocalDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("parseLocalDate", () => {
  it("round-trips with toLocalDate", () => {
    expect(toLocalDate(parseLocalDate("2026-05-12"))).toBe("2026-05-12");
  });
});

describe("mondayOfWeek", () => {
  it("returns the same day for a Monday", () => {
    const mon = new Date(2026, 4, 11); // 2026-05-11 Mon
    expect(toLocalDate(mondayOfWeek(mon))).toBe("2026-05-11");
  });

  it("returns Monday for a Tuesday input (2026-05-12 → 2026-05-11)", () => {
    const tue = new Date(2026, 4, 12); // 2026-05-12 Tue
    expect(toLocalDate(mondayOfWeek(tue))).toBe("2026-05-11");
  });

  it("returns Monday for a Sunday input (2026-05-10 → 2026-05-04)", () => {
    const sun = new Date(2026, 4, 10); // 2026-05-10 Sun
    expect(toLocalDate(mondayOfWeek(sun))).toBe("2026-05-04");
  });

  it("returns Monday for a Saturday input (2026-05-16 → 2026-05-11)", () => {
    const sat = new Date(2026, 4, 16); // 2026-05-16 Sat
    expect(toLocalDate(mondayOfWeek(sat))).toBe("2026-05-11");
  });
});

describe("sundayOfWeek", () => {
  it("returns Sunday for a Tuesday input (2026-05-12 → 2026-05-17)", () => {
    const tue = new Date(2026, 4, 12);
    expect(toLocalDate(sundayOfWeek(tue))).toBe("2026-05-17");
  });

  it("returns the same day for a Sunday", () => {
    const sun = new Date(2026, 4, 17); // 2026-05-17 Sun
    expect(toLocalDate(sundayOfWeek(sun))).toBe("2026-05-17");
  });
});

describe("weekDays", () => {
  it("returns exactly 7 dates starting from Monday", () => {
    const tue = new Date(2026, 4, 12);
    const days = weekDays(tue);
    expect(days).toHaveLength(7);
    expect(toLocalDate(days[0]!)).toBe("2026-05-11"); // Mon
    expect(toLocalDate(days[6]!)).toBe("2026-05-17"); // Sun
  });

  it("consecutive days differ by 1", () => {
    const days = weekDays(new Date(2026, 4, 12));
    for (let i = 1; i < 7; i++) {
      const diff = days[i]!.getDate() - days[i - 1]!.getDate();
      // diff is 1 except at month boundary where it wraps; check timestamp diff instead
      expect(days[i]!.getTime() - days[i - 1]!.getTime()).toBe(86_400_000);
    }
  });
});

describe("weekWindow", () => {
  it("returns Mon–Sun strings for a mid-week date", () => {
    const result = weekWindow(new Date(2026, 4, 12)); // Tue 2026-05-12
    expect(result.from).toBe("2026-05-11");
    expect(result.to).toBe("2026-05-17");
  });

  it("window from=Mon 2026-05-11, an order on 2026-05-10 is OUTSIDE the window", () => {
    const { from, to } = weekWindow(new Date(2026, 4, 12));
    expect("2026-05-10" >= from && "2026-05-10" <= to).toBe(false);
  });

  it("window to=Sun 2026-05-17, an order on 2026-05-26 is OUTSIDE the window", () => {
    const { from, to } = weekWindow(new Date(2026, 4, 12));
    expect("2026-05-26" >= from && "2026-05-26" <= to).toBe(false);
  });

  it("date 2026-05-12 is inside the week window", () => {
    const { from, to } = weekWindow(new Date(2026, 4, 12));
    expect("2026-05-12" >= from && "2026-05-12" <= to).toBe(true);
  });
});

describe("dayWindow", () => {
  it("returns the same from and to", () => {
    const result = dayWindow(new Date(2026, 4, 12));
    expect(result.from).toBe("2026-05-12");
    expect(result.to).toBe("2026-05-12");
  });
});

describe("isoToDateStr", () => {
  it("extracts YYYY-MM-DD from a full ISO timestamp", () => {
    expect(isoToDateStr("2026-05-12T10:30:00Z")).toBe("2026-05-12");
    expect(isoToDateStr("2026-12-31T23:59:59.000Z")).toBe("2026-12-31");
  });

  it("returns a plain date string unchanged", () => {
    expect(isoToDateStr("2026-05-12")).toBe("2026-05-12");
  });
});
