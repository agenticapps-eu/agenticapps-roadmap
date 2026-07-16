---
phase: 07-live-refresh-write-back
verified: 2026-07-16T09:30:00Z
status: human_needed
score: 26/26 must-haves verified (code/structural level); 12 live-proof items intentionally deferred to Phase 8
overrides_applied: 0
human_verification:
  - test: "LIVE-01 Refresh browser check: pnpm dev --?source=live, click Refresh"
    expected: "Refresh button + freshness hint appear only in Live mode; clicking Refresh fires a /api/linear/snapshot Network call (the unique proof a click re-pulls data, since the same-URL predicate alone also passes for a no-op); button shows 'Refreshing…'; hint updates to 'updated just now'; no Refresh button in Snapshot mode."
    why_human: "Requires a real browser + Network tab; the unit test on shouldRevalidateRoadmap alone cannot distinguish an actual re-pull from a same-URL no-op (07-01-PLAN.md's own review note)."
  - test: "LIVE-02 Backfill UI browser check: open the claude-workflow-mapped project's drill-down"
    expected: "Preview renders a typed diff (+N milestones, +M issues, +L labels, ~D dates); Apply is disabled until a successful preview exists, then flips the badge to in-sync + shows 'backfilling…'; a simulated failure reverts the badge and shows a dismissible inline error; a project not in BACKFILL_PROJECTS shows no Backfill control."
    why_human: "Visual/interaction proof of optimistic flip + rollback + control gating; cannot be captured by node-only unit tests (no DOM environment in this repo)."
  - test: "Phase-8 HUMAN-UAT checklist (.planning/phases/07/07-HUMAN-UAT.md), 12 items"
    expected: "Unauthenticated rejection of /api/backfill/*; direct-apply-without-preview 403; a real dry-run dispatch + typed-diff readback through a real GitHub Actions job log; a real Linear write + committed roadmap.json/linear-map.json with the badge staying in-sync after reload; cancelled/failed-run rollback; token absence in every real response; the 204/correlationId fallback; concurrent-writer serialization; a REAL scheduled snapshot.yml cron run (LIVE-03 live proof); job-log timestamp-prefix tolerance."
    why_human: "Every item requires GH_BACKFILL_TOKEN / GH_CROSS_REPO_TOKEN / LINEAR_API_KEY bound (Phase-8 secrets, currently unbound in this environment) and a real GitHub/Linear/Cloudflare round trip — none of this is mockable in a unit test and is explicitly, deliberately deferred by 07-05-PLAN.md to Phase 8. Do NOT treat as a phase-07 gap: the mechanism is code-complete and structurally verified; only the live proof is pending."
---

# Phase 07: Live refresh & write-back Verification Report

**Phase Goal:** On-demand refresh from Linear and UI-triggered per-project backfill, both
behind Access, with optimistic UI + rollback.
**Verified:** 2026-07-16T09:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, Phase 7)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "Refresh from Linear" reconciles live data into the snapshot view. | ✓ VERIFIED (code) / pending human click-proof | `shouldRevalidateRoadmap` additively returns `true` on an identical-URL explicit revalidate while still suppressing filter navigations (`src/lib/roadmap/loader.ts:83-97`, proven by `loader.test.ts`, RED→GREEN); `AppHeader.tsx` wires `useRevalidator().revalidate()` to a Live-mode-only Refresh button with a null-safe `formatFreshness` hint. Unit-test-level truth is fully proven; the unique browser proof (a real `/api/linear/snapshot` Network call on click) is the one thing a predicate unit test cannot show — deferred as human-check per 07-01-PLAN.md's own review note. |
| 2 | A backfill applied via the UI appears in Linear and in the next snapshot. | ✓ VERIFIED (mechanism, code-complete) / OPERATIONALLY PENDING (live) | Full write path exists and is unit-tested end-to-end against mocked boundaries: `functions/api/backfill/dispatch.ts` (allow-list + server-verified preview-before-apply + 200/204 branching, 27 tests), `functions/api/backfill/status.ts` (identity-verified run/correlation resolve + typed-diff readback, 25 tests), `src/lib/backfill/backfill.ts` (pure dispatch/poll/reducer, all terminal conclusions + 204 fallback + transient retry, tests green), `src/lib/backfill/useBackfill.ts` (hook glue + abort-on-unmount), `ProjectDrillDownDialog.tsx`/`OverviewPage.tsx` (eligibility-gated two-phase Preview/Apply UI, optimistic flip), `.github/workflows/backfill.yml` (sibling checkout, env-var-only input passing, typed diff marker, apply→`sync:snapshot` rebuild→commit both `roadmap.json`+`linear-map.json`, verified present in the actual committed YAML). No real GitHub `workflow_dispatch`/Linear write has ever fired through this path in this environment — 07-05's own `07-HUMAN-UAT.md` explicitly records this as OPERATIONALLY PENDING and this verifier treats that as by-design deferral, not a gap. |
| 3 | Writes are optimistic with error rollback; scheduled snapshot refresh runs. | ✓ VERIFIED (mechanism, code-complete) / OPERATIONALLY PENDING (live cron) | `applyBackfillOutcome` (pure reducer, `src/lib/backfill/backfill.ts:238-267`) proven by unit tests for start/success/failure/cancelled/unknown, including the non-reverting "unknown" branch; `SyncBadge.tsx` renders the optimistic override + "backfilling…" pending pill; `ProjectDrillDownDialog.tsx` shows a dismissible inline error on failure/cancelled. `snapshot.yml` confirmed present with `cron: "0 6 * * *"` + `workflow_dispatch` + commit-on-change, now sharing the `roadmap-git-writer` concurrency group with `backfill.yml` (both files read directly, matching 07-HUMAN-UAT.md's claims). No real scheduled cron run has fired yet in this environment (`LINEAR_API_KEY` unbound) — REQUIREMENTS.md correctly leaves LIVE-03 unchecked pending Phase-8 HUMAN-UAT item #11. |

**Score:** 3/3 success criteria code/mechanism-verified; live proof for #2 and #3 explicitly deferred to Phase 8 by phase design (not a phase-07 gap).

### Plan-Level Must-Haves (all 6 plans, truths merged from PLAN frontmatter)

| Plan | Truths | Status |
|------|--------|--------|
| 07-01 (LIVE-01) | R-4 shouldRevalidate fix; Refresh re-pulls + full-replaces dataset; Live-mode-only control; null-safe freshness hint | 4/4 VERIFIED — `loader.ts`/`loader.test.ts`/`freshness.ts`/`freshness.test.ts`/`AppHeader.tsx` all read and confirmed to match spec exactly |
| 07-02 (LIVE-02 backend) | Allow-listed dispatch + server-verified preview-before-apply; identity-verified status/diff readback; generic 5xx + no-store + token-never-in-body | 3/3 VERIFIED — `dispatch.ts`/`status.ts` read in full; 52 tests across both files; `npx tsc -b --noEmit` clean |
| 07-03 (LIVE-02 client core) | 204/correlationId handling; optimistic flip/revert/unknown; transient-retry vs terminal; never-throw | 4/4 VERIFIED — `backfill.ts`/`useBackfill.ts` read in full, logic matches spec exactly (mapConclusion, pollBackfillStatus retry/backoff, applyBackfillOutcome pure reducer) |
| 07-04 (LIVE-02 UI) | Eligibility-gated control dispatching config key; OverviewPage Map ownership; two-phase Preview/Apply; success/fail/unknown badge behavior | 4/4 VERIFIED — `projects.ts`/`SyncBadge.tsx`/`ProjectDrillDownDialog.tsx`/`OverviewPage.tsx` read in full, wiring confirmed (BACKFILL_PROJECTS gate, unconditional useState before guard, typed-diff render) |
| 07-05 (LIVE-03 verify) | snapshot.yml mechanism + shared concurrency; LIVE-02/03 recorded operationally pending; 12-item Phase-8 checklist; workflows verified beyond substring | 4/4 VERIFIED — `07-HUMAN-UAT.md` read in full, contains all required content |
| 07-06 (CI workflows) | Sibling checkout + env-var project passing; typed diff marker from dedicated step; apply→rebuild→commit-both; shared concurrency + run-name encoding | 4/4 VERIFIED — `.github/workflows/backfill.yml`/`snapshot.yml` read in full, match spec exactly |

**Score:** 23/23 plan-level truths verified at code/test level.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/roadmap/loader.ts` | Additive R-4 fix to `shouldRevalidateRoadmap` | ✓ VERIFIED | Both branches present (source-mode-flip + identical-URL); pre-existing suppression preserved |
| `src/lib/roadmap/freshness.ts` | Pure `formatFreshness`, null-safe | ✓ VERIFIED | React-free, handles undefined/null/invalid/<60s/min/hour/day cases |
| `src/components/AppHeader.tsx` | Live-mode-only Refresh + hint | ✓ VERIFIED, WIRED | `useRevalidator`, `lastRefreshedAt` state, render gated on `live && loaderData` |
| `functions/api/backfill/dispatch.ts` | Allow-list + preview-before-apply trigger | ✓ VERIFIED | 166 lines, matches plan's behavior spec exactly; CR-01 notes a security-hardening gap (see below) but the literal must-have ("requires a server-verified successful dry-run previewRunId") is met |
| `functions/api/backfill/status.ts` | Identity-verified run/diff readback | ✓ VERIFIED | 168 lines, run→jobs→job-logs sequence, typed-counts marker parse |
| `src/lib/backfill/backfill.ts` | Pure dispatch/poll/reducer | ✓ VERIFIED, WIRED | Exports `dispatchBackfill`, `pollBackfillStatus`, `applyBackfillOutcome` exactly as specified |
| `src/lib/backfill/useBackfill.ts` | Thin hook over the core | ✓ VERIFIED, WIRED | Exports exact `{ startPreview, applyBackfill, diffFor, statusFor, errorFor, clearError }` contract; abort-on-unmount present |
| `src/lib/backfill/projects.ts` | `BACKFILL_PROJECTS` id→key map | ✓ VERIFIED, WIRED | Seeded from `linear-map.json`'s `claude-workflow` id, matches exactly |
| `src/components/overview/SyncBadge.tsx` | Additive override/pending props | ✓ VERIFIED, WIRED | `outOfSync = planAheadOverride ?? project.planAhead`, "backfilling…" pill present |
| `src/components/overview/ProjectDrillDownDialog.tsx` | Two-phase Backfill control | ✓ VERIFIED, WIRED | Eligibility gate, Preview/Apply buttons, typed-diff render, dismissible error |
| `src/pages/OverviewPage.tsx` | Optimistic state Map owner | ✓ VERIFIED, WIRED | `useState` declared unconditionally before the `if (!loaderData)` guard; threaded to both children |
| `.github/workflows/backfill.yml` | CI dispatch/apply workflow | ✓ VERIFIED | All structural claims (sibling checkout, env-var-only inputs, dedicated marker-emit step, apply→rebuild→commit-both, shared concurrency) confirmed by direct read |
| `.github/workflows/snapshot.yml` | Scheduled snapshot, shared concurrency | ✓ VERIFIED | `cron: "0 6 * * *"`, `workflow_dispatch`, `group: roadmap-git-writer` confirmed |
| `.planning/phases/07/07-HUMAN-UAT.md` | Consolidated Phase-8 checklist | ✓ VERIFIED | 12 items present, all correctly marked BLOCKED-until-Phase-8; explicit OPERATIONALLY PENDING record for LIVE-02/03 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `AppHeader.tsx` | `react-router-dom useRevalidator` | `revalidator.revalidate()` onClick | ✓ WIRED | Confirmed in read source |
| `shouldRevalidateRoadmap` | `roadmapLoader` re-run | identical-URL branch | ✓ WIRED | Both branches present, tests green |
| `dispatch.ts` | `api.github.com .../backfill.yml/dispatches` | `fetch POST` with `GH_HEADERS` | ✓ WIRED | Confirmed; single try/catch, token in header only |
| `status.ts` | run→jobs→job-logs | 3-fetch sequence + `___DIFF_JSON___` parse | ✓ WIRED | Confirmed; identity check precedes any jobs/logs fetch |
| `backfill.ts` | `/api/backfill/dispatch`, `/api/backfill/status` | injected `fetchFn` | ✓ WIRED | Confirmed via `dispatchBackfill`/`pollBackfillStatus` |
| `useBackfill.ts` | `backfill.ts` | wraps pure functions, stores `previewRunId` per project | ✓ WIRED | Confirmed; key-space handled per documented contract |
| `ProjectDrillDownDialog.tsx` | `projects.ts` | `BACKFILL_PROJECTS[project.id]` | ✓ WIRED | Confirmed eligibility gate |
| `OverviewPage.tsx` | `useBackfill.ts` (via dialog) | state Map + setter passed down | ✓ WIRED | Confirmed unconditional `useState`, threaded to both `SyncBadge` and `ProjectDrillDownDialog` |
| `backfill.yml` | `scripts/sync-gsd-linear` CLI | `pnpm sync:gsd -- --project "$PROJECT_KEY"` | ✓ WIRED | Confirmed, env-var passing, no unsafe interpolation |
| `backfill.yml` | `status.ts` marker parser | `___DIFF_JSON___` marker | ✓ WIRED | Confirmed dedicated emit step, fragment-concatenated marker |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `AppHeader.tsx` freshness hint | `lastRefreshedAt` | seeded from `loaderData?.data.generatedAt`, bumped on `loading→idle` | Yes (real snapshot timestamp / revalidate transition) | ✓ FLOWING |
| `SyncBadge` in `OverviewPage`/`ProjectDrillDownDialog` | `backfillState.get(project.id)` | `useBackfill`'s `applyBackfillOutcome` reducer via `setBackfillState` | Yes (real optimistic-state transitions, not hardcoded) | ✓ FLOWING |
| `ProjectDrillDownDialog` diff render | `diffFor(backfillKey/project.id)` | `useBackfill`'s hook-local state, populated from `pollBackfillStatus`'s real `diff` field (itself parsed from `status.ts`'s typed marker) | Yes, but the upstream GitHub round trip that ultimately produces this diff has never executed live in this environment — the mocked-boundary tests prove the wiring, not the live payload | ⚠ FLOWING (mocked-boundary proven; live payload unproven — tracked in 07-HUMAN-UAT.md #4) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase-07 vitest suite | `CI=true npx vitest run` | 21 test files, 340 tests, all pass | ✓ PASS |
| Typecheck | `npx tsc -b --noEmit` | 0 errors | ✓ PASS |
| Production build | `npx vite build` | Succeeds (549.9kB main chunk, no errors) | ✓ PASS |
| Lint | `npx eslint src functions` | 2 pre-existing warnings in `src/components/ui/{badge,button}.tsx` (react-refresh rule), unrelated to phase-07 files; 0 errors | ✓ PASS (no phase-07 regressions) |
| Live dispatch/apply/cron | n/a — requires bound secrets | Not run (no `GH_BACKFILL_TOKEN`/`GH_CROSS_REPO_TOKEN`/`LINEAR_API_KEY` in this environment) | ? SKIP — Phase-8 scope |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repo and neither PLAN nor SUMMARY declares a probe script for phase 07. Step 7c: SKIPPED (no probes declared or discovered).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|--------------|----------------|--------------|--------|----------|
| LIVE-01 | 07-01 | "Refresh from Linear" reconciles live data into the view | ✓ SATISFIED (code); human browser-click proof pending | `loader.ts`/`freshness.ts`/`AppHeader.tsx`; REQUIREMENTS.md correctly marks `[x]` |
| LIVE-02 | 07-02, 07-03, 07-04, 07-06 | UI-triggered per-project backfill with optimistic UI + rollback | ✓ SATISFIED (code/mechanism); live GitHub/Linear round trip OPERATIONALLY PENDING per 07-HUMAN-UAT.md | Full write path read and confirmed; **see Gaps Summary** for a REQUIREMENTS.md tracking inconsistency |
| LIVE-03 | 07-05, 07-06 | Scheduled snapshot refresh (CI cron) | ✓ SATISFIED (mechanism); real cron run not yet observed | `snapshot.yml` confirmed; REQUIREMENTS.md correctly leaves `[ ]` unchecked pending Phase-8 item #11 |

No orphaned requirements: `grep -E "Phase 7"` against REQUIREMENTS.md's traceability table shows only LIVE-01..03, all three claimed across the six plans.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no `placeholder`/`not yet implemented` strings, and no empty-stub implementations (`return null`/`return {}`/no-op handlers) found in any of the 13 phase-07 files scanned (loader.ts, freshness.ts, AppHeader.tsx, dispatch.ts, status.ts, backfill.ts, useBackfill.ts, projects.ts, SyncBadge.tsx, ProjectDrillDownDialog.tsx, OverviewPage.tsx, backfill.yml, snapshot.yml).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `functions/api/backfill/dispatch.ts:71-81` | — | `isValidPreviewRun` has no recency bound or one-time-use/consume marking (CR-01, from 07-REVIEW.md, independently confirmed by direct read) | ⚠️ Warning | A stale (hours/days-old) successful dry-run's `previewRunId` still authorizes an apply today, and the same `previewRunId` can authorize more than one apply. Does not fail the plan's literal must-have ("requires a server-verified successful dry-run previewRunId") but is a real gap against CLAUDE.md's "explicit yes for that specific project" approval-gate intent. Not a phase-07 blocker per the plan's own acceptance criteria, but should be fixed before Phase-8 binds live write secrets. |
| `src/components/overview/ProjectDrillDownDialog.tsx` | 186-193 | `statusFor` exported by `useBackfill.ts` but never called; Preview button has no loading/disabled state (WR-03/IN-01 from 07-REVIEW.md, independently confirmed) | ⚠️ Warning | A user can double-dispatch a real GitHub Actions dry-run by clicking Preview again before the first completes (no UI feedback that a preview is in flight). UX gap, not a functional break. |
| `.planning/REQUIREMENTS.md:62` | — | LIVE-02 is checked `[x]` in the traceability table, but `.planning/phases/07/07-HUMAN-UAT.md` (written by the LAST plan in this phase, 07-05) explicitly states "Both requirements remain open in `.planning/REQUIREMENTS.md`'s traceability table until every item below is executed" (referring to LIVE-02 and LIVE-03) | ⚠️ Warning | Git history confirms LIVE-02 was checked off by an earlier plan (07-06, via its `requirements-completed: [LIVE-02]` frontmatter) before 07-05 ran and explicitly said it should stay open. LIVE-03 correctly stayed unchecked (07-05 fixed only that one). This is a self-inconsistency within the phase's own artifacts — the code/mechanism is genuinely done, so this is a documentation-accuracy issue, not a functional one, but Phase 8 should reconcile it (either re-open LIVE-02's checkbox until the HUMAN-UAT items pass, or update 07-HUMAN-UAT.md's STATUS block to acknowledge the intentional early checkoff). |

## Human Verification Required

### 1. LIVE-01 Refresh control — real browser proof

**Test:** Run `pnpm dev`, navigate to `?source=live`. Confirm the Refresh button + freshness hint appear and no Refresh button renders without `?source=live`. Click Refresh.
**Expected:** Network tab shows a `/api/linear/snapshot` call on click (the unique proof a click re-pulls data — the unit-tested predicate alone also passes for a same-URL no-op); the button shows "Refreshing…" during the request; the hint updates to "updated just now" afterward.
**Why human:** No DOM test environment in this repo; a predicate unit test cannot distinguish an actual network re-pull from a harmless same-URL revalidate no-op.

### 2. LIVE-02 Backfill UI — real browser proof

**Test:** In `pnpm dev` (`?source=live`), open the `claude-workflow`-mapped project's drill-down dialog. Click Preview, then Apply (once enabled). Separately, confirm a project not in `BACKFILL_PROJECTS` shows no Backfill control.
**Expected:** Preview renders a typed diff; Apply is disabled until a successful preview exists; a successful apply flips the badge to in-sync and shows "backfilling…"; a simulated failure reverts the badge and shows a dismissible inline error.
**Why human:** Visual/interaction proof of optimistic UI flip + rollback; this repo has no DOM/browser test harness.

### 3. Phase-8 live-proof checklist (12 items, `.planning/phases/07/07-HUMAN-UAT.md`)

**Test:** Execute all 12 items once `GH_BACKFILL_TOKEN`, `GH_CROSS_REPO_TOKEN`, and `LINEAR_API_KEY` are bound in Phase 8 (unauthenticated rejection, direct-apply-without-preview 403, real dry-run + typed-diff readback, real Linear write + durable snapshot commit, cancelled/failed rollback, token absence, 204 fallback, concurrent-writer serialization, a real scheduled cron run, job-log timestamp tolerance).
**Expected:** All 12 PASS.
**Why human:** Requires bound secrets and real GitHub Actions/Linear/Cloudflare round trips — none of this is mockable in a unit test, and per this phase's own explicit design (07-05-PLAN.md, 07-HUMAN-UAT.md), it is deliberately deferred to Phase 8. This is NOT a phase-07 gap.

## Gaps Summary

No functional gaps block phase-07 goal achievement. Every artifact the six plans promised exists, is substantive (no stubs/placeholders), is wired correctly, and is covered by a green automated test suite (340/340 tests, `tsc` clean, production build succeeds). The three ROADMAP success criteria are code/mechanism-complete; the parts of criteria #2 and #3 that require a real GitHub Actions dispatch, a real Linear write, and a real scheduled cron firing are intentionally, explicitly deferred to Phase 8 (secrets unbound in this environment) — per this phase's own design, this is not treated as a gap.

Two non-blocking findings carried over from the code review (`07-REVIEW.md`) were independently re-confirmed by direct source read: CR-01 (`previewRunId` has no recency bound or one-time-use enforcement — a real security-hardening gap worth fixing before Phase-8 binds live write secrets) and WR-03/IN-01 (`statusFor` unused, no Preview-in-flight UI feedback, enabling accidental double-dispatch of a real CI run). Neither fails any plan's literal must-have.

One documentation-accuracy inconsistency was found: `.planning/REQUIREMENTS.md` checks LIVE-02 `[x]` complete, but `07-HUMAN-UAT.md` (written by the phase's own final plan, 07-05) explicitly states LIVE-02 should remain open until its 12-item checklist passes. This should be reconciled at the start of Phase 8 (either by design decision documented as an override, or by re-opening the checkbox).

Status is `human_needed` rather than `passed` because two plans (07-01, 07-04) carry their own `<human-check>` items that were never executed (no browser tool available to the executors), and the phase's own consolidated Phase-8 checklist (12 items) is, by design, entirely unexecuted pending secrets.

---

_Verified: 2026-07-16T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
