---
phase: 07-live-refresh-write-back
plan: 03
subsystem: ui
tags: [react-hooks, fetch, polling, optimistic-ui, backfill, vitest]

# Dependency graph
requires:
  - phase: 07-live-refresh-write-back
    provides: "07-02's finalized { runId } / { runId: null, correlationId } dispatch contract and { status, conclusion, diff? } status contract"
provides:
  - "src/lib/backfill/backfill.ts — pure dispatchBackfill/pollBackfillStatus/applyBackfillOutcome core, node-unit-tested against a mocked /api/backfill/* boundary"
  - "src/lib/backfill/useBackfill.ts — the explicit useBackfill(setBackfillState) contract for the 07-04 UI wiring plan"
affects: [07-04-ui-wiring, 07-05-phase-8-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-try/catch-per-network-stretch discipline (mirrors src/lib/roadmap/loader.ts) applied to both dispatchBackfill and each pollBackfillStatus tick — no path ever throws past the caller"
    - "Transient-observation-failure vs terminal-job-failure distinction: 502/throw/malformed status responses retry with backoff (retry budget resets on any successful non-terminal observation); only a completed non-success/non-cancelled conclusion is a terminal failure"
    - "Pure-core + thin-hook split: all branching/retry/conclusion logic lives in backfill.ts; useBackfill.ts is useState/useRef/useCallback/useEffect glue only"

key-files:
  created:
    - src/lib/backfill/backfill.ts
    - src/lib/backfill/backfill.test.ts
    - src/lib/backfill/useBackfill.ts
  modified: []

key-decisions:
  - "dispatchBackfill/pollBackfillStatus/applyBackfillOutcome return discriminated-union results ({ ok: true; ... } | { ok: false; kind: \"failure\" | \"cancelled\" | \"unknown\"; message }) — no `any`, never throw"
  - "Retry budget for pollBackfillStatus resets on any successful non-terminal observation (queued/in_progress) — only CONSECUTIVE observation failures count toward maxRetries, so a single flaky poll mid-run doesn't erode the budget for an otherwise-healthy long-running job"
  - "'cancelled' is a distinct terminal kind (not folded into 'failure') so a future caller can render different copy, while still reverting the optimistic override exactly like 'failure' per the plan's truths"
  - "useBackfill resolves the projectId/projectKey key-space ambiguity (07-REVIEWS finding MEDIUM) by keying its own hook-local per-project state (diff/status/error/previewRunId) by whichever string is passed at each call site: startPreview keys by projectKey (the only identifier it receives); applyBackfill reads the previewRunId back out under that same projectKey (it receives both, so no lookup ambiguity there) and re-keys status/diff/error under projectId afterward, matching diffFor/statusFor/errorFor/clearError's projectId-keyed contract and the externally-owned Map<projectId,...> optimistic state. Documented in a header comment in useBackfill.ts for 07-04 to consume correctly (call diffFor/statusFor with projectKey right after startPreview, and with projectId after applyBackfill)."
  - "A correlation-only dispatch handle (204 fallback, runId: null) cannot itself authorize a later apply — previewRunId is only ever stored when the server returned a concrete numeric runId, since dispatch.ts's preview-verification step requires a real run id to re-fetch and validate"

patterns-established:
  - "Pattern (RESEARCH): pure orchestration core node-unit-tested via vi.stubGlobal(\"fetch\") + vi.useFakeTimers()/vi.advanceTimersByTimeAsync(), thin React hook left to typecheck + a dedicated cleanup test against the pure core (not a hook-rendering library)"

requirements-completed: [LIVE-02]

# Metrics
duration: ~20min
completed: 2026-07-16
---

# Phase 07 Plan 03: Backfill client core (dispatch/poll/reducer + useBackfill hook) Summary

**Pure, React-free `backfill.ts` (dispatch + poll + optimistic-flip reducer) proven by 27 node unit tests against a mocked `/api/backfill/*` boundary — full 204-correlation, transient-retry, every-terminal-conclusion, and abort-cleanup matrix — plus a thin `useBackfill` hook exposing the explicit review-hardened contract for 07-04.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-16T08:31Z (approx)
- **Completed:** 2026-07-16T08:36Z
- **Tasks:** 2
- **Files modified:** 3 (all new)

## Accomplishments
- `backfill.ts`: `dispatchBackfill` POSTs `/api/backfill/dispatch` and resolves the `{ runId }` / `{ runId: null, correlationId }` union or a typed `{ ok: false; kind: "failure" }` — never throws.
- `pollBackfillStatus` polls `?run=` or `?correlationId=` depending on the handle; maps `conclusion === "success"` → success, `"cancelled"` → a distinct `cancelled` kind, and every other completed conclusion (`failure`, `timed_out`, `startup_failure`, `stale`, `skipped`, `action_required`, `neutral`, ...) → `failure`; retries transient 502/network-throw/malformed-body observation failures with backoff (retry budget resets on any successful non-terminal read) before declaring `unknown`; also resolves `unknown` on `maxTicks` exhaustion or an aborted `AbortSignal` — never throws.
- `applyBackfillOutcome` is a pure reducer returning a NEW `Map`: `start` → optimistic in-sync + pending; `success` → clears pending, stays in-sync; `failure`/`cancelled` → clears pending AND reverts the override to `undefined`; `unknown` → clears pending but LEAVES the override at its current optimistic value (no revert, no error — prevents a duplicate dispatch over a possibly-still-live run).
- `useBackfill(setBackfillState)` implements the exact published contract (`startPreview`, `applyBackfill`, `diffFor`, `statusFor`, `errorFor`, `clearError`) as thin glue: local `useState`/`useRef`/`useCallback`/`useEffect` only, no new state library, an `AbortController` per in-flight poll aborted both on re-invocation and on unmount.

## Task Commits

Each task was committed atomically (TDD RED → GREEN for Task 1; Task 2 folds in the plan's requested cleanup test, which was already covered by Task 1's abort-signal test against the pure core):

1. **Task 1: backfill.test.ts (RED)** - `c06e3df` (test)
2. **Task 1: backfill.ts implementation (GREEN)** - `2e08b00` (feat)
3. **Task 2: useBackfill.ts hook** - `7594424` (feat)

**Plan metadata:** (this commit, following SUMMARY)

## Files Created/Modified
- `src/lib/backfill/backfill.ts` - Pure dispatch/poll/reducer core: `dispatchBackfill`, `pollBackfillStatus`, `applyBackfillOutcome`, plus the `DispatchResult`/`PollResult`/`BackfillStateMap`/`DiffCounts` types
- `src/lib/backfill/backfill.test.ts` - 27 tests: dispatch success/204-fallback/network-failure/non-ok/malformed; poll happy-path/204→correlation/transient-retry-recovery/malformed-then-unknown/every terminal conclusion/maxTicks-exhaustion/never-throws/abort-cleanup; reducer start/success/failure/cancelled/unknown/no-in-place-mutation
- `src/lib/backfill/useBackfill.ts` - `useBackfill(setBackfillState)` hook exposing `startPreview`/`applyBackfill`/`diffFor`/`statusFor`/`errorFor`/`clearError`

## Decisions Made
- Followed the plan's interfaces block precisely for the dispatch/poll/reducer shapes; the projectId/projectKey key-space ambiguity flagged in 07-REVIEWS as MEDIUM ("hook/UI interface underspecified") was resolved concretely inside `useBackfill.ts` (see frontmatter `key-decisions` — startPreview keys by projectKey, applyBackfill re-keys by projectId afterward) rather than left ad hoc for 07-04, since the interface as literally specified (startPreview receiving only projectKey, while diffFor/statusFor/errorFor/clearError receive only projectId) has no other internally consistent resolution without inventing an extra parameter the plan doesn't provide. Documented in a header comment in the file itself so 07-04 implements against the same understanding.
- The Task 2 "ONE cleanup test... exercised on the pure `pollBackfillStatus`" requirement was already satisfied by an abort-cleanup test written during Task 1 (since it operates on the pure core's `signal` option, not the hook itself, and the full test matrix was written together test-first); no duplicate test was added.
- previewRunId is only stored (and only ever passed to the later apply dispatch) when the preview resolved to a concrete numeric `runId` — a correlation-only 204 preview handle has no numeric identity for the server's preview-verification step to re-fetch, so applying without a resolved numeric preview run id simply omits `previewRunId` (dispatch.ts will then correctly 400 the apply, which the hook surfaces as a normal dispatch failure).

## Deviations from Plan

None - plan executed exactly as written (including the interfaces block's explicit contract), with the projectId/projectKey key-space resolution above documented as an implementation clarification rather than a deviation, since the plan's own MEDIUM finding anticipated this needed to be pinned down during implementation.

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed the mandatory RED → GREEN sequence:
- RED: `c06e3df` `test(07-03): add failing test for backfill dispatch/poll/reducer core` — confirmed failing (module did not exist) before any implementation.
- GREEN: `2e08b00` `feat(07-03): implement backfill.ts pure dispatch/poll/reducer core` — all 27 tests pass immediately after.
- No REFACTOR commit was needed; the implementation matched the tests on the first pass with no cleanup pass required.

## Issues Encountered
- `tsc -b --noEmit` initially flagged a type-conversion error on a test's `fetchMock.mock.calls[0]` destructure (inferred `[]` tuple vs. `[string, RequestInit]`); fixed by casting through `unknown` first rather than over-typing the mock's parameter list (which would have then failed a separate `no-unused-vars` ESLint rule on unused mock params). Both `npx tsc -b --noEmit` and `npx eslint src/lib/backfill` are clean.

## User Setup Required

None - no external service configuration required by this plan.

## Next Phase Readiness
- `useBackfill` exports the exact `{ startPreview, applyBackfill, diffFor, statusFor, errorFor, clearError }` contract, ready for 07-04 to wire into `OverviewPage.tsx`'s `Map<projectId, { pendingBackfill; planAheadOverride }>` optimistic state and `ProjectDrillDownDialog.tsx`'s Preview/Apply controls.
- 07-04 should read this summary's `key-decisions` entry on the projectId/projectKey key-space before wiring the dialog, and call `diffFor`/`statusFor`/`errorFor` with `projectKey` for pre-apply preview display and with `projectId` post-apply, per the documented header comment in `useBackfill.ts`.
- Live end-to-end dispatch/poll against a real GitHub boundary remains Phase-8 UAT scope (07-05); this plan's automated coverage is against a mocked `/api/backfill/*` boundary only, per the locked plan scope.

---
*Phase: 07-live-refresh-write-back*
*Completed: 2026-07-16*

## Self-Check: PASSED

All created files verified present on disk; all task commit hashes verified in `git log --oneline --all`.
