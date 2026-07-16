---
phase: 07-live-refresh-and-write-back
plan: 01
subsystem: ui
tags: [react-router, revalidation, react, freshness, refresh]

# Dependency graph
requires:
  - phase: 05
    provides: shouldRevalidateRoadmap zero-network revalidation gate, AppHeader Snapshot/Live toggle
provides:
  - Additive fix to shouldRevalidateRoadmap allowing an explicit same-URL revalidate through
  - Pure, null-safe formatFreshness(generatedAt, now) helper
  - Live-mode-only Refresh button + freshness hint wired into AppHeader via useRevalidator
affects: [07-live-refresh-and-write-back]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive revalidation gate: keep the existing source-mode-flip branch, add an identical-pathname+search branch for explicit revalidate() calls, never replace the function wholesale"
    - "Pure formatter with injected `now: Date` (no internal Date.now()) for deterministic, non-flaky freshness tests"
    - "Client-tracked lastRefreshedAt (not the live projection's own generatedAt) updated on revalidator.state loading -> idle transition"

key-files:
  created:
    - src/lib/roadmap/freshness.ts
    - src/lib/roadmap/freshness.test.ts
  modified:
    - src/lib/roadmap/loader.ts
    - src/lib/roadmap/loader.test.ts
    - src/components/AppHeader.tsx

key-decisions:
  - "Kept shouldRevalidateRoadmap's existing source-mode-flip branch untouched and added a second identical-URL branch, rather than replacing it with React Router's defaultShouldRevalidate (would have regressed Phase-5 zero-network filter suppression)."
  - "freshness hint tracks the last successful client-side refresh (seeded from the initial loaderData.data.generatedAt, bumped on revalidator loading->idle), not the live projection's own generatedAt (which is always 'just now' in live mode and would make the hint meaningless)."
  - "Refresh button and freshness hint render only when `live && loaderData` is true, keeping Snapshot mode fully network-free with no Refresh affordance (D-07-05)."

patterns-established:
  - "Pure, React-free formatter modules under src/lib/roadmap/ take an injected `now: Date` parameter for deterministic testing (mirrors formatFreshness for any future time-relative helper)."

requirements-completed: [LIVE-01]

# Metrics
duration: ~12min
completed: 2026-07-16
---

# Phase 07 Plan 01: Live Refresh Control Summary

**Live-mode "Refresh from Linear" button wired to React Router's useRevalidator, backed by an additive shouldRevalidateRoadmap fix and a pure null-safe formatFreshness helper.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-16T06:00:34Z
- **Tasks:** 2 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Fixed the R-4 revalidation bug additively: `shouldRevalidateRoadmap` now returns `true` for an explicit same-URL `revalidator.revalidate()` call (in both Live and Snapshot mode) while still suppressing filter/`?project` drill-down navigations, proven test-first (RED confirmed failing before the fix, GREEN after).
- Added `src/lib/roadmap/freshness.ts` — a pure, React-free `formatFreshness(generatedAt, now)` that renders "updated just now" / "updated Nm ago" / "updated Nh ago" / "updated Nd ago", and returns `""` (never throws) for undefined/null/empty/invalid input.
- Wired a Live-mode-only Refresh button into `AppHeader.tsx` using `useRevalidator()`, disabled while `revalidator.state === "loading"`, with a freshness hint driven by a client-tracked `lastRefreshedAt` that updates on the `loading -> idle` transition — guarded so it renders nothing when `loaderData` is absent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix shouldRevalidateRoadmap for explicit same-URL revalidate (R-4)** - `8def9c5` (fix, TDD)
2. **Task 2: Refresh button + null-safe freshness hint in AppHeader** - `67fc2bf` (feat, TDD)

**Plan metadata:** (pending — this commit)

_Note: both tasks were written test-first (RED confirmed, then GREEN); Task 1's RED/GREEN and Task 2's RED/GREEN are each folded into a single commit per task, since the plan's task-level commit protocol commits at task granularity, not per TDD sub-step._

## Files Created/Modified
- `src/lib/roadmap/loader.ts` - Additive fix: `shouldRevalidateRoadmap` now also returns `true` when `currentUrl.pathname + currentUrl.search === nextUrl.pathname + nextUrl.search` (explicit same-URL revalidate)
- `src/lib/roadmap/loader.test.ts` - Two new cases: same-URL revalidate in live mode, same-URL revalidate in snapshot mode; all pre-existing cases (filter suppression, source-flip) still pass unchanged
- `src/lib/roadmap/freshness.ts` - New pure `formatFreshness(generatedAt, now)` export
- `src/lib/roadmap/freshness.test.ts` - Covers <60s, minutes, hours, days, and undefined/null/empty/invalid-timestamp cases
- `src/components/AppHeader.tsx` - Added `useRevalidator`, a `lastRefreshedAt` state seeded from `loaderData?.data.generatedAt` and bumped on `loading -> idle`, and a Live-mode-only (`{live && loaderData && ...}`) freshness `<span>` + Refresh `<button aria-label="Refresh from Linear">` matching the existing toggle button's Tailwind class-array style

## Decisions Made
- Kept both branches of `shouldRevalidateRoadmap` (source-mode-flip AND identical-URL) rather than replacing the function — this was the RESEARCH-verified additive fix, not a reversion.
- The freshness hint renders only when both `live` and `loaderData` are truthy (loaderData can be `null` before the first load per `useRouteLoaderData`'s contract), so the hint is always null-safe.
- `lastRefreshedAt` is client-tracked state, not derived from the live projection's own `generatedAt` field, since the live snapshot's `generatedAt` is always close to "now" and would make the hint meaningless (per plan's `<behavior>` spec).

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the exact additive fix and component-wiring shapes specified in 07-PATTERNS.md and the plan's `<action>` blocks.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Human Verification Required

Task 2's `<verify><human-check>` step (the plan's own review note: the unit test on the predicate does NOT uniquely prove a Refresh click re-pulls data — only a real browser click does) requires a human to:
1. Run `pnpm dev`, navigate to `?source=live`.
2. Confirm the Refresh button and freshness hint appear, and no Refresh button appears when `?source=live` is absent (Snapshot mode).
3. Click Refresh, watch the Network tab for a `/api/linear/snapshot` call (the unique proof of a re-pull), confirm the button shows "Refreshing…" during the request and the hint updates to "updated just now" after.

This was not run in this session (no browser tool available to the executor); automated verification (vitest + tsc) is green.

## Next Phase Readiness
- LIVE-01 is code-complete and automated-test-verified; the human-check above is the only remaining verification step before this plan can be marked fully done in STATE.md's blocking-items list.
- Ready for the next plan in Phase 07's wave sequence (write-back / backfill flows per 07-PATTERNS.md's `useBackfill` and Pages Function routes).

---
*Phase: 07-live-refresh-and-write-back*
*Completed: 2026-07-16*

## Self-Check: PASSED

All created/modified files and both task commit hashes (8def9c5, 67fc2bf) verified present.
