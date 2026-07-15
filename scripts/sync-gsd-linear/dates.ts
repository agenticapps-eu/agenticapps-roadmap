// ---------------------------------------------------------------------------
// Date proposer for sync-gsd-linear (SYNC-03, D-06-06).
//
// Fixed cadence from an anchor, sequential by phase order. Completed phases
// keep whatever proposedDate they already carry (never invented/overwritten)
// -- v1 apply is create-only and must never suggest a live date change for a
// phase that already shipped. Phase order is computed component-wise on the
// dot-separated numeric segments of NormalizedPhase.number, NEVER via a
// whole-string float coercion (06-RESEARCH.md Pitfall 1: coercing "04.10"
// to a float collapses it onto "04.1" -- 4.10 === 4.1 -- silently colliding
// two distinct phases).
// ---------------------------------------------------------------------------

import type { NormalizedPhase } from "./config.ts";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Component-wise numeric segment parse. A non-numeric segment (e.g. a phase
 * dir with no leading numeric token, whose `number` falls back to the raw
 * slug -- parser.ts) maps to `Infinity` rather than `NaN`, so the comparator
 * below stays total: every comparison resolves to a real ordering instead of
 * `NaN` (falsy/unordered), which would otherwise make Array.sort's result
 * order undefined (WR-01).
 */
function numericSegment(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : Infinity;
}

/**
 * Orders two NormalizedPhase.number strings ("04", "04.2", "04.10")
 * component-wise: split on ".", compare each numeric segment left-to-right,
 * shorter-is-less on a tie. Never coerces the whole string to a float.
 */
export function comparePhaseNumber(a: string, b: string): number {
  const aParts = a.split(".").map(numericSegment);
  const bParts = b.split(".").map(numericSegment);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aVal = aParts[i];
    const bVal = bParts[i];
    if (aVal === undefined) return -1; // shorter is less
    if (bVal === undefined) return 1;
    if (aVal !== bVal) return aVal - bVal;
  }
  return 0;
}

/** Formats a Date as a Linear TimelessDate string ("YYYY-MM-DD"), UTC. */
function toTimelessDate(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayTimelessDate(): string {
  return toTimelessDate(new Date());
}

export interface ProposeDatesOptions {
  anchor?: string;
  cadenceWeeks?: number;
}

/**
 * Returns a NEW NormalizedPhase[] (does not mutate `phases`), sorted in
 * phase order, with `proposedDate` set for every not-completed phase: the
 * first not-completed phase anchors at `opts.anchor` (default today), each
 * subsequent not-completed phase is `cadenceWeeks` (default 2) later.
 * Completed phases keep their existing `proposedDate` untouched.
 */
export function proposeDates(
  phases: NormalizedPhase[],
  opts: ProposeDatesOptions = {}
): NormalizedPhase[] {
  const anchor = opts.anchor ?? todayTimelessDate();
  const cadenceWeeks = opts.cadenceWeeks ?? 2;
  const anchorMs = new Date(`${anchor}T00:00:00.000Z`).getTime();

  const sorted = [...phases].sort((a, b) => comparePhaseNumber(a.number, b.number));

  let notCompletedIndex = 0;
  return sorted.map((phase) => {
    if (phase.completed) {
      return { ...phase };
    }
    const targetMs = anchorMs + notCompletedIndex * cadenceWeeks * MS_PER_WEEK;
    notCompletedIndex += 1;
    return { ...phase, proposedDate: toTimelessDate(new Date(targetMs)) };
  });
}
