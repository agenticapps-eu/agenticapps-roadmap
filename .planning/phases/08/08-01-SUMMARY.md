---
phase: 08-deploy-gate-document
plan: 01
subsystem: api
tags: [cloudflare-pages-functions, cloudflare-kv, vitest, security-hardening]

# Dependency graph
requires:
  - phase: 07-write-path
    provides: "functions/api/backfill/dispatch.ts apply/dry-run write path with previewRunId recency-bound verification"
provides:
  - "BACKFILL_NONCE Cloudflare KV binding (wrangler.toml, detectable PLACEHOLDER id)"
  - "Consume-once nonce on the dispatch apply branch (best-effort sequential replay suppression, D-08-06)"
  - "Unit test proof: sequential previewRunId reuse -> 403 with exactly one dispatch POST"
affects: [08-02, 08-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pages Functions Env: one field per binding, flat interface (KVNamespace joins the existing string-token field)"
    - "Map-backed fake KVNamespace (get/put vi.fn) for Vitest unit tests, no Miniflare/wrangler dev"

key-files:
  created: []
  modified:
    - wrangler.toml
    - functions/api/backfill/dispatch.ts
    - functions/api/backfill/dispatch.test.ts

key-decisions:
  - "D-08-06 implemented as designed: check-then-set KV nonce (get -> 403 if present, else put with 900s TTL) inside the existing single try/catch, no new try/catch, no D1/Durable Object escalation"
  - "ctx() env param widened from Record<string,string> to Record<string,unknown> (not the kvOverrides-shorthand shape) so all ~30 pre-existing call sites needed zero changes"

patterns-established:
  - "createFakeKv() factory: Map-backed KVNamespace test double reused across dispatch.test.ts"

requirements-completed: [DEPLOY-01, DEPLOY-02]

# Metrics
duration: 25min
completed: 2026-07-16
---

# Phase 8 Plan 1: KV consume-once nonce for backfill apply Summary

**Closed CR-01's replay gap: a `BACKFILL_NONCE` Cloudflare KV binding plus a check-then-set nonce in `dispatch.ts`'s apply branch now rejects an immediately-reused `previewRunId` with 403 before a second GitHub dispatch fires, with the 15-minute recency bound retained as defense-in-depth.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-16T13:55:00Z (approx, first file read)
- **Completed:** 2026-07-16T14:05:00Z (approx, final commit)
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `wrangler.toml` now declares a single top-level `[[kv_namespaces]]` block binding `BACKFILL_NONCE` with a syntactically-detectable `PLACEHOLDER` id, so plan 08-03's pre-merge gate can reject the literal before opening the release PR.
- `dispatch.ts`'s apply branch performs a check-then-set nonce (`get` -> 403 "preview already applied" if a marker exists; otherwise `put` an opaque `"1"` marker with a 900s TTL) immediately after `isValidPreviewRun` passes and before the shared dispatch call, inside the existing single try/catch — no new error path.
- `dispatch.test.ts` proves the property with ONE shared fake-KV env across two sequential apply calls: reuse of the same `previewRunId` yields exactly one dispatch POST across both attempts (3 total fetches: two preview-run GETs + one dispatch POST); two distinct `previewRunId`s each dispatch independently; the KV value asserted is the opaque marker `"1"`, never a token.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire the KV binding and implement the consume-once nonce** - `5fb18bf` (feat)
2. **Task 2: Replay-suppression unit tests (ONE shared fake-KV env across both applies)** - `4b63c85` (test)

**Plan metadata:** (pending — final commit below)

_Note: Task 2 is `tdd="true"` in the plan, but the plan's own task ordering places implementation in Task 1 and tests in Task 2 (implementation already exists by the time tests are written) — this is the plan's explicit design, not a RED/GREEN/REFACTOR cycle. Tests were written against already-implemented behavior and passed on first run; no artificial failing-test step was fabricated._

## Files Created/Modified
- `wrangler.toml` — adds the `[[kv_namespaces]]` block (`BACKFILL_NONCE`, `id = "PLACEHOLDER"`) with an inline comment on the real-id handoff to plan 08-03
- `functions/api/backfill/dispatch.ts` — `Env.BACKFILL_NONCE: KVNamespace`; replaces the `TODO(phase-8)` comment with `NONCE_TTL_SECONDS = 900`; check-then-set nonce inserted in the apply branch
- `functions/api/backfill/dispatch.test.ts` — widened `ctx()`'s env type, added `createFakeKv()`, a new `"consume-once nonce (D-08-06)"` describe block (2 tests), and extended the no-store / token-leak describe blocks with the new 403-consumed case (2 tests)

## Decisions Made
- Followed the plan's PATTERNS.md recommendation (a): kept `ctx(body, env)`'s existing 2-arg shape with a full env object, widening only the type from `Record<string, string>` to `Record<string, unknown>` — zero changes to ~30 pre-existing call sites.
- Dispatch-POST assertions use URL filtering (`.includes("/dispatches")`) rather than raw total-fetch-count, per the plan's explicit instruction (a replay still performs the preview-run GET, so total fetches per pair of applies is 3, not 1).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required this plan. (The real KV namespace id is created and committed on the feature branch in plan 08-03's pre-merge human step, per the plan's own design — not required here.)

## Next Phase Readiness
- `dispatch.ts`'s apply path is now hardened per D-08-06 ahead of the write path first going live; plan 08-03's pre-merge gate can rely on the `PLACEHOLDER` literal in `wrangler.toml` to block a merge before the real KV namespace id is substituted.
- Full test suite (359 tests) and `tsc -b --noEmit` both green; no regressions in unrelated code.

---
*Phase: 08-deploy-gate-document*
*Completed: 2026-07-16*
