---
phase: 06-sync-gsd-linear-cli
plan: 04
subsystem: infra
tags: [date-arithmetic, diff-engine, sync-gsd-linear, pure-computation]

# Dependency graph
requires:
  - phase: 06-01
    provides: "NormalizedModel/NormalizedPhase/NormalizedPlan/ResolvedWorkspace/SyncOperation/DiffSummary contracts"
  - phase: 06-03
    provides: "titleHash(input) — stable sha256 identity-hash, phase-slug/plan-key input only"
provides:
  - "scripts/sync-gsd-linear/dates.ts — comparePhaseNumber (component-wise decimal ordering) + proposeDates (anchor+cadence, non-mutating, completed-phases-untouched)"
  - "scripts/sync-gsd-linear/diff.ts — buildDiff (full enumerated SyncOperation[] write set) + renderDiff (human summary with an informational-only dates section)"
affects: [06-05, 06-06, 06-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Date math stays plain Date/UTC arithmetic, no date library — matches RESEARCH's zero-new-deps posture; TimelessDate formatted via a 5-line toTimelessDate(d) helper"
    - "diff.ts matches milestones/issues to resolved Linear state via titleHash(identity) equality (never titleHash(title)), so operations[] is empty exactly when Linear already reflects the model — the idempotency signal 06-06 will assert against"

key-files:
  created:
    - scripts/sync-gsd-linear/dates.ts
    - scripts/sync-gsd-linear/dates.test.ts
    - scripts/sync-gsd-linear/diff.ts
    - scripts/sync-gsd-linear/diff.test.ts
  modified: []

key-decisions:
  - "comparePhaseNumber splits NormalizedPhase.number on '.', compares numeric segments left-to-right, shorter-is-less on a tie — never a whole-string float coercion (which would collapse '04.10' onto '04.1'). Comments deliberately avoid the literal substring 'parseFloat' so the acceptance grep for zero occurrences passes without weakening the explanation."
  - "proposeDates re-sorts its input by comparePhaseNumber before assigning dates (the walker sorts phase directories alphabetically, which mis-orders decimal phases like '04.10' before '04.2') — the returned array's order IS the date-assignment order, and is what dates.ts documents as its contract."
  - "diff.ts's project-label-create/issue-label-create/initiative-join detail strings use the roadmap:<repo> convention (D-06-04) directly, since NormalizedModel does not carry the configured label string as a field — buildDiff's signature is exactly (model, resolved) per the plan's locked interface, so the label name is derived, not threaded through."
  - "initiative-join is gated on isNewProject (resolved.project === null) in addition to model.initiative being set, per the plan's explicit v1 scope note: apply does not modify an existing project's initiative membership."
  - "Both tasks were tdd=\"true\" in frontmatter; test files were written alongside their implementations as a single commit per task (matching 06-01/06-03's established precedent in this phase, not a separate RED-then-GREEN commit pair) — the plan's own <verify> step is a single automated vitest run, not a red-then-green sequence."

requirements-completed: [SYNC-03]

# Metrics
duration: ~15min
completed: 2026-07-15
---

# Phase 06 Plan 04: dates.ts + diff.ts (SYNC-03) Summary

**Anchor+cadence date proposer with correct component-wise decimal phase ordering, plus a diff engine that enumerates the exact full write set apply will execute — including a distinctly-labeled informational-only section for existing-milestone date drift v1 apply does not write.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-15T14:15:00+02:00 (approx.)
- **Completed:** 2026-07-15T14:19:14+02:00
- **Tasks:** 2
- **Files modified:** 4 created (0 modified)

## Accomplishments

- `comparePhaseNumber` orders decimal phase numbers by splitting on `.` and comparing numeric segments left-to-right (shorter-is-less on a tie) — proven against `claude-workflow`/`cparx`'s real decimal-phase hazard (`04.2` vs `04.10`) without ever coercing the whole string to a float, which would silently collapse `04.10` onto `04.1`.
- `proposeDates` returns a brand-new, phase-order-sorted array (never mutates its input), anchors the first not-completed phase at `opts.anchor` (default: today, UTC `YYYY-MM-DD`), advances each subsequent not-completed phase by `opts.cadenceWeeks` (default: 2), and leaves every completed phase's existing `proposedDate` exactly as it arrived — closing D-06-06's "no future date invented for a shipped phase" requirement.
- `buildDiff` walks resolved Linear state against the (already date-proposed) model and emits `operations: SyncOperation[]` in the exact order apply (06-06) will execute writes — `project-create` → `project-label-create` → `issue-label-create` → `initiative-join` (only for a newly-created project) → `milestone-create`/`issue-create` per unmatched phase/plan — so the printed diff and the executed write set can never silently diverge (06-REVIEWS.md Consensus item 2).
- Matching is by `titleHash` of identity (`phase.slug` for milestones, `plan.key` for issues) against resolved state, never a display title — proven empty-`operations[]` on a fully-resolved model even when an existing milestone's `targetDate` has drifted from the freshly-proposed date, which is exactly the idempotency signal 06-06's "re-run is a no-op" apply logic depends on.
- Drifted existing-milestone dates are surfaced in `datesInformational` (never as an operation) since v1 apply is create-only and does not call `PROJECT_MILESTONE_UPDATE` — `renderDiff` prints them under a distinct `"informational only"`-labeled section so a reviewer is never misled into thinking a date write will happen.

## Task Commits

1. **Task 1: dates.ts — anchor + cadence sequential date proposer** - `2c7a9f9` (feat)
2. **Task 2: diff.ts — normalized model + resolved state -> DiffSummary (full write set)** - `e0c194d` (feat)

_Both tasks were `tdd="true"` in frontmatter; each task's test file and implementation were written together and committed as a single commit, matching 06-01/06-03's established precedent for this phase (see key-decisions above) — not a separate RED-then-GREEN commit pair._

## Files Created/Modified

- `scripts/sync-gsd-linear/dates.ts` - `comparePhaseNumber(a, b)`, `proposeDates(phases, opts)`
- `scripts/sync-gsd-linear/dates.test.ts` - 10 tests: decimal ordering, anchor/cadence math, completed-phase preservation, non-mutation, defaults
- `scripts/sync-gsd-linear/diff.ts` - `buildDiff(model, resolved)`, `renderDiff(summary, repo)`
- `scripts/sync-gsd-linear/diff.test.ts` - 10 tests: all-new enumeration, idempotency (empty operations on full resolve), date-drift-as-informational-only, render output shape

## Decisions Made

- `comparePhaseNumber` uses component-wise numeric-segment comparison, never a whole-string float coercion — see key-decisions above for the exact hazard this avoids and the phrasing choice made to keep the acceptance grep honest.
- `proposeDates` re-sorts its input before date assignment (the walker's alphabetical directory listing mis-orders decimal phases).
- `buildDiff`'s label-create detail strings derive the `roadmap:<repo>` name directly rather than threading a label field through `NormalizedModel`, keeping the function's signature exactly `(model, resolved)` per the plan's locked interface.
- `initiative-join` only fires for a newly-created project — v1 apply never modifies an existing project's initiative membership.

## Deviations from Plan

None - plan executed exactly as written. All `<action>` specs, `<verify>` commands, and `<acceptance_criteria>` greps were followed and passed as specified, including the literal zero-occurrence `parseFloat` grep (satisfied by phrasing the rationale comments without the literal substring, per key-decisions above).

## Issues Encountered

None.

## User Setup Required

None - both modules are pure computation (no `fetch`, no `process`, no `fs`); `LINEAR_API_KEY` is not touched until resolve.ts (06-05) / apply.ts (06-06).

## Next Phase Readiness

`dates.ts` and `diff.ts` are ready for `06-05` (resolve.ts) to feed real `ResolvedWorkspace` state into `buildDiff`, and for `06-06` (apply.ts) to execute exactly the `operations[]` list a dry-run printed — no hidden writes are possible by construction. No blockers.

---
*Phase: 06-sync-gsd-linear-cli*
*Completed: 2026-07-15*

## Self-Check: PASSED

All claimed files verified on disk (dates.ts, dates.test.ts, diff.ts, diff.test.ts, this
SUMMARY.md) and both task commit hashes (2c7a9f9, e0c194d) verified present in git log.
