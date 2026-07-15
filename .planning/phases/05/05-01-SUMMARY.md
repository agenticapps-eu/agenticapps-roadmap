---
phase: 05-overview-dashboard
plan: 01
subsystem: data
tags: [zod, schema, roadmap-json, typescript]

# Dependency graph
requires:
  - phase: 04-timeline
    provides: "RoadmapJsonSchema / ProjectSchema and the url:.nullish() graceful-degradation idiom (D-13)"
provides:
  - "Optional planAhead field on ProjectSchema (OV-04 data seam) that Phase 6's .planning/ walker will populate"
  - "Back-compat guarantee: current flagless public/roadmap.json snapshot stays schema-valid"
affects: [05-05-sync-badge, 06-gsd-linear-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional/nullish snapshot field seam: add a field as z.boolean().nullish() so producers (future phases) can populate it incrementally without invalidating existing snapshots or requiring a coordinated schema+data rollout."

key-files:
  created: [src/lib/roadmap/schema.test.ts]
  modified: [src/lib/roadmap/schema.ts]

key-decisions:
  - "planAhead uses .nullish() (not .boolean() or .nullable()) so absent, true, false, and null are all valid — required for the current flagless snapshot to keep parsing."
  - "No changes to the exported Project type (still z.infer<typeof ProjectSchema>) — the type auto-derives the new optional field."

patterns-established:
  - "Data-seam-before-producer: ship an optional schema field ahead of the logic that populates it, gated by explicit back-compat + presence/absence parse tests, so UI (05-05) and data producer (Phase 6) can be built independently."

requirements-completed: [OV-04]

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 05 Plan 01: OV-04 planAhead Schema Seam Summary

**Added optional `planAhead: z.boolean().nullish()` to ProjectSchema with 5 back-compat/presence/type-rejection parse tests, proving the current flagless `public/roadmap.json` snapshot still validates.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 1 (TDD: test then feat)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `ProjectSchema` now carries an optional, nullish `planAhead` field (additive-only) immediately after the existing `url` field, mirroring the Phase-4 D-13 idiom.
- Five parse tests cover: back-compat (no key), presence true, presence false (the important invisible-badge state), null, and wrong-type rejection.
- Confirmed via RED run that before the schema change, an unknown `planAhead` key was silently stripped by Zod (tests 2-4 failed with `undefined`, test 5 falsely passed) — this is the exact RED→GREEN pivot the plan called for.

## Task Commits

Each task was committed atomically (TDD: test -> feat):

1. **Task 1 (RED): failing planAhead parse tests** - `6345aa8` (test)
2. **Task 1 (GREEN): add planAhead field to ProjectSchema** - `718b9ac` (feat)

_No refactor commit needed — the GREEN change was already minimal (single line)._

## Files Created/Modified
- `src/lib/roadmap/schema.ts` - Added `planAhead: z.boolean().nullish()` to `ProjectSchema`, directly after `url`.
- `src/lib/roadmap/schema.test.ts` - New file: 5 tests (back-compat, true, false, null, wrong-type) against `RoadmapJsonSchema.safeParse`.

## Decisions Made
None beyond what the plan specified - followed the plan's exact field placement, type (`.nullish()`), and comment.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The OV-04 data seam is in place: `project.planAhead` is a valid, typed, optional field that 05-05's SyncBadge component can read directly (`project.planAhead ? <Badge/> : null`), degrading to invisible when absent/false/null.
- `public/roadmap.json` was NOT modified and remains valid — verified no changes to `public/roadmap.json` in this plan's commits, and the existing loader test suite (8 tests) still passes unmodified.
- Phase 6's `.planning/` walker can populate `planAhead: true` / `false` on regeneration without any further schema work.

---
*Phase: 05-overview-dashboard*
*Completed: 2026-07-15*
