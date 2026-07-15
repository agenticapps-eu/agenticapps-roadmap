---
phase: 05-overview-dashboard
plan: 07
subsystem: routing
tags: [react-router-7, shouldRevalidate, data-router, snapshot-first, vitest]

# Dependency graph
requires:
  - phase: 05-overview-dashboard (05-01..05-06)
    provides: root roadmapLoader on the id:"root" route, URL-driven filters and ?project drill-down that navigate via setSearchParams
provides:
  - "shouldRevalidateRoadmap: pure ShouldRevalidateFunctionArgs -> boolean revalidation gate, unit-tested directly"
  - "root route wired with shouldRevalidate, so filter/drill-down navigations no longer re-run roadmapLoader"
affects: [05-06 (Overview UAT depends on this to verify zero-refetch), phase-07-live-refresh]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Root-loader revalidation gate mirrors the loader's own source==='live' branch condition verbatim to prevent the two rules from drifting apart"

key-files:
  created: []
  modified:
    - src/lib/roadmap/loader.ts
    - src/lib/roadmap/loader.test.ts
    - src/router.tsx

key-decisions:
  - "shouldRevalidateRoadmap revalidates only on a snapshot<->live source-mode flip, not on any other searchParams change (filters, ?project) — closes the Codex HIGH-BLOCKING finding in 05-REVIEWS.md without touching roadmapLoader's fetch body"

patterns-established:
  - "Pure ShouldRevalidateFunctionArgs -> boolean gate functions are directly unit-testable with a small local args builder — no render harness needed (Path B, mirrors 05-02's pure-selector pattern)"

requirements-completed: [OV-02]

# Metrics
duration: 5min
completed: 2026-07-15
---

# Phase 05 Plan 07: Root loader revalidation gate Summary

**Added `shouldRevalidateRoadmap`, a pure React Router 7 revalidation policy wired onto the root route so filter/drill-down URL navigations no longer re-run the snapshot loader, while a snapshot↔live mode flip still does.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-15T09:47:00Z
- **Completed:** 2026-07-15T09:49:40Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- Closed the Codex HIGH-BLOCKING finding from `05-REVIEWS.md`: root loader no longer refetches `/roadmap.json` (snapshot mode) or repeatedly calls `/api/linear/snapshot` (live mode) on every filter toggle or `?project` open/close.
- `shouldRevalidateRoadmap` exported from `src/lib/roadmap/loader.ts`, mirroring the loader's own `searchParams.get("source") === "live"` rule exactly so the two checks cannot diverge.
- Six direct unit tests cover the full matrix: filter-only, `?project` open, `?project` close, filter-while-live → no revalidate; snapshot→live, live→snapshot → revalidate.
- Root route (`id: "root"`) wired with `shouldRevalidate: shouldRevalidateRoadmap`, applying to both the Overview index route and the Timeline child route since revalidation is decided at the loader-owning route.

## Task Commits

Each task was committed atomically (TDD RED→GREEN for Task 1):

1. **Task 1 (RED): add failing tests for shouldRevalidateRoadmap** - `bb488b2` (test)
2. **Task 1 (GREEN): implement shouldRevalidateRoadmap revalidation gate** - `b70b84c` (feat)
3. **Task 2: wire shouldRevalidateRoadmap onto the root route** - `91fcc4c` (feat)

## Files Created/Modified
- `src/lib/roadmap/loader.ts` - added exported `shouldRevalidateRoadmap(args)`, a pure function comparing effective source mode (snapshot/live) between `currentUrl` and `nextUrl`; `roadmapLoader` body untouched.
- `src/lib/roadmap/loader.test.ts` - added `describe("shouldRevalidateRoadmap")` with a local `rargs(current, next)` helper building `ShouldRevalidateFunctionArgs`; six new test cases (existing `roadmapLoader` describe blocks untouched).
- `src/router.tsx` - imported `shouldRevalidateRoadmap` alongside `roadmapLoader`; added `shouldRevalidate: shouldRevalidateRoadmap,` immediately after `loader: roadmapLoader,` on the `id: "root"` route. No other route property changed.

## Decisions Made
- The revalidation gate's `sourceMode(u: URL)` helper is a local, inline mirror of `roadmapLoader`'s own check (not a shared extracted constant) — per the plan's explicit instruction to copy the EXACT rule rather than refactor `roadmapLoader`'s body, keeping the diff surgical and the two checks textually adjacent for future reviewers.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria (`grep` checks, `vitest`, `tsc -b --noEmit`, `eslint`, `vite build`) passed without needing any Rule 1-4 fixes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Pure logic change, no new dependencies.

## Next Phase Readiness

- The Codex/OpenCode/Gemini HIGH-BLOCKING revalidation gap from `05-REVIEWS.md` is closed. `05-06`'s UAT script (which asserts "reload keeps filters with no refetch") can now be verified honestly against actual router behavior.
- `shouldRevalidateRoadmap` is a general-purpose gate: any future Phase-5/7 URL param added to the Overview or Timeline routes will automatically NOT trigger a loader re-run unless it also changes the effective `source` mode — no further router changes needed as new filters are added.
- Phase 7 (live refresh) should re-check this gate if a polling/manual-refresh mechanism is added outside the `source` searchParam, since the gate currently only distinguishes snapshot vs. live by that one param.

---
*Phase: 05-overview-dashboard*
*Completed: 2026-07-15*
