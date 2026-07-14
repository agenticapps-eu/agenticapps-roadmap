import { describe, it, expect } from "vitest";
import {
  getWindow,
  daysBetween,
  barPosition,
  getMonthColumns,
  todayLeftPercent,
} from "./dateUtils";

// July 2026 reference window: 2026-07-01 .. 2027-01-31 (7 months).
const JULY_2026 = new Date(2026, 6, 1);
const WINDOW = getWindow(JULY_2026);

describe("getWindow", () => {
  it("starts on the first day of the current month", () => {
    const { windowStart } = getWindow(JULY_2026);
    expect(windowStart.getFullYear()).toBe(2026);
    expect(windowStart.getMonth()).toBe(6); // July (0-indexed)
    expect(windowStart.getDate()).toBe(1);
  });

  it("ends on the last day of (current month + 6)", () => {
    const { windowEnd } = getWindow(JULY_2026);
    expect(windowEnd.getFullYear()).toBe(2027);
    expect(windowEnd.getMonth()).toBe(0); // January
    expect(windowEnd.getDate()).toBe(31);
  });
});

describe("daysBetween", () => {
  it("returns whole-day difference between two midnight dates", () => {
    expect(daysBetween(new Date(2026, 6, 1), new Date(2026, 6, 8))).toBe(7);
  });
});

describe("getMonthColumns", () => {
  it("returns 7 month labels Jul 2026 .. Jan 2027", () => {
    const labels = getMonthColumns(WINDOW.windowStart).map((c) => c.label);
    expect(labels).toEqual([
      "Jul 2026",
      "Aug 2026",
      "Sep 2026",
      "Oct 2026",
      "Nov 2026",
      "Dec 2026",
      "Jan 2027",
    ]);
  });
});

describe("todayLeftPercent", () => {
  it("is 0 when now is the window start", () => {
    expect(
      todayLeftPercent(WINDOW.windowStart, WINDOW.windowStart, WINDOW.windowDays)
    ).toBe(0);
  });
});

describe("barPosition", () => {
  it("normal fully-in-window bar is a span with real width, unclamped", () => {
    const pos = barPosition("2026-08-05", "2026-09-20", WINDOW);
    expect(pos.left).toBeGreaterThan(0);
    expect(pos.width).toBeGreaterThan(0);
    expect(pos.clampedLeft).toBe(false);
    expect(pos.clampedRight).toBe(false);
    expect(pos.kind).toBe("span");
  });

  it("D-03 starts-before-window: clamps left to 0, still a span (partly-in-window)", () => {
    const pos = barPosition("2026-06-22", "2026-08-17", WINDOW);
    expect(pos.clampedLeft).toBe(true);
    expect(pos.left).toBe(0);
    expect(pos.width).toBeGreaterThan(0);
    expect(pos.kind).toBe("span");
  });

  it("D-03 entirely-before-window: clampedLeft, zero effective width, stub", () => {
    const pos = barPosition("2026-04-13", "2026-05-08", WINDOW);
    expect(pos.clampedLeft).toBe(true);
    expect(pos.left).toBe(0);
    expect(pos.width).toBeLessThanOrEqual(0);
    expect(pos.kind).toBe("stub");
  });

  it("D-03 entirely-after-window: clampedRight, left=100, width=0, stub", () => {
    const pos = barPosition("2028-01-01", "2028-02-01", WINDOW);
    expect(pos.clampedRight).toBe(true);
    expect(pos.left).toBe(100);
    expect(pos.width).toBe(0);
    expect(pos.kind).toBe("stub");
  });

  it("D-07 targetDate present, startDate null: width 0, fixedEnd", () => {
    const pos = barPosition(null, "2026-09-20", WINDOW);
    expect(pos.width).toBe(0);
    expect(pos.kind).toBe("fixedEnd");
    expect(pos.clampedLeft).toBe(false);
  });
});
