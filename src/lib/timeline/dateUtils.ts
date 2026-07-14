// Pure timeline date math (D-01, D-02, D-03, D-07). No external date library —
// only the Date constructor and arithmetic. Date strings are parsed as local
// midnight ("T00:00:00") to avoid UTC-offset drift.

export interface TimelineWindow {
  windowStart: Date;
  windowEnd: Date;
  windowDays: number;
}

/** Fixed 7-month window: first of the current month .. last day of (current month + 6). */
export function getWindow(now: Date = new Date()): TimelineWindow {
  const windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // Day 0 of (month + 7) is the last day of (month + 6).
  const windowEnd = new Date(now.getFullYear(), now.getMonth() + 7, 0);
  const windowDays = daysBetween(windowStart, windowEnd);
  return { windowStart, windowEnd, windowDays };
}

/** Whole-day difference b - a. */
export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

/** Seven month-column headers, e.g. "Jul 2026" .. "Jan 2027". */
export function getMonthColumns(
  windowStart: Date
): Array<{ label: string; date: Date }> {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(windowStart.getFullYear(), windowStart.getMonth() + i, 1);
    return {
      label: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      date,
    };
  });
}

/** Today-marker offset as a percentage of grid width (D-02). */
export function todayLeftPercent(
  now: Date,
  windowStart: Date,
  windowDays: number
): number {
  return (daysBetween(windowStart, now) / windowDays) * 100;
}

/**
 * Bar left/width as percentages of grid width, with D-03 symmetric clamping and a
 * `kind` discriminator so the caller never infers intent from `width <= 0`:
 *   "span"     normal or partly-in-window bar (real width; may be clamped at an edge)
 *   "fixedEnd" D-07 — targetDate present but startDate null (caller renders a 64px bar)
 *   "stub"     bar entirely off-window before/after (caller renders a 32px stub + cue)
 */
export function barPosition(
  startDate: string | null,
  targetDate: string,
  window: TimelineWindow
): {
  left: number;
  width: number;
  clampedLeft: boolean;
  clampedRight: boolean;
  kind: "span" | "fixedEnd" | "stub";
  // The clamped date range the bar box is sized to. Interior milestone markers
  // MUST position against this basis (not the raw start/target) or they drift on
  // window-clamped bars.
  effectiveStart: Date;
  effectiveEnd: Date;
} {
  const { windowStart, windowEnd, windowDays } = window;
  const target = new Date(targetDate + "T00:00:00");
  const clampedRight = target > windowEnd;
  const effectiveEnd = target > windowEnd ? windowEnd : target;

  // D-07: no startDate → fixed-width bar right-aligned to targetDate (caller uses 64px).
  if (startDate === null) {
    const left = (daysBetween(windowStart, effectiveEnd) / windowDays) * 100;
    return {
      left,
      width: 0,
      clampedLeft: false,
      clampedRight,
      kind: "fixedEnd",
      // No interior span; markers pin to the end (degenerate range).
      effectiveStart: effectiveEnd,
      effectiveEnd,
    };
  }

  const start = new Date(startDate + "T00:00:00");
  const clampedLeft = start < windowStart;

  // Clamp symmetrically at both edges. If the whole bar is after windowEnd,
  // pin effectiveStart to windowEnd so left=100% and width=0.
  let effectiveStart = start < windowStart ? windowStart : start;
  if (effectiveStart > windowEnd) effectiveStart = windowEnd;

  const left = (daysBetween(windowStart, effectiveStart) / windowDays) * 100;
  const rawWidth = (daysBetween(effectiveStart, effectiveEnd) / windowDays) * 100;

  return {
    left: Math.max(0, left),
    width: Math.max(0, rawWidth),
    clampedLeft,
    clampedRight,
    // Entirely off-window (before or after) collapses to zero effective width → stub.
    kind: rawWidth <= 0 ? "stub" : "span",
    effectiveStart,
    effectiveEnd,
  };
}

/**
 * A dated milestone's position as a percentage of a bar's own width, measured
 * against the bar's clamped effective range (from barPosition). Milestones
 * outside the visible range clamp to the nearest edge (0 or 100). Degenerate
 * (zero-length) ranges pin to 100.
 */
export function markerPercent(
  msDate: string,
  effectiveStart: Date,
  effectiveEnd: Date
): number {
  const span = effectiveEnd.getTime() - effectiveStart.getTime();
  if (span <= 0) return 100;
  const ms = new Date(msDate + "T00:00:00").getTime();
  const pct = ((ms - effectiveStart.getTime()) / span) * 100;
  return Math.min(100, Math.max(0, pct));
}
