---
phase: 04-roadmap-timeline-ui
plan: 02
subsystem: timeline-core
tags: [pure-functions, date-math, color, tdd]
requires: []
provides:
  - "src/lib/timeline/dateUtils.ts (getWindow, daysBetween, barPosition, getMonthColumns, todayLeftPercent)"
  - "src/lib/timeline/colorUtils.ts (resolveInitiativeColor, luminanceFor, FALLBACK_PALETTE)"
affects: []
tech-stack:
  added: []
  patterns: [pure-named-export-module, vitest-inline-fixtures, tdd-red-green]
key-files:
  created:
    - src/lib/timeline/dateUtils.ts
    - src/lib/timeline/dateUtils.test.ts
    - src/lib/timeline/colorUtils.ts
    - src/lib/timeline/colorUtils.test.ts
  modified: []
decisions:
  - "barPosition exposes an explicit kind discriminator (span|fixedEnd|stub) so the 04-05 caller never infers intent from width<=0."
  - "luminanceFor uses gamma-corrected WCAG relative luminance, not the linear formula in RESEARCH.md, to satisfy the plan's purple<0.4 contrast contract."
metrics:
  duration: ~10m
  completed: 2026-07-14
requirements: [TL-01, TL-02, TL-04]
---

# Phase 04 Plan 02: Timeline Calculation Core Summary

Pure, offline-testable timeline math — fixed 7-month window/bar positioning with a
`kind` discriminator for D-03 clamping and D-07 short bars, plus deterministic
initiative color fallback (D-11) and gamma-corrected bar-text contrast luminance.

## What Was Built

Two dependency-free modules under `src/lib/timeline/`, each backed by unit tests:

- **`dateUtils.ts`** — `getWindow` (first-of-current-month .. last-of-+6, 7 months),
  `daysBetween`, `getMonthColumns` (7 labels "Jul 2026".."Jan 2027"),
  `todayLeftPercent` (D-02), and `barPosition`. `barPosition` clamps symmetrically at
  both window edges and returns `kind: "span" | "fixedEnd" | "stub"`:
  - `span` — normal or partly-in-window bar (real width; may be clampedLeft/Right).
  - `fixedEnd` — D-07: targetDate present, startDate null (width 0; caller renders 64px).
  - `stub` — D-03: bar entirely before/after window (zero effective width; caller renders a 32px stub + ◀/▶ cue).
  No date library — only the `Date` constructor and arithmetic; date strings parsed as
  local midnight (`+ "T00:00:00"`) to avoid UTC drift.
- **`colorUtils.ts`** — `FALLBACK_PALETTE`, `resolveInitiativeColor` (API color when set,
  else stable palette entry keyed by lexicographic null-id order — D-11), and
  `luminanceFor` (WCAG relative luminance; caller picks white text when `< 0.4`).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | dateUtils module (window, bar position, clamping, today) | 578fb05 | dateUtils.ts, dateUtils.test.ts |
| 2 | colorUtils module (fallback palette + contrast) | 0ffd6b5 | colorUtils.ts, colorUtils.test.ts |

Both tasks executed strict TDD: failing test written and observed RED, then implementation to GREEN.

## Verification Evidence

**Typecheck** — `npx tsc -b --noEmit` → exit 0 (no output).

**Full test suite** — `CI=true npx vitest run`:
```
 Test Files  5 passed (5)
      Tests  63 passed (63)
```
(dateUtils.test.ts: 10 passed; colorUtils.test.ts: 6 passed; 47 pre-existing tests unaffected.)

**Lint** — `npx eslint src/lib/timeline` → exit 0 (clean).

**No date library** — `grep -c "date-fns\|dayjs\|luxon\|moment" src/lib/timeline/dateUtils.ts` → 0.

**TDD RED evidence** — before implementation, both test files failed with
`Cannot find module './dateUtils'` / `./colorUtils` (module-missing), confirming the
tests exercised absent code first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `luminanceFor` uses gamma-corrected luminance, not RESEARCH's linear formula**
- **Found during:** Task 2 (writing the purple `< 0.4` assertion).
- **Issue:** RESEARCH.md Pattern 2 and the plan `<action>` specify the linear formula
  `0.2126*r + 0.7152*g + 0.0722*b`. That yields `luminanceFor("#5e6ad2") ≈ 0.435`
  (> 0.4), which directly contradicts the plan's own `<behavior>`/`<acceptance_criteria>`
  requiring purple `< 0.4` (so the caller renders white text) and the UI-SPEC statement
  that all named/palette colors qualify for white text except yellow `#f2c94c`.
- **Fix:** Implemented proper WCAG gamma-corrected relative luminance (sRGB channel
  linearization before weighting). Result: `#5e6ad2` ≈ 0.17 (< 0.4 ✓), `#f2c94c` ≈ 0.61
  (> 0.4 ✓). The testable acceptance contract and UI-SPEC are the binding authority; the
  linear formula in the action text was incorrect for the stated contrast purpose.
- **Files modified:** src/lib/timeline/colorUtils.ts
- **Commit:** 0ffd6b5

No architectural changes; no authentication gates encountered.

## Known Stubs

None. Both modules are complete, pure, and fully unit-covered. (These are calculation
primitives consumed by later plans 04-04/04-05; that is by design, not a stub.)

## Self-Check: PASSED

- FOUND: src/lib/timeline/dateUtils.ts
- FOUND: src/lib/timeline/dateUtils.test.ts
- FOUND: src/lib/timeline/colorUtils.ts
- FOUND: src/lib/timeline/colorUtils.test.ts
- FOUND commit: 578fb05
- FOUND commit: 0ffd6b5
