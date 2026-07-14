---
phase: 03-linear-proxy
plan: 03
subsystem: api
tags: [cloudflare-pages, linear, graphql, typescript, workers, tdd, proxy, security]

# Dependency graph
requires:
  - phase: 03-linear-proxy/03-01
    provides: map.ts (mapWorkspace/GqlResponse), query.ts (WORKSPACE_QUERY), transform.ts (buildSnapshot/assertNoLeak)
  - phase: 03-linear-proxy/03-02
    provides: "@cloudflare/workers-types, tsconfig.functions.json, vitest glob for functions/**"

provides:
  - "functions/api/linear/[[path]].ts — full proxy handler: OPERATIONS registry, env binding, rate limit, error table, cache header"
  - "functions/api/linear/[[path]].test.ts — 13 tests covering REQ-PROXY-1..4, 500/502/malformed-JSON paths, token-never-present"
  - "scripts/linear/__fixtures__/gql-clean.ts — full GqlResponse fixture (schema-valid)"
  - "scripts/linear/__fixtures__/gql-with-email.ts — full GqlResponse fixture with secret@example.com planted"

affects: [03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Named-operation OPERATIONS registry: client supplies op name only; raw GraphQL never reaches the Function"
    - "Single try/catch body-handling stretch: json()+errors+mapWorkspace+buildSnapshot; any throw → generic 502 (malformed JSON, assertNoLeak, schema parse all collapse to same path)"
    - "Per-isolate fixed-window rate limit (LIMIT=30/WINDOW_MS=60_000): module-scope counters; reset on isolate recycle"
    - "Full GqlResponse fixture contract: fixtures include top-level `data` key; stub returns directly — no double-wrap"
    - "globalThis cast for process detection: typeof (globalThis as Record)['process'] works under both node and workers-types tsconfigs"

key-files:
  created:
    - functions/api/linear/[[path]].test.ts
    - scripts/linear/__fixtures__/gql-clean.ts
    - scripts/linear/__fixtures__/gql-with-email.ts
  modified:
    - functions/api/linear/[[path]].ts
    - scripts/linear/transform.ts

key-decisions:
  - "Full GqlResponse fixture contract honored: gqlClean/gqlWithEmail both include top-level `data` key; stub .json() returns directly (no double-wrap); mapWorkspace reads json.data.initiatives/projects"
  - "Single try/catch around entire body-handling stretch ensures malformed-JSON, assertNoLeak, and schema-parse errors all produce a generic 502 with no upstream content"
  - "transform.ts process-guard ported to globalThis cast — typeof (globalThis as Record<string,unknown>)['process'] typechecks under both tsconfig.scripts.json (node) and tsconfig.functions.json (workers-types)"

# Metrics
duration: 15min
completed: 2026-06-29
---

# Phase 3 Plan 03: Linear Proxy Pages Function Summary

**Named-op proxy handler with OPERATIONS registry, env-binding auth, assertNoLeak pipeline, generic error table (404/429/500/502), Cache-Control header, and per-isolate rate limit — built strict RED→GREEN with 13 tests covering all security paths**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-29T07:00:00Z
- **Completed:** 2026-06-29T07:08:14Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 5

## Accomplishments

- Created `gql-clean.ts` and `gql-with-email.ts` — full `GqlResponse` envelope fixtures (top-level `data` key, nested `initiative: { id }` shape) that the test stubs return directly from `.json()` without any double-wrap
- Wrote 13 failing tests (RED: `a47769f`) covering REQ-PROXY-1..4 (404/200/502-email/token-never-present), 500 missing key, 502 upstream-non-ok, 502 GraphQL-errors, and 502 malformed-JSON
- Replaced the 03-01 bundling probe with the full proxy handler (GREEN: `3c0cf57`): OPERATIONS registry, ordered checks, single try/catch body-handling stretch, Cache-Control header, and per-isolate fixed-window rate limit (LIMIT=30/WINDOW_MS=60_000)
- All 27 tests pass; `pnpm typecheck` and `pnpm build` clean

## Task Commits

1. **Task 1 (RED): fixtures + failing handler tests** — `a47769f` (test)
2. **Task 2 (GREEN): full proxy handler + transform.ts fix** — `3c0cf57` (feat)

## TDD Gate Compliance

- RED gate: `test(03-03)` commit `a47769f` — 11/13 tests failing (confirmed in output before commit)
- GREEN gate: `feat(03-03)` commit `3c0cf57` — 13/13 passing

## Files Created/Modified

- `functions/api/linear/[[path]].ts` — full proxy handler replacing 03-01 probe; exports `onRequestGet: PagesFunction<Env>`; imports from map.ts (not client.ts); no `console.log`; no upstream body passthrough; all error bodies are generic strings
- `functions/api/linear/[[path]].test.ts` — 13 unit tests; `ctx()` helper builds minimal context; `vi.stubGlobal("fetch", ...)` intercepts; Response-like stubs with `ok`, `status`, `json`
- `scripts/linear/__fixtures__/gql-clean.ts` — `gqlClean: GqlResponse`; full envelope; schema-valid when transformed
- `scripts/linear/__fixtures__/gql-with-email.ts` — `gqlWithEmail: GqlResponse`; `secret@example.com` in project description; assertNoLeak throws on this
- `scripts/linear/transform.ts` — one targeted fix: `typeof process` guard ported to `globalThis` cast (Rule 1 fix — see Deviations)

## Decisions Made

- **Fixture contract as specified:** Both fixtures carry the top-level `data` key; stubs return them directly — the cross-AI review contradiction ("no double-wrap") was the authoritative reading
- **Single try/catch for the full body-handling stretch:** `json()` + `errors` check + `mapWorkspace` + `buildSnapshot` all run inside one try/catch so malformed JSON, GraphQL errors, assertNoLeak throws, and schema-parse failures all map to the same generic 502 body
- **Per-isolate rate limit stays module-scope:** LIMIT=30/WINDOW_MS=60_000 with no KV/DO — exactly as specified; defense-in-depth only, not the primary auth control

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] transform.ts `typeof process` guard failed typecheck under workers-types tsconfig**

- **Found during:** Task 2 (GREEN) — `pnpm typecheck` exited 2 after the handler was written
- **Issue:** `tsconfig.functions.json` uses `types: ["@cloudflare/workers-types"]` with no node types. When `tsc -b` processes the handler (in functions/) and follows the import chain into `scripts/linear/transform.ts`, it evaluates `transform.ts` under the Worker tsconfig context where `process` is not a declared global. The `typeof process !== "undefined"` guard triggered TS2591.
- **Fix:** Replaced `typeof process !== "undefined" ? process.env[...]` with a `globalThis` cast pattern: `typeof (globalThis as Record<string, unknown>)["process"] !== "undefined"` then access via a typed intermediate. This compiles under both the node and workers-types tsconfigs while retaining identical runtime behaviour (Worker isolate: undefined; Node: reads process.env).
- **Files modified:** `scripts/linear/transform.ts` (one targeted block)
- **Commit:** included in `3c0cf57`

## Known Stubs

None — the handler calls the real `buildSnapshot` pipeline; no hardcoded/empty data flows to callers.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-authenticated-endpoint | functions/api/linear/[[path]].ts | `/api/linear/*` is a new network endpoint holding the Linear token in Authorization header. This is the intended trust boundary for this plan; mitigations T-03-05..T-03-09 and T-03-18 are all implemented and test-verified. |

## Self-Check

All files verified to exist:

- `functions/api/linear/[[path]].ts` — FOUND
- `functions/api/linear/[[path]].test.ts` — FOUND
- `scripts/linear/__fixtures__/gql-clean.ts` — FOUND
- `scripts/linear/__fixtures__/gql-with-email.ts` — FOUND
- `scripts/linear/transform.ts` (modified) — FOUND

Commits verified in git log:

- `a47769f` — FOUND (test RED)
- `3c0cf57` — FOUND (feat GREEN)

## Self-Check: PASSED

---
*Phase: 03-linear-proxy*
*Completed: 2026-06-29*
