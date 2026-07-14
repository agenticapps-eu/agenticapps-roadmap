---
phase: 04-roadmap-timeline-ui
plan: 06
subsystem: timeline-assembly
tags: [react, react-router-7, layout, states, responsive, dark-mode]
requires:
  - "src/lib/timeline/dateUtils.ts (getWindow, getMonthColumns, todayLeftPercent — 04-02)"
  - "src/lib/timeline/colorUtils.ts (resolveInitiativeColor — 04-02)"
  - "src/components/timeline/UndatedPill.tsx, ScheduledBar.tsx (04-05)"
provides:
  - "src/components/timeline/AxisRow.tsx (AxisRow)"
  - "src/components/timeline/InitiativeLane.tsx (InitiativeLane)"
  - "src/pages/TimelinePage.tsx (TimelinePage — full replacement)"
  - "src/components/RoadmapBoundaries.tsx (RoadmapLoading skeleton swimlanes)"
affects:
  - "src/components/RoadmapBoundaries.tsx (RoadmapLoading upgraded; RoadmapError unchanged)"
tech-stack:
  added: []
  patterns:
    - grid-cols-7-month-axis
    - absolute-today-marker-via-percent
    - loader-data-lane-ordering
    - inline-empty-error-states
    - hydratefallback-skeleton
key-files:
  created:
    - src/components/timeline/AxisRow.tsx
    - src/components/timeline/InitiativeLane.tsx
  modified:
    - src/pages/TimelinePage.tsx
    - src/components/RoadmapBoundaries.tsx
decisions:
  - "Scheduled bars sit inside a grid with py-2.5 (no horizontal padding) so the absolute bars' left%/width% stay measured against full grid width while gaining the D-05 10px top inset."
  - "TimelinePage's null-loaderData branch renders the muted error copy (not `return null`) — genuine loader failures already throw to RoadmapError, so null is the defensive out-of-band case that surfaces the error line."
  - "RoadmapLoading (root HydrateFallback) is generic (no timeline-only copy) since it renders across all routes during hydration; skeleton is shape-only per UI-SPEC."
metrics:
  duration: ~15m
  completed: 2026-07-14
requirements: [TL-01, TL-02, TL-04]
---

# Phase 04 Plan 06: Timeline Assembly Summary

The timeline hero view wired end-to-end: `AxisRow` (D-01 7-month header + D-02 today
marker), `InitiativeLane` (color-swatch header + D-04 parking rail + D-06 scheduled
grid), and the full `TimelinePage` replacement (loader data, lane ordering,
empty/error states, responsive + dark-mode shell) — plus a skeleton-swimlane loading
state on the root HydrateFallback. The route now renders all 16 projects from
`public/roadmap.json` with zero network calls.

## What Was Built

- **`AxisRow({ window, monthColumns })`** — a `flex h-8` row: a `w-40 shrink-0` rail
  header captioned "Needs dates" (`text-xs`, `--muted-foreground`) beside a
  `relative grid grid-cols-7` region rendering 7 semibold month cells ("Jul 2026" …
  "Jan 2027"). A non-interactive 1.5px `--foreground` vertical TodayMarker
  (`aria-label="Today"`) is absolutely positioned via
  `todayLeftPercent(new Date(), window.windowStart, window.windowDays)`.
- **`InitiativeLane({ initiative, projects, color, window })`** — a `flex h-8`
  LaneHeader with an 8×8px color-swatch circle (`style={{ backgroundColor: color }}`)
  + `initiative.name`. LaneBody is a `flex min-h-12`: a `w-40 shrink-0 bg-(--color-muted)`
  parking rail rendering `UndatedPill` for each `targetDate === null` project sorted
  priority-asc then name-asc, and a `flex-1 relative` scheduled grid with per-month
  grid lines and a `ScheduledBar` for each `targetDate !== null` project. A zero-project
  initiative renders header-only (Factiv) — never hidden.
- **`TimelinePage`** — reads `useRouteLoaderData("root") as RoadmapLoaderData | null`,
  computes `window = getWindow()` + `monthColumns`, builds one lane per initiative
  (colored via `resolveInitiativeColor`), and sorts lanes scheduled-count desc then
  name asc. Renders `section[aria-label="Timeline"]` (with `overflow-x-auto`), an
  `h1 "Timeline"`, and a `min-w-[840px]` grid of `AxisRow` + divided `InitiativeLane`s.
  Inline empty state (`data.projects.length === 0` → 📅 + "No projects found") and error
  state (null loaderData → "Could not load timeline data. Switch to Snapshot mode above.").
- **`RoadmapLoading`** — upgraded from a text spinner to `animate-pulse` skeleton
  swimlanes: a pulsing 7-rectangle axis row + 3 lane placeholders (2 rail pill shapes +
  one grid bar shape each). No copy. `RoadmapError` and the router
  `HydrateFallback: RoadmapLoading` wiring left unchanged.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | AxisRow (month columns + today marker) | bdba713 | src/components/timeline/AxisRow.tsx |
| 2 | InitiativeLane (header + parking rail + scheduled grid) | f878651 | src/components/timeline/InitiativeLane.tsx |
| 3 | TimelinePage assembly + skeleton loading state | 4957dca | src/pages/TimelinePage.tsx, src/components/RoadmapBoundaries.tsx |

## Verification Evidence

**Typecheck** — `npx tsc -b --noEmit` → exit 0 (no output) after each task.

**Full test suite** — `CI=true npx vitest run`:
```
 Test Files  5 passed (5)
      Tests  63 passed (63)
```
No test files added — per the plan (Path B): this repo has no React-render/jsdom harness
and the plan deliberately defers RTL smoke tests. Pre-existing 63 pure-module tests remain
green. The Task 3 human-check is the fidelity gate for the assembled UI.

**Production build** — `CI=true npx vite build` → exit 0, `✓ built in ~1.4s`, 2071 modules
transformed, `dist/assets/index-*.js` emitted. This proves the assembled page compiles and
bundles. (The >500 kB chunk-size advisory is pre-existing and unrelated — out of scope.)

**Lint** — `npx eslint` on all four touched files → exit 0 (clean).

**Acceptance greps** — AxisRow: `grid-cols-7`=1, `aria-label="Today"`=1, `Needs dates`=2.
InitiativeLane: `targetDate === null|!== null`=3, `bg-(--color-muted)`=1. TimelinePage:
`useRouteLoaderData("root")`=1, `min-w-[840px]`=1, `No projects found`=1,
`Could not load timeline data`=1, `resolveInitiativeColor`=3. RoadmapBoundaries:
`animate-pulse`=1. router.tsx: `HydrateFallback`=1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing correctness] TimelinePage null-loaderData branch renders the error copy instead of `return null`**
- **Found during:** Task 3.
- **Issue:** The plan `<interfaces>` note says "return null if null," but the Task 3
  acceptance requires `grep "Could not load timeline data"` in TimelinePage, and the UI-SPEC
  Error State assigns that copy to exactly this branch. Returning null would render a blank
  page on the defensive null case and fail the acceptance grep.
- **Fix:** The null-loaderData branch returns the muted "Could not load timeline data.
  Switch to Snapshot mode above." paragraph (genuine loader failure still throws to
  RoadmapError; null is the out-of-band defensive case). Matches UI-SPEC + PATTERNS Error State.
- **Files modified:** src/pages/TimelinePage.tsx
- **Commit:** 4957dca

### Implementation Notes (within plan intent)

- **Scheduled-grid vertical inset via `py-2.5` (10px), no horizontal padding.** `ScheduledBar`
  (04-05) is `absolute` and sets only left/width/right — never `top`. Applying vertical-only
  padding on the grid gives the bar its D-05 ~10px top inset (48px lane = 10 + 28 + 10) via
  its auto static-position top, while leaving `left%`/`width%` measured against the full grid
  width (horizontal percentages are unaffected by vertical padding). Bars are not modified.
- **Grid lines** are a decorative `pointer-events-none absolute inset-0 grid grid-cols-7`
  overlay (7 `border-l` cells) so they never intercept bar/pill hover.
- **RoadmapLoading is route-generic.** As the root HydrateFallback it renders during
  hydration for every route (including Overview), so the skeleton is shape-only with no
  timeline-specific copy, per the UI-SPEC (skeleton, no text).

No architectural changes; no authentication gates encountered.

## Human-Check (deferred to post-phase review)

Task 3 carries a `<human-check>` (visual fidelity, lane ordering, dark mode, <840px
horizontal scroll, skeleton loading state, no Overview regression). All automated gates
(typecheck/test/build/lint/greps) pass; the visual human-check is the remaining fidelity
gate and is owned by the orchestrator's post-phase `/review` + `/qa` step. The Linear
popover link is intentionally omitted until 04-07 runs (D-13).

## Known Stubs

None. AxisRow, InitiativeLane, and TimelinePage are complete and render all 16 projects
from the validated snapshot. No hardcoded empty data, placeholders, or unwired data sources.

## Self-Check: PASSED

- FOUND: src/components/timeline/AxisRow.tsx
- FOUND: src/components/timeline/InitiativeLane.tsx
- FOUND: src/pages/TimelinePage.tsx
- FOUND: src/components/RoadmapBoundaries.tsx
- FOUND commit: bdba713
- FOUND commit: f878651
- FOUND commit: 4957dca
