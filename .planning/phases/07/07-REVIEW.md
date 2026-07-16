---
phase: 07
reviewed: 2026-07-16T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - .github/workflows/backfill.yml
  - .github/workflows/snapshot.yml
  - functions/api/backfill/dispatch.ts
  - functions/api/backfill/dispatch.test.ts
  - functions/api/backfill/status.ts
  - functions/api/backfill/status.test.ts
  - src/components/AppHeader.tsx
  - src/components/overview/ProjectDrillDownDialog.tsx
  - src/components/overview/SyncBadge.tsx
  - src/lib/backfill/backfill.ts
  - src/lib/backfill/backfill.test.ts
  - src/lib/backfill/projects.ts
  - src/lib/backfill/useBackfill.ts
  - src/lib/roadmap/freshness.ts
  - src/lib/roadmap/freshness.test.ts
  - src/lib/roadmap/loader.ts
  - src/lib/roadmap/loader.test.ts
  - src/pages/OverviewPage.tsx
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-07-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

This phase adds a Linear→GitHub write path: `dispatch.ts`/`status.ts` Pages Functions
trigger and read back a `workflow_dispatch` run of `backfill.yml`, with client
orchestration (`backfill.ts`/`useBackfill.ts`) and optimistic UI
(`ProjectDrillDownDialog.tsx`/`SyncBadge.tsx`). I cross-checked the implementation
against `.planning/phases/07/07-REVIEWS.md` (the pre-implementation cross-AI plan
review) and `scripts/sync-gsd-linear/diff.ts` (the CLI's `renderDiff`, to confirm the
job-log marker regex is sound — it is: the `+ N milestones, + M issues, + L labels`
line is unconditional and never pluralizes, so the parse is reliable).

Token handling is solid (header-only, single try/catch → generic 5xx, `Cache-Control:
no-store` on every response, verified by an explicit "token never in body" test suite
across all status codes). The allow-list, mode-enum, and env-check ordering all
reject before any upstream fetch, as intended. The 204/correlationId fallback is fully
implemented end-to-end (unlike the plan-stage version, which the pre-implementation
review flagged as "half-built") — `status.ts` does correctly resolve a `correlationId`
via the runs list.

The most significant unresolved gap is that the server-side "preview-before-apply"
check verifies a previous dry-run's *authenticity* but not its *recency or
one-time use* — see CR-01. Several smaller robustness/UX gaps remain from the
pre-implementation review's suggestions that weren't carried into the final code
(runtime validation of GitHub responses, defense-in-depth rate limiting, a loading
indicator for Preview) — see the Warnings below.

## Critical Issues

### CR-01: `previewRunId` has no recency check or replay/consumption protection

**File:** `functions/api/backfill/dispatch.ts:71-81, 112, 124-136`
**Issue:** `isValidPreviewRun` (and the apply-path check that calls it) verifies that
`previewRunId` refers to a real, completed, successful dry-run of `backfill.yml` on
`main` for the same `project` — but it never checks *when* that run happened, and
nothing marks a `previewRunId` as "consumed" once it authorizes an apply. This means:

1. A `previewRunId` from an arbitrarily old successful dry-run (hours, days, weeks
   ago) will still pass verification today. The diff a user reviewed at preview time
   may no longer reflect the current state of the sibling repo's `.planning/` or the
   Linear workspace, yet the server will happily authorize an `apply` "as if" that
   stale preview were current.
2. The same `previewRunId` can be reused to authorize multiple, separate `apply`
   dispatches (no nonce/one-time-use marking), so one approved preview can back an
   unbounded number of later applies.

CLAUDE.md states the GSD sync approval gate is "mandatory" and requires "a printed
diff and an explicit yes for that specific project" — the current check proves *a*
prior successful preview existed for the project, not that *this* apply corresponds
to a recent, single-use approval. This was flagged in the pre-implementation review
(`07-REVIEWS.md:129`, "Require `previewRunId` or a short-lived approval capability
for apply") but the "short-lived" part was never implemented.

**Fix:**
```ts
// In isValidPreviewRun, add a recency bound (GitHub run objects include
// created_at/run_started_at); reject anything older than e.g. 15 minutes:
function isValidPreviewRun(run: PreviewRun, project: string): boolean {
  const startedAt = new Date(run.run_started_at ?? run.created_at).getTime();
  const ageMs = Date.now() - startedAt;
  const MAX_PREVIEW_AGE_MS = 15 * 60 * 1000;
  return (
    run.path === ".github/workflows/backfill.yml" &&
    run.head_branch === "main" &&
    run.event === "workflow_dispatch" &&
    run.status === "completed" &&
    run.conclusion === "success" &&
    run.name.includes(`[proj:${project}]`) &&
    run.name.includes("[mode:dry-run]") &&
    ageMs <= MAX_PREVIEW_AGE_MS
  );
}
// For one-time-use, track consumed previewRunIds (e.g. a KV/D1 binding, or embed
// a server-issued nonce in the dispatch and require it back) so a second apply
// against the same previewRunId is rejected.
```

## Warnings

### WR-01: Backfill write-path routes have no rate limiting, unlike the sibling read-only route

**File:** `functions/api/backfill/dispatch.ts`, `functions/api/backfill/status.ts`
**Issue:** `functions/api/linear/[[path]].ts` (the existing, read-only Linear proxy)
explicitly documents "Cloudflare Access is the primary auth control" and additionally
implements an in-memory fixed-window rate limiter (30 req/min) as defense-in-depth.
The new `dispatch.ts`/`status.ts` have neither an explicit statement of the auth
boundary they rely on nor any rate limiting at all — despite `dispatch.ts` being able
to push commits to `main` and write to a production Linear workspace, a materially
higher blast radius than the read-only proxy. The plan accepted this
(`07-02-PLAN.md:202`, "New routes inherit the existing `/api/*` Cloudflare Access
policy") — that's a reasonable call for authn, but it doesn't address the missing
defense-in-depth rate limit if Access is ever misconfigured for this specific path.
**Fix:** Add the same `isRateLimited()` pattern used in `functions/api/linear/[[path]].ts`
to both `dispatch.ts` and `status.ts` (tighter limits are appropriate for `dispatch.ts`
given it triggers real writes), and add a comment stating the Access-gating assumption
explicitly, matching the sibling file's convention.

### WR-02: GitHub API responses are trusted via blind type assertions with no runtime validation

**File:** `functions/api/backfill/dispatch.ts:132, 156`; `functions/api/backfill/status.ts:118, 133, 149`
**Issue:** Every GitHub API response is cast with `as PreviewRun` / `as Run` / `as {
workflow_run_id: number }` / `as { workflow_runs: ... }` / `as { jobs: ... }` with no
runtime shape validation. This is inconsistent with this codebase's own established
discipline elsewhere (`src/lib/roadmap/loader.ts` validates every external payload via
`RoadmapJsonSchema.safeParse` before trusting it). Today the failure mode happens to
be safe (missing fields become `undefined`, and every identity comparison then
evaluates to `false`, failing closed) — but that's incidental, not by design, and a
future refactor of these functions could easily introduce an unsafe access. The
pre-implementation review explicitly suggested "Validate GitHub responses at runtime
rather than relying on TypeScript casts" (`07-REVIEWS.md:130`); it wasn't carried into
the implementation.
**Fix:** Add a small zod schema (or manual type guard, matching `isDispatchResponse`/
`isStatusResponse` already used client-side in `backfill.ts`) for `PreviewRun`/`Run`/
the jobs and runs-list payloads, and treat a failed parse as the generic 502 path.

### WR-03: Preview has no loading indicator and no button-disable — `statusFor` is exported but never used

**File:** `src/components/overview/ProjectDrillDownDialog.tsx:186-193`; `src/lib/backfill/useBackfill.ts:58, 196-199, 215`
**Issue:** `useBackfill` exports `statusFor`, but `ProjectDrillDownDialog` only
destructures `{ startPreview, applyBackfill, diffFor, errorFor, clearError }` — it is
never called anywhere in the codebase (confirmed via repo-wide search). Consequently:
- The "Preview" button has no `disabled` attribute and no in-flight visual state at
  all (unlike "Apply", which is correctly `disabled={!previewDiff || entry?.pendingBackfill === true}`).
- A dry-run preview can take real minutes (GitHub Actions queue + run time) with zero
  feedback to the user that anything is happening.
- Because `startPreview` calls `abortAndClear(backfillKey)` and re-dispatches on every
  invocation, a user who — reasonably, given no feedback — clicks "Preview" again
  while waiting triggers a brand-new `POST /api/backfill/dispatch` and a brand-new
  real GitHub Actions run each time (the earlier run is not cancelled, only the local
  poll is aborted). The pre-implementation review rated the general "no
  dispatch de-duplication" risk LOW (`07-REVIEWS.md:205`) on the assumption of some
  UI awareness; the complete absence of any loading state here makes that outcome
  materially more likely in practice.
**Fix:** Render `statusFor(backfillKey)` in the UI (e.g. `disabled={status === "previewing"}` on the Preview button, plus a "Previewing…" label), matching the existing "Apply"/`pendingBackfill` treatment.

### WR-04: Run identity verification is a plain substring match on a value partly derived from `workflow_dispatch` inputs

**File:** `functions/api/backfill/dispatch.ts:71-81`; `functions/api/backfill/status.ts:52-58`; `.github/workflows/backfill.yml:3`
**Issue:** `isValidPreviewRun`/`isIdentityValid` rely on `run.name.includes(`[proj:${project}]`)` and `.includes("[mode:dry-run]")`. The run name itself is built by GitHub Actions' `run-name: backfill [proj:${{ inputs.project }}] [mode:${{ inputs.mode }}] [cid:${{ inputs.correlation_id }}]`, i.e. from the *raw* `workflow_dispatch` inputs, not from a value GitHub structurally separates. `project` in that expression is typed as an unrestricted `string` input at the workflow level (only `dispatch.ts`'s own allow-list constrains it on the path that matters — the public app). Anyone with `actions:write` on this repo who dispatches `backfill.yml` directly (bypassing `dispatch.ts` entirely, e.g. via the GitHub UI/API) could set `project` to a string containing literal `]`/`[` sequences designed to forge a `[mode:dry-run]` or `[proj:X]` substring inside a run whose *actual* mode/project differs, and that forged run could later be presented as a valid `previewRunId` to `dispatch.ts`. This requires repo-collaborator-level access already, so it's not exploitable from the public web app, but it is a weaker identity contract than it looks — `.includes()` on unstructured text is not a substitute for genuinely structured, unforgeable data.
**Fix:** Given `project` is already server-validated by `dispatch.ts`'s own allow-list before it's ever sent to GitHub, this is low-risk in the intended flow. As defense-in-depth, consider anchoring the substring checks (`` name === `backfill [proj:${project}] [mode:dry-run] [cid:${cid}]` `` via a stricter regex with escaped delimiters) rather than free-form `.includes()`, or re-validate `project` against `ALLOWED_PROJECTS` again when parsing the preview run's name.

### WR-05: `return_run_details: true` is an unverified GitHub API assumption; the 200/`runId` path may be permanently dead

**File:** `functions/api/backfill/dispatch.ts:150-158`
**Issue:** The dispatch body includes `return_run_details: true` expecting GitHub's
`workflow_dispatch` create-event endpoint to optionally return `200 { workflow_run_id
}` instead of the documented `204 No Content`. This is called out in
`07-RESEARCH.md` (assumption A3) as unconfirmed for this repo's plan/API version and
explicitly deferred to a Phase-8 live smoke test. The code and tests here are
internally consistent and the 204/correlationId fallback is fully implemented (this
part is good), but every test exercising the "200 → `{ runId }`" branch
(`dispatch.test.ts`'s "dry-run dispatch success" / "apply dispatch success" cases) is
validating a hypothetical contract, not proven GitHub behavior. If the parameter is
in fact ignored by the real API, that branch (lines 155-158) will never execute in
production and the app will always take the correlationId path — functionally fine
given the fallback works, but worth flagging so it isn't mistaken for a proven,
load-bearing code path before the planned Phase-8 verification happens.
**Fix:** No code change required now; ensure the Phase-8 HUMAN-UAT checklist (already
referenced in `07-05`) includes an explicit assertion of which status code the real
dispatch call returns, and remove/simplify the 200 branch if it's confirmed dead.

### WR-06: `status.ts` assumes the workflow run has exactly one job

**File:** `functions/api/backfill/status.ts:149-153`
**Issue:** `const job = jobs.jobs[0];` unconditionally takes the first job in the run,
with no name/id matching. This is correct today because `backfill.yml` defines a
single job (`backfill`), but it's a silent, untested assumption: if the workflow is
later extended with an additional job that runs before `backfill` (e.g., a lint or
setup job), `jobs.jobs[0]` would silently read the wrong job's logs and `extractDiff`
would (harmlessly, per WR above) just fail to find the marker — but it also wouldn't
error, so a future workflow change here would degrade silently rather than break
loudly.
**Fix:** Match by job name (`jobs.jobs.find(j => j.name === "backfill")`) instead of
positional indexing.

## Info

### IN-01: `statusFor` is dead code from the consumer's perspective

**File:** `src/lib/backfill/useBackfill.ts:58, 196-199`
**Issue:** Exported and implemented, but no component in the repo calls it (see
WR-03). Either wire it into the UI or drop it from the public hook contract to avoid
carrying unused surface area.
**Fix:** Resolve together with WR-03 (use it in the Preview button's `disabled`/label
state) or remove the export if intentionally deferred.

### IN-02: Backfill control is not gated to snapshot-vs-live mode, per an unresolved pre-implementation suggestion

**File:** `src/components/overview/ProjectDrillDownDialog.tsx:179-226`
**Issue:** The pre-implementation review noted (`07-REVIEWS.md:197`) that
`buildSnapshot` (the live-mode data transform) never sets `planAhead`, so the
optimistic `planAheadOverride` flip is a no-op visual in live mode, and suggested
either gating the Backfill control to snapshot mode or documenting this explicitly.
Neither was done — the control renders identically regardless of `loaderData.live`.
In practice this is harmless today (the badge simply never shows in live mode, with
or without a backfill in flight), but the invariant that makes it harmless
(`buildSnapshot` never setting `planAhead`) lives in a different file with no test or
comment tying the two together — a future change to `buildSnapshot` could silently
make the live-mode badge state inconsistent with no coverage to catch it.
**Fix:** Add a one-line comment in `ProjectDrillDownDialog.tsx` (or `SyncBadge.tsx`)
noting the dependency on `buildSnapshot` never populating `planAhead`, so a future
change to that function trips a "check this" flag for a reviewer.

### IN-03: `snapshot.yml`'s commit step has no `git pull --rebase`, unlike `backfill.yml`'s equivalent step

**File:** `.github/workflows/snapshot.yml:39-46` vs `.github/workflows/backfill.yml:139-149`
**Issue:** Both workflows share the `roadmap-git-writer` concurrency group
(`cancel-in-progress: false`), which does serialize them against each other, so this
isn't currently a race in practice. But `backfill.yml`'s apply-commit step defensively
does `git pull --rebase origin main` before `git push`, while `snapshot.yml`'s
does not. If the concurrency-group guarantee is ever loosened (e.g., a workflow rename
that changes the effective group scope, or a manual `workflow_dispatch` run with a
different `ref`), `snapshot.yml`'s push would be the one left exposed to a rejected
non-fast-forward push.
**Fix:** Add the same `git pull --rebase origin main` line to `snapshot.yml`'s commit
step for consistency and defense-in-depth.

---

_Reviewed: 2026-07-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
