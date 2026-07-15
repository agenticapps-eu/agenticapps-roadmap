---
phase: 06-sync-gsd-linear-cli
plan: 05
subsystem: infra
tags: [linear-graphql, resolve-before-create, idempotency, sync-gsd-linear]

# Dependency graph
requires:
  - phase: 06-01
    provides: "config.ts contracts (LinearMap, SyncConfigEntry, ResolvedIssue/Project/Workspace) resolve.ts builds against"
  - phase: 06-03
    provides: "hash.ts (titleHash) + mutations.ts (TEAMS_QUERY, PROJECT_LABELS_QUERY, ISSUE_LABELS_QUERY, PROJECT_ISSUES_QUERY, write mutation docs) resolve.ts consumes"
provides:
  - "scripts/sync-gsd-linear/resolve.ts — resolveTeam, resolveLabels (both pools), resolveInitiative (name->id, fail-closed), resolveProjectByLabel, resolveProject/resolveMilestone/resolveIssue (map->label->hash order), readProjectIssues (paginated dedup read), buildResolvedWorkspace (composes all of it)"
affects: [06-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected-fetch, variables-only GraphQL discipline (mirrors fetch-workspace.ts) applied to every new lookup"
    - "Soft-fail secondary resolve signal: a query whose failure should fall through to the next resolve step (rather than abort resolution) returns null on any transport/GraphQL error instead of throwing — used for resolveProjectByLabel, contrasted with resolveTeam/resolveInitiative's fail-closed (throw) contract for mandatory/named-but-missing lookups"
    - "Operation-name-dispatch test stub (stubFetch) in resolve.test.ts — mirrors linear-mutation-mock.ts's own dispatch style for read-only fixed fixtures, robust to call ordering unlike a sequential-array mock"

key-files:
  created:
    - scripts/sync-gsd-linear/resolve.ts
    - scripts/sync-gsd-linear/resolve.test.ts
  modified: []

key-decisions:
  - "resolveProjectByLabel is a small, file-local GraphQL query (PROJECT_BY_LABEL_QUERY, `projects(filter: { labels: { name: { eq } } })`), not an extension to mutations.ts or map.ts/transform.ts. RawWorkspace's MAIN_QUERY read intentionally omits per-project label attachment (map.ts/transform.ts's explicit read-side allow-list never needed it), so Project's D-06-03 'label-carrying project' resolve step cannot be answered by scanning the already-fetched workspace. Keeping the new query file-local to resolve.ts respects this plan's locked files_modified scope (resolve.ts/resolve.test.ts only) rather than reopening the shared read-path files other phases/the live snapshot depend on."
  - "resolveProjectByLabel soft-fails (returns null) on any transport/GraphQL/parse error instead of throwing. A miss on this secondary signal is equivalent to a real 'the label doesn't identify a project' miss — it must fall through to the name-match step, not abort the whole resolve. This also keeps buildResolvedWorkspace usable against linear-mutation-mock.ts (06-01's fixture, out of this plan's file scope to extend), which has no ProjectByLabel handler and would otherwise make every buildResolvedWorkspace call against the mock throw."
  - "resolveProject takes an explicit `labeledProjectId: string | null` parameter (resolved by buildResolvedWorkspace via resolveProjectByLabel before calling it) rather than performing its own network call — keeps resolveProject a pure, trivially-testable function over already-resolved data, consistent with resolveMilestone/resolveIssue's shape."
  - "The idempotency test (map->label->hash 'no duplicate after create' proof) calls resolveProject/resolveMilestone/resolveIssue directly against state read from linear-mutation-mock.ts, per the plan's own Task 2 acceptance wording ('a second resolveProject/resolveMilestone/resolveIssue against the now-populated mock finds them') — not through buildResolvedWorkspace's full network orchestration, since the mock has no ProjectIssues/ProjectByLabel read handlers (06-01 fixture, out of this plan's scope to extend). resolveIssue's project.issues input is built by reading the mock's in-memory state directly, mirroring the fields a real readProjectIssues call would map."

requirements-completed: [SYNC-02]

# Metrics
duration: ~25min
completed: 2026-07-15
---

# Phase 06 Plan 05: resolve.ts — SYNC-02 map->label->hash resolver Summary

**Full Linear resolve-before-create surface (team, both label pools, initiative name->id, project/milestone/issue via the locked map->label->hash order, plus a paginated per-project issue read for dedup) — 29 tests including a mutation-mock idempotency proof that re-resolving after a create finds the existing records with no duplicate.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-15T14:20:00+02:00 (approx.)
- **Completed:** 2026-07-15T14:45:00+02:00
- **Tasks:** 2
- **Files modified:** 2 created (0 modified)

## Accomplishments
- `resolveTeam`/`resolveLabels` resolve a Team by key and both distinct label pools (ProjectLabel + IssueLabel) by name, each via GraphQL variables (never interpolation); a second `teamKey` resolves a different team, closing RESEARCH Assumption A1's per-entry-override gap.
- `resolveInitiative` matches a configured Initiative NAME against the already-read workspace: `null` when unset, the id when found, a clear fail-closed throw when named-but-missing — mirrors `resolveTeam`'s contract.
- `resolveProject`/`resolveMilestone`/`resolveIssue` honor the exact locked order (stored `linear-map.json` id → `roadmap:<repo>` label → title-hash), verified by dedicated ordering tests (map id beats label, label beats name/hash).
- `readProjectIssues` is a cursor-paginated, target-scoped read (copies `fetch-workspace.ts`'s loop + endCursor invariant) populating `ResolvedProject.issues` with `id`/`title`/`milestoneId`/`labelIds` — the identity surface `resolveIssue` and, later, `06-06`'s diff/dedup need.
- `buildResolvedWorkspace` composes the base `fetchAssembledWorkspace`+`mapWorkspace` read with team/labels/initiative/project resolution into a single `ResolvedWorkspace`, with `initiativeId` populated so apply's initiative-join mutation gets a real id.
- The idempotency proof (`describe("idempotent re-resolve after create")`) drives `linear-mutation-mock.ts`'s real create handlers, then proves `resolveProject`/`resolveMilestone`/`resolveIssue` find the exact same ids on re-resolve, and that a second identical create returns the same id with mock state arrays unchanged in length — the core SYNC-04 primitive this plan hands to `06-06`.
- All 29 new tests pass; full `scripts/sync-gsd-linear` suite is 91/91 green; `tsc -b --noEmit` is clean; zero `any`.

## Task Commits

1. **Task 1 + Task 2: resolve.ts — team/labels/initiative/project/milestone/issue resolve + issue read surface** - `60e02d5` (feat)

_Both tasks were implemented in a single pass as one internally-consistent `resolve.ts` file (Task 2's `buildResolvedWorkspace` directly composes Task 1's `resolveTeam`/`resolveLabels`), matching 06-01's precedent of a single commit covering a `tdd="true"`-frontmatter plan's test+implementation together rather than an artificial split._

## Files Created/Modified
- `scripts/sync-gsd-linear/resolve.ts` - `resolveTeam`, `resolveLabels`, `resolveInitiative`, `resolveProjectByLabel`, `resolveProject`, `readProjectIssues`, `resolveMilestone`, `resolveIssue`, `buildResolvedWorkspace`
- `scripts/sync-gsd-linear/resolve.test.ts` - 29 tests: team/label resolution, initiative name->id (unset/found/fail-closed), project/milestone/issue resolve ordering, paginated issue read (single page + multi-page), full `buildResolvedWorkspace` flows (empty workspace, populated-via-name, populated-via-label, initiative), and the mutation-mock idempotency proof

## Decisions Made
- `resolveProjectByLabel` added as a small, file-local query (not an extension to `mutations.ts`/`map.ts`/`transform.ts`) — see key-decisions above for the full rationale (RawWorkspace's MAIN_QUERY read has no per-project label field; this plan's file scope is locked to `resolve.ts`/`resolve.test.ts`).
- `resolveProjectByLabel` soft-fails (null) rather than throwing on any query error — a deliberate contrast with `resolveTeam`'s fail-closed contract, since a miss on this *secondary* resolve signal must fall through to the next step, not abort resolution.
- `resolveProject` accepts a `labeledProjectId` parameter instead of making its own network call, keeping it pure/sync like `resolveMilestone`/`resolveIssue`.
- The idempotency test operates at the `resolveProject`/`resolveMilestone`/`resolveIssue` function level against `linear-mutation-mock.ts`'s real create handlers + direct in-memory state reads, rather than through `buildResolvedWorkspace`'s full network path — the mock has no `ProjectIssues`/`ProjectByLabel` read handlers (out of this plan's scope to add), and the plan's own Task 2 acceptance wording names the three individual functions for this specific proof.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `resolveProjectByLabel`, a dedicated Project-carries-label lookup**
- **Found during:** Task 2 (`resolveProject` implementation)
- **Issue:** The plan's `<action>` specifies `resolveProject(workspace, map, entry)` implementing a 3-step order where step 2 is "project carrying the `roadmap:<repo>` label," matched purely over the already-fetched `RawWorkspace`. But `RawWorkspace`/`RawProject` (`scripts/linear/transform.ts`) and `GqlProject` (`scripts/linear/map.ts`) both intentionally omit per-project label data (explicit read-side allow-list, confirmed by reading both files) — there is no field to scan. Without a fix, the label-resolve step for Project would be silently unimplementable, violating the plan's own must-have truth ("stored map id -> roadmap:<repo> label -> title-hash... every entity").
- **Fix:** Added a small, file-local `PROJECT_BY_LABEL_QUERY` + `resolveProjectByLabel(fetchFn, endpoint, auth, labelName): Promise<string | null>` in `resolve.ts`. `buildResolvedWorkspace` resolves this once and passes the result into `resolveProject` as an explicit parameter, keeping `resolveProject` itself a pure/sync function. Soft-fails to `null` on any error (see Decisions) so a lookup failure degrades gracefully to the name-match fallback rather than aborting resolution.
- **Files modified:** `scripts/sync-gsd-linear/resolve.ts`, `scripts/sync-gsd-linear/resolve.test.ts`
- **Verification:** 6 dedicated tests (`resolveProjectByLabel` resolves/soft-fails/handles-unimplemented-op; `resolveProject`'s "label beats name" and "map beats label" ordering tests; the full `buildResolvedWorkspace` "resolves via label when name doesn't match" test) plus the full 29-test file green.
- **Committed in:** `60e02d5` (single task commit for both tasks)

**2. [Rule 1 - Bug] Did not reuse the stale `projectIssuesPage` fixture from `linear-responses.ts`**
- **Found during:** Task 2 (`readProjectIssues` tests)
- **Issue:** `linear-responses.ts`'s `projectIssuesPage` fixture (built in 06-01, before `mutations.ts` existed) is shaped `{ data: { project: { issues: { nodes: [...] } } } }` — it does not match the real, finalized `PROJECT_ISSUES_QUERY`/`ProjectIssuesQueryResponse` contract from `mutations.ts` (06-03), which is a flat top-level `{ data: { issues: { nodes, pageInfo } } }` (no `pageInfo`, no `project` wrapper in the stale fixture). Using it directly would either fail to typecheck or silently test the wrong shape.
- **Fix:** `resolve.test.ts` constructs its own inline mock responses matching the real `ProjectIssuesQueryResponse` shape for all `readProjectIssues`/`buildResolvedWorkspace` tests, rather than importing the mismatched fixture. `linear-responses.ts` itself was left untouched (outside this plan's file scope; 06-01's stale export is unused by this plan and does not block it).
- **Files modified:** `scripts/sync-gsd-linear/resolve.test.ts` (no changes to `linear-responses.ts`)
- **Verification:** `readProjectIssues` tests pass against the correctly-shaped inline fixtures; `tsc -b --noEmit` clean.
- **Committed in:** `60e02d5`

---

**Total deviations:** 2 auto-fixed (1 missing critical functionality, 1 bug/stale-fixture workaround)
**Impact on plan:** Both were necessary to make the plan's own must-have truths achievable given the actual shape of the existing read plumbing; neither expanded scope beyond `resolve.ts`/`resolve.test.ts`, and neither touched any file outside this plan's locked `files_modified` list.

## Issues Encountered

None beyond the two deviations above (both resolved inline, no open follow-up needed for this plan).

## User Setup Required

None - no external service configuration required. `resolve.ts` is process-free/pure aside from the injected `fetchFn`; `LINEAR_API_KEY` is read only at `06-06`/`06-07`'s Node-only CLI boundary, not here.

## Next Phase Readiness

`resolve.ts`'s full resolve-before-create surface (`resolveTeam`, `resolveLabels`, `resolveInitiative`, `resolveProject`, `resolveMilestone`, `resolveIssue`, `readProjectIssues`, `buildResolvedWorkspace`) is ready for `06-06` (apply.ts) to build the diff-consuming, mutation-executing write path against. The idempotency primitive (resolve-before-create finds existing records via the mock) is proven at this layer; `06-06` still owns write-back to `linear-map.json` after each successful create and the `PROJECT_MILESTONE_UPDATE`/`ISSUE_UPDATE` create-vs-update decision (per 06-REVIEWS.md C5, already scoped as "v1 creates only" per the phase's other plans). No blockers.

---
*Phase: 06-sync-gsd-linear-cli*
*Completed: 2026-07-15*
