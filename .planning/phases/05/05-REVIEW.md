---
phase: 05-overview
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/components/overview/FilterBar.tsx
  - src/components/overview/HealthStrip.tsx
  - src/components/overview/KpiCards.tsx
  - src/components/overview/ProjectDrillDownDialog.tsx
  - src/components/overview/SyncBadge.tsx
  - src/components/ui/card.tsx
  - src/components/ui/dialog.tsx
  - src/lib/overview/selectors.ts
  - src/lib/overview/selectors.test.ts
  - src/lib/roadmap/loader.ts
  - src/lib/roadmap/loader.test.ts
  - src/lib/roadmap/schema.ts
  - src/lib/roadmap/schema.test.ts
  - src/pages/OverviewPage.tsx
  - src/router.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the Overview page slice: pure selectors (KPI/health rollups + URL
filter encode/decode/apply), the roadmap loader + revalidation gate, the Zod
schema, and the presentational components (FilterBar, HealthStrip, KpiCards,
drill-down dialog, SyncBadge).

Security posture is sound: no client-side Linear token, the loader only touches
`/api/linear/*` under `?source=live`, the live branch swallows every error and
falls back to the snapshot without throwing, and the Linear deep-link is
correctly guarded with `startsWith("https://linear.app/")` plus
`rel="noopener noreferrer"` (the guard even defeats the `linear.app.evil.com`
prefix trick because it requires the trailing slash). Attacker-controllable
searchParams are defensively parsed for priority (strict integer 0..4) and
from/to (real-calendar round-trip). Division-by-zero is guarded everywhere with
`total === 0`. No crashes, injections, secrets, or data-loss paths found.

The defects below are functional/UX correctness gaps and asymmetric-validation
quality issues, not blockers. The strongest is a silent no-op in the custom
date-range filter: a user can set a From (or To) date, see it populated in the
input, and have zero filtering applied.

## Warnings

### WR-01: Single-sided custom date range is silently ignored

**File:** `src/lib/overview/selectors.ts:220-234` (with `src/components/overview/FilterBar.tsx:206-229`)
**Issue:** `resolveRange` only honors the custom range when **both** `from` and
`to` are set (`if (filters.from && filters.to)`). The FilterBar renders two
independent `type="date"` inputs and lets quarter + custom dates coexist, so a
user very commonly sets only From ("everything after X") or only To. In that
case `resolveRange` skips the custom branch entirely: if no quarter is set it
returns `null` (no date filtering at all — undated projects even remain
included), and if a quarter is set the quarter silently wins. Meanwhile
`FilterBar` shows the entered date via `value={filters.from ?? ""}`, so the UI
implies an active filter that does nothing. This is a real functional gap, not a
styling nit.
**Fix:** Support open-ended ranges in `resolveRange`, e.g. treat a lone bound as
an unbounded comparison:
```ts
export function resolveRange(
  filters: Filters
): { start: string; end: string } | null {
  if (filters.from || filters.to) {
    return {
      start: filters.from ?? "0000-01-01",
      end: filters.to ?? "9999-12-31",
    };
  }
  if (filters.quarter) {
    const m = /^(\d{4})-Q([1-4])$/.exec(filters.quarter);
    if (!m) return null;
    const [, year, q] = m;
    const [start, end] = QUARTER_MONTH_RANGES[q];
    return { start: `${year}-${start}`, end: `${year}-${end}` };
  }
  return null;
}
```
If single-sided ranges are genuinely out of scope, at minimum disable/clear the
lone input or surface a hint so the UI never shows an inert value.

### WR-02: Reversed custom range (from > to) empties the view with no feedback

**File:** `src/lib/overview/selectors.ts:223-225`, `241-266`
**Issue:** `resolveRange` returns a reversed range verbatim (confirmed by the
`selectors.test.ts:297-300` "no throw" test). `applyFilters` then requires
`p.targetDate >= start && p.targetDate <= end`, which is unsatisfiable when
`start > end`, so every project is excluded and the page shows the generic "No
projects found" empty state with no indication that the date order is the cause.
Users who fat-finger the two date pickers get a confusing dead-end.
**Fix:** Normalize the bounds when both are present, so intent is preserved
regardless of entry order:
```ts
if (filters.from && filters.to) {
  const [start, end] =
    filters.from <= filters.to
      ? [filters.from, filters.to]
      : [filters.to, filters.from];
  return { start, end };
}
```
(Alternatively add `min`/`max` attributes on the date inputs in FilterBar.)

### WR-03: HealthStrip always renders every initiative, contradicting the filtered "initiatives" KPI

**File:** `src/pages/OverviewPage.tsx:52`, `src/lib/overview/selectors.ts:96-109`, `src/components/overview/HealthStrip.tsx:22-66`
**Issue:** `rollupInitiativeHealth(filtered, data.initiatives)` iterates the
**unfiltered** `data.initiatives`, emitting an all-zeros row for any initiative
with no projects in the filtered set. When the user filters by a single
initiative, the strip still shows a full-height row per initiative (all others
all-zero noise). This directly contradicts the KPI card, which by design counts
only distinct initiatives among the filtered projects (`computeKpis` →
`initiatives: 1`) — the selector file's own header invariant says "every KPI
reflects the same filtered input." So the KPI reads "1" while the strip renders
N rows. The always-show-zero-project-initiative behavior is intentional for
genuinely empty initiatives (see `selectors.test.ts:147-161`), but under an
active initiative filter it produces a misleading, inconsistent surface.
**Fix:** Drop zero-project rows when an initiative filter is active, or restrict
the rollup's initiative list to those present in the filtered set, e.g. pass the
filtered initiative ids through:
```ts
const activeInitiatives =
  filters.initiatives.length > 0
    ? data.initiatives.filter((i) => filters.initiatives.includes(i.id))
    : data.initiatives;
const health = rollupInitiativeHealth(filtered, activeInitiatives);
```
Confirm the intended product behavior before changing, since it is a judgment
call — but the current KPI-vs-strip mismatch should be resolved one way or the
other.

## Info

### IN-01: Schema does not bound `priority` to the 0..4 domain

**File:** `src/lib/roadmap/schema.ts:23`
**Issue:** `priority: z.number().int()` accepts any integer (e.g. `7`, `-1`),
but the rest of Phase 5 treats 0..4 as canonical: `decodeFilters` only admits
0..4 from the URL, so an out-of-domain priority can never be filtered, and it
renders as a raw number in `KpiCards` (`PRIORITY_LABELS[Number(priority)] ??
priority`) or as `"—"` in the drill-down dialog. Given CLAUDE.md's "defensive
parsing matters," the snapshot boundary is the right place to constrain this.
**Fix:** `priority: z.number().int().min(0).max(4)` (or `z.union` of literals),
matching the `PRIORITY_LABELS` domain.

### IN-02: Asymmetric defensive parsing — initiatives/statuses/quarter pass through unvalidated

**File:** `src/lib/overview/selectors.ts:165-184`
**Issue:** `decodeFilters` strictly validates and dedupes `priority` and
round-trips `from`/`to`, but `initiatives` and `statuses` are taken raw via
`getAll` (no dedupe) and `quarter` is `sp.get("quarter")` with no shape check
(validated only later, lazily, in `resolveRange`). It is not exploitable —
these values are only used in equality/`includes` checks and re-encoded — but an
arbitrary/garbage `?quarter=...` or duplicate `?initiative=A&initiative=A`
survives round-trips through `encodeFilters`, which is inconsistent with the
"decode is DEFENSIVE" contract stated in the same file's docstring.
**Fix:** Optionally validate `quarter` against `/^(\d{4})-Q[1-4]$/` in
`decodeFilters` (dropping invalid to `null`) and `[...new Set(...)]` the
initiative/status arrays, so the normalized state is the single source of truth.

### IN-03: `shouldRevalidateRoadmap` duplicates the loader's source-mode logic

**File:** `src/lib/roadmap/loader.ts:31-32`, `88-90`
**Issue:** The `source === "live"` check exists in two exported functions with a
comment warning "must not drift." Duplicated business logic across module
exports is a maintainability hazard — a future change to how the source mode is
determined must be mirrored in both places or revalidation silently desyncs from
the loader.
**Fix:** Extract a single `isLiveSource(url: URL): boolean` helper and call it
from both `roadmapLoader` and `shouldRevalidateRoadmap`.

---

_Reviewed: 2026-07-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
