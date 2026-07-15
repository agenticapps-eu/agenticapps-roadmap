---
phase: 06-sync-gsd-linear-cli
plan: 06
subsystem: infra
tags: [linear-graphql, write-engine, idempotency, sync-gsd-linear]

# Dependency graph
requires:
  - phase: 06-03
    provides: "mutations.ts (typed *_CREATE mutation docs) and hash.ts (titleHash) apply.ts executes/relies on"
  - phase: 06-04
    provides: "diff.ts's buildDiff -- the exact approved write set (SyncOperation[]) apply.ts executes"
  - phase: 06-05
    provides: "resolve.ts's buildResolvedWorkspace -- the resolve-before-create read surface apply.ts calls twice (baseline + TOCTOU re-resolve)"
provides:
  - "scripts/sync-gsd-linear/apply.ts -- applyProject(deps, model, map, opts): create-only operation-set upsert, TOCTOU abort-on-drift, atomic per-create linear-map.json write-back, gated planAhead patch"
  - "scripts/sync-gsd-linear/apply.ts -- writeLinearMap(path, map) (temp-file + rename) and patchPlanAhead(roadmapPath, projectName, planAhead) (assertNoLeak + RoadmapJsonSchema gate) as standalone exports"
affects: [06-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Issue-identity dedup is MAP-based (id -> plan.key reverse lookup through linear-map.json.issues), not title-hash-based -- Linear issue titles stay human-readable (plan.title, D-06-01) while diff.ts's identityKey-field matching contract (hash.ts: 'issue identity hashes the KEY, never the display title') is satisfied without needing a hidden identity token in a field PROJECT_ISSUES_QUERY doesn't even fetch (no description field)."
    - "TOCTOU guard re-resolves + rebuilds the operation set immediately before writing and aborts on any canonical-operation-set mismatch, rather than trusting a diff computed earlier in a separate CLI invocation."
    - "Execute order is a fixed dependency chain (team check -> labels -> project -> initiative-join -> milestones -> issues), filtered by which operation kinds are present in the approved set -- not literal iteration order of DiffSummary.operations[] (whose array order groups by kind differently)."

key-files:
  created:
    - scripts/sync-gsd-linear/apply.ts
    - scripts/sync-gsd-linear/apply.test.ts
  modified:
    - scripts/sync-gsd-linear/__fixtures__/linear-mutation-mock.ts

key-decisions:
  - "Issue title on ISSUE_CREATE is set to plan.title (the human plan heading, honoring D-06-01 'titled from the plan heading') rather than plan.key. Dedup/identity for issues is instead recovered by reverse-matching a resolved issue's Linear id against the already-written linear-map.json issues pool (map-tier only) -- sufficient for every must-have this plan states ('a second apply against the now-populated MAP/workspace is a no-op') without requiring a raw identity string to ever appear as a Linear issue's visible title. Internal module layout is explicitly Claude's Discretion per 06-CONTEXT.md."
  - "applyProject's locked signature takes a NormalizedModel, not a SyncConfigEntry, but resolve.ts's buildResolvedWorkspace needs the latter -- apply.ts derives a SyncConfigEntry from the model via entryFromModel(), computing `label: roadmap:<repo>` the same way diff.ts already does (NormalizedModel carries no separate label field, per 06-04's own key-decision)."
  - "Execution order for creates is the explicit dependency chain from the plan's own <action> text (team -> labels -> project -> initiative-join -> milestones -> issues), filtered by hasOp(kind) checks against the approved operations[] set -- not the literal array order buildDiff emits (which lists project-create before the label-create ops), since a Project's labelIds must exist before PROJECT_CREATE fires."
  - "Milestone id lookup during execution re-derives the same titleHash(phase.slug)-vs-titleHash(m.name) match diff.ts's own findMatchingMilestone uses, rather than calling resolve.ts's resolveMilestone -- keeps apply.ts's own matching self-consistent with what buildDiff just decided, without a second network round-trip or relying on resolveMilestone's mutable-map-lookup semantics mid-execution."

requirements-completed: [SYNC-04]

# Metrics
duration: ~40min
completed: 2026-07-15
---

# Phase 06 Plan 06: apply.ts -- SYNC-04 write engine Summary

**Create-only Linear write engine (`applyProject`) that executes exactly the diff-approved operation set, aborts on TOCTOU drift, persists `linear-map.json` atomically after every single create, and patches `public/roadmap.json`'s `planAhead` flag through the existing leak/schema gate -- 11 tests, all against the shared mutation mock, zero live Linear calls.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-15T15:10:00+02:00 (approx.)
- **Completed:** 2026-07-15T15:50:00+02:00
- **Tasks:** 2
- **Files modified:** 2 created, 1 modified (fixture)

## Accomplishments

- `applyProject(deps, model, map, opts)` builds the resolved workspace + diff once (dry-run baseline / return value), and on a real apply (`dryRun: false`) re-resolves and rebuilds the operation set a SECOND time immediately before writing -- if the two operation sets differ (canonical `kind:identityKey` signature comparison), it throws `"Linear state changed since the diff was shown — re-run to review"` rather than writing anything unapproved (TOCTOU guard).
- Creates execute in the correct resolve-before-create dependency order (team check -> ProjectLabel/IssueLabel -> Project -> initiative-join -> milestones -> issues), filtered strictly by which operation kinds `buildDiff` approved -- v1 never calls a `*_UPDATE` mutation; an existing milestone's drifted `targetDate` is proven to stay untouched (surfaces only in `datesInformational`).
- The initiative-join fires `INITIATIVE_TO_PROJECT_CREATE` with `resolved.initiativeId` (the resolved Linear id, never the bare config name) only when the project was newly created in the same run, and is proven to not repeat on a second apply.
- Every successful create writes its id into the matching `linear-map.json` pool and calls `writeLinearMap` (temp file + `renameSync`) IMMEDIATELY -- not batched -- proven both by call-count (one `renameSync` per map-writing create) and by reading the persisted file mid-sequence.
- A mutation failure mid-apply is caught and re-thrown as `"apply incomplete: <cause>; map already holds N newly-written id(s) from this run; re-run to continue"` -- the already-persisted map bounds the blast radius.
- `patchPlanAhead` reuses `assertNoLeak` + `RoadmapJsonSchema.parse` verbatim (imported, not reimplemented) and is gated to `!opts.dryRun || opts.writeSnapshot === true`; a plain dry-run never touches `roadmap.json`, dry-run+`--write-snapshot` patches it with zero mutation calls, and a token/email already present in the file throws before any write.
- A second `applyProject` call against the now-populated map/mock creates nothing (`operations: []`, mock state array lengths unchanged) -- the core SYNC-04 idempotency proof.
- 11/11 new tests green; full `scripts/sync-gsd-linear` suite 102/102; full repo suite 221/221; `tsc -b --noEmit` clean; `eslint` clean; zero `any`.

## Task Commits

Both tasks were implemented in a single pass as one internally-consistent `apply.ts` file (Task 2's `patchPlanAhead` is called directly from Task 1's `applyProject`), matching 06-01/06-04/06-05's established precedent for this phase (single commit per tightly-coupled `tdd="true"` file pair) rather than an artificial two-commit split of one file's two halves.

1. **Task 1 + Task 2: apply.ts -- operation-set upsert + atomic map write-back + gated planAhead patch** - `6fda089` (feat)

## Files Created/Modified

- `scripts/sync-gsd-linear/apply.ts` - `applyProject`, `writeLinearMap`, `patchPlanAhead`, plus file-local helpers (`entryFromModel`, `withIssueIdentity`, `executeOperations`, `postGraphQL`)
- `scripts/sync-gsd-linear/apply.test.ts` - 11 tests: dry-run (zero mutations), idempotent re-run, initiative-join (fires once, resolved id), create-only (no `*_UPDATE`), atomic-map (temp+rename, per-create persistence, x2), abort-on-drift (TOCTOU), planAhead (x4: schema-valid patch, leak-throw, plain-dry-run-skips, dry-run+write-snapshot-patches)
- `scripts/sync-gsd-linear/__fixtures__/linear-mutation-mock.ts` - added the `ProjectIssues` read handler (see Deviations)

## Decisions Made

- Issue identity/dedup is resolved via a map-based reverse lookup (Linear issue id -> plan key, through the already-persisted `linear-map.json` issues pool), not by encoding `plan.key` into the Linear issue's visible `title`. See key-decisions above for the full rationale (D-06-01 vs. hash.ts's identity-hash-never-title contract vs. `PROJECT_ISSUES_QUERY`'s missing `description` field). Real Linear issue titles stay human-readable (`plan.title`); `resolve.ts`'s own `resolveIssue` (title-hash tier) remains available/correct for its own designed purpose but is not invoked by `apply.ts`'s enrichment step, since the map tier alone satisfies every must-have this plan states.
- `entryFromModel()` adapts `NormalizedModel` to the `SyncConfigEntry` shape `buildResolvedWorkspace` requires, deriving `label` via the same `roadmap:<repo>` convention `diff.ts` already uses.
- Execution order follows the plan's explicit dependency chain, not `DiffSummary.operations[]`'s literal array order (which lists `project-create` before the label-create ops) -- a Project's `labelIds` must exist before `PROJECT_CREATE` fires.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the missing `ProjectIssues` read handler to `linear-mutation-mock.ts`**
- **Found during:** Task 1 (idempotency test)
- **Issue:** `resolve.ts`'s `buildResolvedWorkspace` calls `readProjectIssues` (target-scoped `PROJECT_ISSUES_QUERY`) whenever a project is already resolved -- which is exactly the second-run path this plan's own idempotency must-have exercises. `linear-mutation-mock.ts` (06-01/06-05) had no handler for this operation name; 06-05's own `resolve.test.ts` comment explicitly flagged this as "out of this plan's file scope to add," deferring it to 06-06. Without a fix, a second real `applyProject` call would throw on the unimplemented-operation error response instead of proving idempotency.
- **Fix:** Added a `ProjectIssues` handler mirroring the shape `PROJECT_ISSUES_QUERY`/`ProjectIssuesQueryResponse` (mutations.ts, 06-03) expects: filters `state.issues` by `projectId`, maps to `{id, title, projectMilestone, labels}`, returns `pageInfo: {hasNextPage: false, endCursor: null}`.
- **Files modified:** `scripts/sync-gsd-linear/__fixtures__/linear-mutation-mock.ts`
- **Verification:** "idempotent" and "initiative-join" tests (both call `applyProject` twice, hitting this handler on the second call) pass; full fixture-dependent suite (102 tests across `scripts/sync-gsd-linear`) green.
- **Committed in:** `6fda089` (Task 1+2 commit)

**2. [Rule 1 - Bug] Fixed a test-authoring bug that clobbered the repo's own committed `linear-map.json`**
- **Found during:** self-check, after the first full test pass (11/11 green)
- **Issue:** Several `apply.test.ts` calls to `applyProject(..., { dryRun: false, roadmapPath })` omitted `mapPath`, falling through to `apply.ts`'s `DEFAULT_MAP_PATH = "linear-map.json"` (relative to cwd). Since tests run from the repo root, this wrote real test-generated ids into the repo's actual committed `linear-map.json` -- caught via `git status` showing an unexpected modification before staging.
- **Fix:** Reverted `linear-map.json` via `git checkout --`, added a `tmpMapPath()` test helper (tmpDir-scoped), and passed it explicitly to every `applyProject` call in the file, including `dryRun: true` calls (defense in depth against future default-path regressions).
- **Files modified:** `scripts/sync-gsd-linear/apply.test.ts` (test-only; `linear-map.json` itself was reverted, not "fixed" -- it should never have been touched)
- **Verification:** All 11 tests still pass after the fix; `git status --short linear-map.json` shows no diff; full repo suite (221 tests) green.
- **Committed in:** `6fda089` (Task 1+2 commit; the bug was caught and fixed before this commit, so the committed test file never contained the unsafe default-path calls)

---

**Total deviations:** 2 auto-fixed (1 blocking fixture gap, 1 test-authoring bug caught pre-commit)
**Impact on plan:** Both were necessary for the plan's own must-haves to be genuinely provable (idempotency against the real `buildResolvedWorkspace` path) and safe (never writing to the committed `linear-map.json` from a test run). Neither expanded scope beyond what SYNC-04 requires; no production behavior in `apply.ts` was affected by deviation 2.

## Known Stubs

None. `applyProject`'s only unimplemented paths are the explicitly-scoped-out v1 `*_UPDATE` mutations (create-only is the stated design, not a stub), and the 06-07 CLI wiring (arg parsing, `y/N` prompt, `LINEAR_API_KEY` env read) which this plan explicitly defers per its own objective ("This plan is autonomous logic + mocked tests; the CLI wiring and live human-verify are 06-07").

## Threat Flags

None beyond the threat model already declared in `06-06-PLAN.md` (T-06-01, T-06-02, T-06-05, T-06-06) -- all four mitigations are implemented as specified: every mutation variable is passed through GraphQL `variables` (never interpolated), `patchPlanAhead` runs `assertNoLeak` before every write, `applyProject` executes only the approved operation set with abort-on-drift, and the atomic per-create map write bounds a mid-apply crash to at most one duplicated record.

## Issues Encountered

None beyond the two deviations above (both resolved inline, no open follow-up needed for this plan).

## User Setup Required

None - no external service configuration required. `apply.ts` is pure/injected-`fetch` (no `process.env` read); `LINEAR_API_KEY` is threaded in by the caller (06-07's Node-only CLI boundary), matching `client.ts`'s established pattern.

## Next Phase Readiness

`applyProject`, `writeLinearMap`, and `patchPlanAhead` are ready for `06-07` to wire into the actual `pnpm sync:gsd` CLI: argument parsing (`--project`, `--dry-run` default, `--yes`, `--write-snapshot`, `--anchor`/`--cadence`), the `y/N` approval prompt (D-06-07), reading `LINEAR_API_KEY` at the Node boundary (mirroring `client.ts`'s fail-fast pattern), and loading/saving `sync.config.json` + `linear-map.json` from their real committed paths. No blockers. One open note for 06-07: `applyProject`'s TOCTOU guard only detects drift *within* a single `dryRun: false` invocation (it re-resolves twice internally) -- it does not re-validate against a diff shown by an earlier, separate `--dry-run` CLI invocation; 06-07's CLI should call `applyProject` with `dryRun: true` to render the approval prompt and then immediately call it again with `dryRun: false` after a `y` answer, keeping the human-visible diff and the executed write as close in time as this guard already assumes.

---
*Phase: 06-sync-gsd-linear-cli*
*Completed: 2026-07-15*

## Self-Check: PASSED

All claimed files verified on disk (apply.ts, apply.test.ts, this SUMMARY.md)
and the task commit hash (6fda089) verified present in git log.
