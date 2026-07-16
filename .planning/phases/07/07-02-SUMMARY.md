---
phase: 07-live-refresh-write-back
plan: 02
subsystem: api
tags: [cloudflare-pages-functions, github-actions, workflow-dispatch, backfill, security]

# Dependency graph
requires:
  - phase: 03-linear-data-layer
    provides: functions/api/linear/[[path]].ts Env/ordering/single-try-catch pattern to mirror
provides:
  - "POST /api/backfill/dispatch — allow-listed, preview-verified workflow_dispatch trigger"
  - "GET /api/backfill/status — identity-verified run/correlation status + typed diff readback"
affects: [07-03-client-backfill-wiring, 07-06-backfill-workflow, 07-05-phase-8-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GH_HEADERS(token) helper mirroring functions/api/linear/[[path]].ts's fetch-header discipline, with mandatory User-Agent"
    - "Server-side project allow-list + mode enum validated before any fetch"
    - "Two-phase approval enforced server-side: apply requires a verified successful dry-run previewRunId (workflow path/branch/event/status/conclusion/run-name)"
    - "Run-name parsing ([proj:][mode:][cid:]) as the only channel exposing project/mode/correlation from the GitHub runs API"
    - "run -> jobs -> job-logs three-fetch sequence for typed diff readback (no artifact/zip, no fflate dependency)"

key-files:
  created:
    - functions/api/backfill/dispatch.ts
    - functions/api/backfill/dispatch.test.ts
    - functions/api/backfill/status.ts
    - functions/api/backfill/status.test.ts
  modified: []

key-decisions:
  - "GH_BACKFILL_TOKEN is a distinct env binding name from LINEAR_API_KEY (never reused) to avoid a copy-paste Cloudflare dashboard mistake"
  - "Diff readback uses run->jobs->job-logs grep for a typed ___DIFF_JSON___ marker, not artifact download/unzip — zero new npm dependencies"
  - "Preview-run identity check treats any non-2xx GET or any single failed identity/outcome/run-name condition as an undifferentiated 403 (no per-field error detail leaked)"

patterns-established:
  - "Pattern 1 (RESEARCH): both backfill Functions mirror the Linear proxy's Env/ordering/single-try-catch/token-never-in-body shape exactly"

requirements-completed: [LIVE-02]

# Metrics
duration: ~15min
completed: 2026-07-16
---

# Phase 07 Plan 02: Backfill dispatch + status Pages Functions Summary

**Two Pages Functions (`dispatch.ts`, `status.ts`) implementing the server-side GitHub `workflow_dispatch` trigger and identity-verified run/diff readback for LIVE-02, both test-first against a mocked GitHub REST boundary with zero leaked tokens across every response.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-16T06:05Z (approx, per STATE.md session timestamp)
- **Completed:** 2026-07-16T06:10:47Z
- **Tasks:** 2
- **Files modified:** 4 (all new)

## Accomplishments
- `dispatch.ts`: allow-listed (`claude-workflow`/`cparx`/`fx-signal-agent`), mode-enum-validated (`dry-run`/`apply`) `workflow_dispatch` trigger; apply mode is rejected 403 unless a `previewRunId` resolves to a real, completed, successful dry-run of `backfill.yml` on `main` whose run-name encodes the same project — enforcing the two-phase approval server-side, not just in the UI (T-07-10).
- `status.ts`: resolves a run by `?run=<id>` or `?correlationId=` (list-and-match fallback, `{status:"queued"}` while unresolved), verifies workflow identity (`path`/`head_branch`/`event`) BEFORE reading any jobs/logs (T-07-11), and — only once `status === "completed"` — walks run→jobs→job-logs to extract and `JSON.parse` a TYPED `___DIFF_JSON___` counts payload.
- Both Functions collapse every GitHub failure mode (network throw, non-2xx, malformed body) to a single generic 502 via exactly one try/catch; every response (200/400/403/500/502) sets `Cache-Control: no-store` and is asserted, in every test, to never contain the token value or a `/ghp_|github_pat_/`-shaped string.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: dispatch.ts test (RED)** - `896b88b` (test)
2. **Task 1: dispatch.ts implementation (GREEN)** - `bf2f129` (feat)
3. **Task 2: status.ts test (RED)** - `33af3f3` (test)
4. **Task 2: status.ts implementation (GREEN)** - `e0c5f5d` (feat)

**Plan metadata:** (this commit, following SUMMARY)

## Files Created/Modified
- `functions/api/backfill/dispatch.ts` - POST handler: allow-list + mode validation, preview-run server-side verification, GitHub dispatch POST with `return_run_details`, 200/204 branching
- `functions/api/backfill/dispatch.test.ts` - 27 tests covering validation, preview-verification 403s (5 distinct failing checks), dry-run 200/204, apply 200, generic-502, no-store, token-absence
- `functions/api/backfill/status.ts` - GET handler: run/correlationId resolve, identity verification, completed-only jobs/logs walk, typed diff extraction
- `functions/api/backfill/status.test.ts` - 25 tests covering in-progress, completed+marker, completed-no-marker, identity-failure 403s (3 distinct checks), correlationId resolve/not-found, invalid input 400, generic-502, no-store, token-absence

## Decisions Made
- Followed the plan's interfaces section exactly: `GH_HEADERS` helper with mandatory `User-Agent` (Pitfall 3), run-name contract (`[proj:]`/`[mode:]`/`[cid:]`) as the sole project/mode/correlation channel, job-logs-grep diff readback (no `fflate`, no artifact/zip path) per Simplicity First.
- No deviations from the locked interface contracts were needed — the analog (`functions/api/linear/[[path]].ts` + its test file) provided a complete, directly-portable shape for Env/ordering/try-catch/token-assertion discipline.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required by this plan. `GH_BACKFILL_TOKEN` binding value and `GH_CROSS_REPO_TOKEN` GitHub secret remain Phase-8 scope (mirrors `LINEAR_API_KEY`'s existing split), unchanged from this plan.

## Next Phase Readiness
- The `{ runId }` / `{ runId: null, correlationId }` dispatch contract and `{ status, conclusion, diff? }` status contract are ready for 07-03 (client-side `useBackfill` hook wiring) to consume directly.
- `.github/workflows/backfill.yml` (07-06) must emit the run-name format `backfill [proj:<project>] [mode:<mode>] [cid:<correlationId>]` and the `___DIFF_JSON___<payload>___END_DIFF___` stdout marker exactly as these Functions expect — no other coordination needed.
- Live end-to-end dispatch/apply against a real GitHub boundary remains a Phase-8 HUMAN-UAT item (R-1), per RESEARCH; this plan's automated coverage is against a mocked GitHub REST boundary only.

---
*Phase: 07-live-refresh-write-back*
*Completed: 2026-07-16*
