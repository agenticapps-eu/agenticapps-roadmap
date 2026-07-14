---
phase: 03-linear-proxy
plan: 01
subsystem: api
tags: [cloudflare-pages, linear, graphql, typescript, workers, wrangler]

# Dependency graph
requires:
  - phase: 02-linear-data-layer
    provides: fetchWorkspace, buildSnapshot, assertNoLeak, transform.test.ts, RawWorkspace shape

provides:
  - scripts/linear/query.ts — single-source WORKSPACE_QUERY constant importable by Node and Worker
  - scripts/linear/map.ts — process-free GqlResponse + mapWorkspace; Worker-safe (no process, no fetch)
  - scripts/linear/client.ts — refactored Node-only fetch wrapper; re-exports mapWorkspace/GqlResponse for callers
  - scripts/linear/transform.ts — assertNoLeak with typeof-process guard (Worker-safe)
  - functions/api/linear/[[path]].ts — trivial probe handler; proven cross-dir .ts import works under wrangler
  - Proven bundling strategy: cross-directory relative .ts imports from functions/ into scripts/linear/ bundle correctly under wrangler esbuild (no src/lib/linear relocation needed)

affects: [03-02, 03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Process-free shared module (map.ts): no process/fetch references; safe under both Node tsconfig and future Worker-only tsconfig"
    - "typeof-process guard for assertNoLeak: identical Node behavior; Worker isolate skips liveKey branch"
    - "Single-source query constant (query.ts): both Node sync and Worker handler import one copy — no mapping divergence"
    - "Bundling probe pattern: trivial handler before full handler, body derived from import value (not literal) to prove eval not just type-resolution"

key-files:
  created:
    - scripts/linear/query.ts
    - scripts/linear/map.ts
    - functions/api/linear/[[path]].ts
  modified:
    - scripts/linear/client.ts
    - scripts/linear/transform.ts

key-decisions:
  - "Cross-dir .ts import strategy CONFIRMED: functions/ → scripts/linear/ bundles correctly under wrangler@4 esbuild; src/lib/linear relocation NOT needed (Open-Q1 resolved)"
  - "mapWorkspace + GqlResponse live in process-free map.ts, NOT client.ts; Worker imports map.ts directly to avoid pulling in process.env"
  - "client.ts re-exports mapWorkspace/GqlResponse for backward compatibility; Node callers unaffected"
  - "fetchWorkspaceWith NOT built (YAGNI — two callers with different error semantics; mapWorkspace is the right shared unit)"

patterns-established:
  - "Pattern: process-free shared module — any code shared between Node and Worker must have zero process/fetch references"
  - "Pattern: probe-before-implement — verify cross-runtime import bundling with a trivial handler before building the real one"

requirements-completed: [REQ-SHARE, REQ-GUARD, REQ-TYPE]

# Metrics
duration: 15min
completed: 2026-06-28
---

# Phase 3 Plan 01: Shared Runtime-Agnostic Query/Map + Bundling Probe Summary

**WORKSPACE_QUERY and mapWorkspace extracted to process-free modules (query.ts, map.ts) shareable by Node and Worker; assertNoLeak guarded for Worker isolates; cross-directory .ts import confirmed working under wrangler esbuild**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-28T13:58:00Z
- **Completed:** 2026-06-28T14:02:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Extracted `WORKSPACE_QUERY` to `scripts/linear/query.ts` and pure `mapWorkspace` + all `Gql*` types to process-free `scripts/linear/map.ts` — both Node sync and Worker can now import one copy with no `process` or `fetch` transitive pull
- Guarded `assertNoLeak`'s `liveKey` read with `typeof process !== "undefined"` — Worker isolate skips the live-key branch (no `ReferenceError`); Node behavior byte-for-byte unchanged (14/14 tests green before and after)
- Proved Open-Q1 (cross-directory `.ts` import under Pages build): `wrangler pages dev dist` served `GET /api/linear/snapshot` → HTTP 200 body `605` (equals `WORKSPACE_QUERY.length`); the `src/lib/linear` relocation fallback is NOT needed

## Task Commits

1. **Task 1: Extract WORKSPACE_QUERY to query.ts and process-free mapWorkspace + Gql types to map.ts** — `30c105e` (feat)
2. **Task 2: Guard the assertNoLeak liveKey read for runtimes without process** — `87fea31` (fix)
3. **Task 3: Bundling probe — trivial handler importing WORKSPACE_QUERY under wrangler pages dev** — `0653695` (feat)

## Files Created/Modified

- `scripts/linear/query.ts` — new; exports `WORKSPACE_QUERY` verbatim (moved from client.ts)
- `scripts/linear/map.ts` — new; exports `GqlResponse` interface + `mapWorkspace` function; zero `process`/`fetch` references; imports `RawWorkspace` as type from transform.ts
- `scripts/linear/client.ts` — refactored; imports from query.ts and map.ts; re-exports `mapWorkspace`/`GqlResponse` for Node callers; `fetchWorkspace` returns `mapWorkspace(json)`; `process.env["LINEAR_API_KEY"]` stays in client.ts only
- `scripts/linear/transform.ts` — one-line change: `typeof process !== "undefined"` guard on liveKey read
- `functions/api/linear/[[path]].ts` — new trivial probe; exports `onRequestGet` returning `String(WORKSPACE_QUERY.length)`; fully replaced in 03-03

## Decisions Made

- **Cross-dir import strategy: CONFIRMED direct relative path.** `functions/api/linear/[[path]].ts` imports `"../../../scripts/linear/query.ts"` and wrangler@4 bundles it correctly. The `files_modified_conditional` fallback (relocation to `src/lib/linear/`) was NOT triggered. Plan 03-03 must import from `scripts/linear/` (not `src/lib/linear/`).
- **`fetchWorkspaceWith` not built.** YAGNI: Node and Worker have different error-handling semantics; `mapWorkspace` is the correct shared unit. Recorded per research Pattern 2 note.
- **`map.ts` is the Worker's import target for mapping.** The Worker (03-03) must import `mapWorkspace` and `GqlResponse` from `map.ts`, never from `client.ts` — `client.ts` owns `process.env` and must never be transitively imported by the Worker.

## Deviations from Plan

None — plan executed exactly as written. All three acceptance criteria sets passed on first attempt. The bundling probe succeeded without needing the conditional relocation fallback.

## Issues Encountered

None. The initial wrangler startup test timed out because `npx wrangler@4` downloaded the package on first invocation; a second run with polling-based readiness detection succeeded cleanly.

## Bundling Strategy Decision (load-bearing for 03-03)

**Cross-directory relative `.ts` import WORKS.** Plan 03-03 must use:

```typescript
import { WORKSPACE_QUERY } from "../../../scripts/linear/query.ts";
import { mapWorkspace, type GqlResponse } from "../../../scripts/linear/map.ts";
import { buildSnapshot } from "../../../scripts/linear/transform.ts";
```

The `src/lib/linear/` relocation was NOT triggered. The `files_modified_conditional` list in the plan frontmatter remains untouched.

## User Setup Required

None — no external service configuration required in this plan.

## Next Phase Readiness

- **03-02** (Worker types legitimacy gate): can proceed. The `functions/` directory exists with a real `.ts` handler; `@cloudflare/workers-types` devDep install target is confirmed.
- **03-03** (Linear proxy Pages Function, TDD): import paths are proven and recorded above. Worker must import from `map.ts` (not `client.ts`). The probe handler at `functions/api/linear/[[path]].ts` will be fully replaced.
- All tests green (14/14), typecheck clean, build clean.

---
*Phase: 03-linear-proxy*
*Completed: 2026-06-28*
