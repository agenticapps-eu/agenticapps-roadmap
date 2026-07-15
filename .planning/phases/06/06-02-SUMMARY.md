---
phase: 06-sync-gsd-linear-cli
plan: 02
subsystem: infra
tags: [filesystem, parser, vitest, gsd-planning, tdd]

# Dependency graph
requires: [06-01]
provides:
  - "scripts/sync-gsd-linear/walker.ts — walkPlanning(planningDir) enumerates phases/* keyed on full dir slug, tolerant of missing dirs"
  - "scripts/sync-gsd-linear/parser.ts — parseRepo(rawDirs, meta) turns RawPhaseDir[] into a schema-valid NormalizedModel with per-plan identity key + taskLines"
affects: [06-03, 06-04, 06-05, 06-06, 06-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "node:fs readdirSync({withFileTypes:true})/existsSync directly for filesystem traversal — no analog in this repo, per 06-PATTERNS.md 'No Analog Found'"
    - "transform.ts-style raw->normalized mapping: small pure helper per concern (titleFor/taskLinesFor/completionStatusFor), final Schema.parse at the return boundary"
    - "RED/GREEN TDD per task: failing test committed first (test(06-02):...), then the minimal implementation (feat(06-02):...)"

key-files:
  created:
    - scripts/sync-gsd-linear/walker.ts
    - scripts/sync-gsd-linear/walker.test.ts
    - scripts/sync-gsd-linear/parser.ts
    - scripts/sync-gsd-linear/parser.test.ts
  modified: []

key-decisions:
  - "Phase-dir and plan-file listings are explicitly .sort()-ed (localeCompare / lexicographic) in walker.ts for deterministic test output, even though the plan's behavior spec only requires 'ordering deferred to dates.ts' (i.e. not numeric phase-order sorting) — plain alphabetical listing order doesn't conflict with that requirement and removes OS-readdir-order flakiness."
  - "titleFor/taskLinesFor/completionStatusFor are module-private (not exported) except where a test needs behavior unreachable through fixture-backed parseRepo calls (the 'bodyless plan -> empty taskLines' case, which no on-disk fixture exercises) — that one case is tested via a fresh mkdtempSync-created PLAN.md rather than exporting an internal helper, keeping parser.ts's public surface to just parseRepo (mirrors transform.ts's fully-internal bucketFor/redactEmails)."
  - "completionStatusFor's ROADMAP-checkbox match checks both the full phase slug and its number-stripped suffix as substrings of a checked/✅ line, since real ROADMAP.md stub text phrases entries as 'Phase 01 (gsd-bug-fixes): ...' rather than the raw directory slug verbatim — this is the exact shape 06-01's duplicate-NN fixture ROADMAP.md stub uses."

requirements-completed: [SYNC-01]

# Metrics
duration: ~25min
completed: 2026-07-15
---

# Phase 06 Plan 02: Filesystem walker + PLAN.md parser Summary

**walker.ts enumerates every sibling repo's `phases/*` directory by full slug (never the bare number), and parser.ts turns that plus each PLAN.md's content into a schema-valid NormalizedModel where every plan carries a stable `repo/phaseSlug/relativePlanPath` identity key distinct from its display title, closing the generic-H1 collision risk 06-REVIEWS.md flagged.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-15T12:00:01Z
- **Tasks:** 2 (both `tdd="true"`, each executed as a RED test commit then a GREEN implementation commit)
- **Files created:** 4 (0 modified)

## Accomplishments

- `walker.ts`'s `walkPlanning(planningDir)` lists every subdirectory of `phases/` as a `RawPhaseDir {slug, dir, planFiles, roadmapPath, statePath}`, keyed on the FULL directory name — verified against the `duplicate-NN` fixture that `01-go-routing` and `01-gsd-bug-fixes` both appear as distinct, non-colliding entries with their own `planFiles`.
- Decimal-numbered phase dirs (`03.5-quality`, `04.10-x`, `04.2-y`) are all enumerated by the walker without any numeric interpretation — component-wise numeric ordering is left entirely to `dates.ts`, per plan.
- A missing `phases/` dir, or a missing repo path entirely, returns `[]` with a `console.warn` and never throws — verified against two "does-not-exist" paths.
- `parser.ts`'s `parseRepo(rawDirs, meta)` produces a `NormalizedModel` whose every plan carries a stable identity `key = repo/phaseSlug/phases/phaseSlug/filename` used for hashing/dedup, and a separate display `title` that falls back through three tiers: frontmatter H1 used verbatim → frontmatter-less + generic H1 falls back to the PLAN.md filename (`NN-MM-PLAN.md` case) → frontmatter-less + generic H1 + bare `PLAN.md` falls back to the phase slug.
- The `two-generic-plans-in-one-phase` fixture (`20-01-PLAN.md`/`20-02-PLAN.md`, byte-identical H1s) proves the two plans get distinct keys AND distinct titles (`20-01-PLAN`/`20-02-PLAN`) — the exact defect 06-REVIEWS.md Consensus item 1 called out.
- `taskLinesFor` extracts every checklist/bullet line (`- [ ]`, `- [x]`, plain `- `) from the plan body (frontmatter stripped first) for the apply engine's future issue description; verified populated for a real fixture plan and empty (`[]`) for a synthetic bodyless plan.
- `completionStatusFor` implements the layered heuristic from 06-RESEARCH.md Pitfall 3: ROADMAP.md checkbox/✅ match → VERIFICATION.md sibling present → every PLAN.md has a sibling SUMMARY.md → else in-progress. Verified against all three completed-phase fixture shapes (`01-go-routing` via VERIFICATION.md, `01-gsd-bug-fixes` via the partial-stub ROADMAP.md, `03.5-quality` via its SUMMARY.md sibling) and one plan-only in-progress phase (`04.10-x`).
- The phase `number` field is kept as the leading dot-separated numeric token STRING (`"03.5"`, `"04.10"`, `"04.2"`), never `parseFloat`'d, so `04.10` and `04.2` never collide.

## Task Commits

1. **Task 1: walker.ts — enumerate phases/* keyed on full dir slug**
   - RED: `0294ac4` (test) — 9 failing tests against walker.ts (not yet created)
   - GREEN: `c17b4c4` (feat) — `walkPlanning` implementation, all 9 tests pass
2. **Task 2: parser.ts — phase dirs + PLAN.md -> NormalizedModel (with key + taskLines)**
   - RED: `e655de9` (test) — 13 failing tests against parser.ts (not yet created)
   - GREEN: `804f21b` (feat) — `parseRepo` implementation, all 13 tests pass

## TDD Gate Compliance

Both tasks in this plan carry `tdd="true"`. Both followed the full RED → GREEN cycle:
- Task 1: `test(06-02): add failing tests for walker.ts...` (`0294ac4`) confirmed failing (module not found) before `feat(06-02): walker.ts enumerates...` (`c17b4c4`) made all 9 tests pass.
- Task 2: `test(06-02): add failing tests for parser.ts...` (`e655de9`) confirmed failing (module not found) before `feat(06-02): parser.ts produces NormalizedModel...` (`804f21b`) made all 13 tests pass.

No REFACTOR commits were needed — both implementations passed cleanly on the first GREEN attempt.

## Files Created/Modified

- `scripts/sync-gsd-linear/walker.ts` — `walkPlanning(planningDir): RawPhaseDir[]`, exported `RawPhaseDir` interface
- `scripts/sync-gsd-linear/walker.test.ts` — 9 tests: duplicate-NN distinctness, per-dir planFiles isolation, ROADMAP/STATE detection, decimal-phase enumeration, bare-PLAN/two-generic-plans shapes, missing-dir/missing-repo → `[]`
- `scripts/sync-gsd-linear/parser.ts` — `parseRepo(rawDirs, meta): NormalizedModel`, private helpers `titleFor`/`taskLinesFor`/`completionStatusFor`/`roadmapMarksComplete`/`stripFrontmatter`
- `scripts/sync-gsd-linear/parser.test.ts` — 13 tests: title fallback tiers, identity-key distinctness, taskLines population (populated + bodyless-empty), number-token string preservation, all four completion-heuristic branches, end-to-end schema validity

## Decisions Made

- Walker sorts phase-dir and plan-file listings alphabetically for deterministic test output — does not conflict with "ordering deferred to dates.ts" since that spec concerns numeric phase-order, not filesystem-listing determinism.
- Kept `parser.ts`'s helper functions module-private (mirrors `transform.ts`'s `bucketFor`/`redactEmails`); the one edge case unreachable via fixture-backed `parseRepo` calls (bodyless-plan → empty `taskLines`) is tested through a temp `mkdtempSync` PLAN.md rather than exporting an internal helper.
- ROADMAP-checkbox completion matching checks both the full phase slug and its number-stripped suffix as substrings, since real `ROADMAP.md` stub text phrases entries descriptively (`Phase 01 (gsd-bug-fixes): ...`) rather than embedding the raw directory slug.

## Deviations from Plan

None - plan executed exactly as written. All `<action>` specs, `<verify>` commands, and `<acceptance_criteria>` greps were followed and passed as specified, including both tasks' full RED/GREEN TDD cycles.

## Issues Encountered

One self-caught lint issue: `parser.test.ts`'s initial draft imported `afterEach` from vitest but ended up using a `try/finally` block instead (no `afterEach` needed for the single temp-dir test). `tsc -b --noEmit` caught it via `noUnusedLocals` before the GREEN commit; removed the unused import and re-verified typecheck + full test suite green. Folded into the Task 2 GREEN commit rather than treated as a separate deviation, since it never reached a committed broken state — RED commit `e655de9` did not yet reference the fix, and it was corrected before parser.ts's GREEN commit.

## User Setup Required

None.

## Next Phase Readiness

`walker.ts` and `parser.ts` together give `06-03` onward (resolve/diff/dates/apply) a working, schema-valid `NormalizedModel` for every fixture shape RESEARCH.md identified. Full project test suite (10 files, 157 tests) passes; `npx tsc -b --noEmit` is clean. No blockers.

---
*Phase: 06-sync-gsd-linear-cli*
*Completed: 2026-07-15*

## Self-Check: PASSED

All claimed files verified on disk (walker.ts, walker.test.ts, parser.ts,
parser.test.ts, this SUMMARY.md) and all four task commit hashes (0294ac4,
c17b4c4, e655de9, 804f21b) verified present in git log.
