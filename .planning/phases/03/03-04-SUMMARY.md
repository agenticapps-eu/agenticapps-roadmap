---
phase: 03-linear-proxy
plan: 04
subsystem: ui
tags: [react, react-router-7, typescript, loader, cloudflare-pages, linear, graphql, vitest]

# Dependency graph
requires:
  - phase: 03-linear-proxy
    provides: "03-03 built the Pages Function proxy at /api/linear/snapshot with cache headers and leak-gate"
provides:
  - "Source-selecting loader returning { data, live, liveUnavailable } with total-failure-safe snapshot fallback"
  - "Loader unit tests enforcing snapshot-default (zero /api/linear/* calls without ?source)"
  - "Header Snapshot/Live toggle flipping ?source (clean default URL, no ?source=snapshot)"
  - "Live-unavailable notice rendered in AppHeader when live falls back"
  - "Complexity-safe two-part Linear fetch: bounded MAIN_QUERY + paginated ISSUES_QUERY"
  - "Corrected Live Linear schema field names (Initiative.status, Project.initiatives, Project.status)"
affects: [03-05, 04-timeline-ui, 05-overview-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single try/catch wrapping the entire live branch — any failure (fetch reject, json() throw, !ok, schema mismatch) falls through to snapshot, never throws"
    - "RR7 search-param revalidation — ?source toggle triggers automatic loader revalidation with no useRevalidator"
    - "Two-part Linear fetch — MAIN_QUERY (bounded) + ISSUES_QUERY (cursor-paginated) assembled in fetch-workspace.ts to avoid 'Query too complex' errors"
    - "fetchAssembledWorkspace delegates from both client.ts and the Worker handler, keeping map.ts/transform.ts/schema.ts unchanged"

key-files:
  created:
    - "src/lib/roadmap/loader.test.ts"
    - "scripts/linear/fetch-workspace.ts"
  modified:
    - "src/lib/roadmap/loader.ts"
    - "src/pages/OverviewPage.tsx"
    - "src/pages/TimelinePage.tsx"
    - "src/components/AppHeader.tsx"
    - "scripts/linear/map.ts"
    - "scripts/linear/query.ts"
    - "scripts/linear/__fixtures__/gqlClean.json"
    - "scripts/linear/__fixtures__/gqlWithEmail.json"

key-decisions:
  - "Two-part Linear fetch (MAIN_QUERY + paginated ISSUES_QUERY) chosen over single nested query to avoid Linear's 'Query too complex' error at production data volumes"
  - "fetch-workspace.ts introduced as a process-free assembly layer — maps cursor pages to bucket by project.id, skips null-project orphans, reassembles into existing GqlResponse shape"
  - "Live field names corrected to live Linear schema: Initiative.state→status (enum), Project.initiative{id}→initiatives{nodes{id}}, Project.state{name,type}→status{name,type}"
  - "In-browser visual toggle check deferred and accepted by user — unit tests (41 passing) + prior screenshot (/tmp/agenticapps-roadmap-header-toggle.png) deemed sufficient"
  - "Both latent field-name and complexity bugs would have also broken the Phase-02 CI snapshot refresh path once LINEAR_API_KEY is set in GitHub Secrets"

patterns-established:
  - "Loader wrapper pattern: roadmapLoader returns RoadmapLoaderData { data, live, liveUnavailable } — consumers destructure .data, never cast to bare RoadmapJson"
  - "Clean default URL contract: toggling off live removes ?source entirely (prev.delete), never sets ?source=snapshot"

requirements-completed: [REQ-LOADER]

# Metrics
duration: ~3h (Tasks 1-3) + live smoke session
completed: 2026-06-29
---

# Phase 03 Plan 04: Client Live-Data Path + Source Toggle Summary

**Source-selecting RR7 loader with total-failure-safe snapshot fallback, Snapshot/Live header toggle (clean default URL), and a complexity-safe two-part Linear fetch that correctly maps live GraphQL field names**

## Performance

- **Duration:** ~3h implementation + live smoke verification
- **Started:** 2026-06-29
- **Completed:** 2026-06-29
- **Tasks:** 4 (3 auto + 1 checkpoint:human-verify — APPROVED)
- **Files modified:** 8

## Accomplishments

- Source-selecting loader with a single try/catch over the entire live branch: any failure mode (rejected fetch, json() SyntaxError, !ok, schema mismatch) falls through to the snapshot and sets `liveUnavailable: true` — the live branch never throws
- Loader unit test suite (41 passing) locking in snapshot-default behavior: asserts zero `/api/linear/*` calls without `?source`, plus the full live-failure fallback matrix (4 failure modes)
- Header Snapshot/Live toggle using `useSearchParams` — toggling off removes `?source` entirely (clean default URL), toggling on sets `?source=live`; live-unavailable notice rendered inline when fallback occurs
- Two latent bugs found and fixed during live smoke (see Deviations): corrected Live Linear schema field names and replaced the single complex query with a complexity-safe two-part fetch + assembly layer
- Live smoke passed: `GET /api/linear/snapshot` → 200 in 714ms, 5 initiatives / 20 projects / 271 issues accurately bucketed across multiple cursor pages; `GET /api/linear/nope` → 404; no token or PII in any response body, header, or wrangler log

## Task Commits

Each task was committed atomically:

1. **Task 1: Source-selecting loader + consumer-page updates** - `c398fab` (feat)
2. **Task 2: Loader unit tests** - `656762c` (test)
3. **Task 3: Header toggle + live-unavailable notice** - `9961845` (feat)
4. **Deviation: Fix live Linear schema field names** - `1add766` (fix)
5. **Deviation: RED — two-part fetch tests** - `2809e0a` (test)
6. **Deviation: GREEN — complexity-safe two-part fetch** - `90b7c32` (feat)

_Note: Tasks 1-3 committed after passing verification. Deviation commits followed after latent bugs surfaced during live smoke._

## Files Created/Modified

- `src/lib/roadmap/loader.ts` — Source-selecting loader; reads `?source` from `request.url`; live branch in single try/catch; returns `{ data, live, liveUnavailable }`; exports `RoadmapLoaderData` type
- `src/lib/roadmap/loader.test.ts` — NEW: Vitest unit tests using `vi.stubGlobal("fetch", ...)`. Covers snapshot-default (asserts zero `/api/linear/*` calls), live-success, and four live-failure modes
- `src/pages/OverviewPage.tsx` — Reads `{ data }` off `RoadmapLoaderData` wrapper; no bare `as RoadmapJson` cast
- `src/pages/TimelinePage.tsx` — Same consumer update as OverviewPage
- `src/components/AppHeader.tsx` — Snapshot/Live toggle via `useSearchParams`; `prev.delete("source")` on toggle-off; live-unavailable notice gated on `liveUnavailable` from `useRouteLoaderData("root")`
- `scripts/linear/query.ts` — Split into `MAIN_QUERY` (initiatives + projects + milestones + status, bounded) + `ISSUES_QUERY` (flat top-level issues, cursor-paginated); corrected field names to live schema
- `scripts/linear/fetch-workspace.ts` — NEW (process-free): fetches MAIN_QUERY + paginates ISSUES_QUERY; buckets issues by `project.id` (skips null-project orphans); reassembles into existing `GqlResponse` shape
- `scripts/linear/map.ts` — Updated interfaces to match corrected Live schema: `Initiative.status` (not `.state`), `Project.initiatives.nodes[].id` (not `.initiative.id`), `Project.status.{name,type}` (not `.state`)
- `scripts/linear/__fixtures__/gqlClean.json` — Updated fixture to match corrected field names
- `scripts/linear/__fixtures__/gqlWithEmail.json` — Updated fixture to match corrected field names

## Decisions Made

- **Two-part fetch design:** Chose `MAIN_QUERY` (bounded, no issues) + `ISSUES_QUERY` (paginated, flat top-level) over a single nested query to avoid Linear's "Query too complex" rejection at production data volumes (5 initiatives / 20 projects / 271+ issues). The `fetch-workspace.ts` assembly layer buckets issues by `project.id` after fetching, keeping `map.ts`/`transform.ts`/`schema.ts` completely unchanged.
- **Clean default URL contract:** Toggle-off calls `prev.delete("source")` — never `prev.set("source", "snapshot")` — so the default URL is clean and shareable without encoding mode state.
- **In-browser visual deferred:** The orchestrator-run live smoke (curl + wrangler logs) plus 41 passing unit tests and a prior screenshot were accepted by the user as sufficient. No additional browser visual was required.
- **Cross-cutting impact of latent bugs:** Both the field-name fix and the two-part fetch redesign also fix the Phase-02 CI snapshot path (`pnpm sync:snapshot`) — that path was masked because Phase-02 seeded `roadmap.json` via the Linear MCP (which abstracts away raw field names), not via the live GraphQL query. Once `LINEAR_API_KEY` is set in GitHub Secrets, the CI snapshot refresh would have failed without these fixes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected wrong GraphQL field names vs the live Linear schema**

- **Found during:** Task 4 (live smoke verification against the real Linear workspace)
- **Issue:** Three field name mismatches between the code and the live schema: `Initiative.state` (a string) → should be `Initiative.status` (an enum); `Project.initiative.id` → should be `Project.initiatives.nodes[].id` (initiatives is a connection, not a scalar); `Project.state.{name,type}` → should be `Project.status.{name,type}`. These were hidden because Phase-02 seeded `roadmap.json` via the Linear MCP which abstracts raw GraphQL field names.
- **Fix:** Updated field names in `scripts/linear/query.ts` and `scripts/linear/map.ts` interfaces; updated both `__fixtures__/gqlClean.json` and `__fixtures__/gqlWithEmail.json` to use the corrected shape. `map.ts`/`transform.ts`/`schema.ts` structural logic unchanged.
- **Files modified:** `scripts/linear/query.ts`, `scripts/linear/map.ts`, `scripts/linear/__fixtures__/gqlClean.json`, `scripts/linear/__fixtures__/gqlWithEmail.json`
- **Cross-cutting note:** This fix also corrects the Phase-02 CI snapshot refresh path — `pnpm sync:snapshot` would have failed once `LINEAR_API_KEY` is set in GitHub Secrets.
- **Verification:** `pnpm test` (41 passing), `pnpm typecheck` clean
- **Committed in:** `1add766` (fix(03-04): correct WORKSPACE_QUERY fields to live Linear schema)

**2. [Rule 1 - Bug] Redesigned into complexity-safe two-part fetch to avoid "Query too complex" rejection**

- **Found during:** Task 4 (live smoke), after field-name fix — the proxy returned a Linear error: "Query too complex" because the single `WORKSPACE_QUERY` nested issues under every project (20 projects × N issues each)
- **Issue:** Linear enforces query complexity limits. The original design nested issues inline under projects. At production data volumes (20 projects, 271+ issues), the query exceeded Linear's complexity budget and was rejected.
- **Fix:** TDD approach (RED → GREEN). Redesigned query into two parts: `MAIN_QUERY` (initiatives + projects + milestones + status, bounded, no issues) + `ISSUES_QUERY` (flat top-level issues via `issues(first:250)`, cursor-paginated). Created `scripts/linear/fetch-workspace.ts` (process-free) as an assembly layer: fetches MAIN_QUERY, paginates ISSUES_QUERY, buckets issues by `project.id` (null-project orphans skipped), and reassembles into the existing `GqlResponse` shape. Both `client.ts` and the Worker handler delegate to `fetchAssembledWorkspace`. `map.ts`/`transform.ts`/`schema.ts` are completely unchanged.
- **Files modified:** `scripts/linear/query.ts` (split into two queries), `scripts/linear/fetch-workspace.ts` (new)
- **Cross-cutting note:** This fix also corrects the Phase-02 CI snapshot path — `pnpm sync:snapshot` (which calls through `client.ts`) would have hit the same "Query too complex" error at production data volumes.
- **Verification:** Live smoke confirmed 271 issues accurately bucketed across multiple cursor pages. `pnpm test` 41 passing, `pnpm typecheck` clean, `pnpm build` clean.
- **Committed in:** `2809e0a` (test(03-04): RED), `90b7c32` (feat(03-04): GREEN)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs found during live smoke)
**Impact on plan:** Both fixes were required for the live data path to work at all against the real Linear workspace. No scope creep. `map.ts`/`transform.ts`/`schema.ts` were explicitly kept unchanged.

## Live Smoke Evidence

Orchestrator-driven live smoke using `wrangler pages dev dist --port 8788` with `LINEAR_API_KEY` in gitignored `.dev.vars`:

| Check | Result |
|-------|--------|
| `GET /api/linear/snapshot` | 200 in 714ms, `Cache-Control: private, max-age=60` |
| Initiatives / Projects | 5 initiatives, 20 projects; statuses correct (Active / Backlog) |
| Issues | 271 issues bucketed across multiple cursor pages (76 backlog / 6 started / 189 done) |
| `GET /api/linear/nope` | 404 |
| Token in response/log | Absent — `LINEAR_API_KEY` never appeared in any response body, header, or wrangler log |
| PII in body | None |
| Unit tests | 41 passing (`pnpm test`), `pnpm typecheck` clean, `pnpm build` clean |
| Toggle + fallback | Covered by unit tests + prior header-toggle screenshot (`/tmp/agenticapps-roadmap-header-toggle.png`) |
| In-browser visual | Deferred — user accepted curl + unit test evidence as sufficient (browser profile was busy during smoke session) |

## Issues Encountered

- Linear "Query too complex" error was not discoverable without a real token and real workspace data at production volume. The MCP-seeded fixture data used in Phase-02 did not exercise the complexity path. This is a class of error (production-scale data behaviour) that only live smoke can catch.

## User Setup Required

None — no new environment variables or external service configuration introduced in this plan. The existing `.dev.vars` / `LINEAR_API_KEY` pattern from Phase-03 applies.

## Next Phase Readiness

- 03-04 complete: the full client live-data path is working, tested, and live-smoke verified
- Ready for 03-05: Access setup runbook + captured Access-enforcement proof (the blocking gate for Phase 3 completion)
- `LINEAR_API_KEY` GitHub Secret still needs to be set for the CI snapshot Action to run (pre-existing open item from 03-01/03-02)
- In-browser visual toggle check deferred but accepted by user; may be captured opportunistically during 03-05 smoke

---
*Phase: 03-linear-proxy*
*Completed: 2026-06-29*
