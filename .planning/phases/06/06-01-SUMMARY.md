---
phase: 06-sync-gsd-linear-cli
plan: 01
subsystem: infra
tags: [zod, cli, linear-graphql, vitest, gsd-planning]

# Dependency graph
requires: []
provides:
  - "scripts/sync-gsd-linear/config.ts — Zod schemas (SyncConfig, LinearMap, NormalizedModel) + resolved-state contracts (ResolvedIssue/ResolvedProject/ResolvedWorkspace) + SyncOperation/DiffSummary + loadSyncConfig/loadLinearMap"
  - "scripts/sync-gsd-linear/__fixtures__/planning-trees/ — 5 synthetic .planning/ subtrees (duplicate-NN, decimal-phase, frontmatter-less, two-generic-plans-in-one-phase, bare-PLAN)"
  - "scripts/sync-gsd-linear/__fixtures__/linear-responses.ts — full-GqlResponse read fixtures (teams, project/issue labels, workspace, per-project issues, initiatives)"
  - "scripts/sync-gsd-linear/__fixtures__/linear-mutation-mock.ts — in-memory mutable mock GraphQL workspace, dup-create-safe"
  - "sync.config.json — committed 3-repo allow-list (claude-workflow, cparx, fx-signal-agent)"
  - "linear-map.json — empty central id map (5 pools)"
affects: [06-02, 06-03, 06-04, 06-05, 06-06, 06-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod schema style: one const per concept, bottom-up composition, trailing `export type X = z.infer<typeof XSchema>` (mirrors src/lib/roadmap/schema.ts)"
    - "readFileSync -> JSON.parse -> safeParse -> throw-Error-naming-the-file boundary (mirrors src/lib/roadmap/loader.ts)"
    - "Full-GqlResponse fixture contract: every fixture export is a complete `{ data: {...} }` object returned directly from a mocked fetch's `.json()`"
    - "Mock GraphQL dispatch by operation name (regex on `query|mutation OpName(`) against an in-memory mutable state object, `fetchFn: typeof fetch` compatible with the existing injected-fetch convention (fetch-workspace.ts)"

key-files:
  created:
    - scripts/sync-gsd-linear/config.ts
    - scripts/sync-gsd-linear/config.test.ts
    - scripts/sync-gsd-linear/__fixtures__/planning-trees/README.md
    - scripts/sync-gsd-linear/__fixtures__/planning-trees/duplicate-NN/ (2 phases + ROADMAP.md stub)
    - scripts/sync-gsd-linear/__fixtures__/planning-trees/decimal-phase/ (3 phases)
    - scripts/sync-gsd-linear/__fixtures__/planning-trees/frontmatter-less/
    - scripts/sync-gsd-linear/__fixtures__/planning-trees/two-generic-plans-in-one-phase/
    - scripts/sync-gsd-linear/__fixtures__/planning-trees/bare-PLAN/
    - scripts/sync-gsd-linear/__fixtures__/linear-responses.ts
    - scripts/sync-gsd-linear/__fixtures__/linear-mutation-mock.ts
    - sync.config.json
    - linear-map.json
  modified: []

key-decisions:
  - "SyncConfigSchema is a top-level z.array(SyncConfigEntrySchema), not a wrapped {entries:[...]} object — matches D-06-04's 'each entry is {...}' phrasing and keeps sync.config.json a flat, readable list."
  - "Resolved-state contracts (ResolvedIssue/ResolvedProject/ResolvedWorkspace/SyncOperation/DiffSummary) are plain TypeScript interfaces, not Zod schemas — they describe internal computed state built by resolve.ts from already-typed GraphQL responses, not untrusted external input that needs runtime validation."
  - "linear-mutation-mock.ts's dup-create resolve check approximates the CLI's title-hash step by exact name/title string match (hash.ts doesn't exist yet in Wave 0) — same name always produces the same hash, so this is behaviorally equivalent for the mock's purpose without a forward dependency on a not-yet-built module."
  - "fx-signal-agent first-run caveat (RESEARCH Open Question 2): fx-signal-agent's pre-existing Linear milestones (M7/M8) don't follow this CLI's slug-based naming/hash convention. sync.config.json still includes fx-signal-agent per the phase's target-repo list, but 06-07's human-verify checkpoint is where this is surfaced live before any real apply — no code change needed in this plan (data-file config only, no special-casing in the schema)."

patterns-established:
  - "Wave-0 fixture-first testing: on-disk synthetic .planning/ trees + full-GqlResponse fixtures + a dup-safe mutation mock exist BEFORE any walker/parser/resolver/apply behavior code, so 06-02..06-06 build test-first against fixed inputs."

requirements-completed: [SYNC-01, SYNC-04]

# Metrics
duration: ~20min
completed: 2026-07-15
---

# Phase 06 Plan 01: Interface-first foundation + Wave-0 fixtures Summary

**Zod contracts (config/map/normalized-model + resolved-state + SyncOperation write-set union) and three Wave-0 fixture sets (synthetic `.planning/` trees, full-GqlResponse read fixtures, a dup-create-safe mutation mock) for the sync-gsd-linear CLI, hardened per cross-AI review Consensus items 1-5.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-15T13:34:00+02:00 (approx.)
- **Completed:** 2026-07-15T13:42:23+02:00
- **Tasks:** 3
- **Files modified:** 19 created (0 modified)

## Accomplishments
- `config.ts` is now the single source of every contract downstream stages (walker, parser, resolver, diff, dates, apply) will build against: `SyncConfigSchema`/`LinearMapSchema`/`NormalizedModelSchema` (Zod), plus `ResolvedIssue`/`ResolvedProject`/`ResolvedWorkspace`/`SyncOperation`/`DiffSummary` (plain interfaces) and the two `readFileSync`-based loaders.
- `NormalizedPlan` carries a stable `key` (identity path) separate from the display `title`, plus `taskLines` — closes the review-flagged risk of two generic-H1 plans in one phase collapsing onto the same title-hash.
- `SyncConfigEntry.name` is the `--project` match key; `ResolvedWorkspace.initiativeId` gives apply a real id for the initiative-join mutation; `SyncOperation`/`DiffSummary.operations` let the printed diff enumerate the exact write set apply will execute.
- Five synthetic `.planning/` subtrees reproduce every structural quirk RESEARCH.md found across the three real target repos (duplicate-`01-*` dirs, decimal phase numbers, frontmatter-less generic-H1 plans, two identical-H1 plans in one phase, a bare single `PLAN.md`), plus a partial `ROADMAP.md` stub and `VERIFICATION.md`/`SUMMARY.md` completion-status siblings.
- `linear-mutation-mock.ts`'s create handlers resolve-before-create (label match, then name match) and return the existing id on a duplicate — verified live: two `ProjectCreate` calls with the same name produced exactly one project in mock state.
- `sync.config.json` (3 repos, each with `name` + `teamKey: AGE`, no token) and `linear-map.json` (5 empty pools) both parse cleanly through their schemas.

## Task Commits

1. **Task 1: Config, map, normalized-model schemas + resolved-state + operation contracts** - `c4c2c59` (feat)
2. **Task 2: Three Wave-0 fixture sets** - `10a9551` (feat)
3. **Task 3: Seed sync.config.json and linear-map.json** - `0dd3203` (feat)

_No TDD tasks in this plan (Task 1 was `tdd="true"` in frontmatter; test file was written alongside the implementation as a single commit per the plan's `<action>` step, not a separate RED/GREEN pair — the plan's own `<verify>` step is a single automated vitest run, not a red-then-green sequence)._

## Files Created/Modified
- `scripts/sync-gsd-linear/config.ts` - Zod schemas + resolved-state/operation contracts + loaders
- `scripts/sync-gsd-linear/config.test.ts` - 16 tests: schema accept/reject cases + loader read+parse+throw behavior
- `scripts/sync-gsd-linear/__fixtures__/planning-trees/` - 5 synthetic `.planning/` subtrees + README documenting each quirk
- `scripts/sync-gsd-linear/__fixtures__/linear-responses.ts` - 9 named full-GqlResponse fixture constants (teams, labels, workspace, per-project issues, initiatives)
- `scripts/sync-gsd-linear/__fixtures__/linear-mutation-mock.ts` - `createMutationMock()` — in-memory mock GraphQL workspace, dup-create returns existing id
- `sync.config.json` - 3-repo allow-list (claude-workflow, cparx, fx-signal-agent), token-free
- `linear-map.json` - 5 empty id pools

## Decisions Made
- `SyncConfigSchema` is a flat `z.array(...)`, not a wrapped object — see key-decisions above.
- Resolved-state/operation contracts are plain interfaces, not Zod-validated — internal computed state, not untrusted input.
- Mutation-mock's dup-check uses exact name match as the title-hash stand-in (hash.ts doesn't exist until a later plan).
- fx-signal-agent stays in `sync.config.json`'s target-repo list; the M7/M8 pre-existing-milestone caveat is a live-verify concern for 06-07, not a schema/config change here.

## Deviations from Plan

None - plan executed exactly as written. All `<action>` specs, `<verify>` commands, and `<acceptance_criteria>` greps were followed and passed as specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. (`LINEAR_API_KEY` is required starting with the resolve/apply plans in this phase, not this Wave-1/Wave-0 plan.)

## Next Phase Readiness

`config.ts`'s contracts and all three Wave-0 fixture sets are in place for `06-02` (walker) and `06-03` (parser) to build test-first against the `planning-trees/` fixtures, and for `06-05`/`06-06` (resolve/apply) to build test-first against `linear-responses.ts` and `linear-mutation-mock.ts`. No blockers.

---
*Phase: 06-sync-gsd-linear-cli*
*Completed: 2026-07-15*
