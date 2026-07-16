---
phase: 07
reviewers: [gemini, codex, opencode]
reviewed_at: 2026-07-15T20:09:40Z
plans_reviewed: [07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md, 07-04-PLAN.md, 07-05-PLAN.md]
self_skipped: claude (running inside Claude Code)
---

# Cross-AI Plan Review — Phase 7: Live refresh & write-back

Three independent reviewers. Gemini reviewed the plans as-written (higher level).
Codex and OpenCode each independently inspected the actual codebase and converged on
the same set of HIGH plan-correctness/security findings — which sharply raises their
credibility.

---

## Gemini Review

## Plan Review: Phase 07

### 1. Summary

This is an exceptionally well-structured and comprehensive set of plans for a complex feature. The planning demonstrates a deep understanding of the project's existing architecture, successfully reusing patterns while introducing new functionality securely and robustly. The proactive research into potential pitfalls (especially the R-4 revalidation bug and R-2 CI checkout layout) and the direct integration of those findings into the plans is a significant strength. The clear separation of concerns between backend, client-side logic, and UI wiring, combined with a TDD approach, provides high confidence in a successful execution.

### 2. Strengths

*   **Research-Driven Planning:** The plans are not speculative; they directly address and implement solutions for critical issues discovered during research (R-4 `shouldRevalidate` bug, R-2 CI checkout paths, R-3 durable state commit). This de-risks the implementation significantly.
*   **Excellent Separation of Concerns:** The breakdown of LIVE-02 into three distinct, well-sequenced plans (07-02: Backend, 07-03: Client Core, 07-04: UI Wiring) is exemplary. Creating a pure, testable `backfill.ts` core (07-03) is a major highlight that will improve code quality and maintainability.
*   **Strong Security Posture:** The plans consistently enforce the project's "token-server-side" invariant, mirroring the battle-tested security model of the existing Linear proxy for the new GitHub token. The inclusion of threat models in the plans demonstrates a mature security awareness.
*   **Robust Project Management:** Plan 07-05 shows foresight by verifying and reusing the existing `snapshot.yml` for LIVE-03 and, crucially, consolidating all deferred live-verification tasks into a single `HUMAN-UAT.md` checklist for Phase 8. This ensures that dependencies on future secret-binding are not forgotten.
*   **Adherence to Existing Patterns:** The plans consistently leverage existing architectural patterns, from the single-try/catch error handling in Pages Functions to the `vi.stubGlobal("fetch")` testing methodology, which will reduce cognitive load and ensure consistency.

### 3. Concerns

*   **HIGH: No concerns of high severity.**
*   **MEDIUM: No concerns of medium severity.**
*   **LOW: Incomplete Fallback Logic for Dispatch Polling:** The research correctly identifies that the `workflow_dispatch` API might return a `204 No Content` instead of a `runId`, forcing a list-and-correlate fallback. Plan 07-02 correctly specifies that `dispatch.ts` should return a `correlationId` in this case. However, plan 07-03 for the client-side core (`backfill.ts`) does not specify how it will handle receiving a `correlationId`. The current plan seems to assume it will always receive a `runId` to start polling the status endpoint, creating a potential gap if the primary dispatch method fails.
*   **LOW: Ambiguous Error Handling for Pre-CI Dispatch Failures:** The plans thoroughly cover error handling for a *running* or *completed* CI job. However, it's unclear how the client will behave if the initial `POST /api/backfill/dispatch` call itself fails—for example, with a 404 from GitHub if the workflow file is named incorrectly, or a 422 if the inputs are invalid. The client might try to poll for a `runId` that was never created, leading to a confusing timeout instead of an immediate, clear error.

### 4. Suggestions

*   **Explicitly Plan the Correlation ID Fallback Path:** In `07-03-PLAN.md`, update the `pollBackfillStatus` (or a wrapper function) to accept *either* a `runId` or a `correlationId`. If a `correlationId` is provided, the function's first responsibility should be to poll the GitHub "List workflow runs" endpoint (filtered by `event`, `created`, and the `correlation_id` passed in `inputs`) to find the `runId`. Once found, it can proceed with the existing status polling logic. This will make the client fully robust.
*   **Handle Dispatch API Errors Immediately:** In `07-03-PLAN.md`, task 1 (`backfill.ts`), explicitly add a behavior: "The `dispatchBackfill` function must handle non-2xx responses from the `/api/backfill/dispatch` endpoint itself and resolve to a typed failure result, which immediately triggers the rollback/error state in the UI." This ensures that failures before a CI run even starts are handled instantly and correctly.

### 5. Risk Assessment

**Overall Risk: LOW**

**Justification:** The planning quality is very high. The most complex technical and security risks have been identified and mitigated through excellent research and pattern reuse. The deliberate deferral of live end-to-end testing to a consolidated Phase 8 checklist is a sound and proven strategy for this project, and the mock/unit-test boundaries are sufficient for this phase's goals. The identified concerns are minor edge cases in the client-side error handling logic and can be easily addressed by incorporating the suggestions above. The phase is well-positioned for a successful and high-quality implementation.
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-roadmap)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-roadmap)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 18ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-roadmap)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-roadmap)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 19ms

---

## Codex Review

## Summary

The plans are thoughtfully decomposed and unusually explicit about invariants, but Phase 7 is not executable or secure enough as written. LIVE-01 is close to adequate. LIVE-02 has several blocking contract failures across dispatch, polling, project identity, approval enforcement, diff transport, and durable snapshot state. LIVE-03’s mechanism exists, but static YAML inspection does not prove that the scheduled refresh “runs.” The Phase-8 deferral is reasonable for real credentials and production verification, but the current mocked tests encode an incorrect GitHub call sequence and cannot compensate for unresolved design contradictions.

## Strengths

- Clear three-wave decomposition: backend contract before client orchestration before UI wiring.
- Strong preservation of the snapshot-default, zero-Linear-network architecture.
- Good TDD focus around the confirmed `shouldRevalidateRoadmap` issue and Pages Function error paths.
- Appropriate decision to keep GitHub and Linear tokens server-side and test their absence from response bodies.
- Generic upstream error handling avoids returning GitHub bodies or authorization headers.
- Correct high-level insight that sibling repositories must be checked out beside a subdirectory checkout of the roadmap repository.
- Bounded polling, unmount cleanup, local optimistic state, and no unnecessary global state dependency are sensible.
- Explicit Phase-8 UAT documentation is better than silently pretending production behavior has been verified.
- Reusing the existing scheduled snapshot workflow is appropriate; no second scheduler is justified.

## Concerns

- **[HIGH] The 204 dispatch fallback is nonfunctional.** [07-02](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/.planning/phases/07/07-02-PLAN.md:122) returns `{ runId: null, correlationId }`, but [07-03](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/.planning/phases/07/07-03-PLAN.md:95) can poll only a numeric run ID. Nothing lists and correlates workflow runs, and `backfill.yml` does not put the correlation ID into a queryable `run-name`. On a 204, preview/apply simply dead-ends.

- **[HIGH] The status endpoint omits a required GitHub API step.** A workflow run ID is not a job ID. The plan jumps from `GET /actions/runs/{runId}` directly to `GET /actions/jobs/{jobId}/logs` without calling `GET /actions/runs/{runId}/jobs` and selecting the backfill job. The proposed two-fetch tests would therefore validate an impossible production sequence.

- **[HIGH] The UI-to-CLI project identity contract does not exist.** `sync.config.json` accepts `claude-workflow`, `cparx`, and `fx-signal-agent`, while the actual snapshot contains Linear display names such as “AgenticApps Roadmap” and “cPARX Prototype.” Yet [07-04](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/.planning/phases/07/07-04-PLAN.md:116) passes the `RoadmapJson.Project` directly to the hook. Most projects are not eligible, and even intended targets will not resolve reliably.

- **[HIGH] The two-phase approval rule is enforced only in the UI.** Anyone with Access can POST `{ mode: "apply" }` directly to the dispatch Function, bypassing preview. That violates the hard “printed diff, then explicit yes for that project” rule. Apply should require proof of a recent, successful preview for the same project—ideally a preview run ID plus a server-verified project/diff digest.

- **[HIGH] Quoting `${{ inputs.project }}` does not make shell interpolation safe.** GitHub expressions are expanded before the shell parses the command. A crafted project string can escape the surrounding quotes. The Function should accept only an explicit project-key allow-list, and the workflow should transfer the value through `env`, then use `"$PROJECT_KEY"` in shell.

- **[HIGH] The durable `planAhead` model contradicts the optimistic UI.** Phase 7 treats successful apply as `planAhead: false`, but the existing apply path explicitly writes `true` after success in [apply.ts](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/scripts/sync-gsd-linear/apply.ts:431). Furthermore, a later `sync:snapshot` rebuild omits `planAhead` entirely in [transform.ts](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/scripts/linear/transform.ts:147). The proposed job therefore cannot make the optimistic “in sync” state durable.

- **[HIGH] The workflow discards important CLI state.** The CLI persists new IDs to `linear-map.json` at [cli.ts](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/scripts/sync-gsd-linear/cli.ts:143), but the workflow commits only `public/roadmap.json`. A partial or successful apply can therefore mutate Linear while losing its updated identity map in CI.

- **[HIGH] Per-project concurrency permits conflicting git writers.** Different project jobs can simultaneously modify and push `linear-map.json`/`roadmap.json`. `snapshot.yml` uses a separate concurrency group and can race them too. This risks non-fast-forward failures, lost map entries, or snapshot overwrites. Git-writing apply and snapshot jobs need shared serialization or a deliberate rebase/retry strategy.

- **[HIGH] The status endpoint can become a log-exfiltration proxy.** It accepts any nonempty `run` value and does not verify that the run belongs to `backfill.yml`, the expected ref, project, mode, or correlation ID. An Access user could query another workflow’s completed run and cause its logs to be inspected or partially returned. Require a positive integer and verify workflow identity before reading jobs/logs.

- **[HIGH] Diff transport is not a stable contract.** The workflow serializes human, ANSI-colored CLI stdout; `status.ts` returns the regex payload as a string; the UI expects structured counts. The parser may also match the logged shell command containing `___DIFF_JSON___` rather than the emitted result, and completed-run logs may not be immediately available. Either return sanitized preformatted text consistently or introduce a structured JSON output/artifact.

- **[MEDIUM] Polling treats observation failures as job failures.** A transient 502, status timeout, or malformed response can occur after GitHub accepted the apply. Immediate rollback and re-enable may let the user dispatch a second run while the first is still executing. Retry transient status failures with backoff and distinguish “terminal failure” from “outcome unknown.”

- **[MEDIUM] Terminal conclusion handling is incomplete.** GitHub conclusions extend beyond `success`, `failure`, and `cancelled`; timeouts, startup failures, stale, skipped, action-required, and neutral cases need defined behavior. Conservatively, any completed conclusion other than `success` should clear pending and report failure/unknown.

- **[MEDIUM] The hook/UI interface is underspecified.** `startPreview` must somehow expose stored diff state, but the published hook interface contains no `diffFor`. The error is described as dismissible, but no `clearError` exists. Project arguments alternate between strings and objects. These inconsistencies will be resolved ad hoc during implementation unless the contract is made explicit first.

- **[MEDIUM] Workflow verification is only substring matching.** It does not prove valid YAML, correct expressions, correct `if:` branches, safe shell handling, or correct working directories. The subdirectory checkout also requires `working-directory: agenticapps-roadmap` for installation and an appropriate `cache-dependency-path`.

- **[MEDIUM] LIVE-01 lacks component-level proof.** The loader predicate is tested, but the live-only render gate and actual `revalidate()` click are human-only. The proposed identical-URL predicate also enables snapshot-mode same-URL revalidation, so it is not uniquely identifying a Refresh click. `loaderData` should remain null-safe when rendering the freshness hint.

- **[MEDIUM] Plan 07-05 is ordered too early.** A consolidated UAT artifact should depend on 07-01 through 07-04; otherwise it can be generated before the final route, hook, and UI contracts exist and immediately become stale.

- **[HIGH] The phase claims exceed its evidence.** [07-05](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/.planning/phases/07/07-05-PLAN.md:72) declares LIVE-03 satisfied by finding strings in YAML, although the success criterion says the scheduled refresh runs. Likewise, LIVE-02 cannot be claimed complete before a real dispatch/write/snapshot proof. Phase-8 deferral is acceptable, but these requirements should remain operationally pending.

## Suggestions

- Add a prerequisite “07-00 contract correction” covering:

  - A stable backfill project key/mapping and explicit allow-list.
  - Correct `planAhead` semantics after preview and apply.
  - Preservation/recomputation of `planAhead` during full snapshot rebuild.
  - Commitment of both `linear-map.json` and the refreshed snapshot.

- Redesign the dispatch/status contract:

  - Always return a usable run ID; implement correlation server-side for 204 responses.
  - Add a correlation-based `run-name` if fallback listing is retained.
  - Require `previewRunId` or a short-lived approval capability for apply.
  - Validate GitHub responses at runtime rather than relying on TypeScript casts.
  - Resolve run → jobs → exact job → logs, and verify workflow/ref/mode/project first.
  - Return `Cache-Control: no-store` on dispatch and polling responses.

- Replace raw log scraping with a typed, sanitized diff contract. If “CLI unchanged” remains absolute, return cleaned preformatted text and adjust the UI requirement accordingly. Otherwise, a narrow `--json` output is safer than parsing terminal output.

- Harden the workflow:

  - Pass project and mode through environment variables.
  - Serialize all git-writing workflows.
  - Run a full snapshot refresh after apply, then preserve the computed sync flag.
  - Commit `linear-map.json` with `roadmap.json`.
  - Set all subdirectory working directories and cache paths explicitly.
  - Validate with `actionlint` or an equivalent workflow-aware checker.

- Expand client tests to cover 204 correlation, duplicate clicks, transient polling failures, log/diff delay, every terminal conclusion, abort cleanup, missing diff, and “outcome unknown.”

- Expand Phase-8 UAT to include unauthenticated rejection of `/api/backfill/*`, direct-apply rejection without preview, cancelled/failed-run rollback, token absence in network responses, 204 fallback, concurrent writer behavior, and a real scheduled cron run.

## Risk Assessment

**Overall risk: HIGH.**

LIVE-01 is low-to-medium risk and largely sound. LIVE-02’s nominal happy path cannot currently complete reliably: project keys do not map, 204 responses cannot be polled, job IDs are never resolved, diff output is incompatible with the UI, approval is bypassable, and durable state is inverted or discarded. LIVE-03 is implemented structurally but not operationally proven. Mocked boundaries are appropriate for reducer and leak-error behavior, but the proposed mocks currently model the wrong GitHub interaction and are insufficient to claim the phase success criteria.

---

## OpenCode Review

I'll review these plans against the actual codebase to verify the key assumptions before giving my assessment. Let me explore the critical files in parallel.
Let me verify the critical assumptions about the sync CLI (does it write roadmap.json?) and whether the live projection includes `planAhead`.
Key finding: `buildSnapshot` (the live transform) does NOT populate `planAhead` — only the Phase-6 walker does. Let me verify whether `sync:gsd` actually writes `roadmap.json` (critical for R-3 / success criterion 2).
I found a critical issue. `patchPlanAhead` sets `planAhead=true` on apply (apply.ts:431), but D-07-06 says the optimistic flip goes out-of-sync→in-sync. Let me verify the `planAhead` semantics and how the snapshot computes it.
Let me check the actual `roadmap.json` state and search for where `planAhead` is computed during snapshot builds — this is critical to the optimistic-flip design.
I've found a critical semantic mismatch. Let me verify the diff output format (for the diff-readback contract) and confirm there's no full-snapshot rebuild in the apply path.
Let me verify the remaining integration points claimed by the plans: the existing `loader.test.ts`, `AppHeader.tsx`, and `ProjectDrillDownDialog.tsx`.
I've verified the plans against the actual codebase. My review follows.

---

# Cross-AI Plan Review — Phase 7: Live refresh & write-back

## 1. Summary

The five plans are well-structured, disciplined about dependencies (no new npm packages, no state library, no GitHub SDK), and correctly mirror the existing Linear-proxy pattern. The R-4 `shouldRevalidateRoadmap` bug is real (verified at `loader.ts:83-91`), and the additive fix with TDD is exactly right. Wave ordering is correct. **However, three findings from inspecting the actual code materially undermine the plans:** (a) the apply job commits `planAhead=true` via `patchPlanAhead` (`apply.ts:431`), which renders the *“Out of sync with plan”* badge — the **opposite** of the optimistic in-sync flip D-07-06 describes, so R-3's "durable flip" is inverted; (b) the apply job's `patchPlanAhead` only flips one field — it does **not** add the new milestones/issues to `roadmap.json`, so success criterion 2 ("appears in the next snapshot") is only satisfied by the daily cron, not the apply commit; (c) the dry-run diff readback wraps raw `renderDiff` stdout including ANSI color codes and a `--- repo ---` header (`diff.ts:168-189`), with no structured contract to the UI. These are fixable in the plans (not just Phase-8 secrets), and should be addressed before execution.

## 2. Strengths

- **R-4 is a verified bug, not hypothetical.** Confirmed at `src/lib/roadmap/loader.ts:83-91`: on an explicit `revalidator.revalidate()`, `currentUrl === nextUrl`, so `sourceMode(current) === sourceMode(next)` → returns `false` → loader never re-runs. The additive fix (keep the source-flip branch, add an identical-URL `true` branch) is correct and preserves the Phase-5 zero-network filter suppression. TDD-first is appropriate.
- **Faithful pattern reuse.** `dispatch.ts`/`status.ts` mirror `functions/api/linear/[[path]].ts` exactly: typed `Env`, env-check + input-validation before any fetch, single try/catch → generic 5xx, token-only-in-header. The distinct `GH_BACKFILL_TOKEN` binding name avoids the copy-paste collision anti-pattern.
- **Simplicity-First holds.** `fflate`/artifact-unzip rejected in favor of job-logs-grep (zero deps); no Zustand/Redux (local `useState` Map); raw `fetch` instead of `@octokit/rest`; pure core + thin hook split is justified by the no-jsdom test constraint, not over-engineering.
- **Checkout layout fix is correct.** Pattern 2 reproduces `sync.config.json`'s `../claude-workflow`, `../../factiv/cparx`, `../../factiv/fx-signal-agent` relative paths inside `$GITHUB_WORKSPACE` (verified against `sync.config.json`) without touching the CLI — a workflow-only fix that respects Surgical Changes.
- **Threat model is thorough.** Token-absence asserted across every status code (200/400/500/502); supply-chain threat (T-07-SC) closed by zero new deps; per-project `concurrency` prevents clobbering.
- **Phase-8 deferral is well-documented** in 07-05, mirroring Phase 3's Access-proof pattern.

## 3. Concerns

- **[HIGH] R-3 / planAhead semantic inversion — the apply job makes the badge *out-of-sync*, not in-sync.** `patchPlanAhead(roadmapPath, projectName, true)` is called on every real apply (`apply.ts:414` and `:431`; confirmed by `apply.test.ts:450` asserting `planAhead === true`). `SyncBadge` renders *"Out of sync with plan"* when `planAhead` is truthy (`SyncBadge.tsx:12`). D-07-06 says the optimistic flip goes out-of-sync → **in-sync** (`planAheadOverride: false`, badge hidden). So: the client optimistically hides the badge, the apply job commits `planAhead: true`, and on **reload the badge reappears as "out of sync"** — the optimistic in-sync is reverted by the very commit that was supposed to make it durable. R-3's stated intent ("the optimistic flip becomes durable truth") is not met; the durable state is the *opposite* of the optimistic state.

- **[HIGH] The apply job does NOT put new milestones/issues into `roadmap.json` — success criterion 2 is only met by the daily cron.** `patchPlanAhead` (`apply.ts:115-128`) reads `roadmap.json`, sets one boolean, and writes it back. It does not re-fetch Linear or add the newly-created milestones/issues. So the apply job's committed `roadmap.json` carries the *old* milestones + `planAhead: true`. The new records only appear when `snapshot.yml`'s cron runs `pnpm sync:snapshot` (which calls `buildSnapshot`, rebuilding fully from Linear). Plan 07-02 Task 3 calls this "the refreshed `public/roadmap.json`" — it is not refreshed; it's a one-field patch. "Appears in the next snapshot" therefore means "up to 24h later via cron," not "immediately via the apply commit."

- **[HIGH] Diff-readback contract is underspecified and ANSI-laden.** `renderDiff` (`diff.ts:168-189`) emits human text with `\x1b[32m…\x1b[0m` color codes and a `--- ${entry.name} ---` header, formatted as `+ N milestones, + M issues, + L labels` / `~ D dates (informational only — existing milestones are not updated in v1)`. Plan 07-02 Task 3 wraps the *entire raw stdout* as `JSON.stringify(readFileSync(...))` inside the `___DIFF_JSON___` marker. Plan 07-04 then renders `+ N milestones, + M issues, ~ D dates` "from the diff" — but the diff is ANSI-laden, multi-line, header-prefixed human text that doesn't match the UX mockup (labels omitted, trailing parenthetical included). There is no structured JSON contract between CI and UI; the UI must regex-parse colored text. Fragile, and not covered by any unit test on the UI side.

- **[MEDIUM] The `correlation_id` fallback is half-built — a real Phase-8 break path.** `dispatch.ts` emits `{ runId: null, correlationId }` on a 204, but `status.ts` only accepts `?run=<id>`. If `return_run_details` is unsupported (the research flags this as a genuine possibility, A3), the client receives `runId: null` and has **no endpoint to resolve it to a runnable** — the entire preview→apply polling loop breaks, and the fallback the research promised ("coded but untested-until-live") is not actually coded into `status.ts`. Either complete the fallback (a status variant that lists runs by `correlation_id`) or drop the `correlationId` emission to avoid a dead path.

- **[MEDIUM] `status.ts` job-logs readback needs an unstated job-listing step.** The per-job plain-text logs endpoint is `/actions/jobs/{job_id}/logs` — it requires a `job_id`. To get one, the function must first `GET /actions/runs/{run_id}/jobs` and pick a job. The plan's behavior/test describe "fetch job logs" as a single step and stub a single logs response. The run-level `/actions/runs/{run_id}/logs` returns a **zip** (the rejected `fflate` path). The multi-fetch sequence (run → jobs list → job logs) should be made explicit in 07-02 Task 2's behavior and fixtures, or the implementation will be missing a call.

- **[MEDIUM] `planAhead` is absent in live mode — the optimistic flip is a snapshot-mode feature the plans don't acknowledge.** `buildSnapshot` (`transform.ts:118-168`, the live transform used by `/api/linear/snapshot`) does **not** set `planAhead`; only `patchPlanAhead` (apply path) ever sets it, and the daily cron's `buildSnapshot` wipes it to `undefined`. So in live mode, `SyncBadge` never renders and there is nothing to optimistically flip. The Backfill control is placed in the drill-down dialog (available in both modes), but its optimistic UI only visually works in snapshot mode. Unlike Refresh (gated to live mode by D-07-05), Backfill is ungated. The plans should either gate Backfill to snapshot mode or explicitly document that the optimistic flip is grounded in the snapshot's `planAhead`.

- **[MEDIUM] The freshness hint is meaningless in live mode.** Plan 07-01 Task 2 feeds `formatFreshness(loaderData.data.generatedAt, new Date())`, co-located with the live-only Refresh button. But in live mode `data.generatedAt` is set by `buildSnapshot` to `new Date().toISOString()` at request time (`transform.ts:122`), so the hint will always read "updated just now." It's only meaningful for the *snapshot's* `generatedAt`, which isn't what the live-mode slot displays.

- **[MEDIUM] `useBackfill` is verified only by typecheck — the bug-prone parts are untested.** The pure core (`backfill.ts`) is well-tested, but the hook owns the poll lifecycle, `AbortController`/`mounted`-ref cleanup, and stale-closure management — exactly the areas where memory leaks and stale-state bugs live. "Thin glue verified by typecheck" understates the risk; a tab-close-during-poll or rapid double-Apply has no automated coverage.

- **[LOW] 07-05 runs in Wave 1 but documents 07-02's route contract.** The UAT checklist references `/api/backfill/*` shapes and `backfill.yml` inputs. If 07-05 executes before 07-02 finalizes, the doc could drift from the implementation. The contract is locked by frontmatter, so this is minor, but sequencing 07-05 after 07-02 would be safer.

- **[LOW] No dispatch de-duplication.** Repeated Preview clicks queue dry-run runs (the `concurrency` group serializes but doesn't cancel). Polling tracks its own `runId` correctly, but orphaned queued runs accumulate. Harmless but wasteful.

- **[LOW] Token-shape regex `/ghp_|github_pat_/` only matches PATs.** A GitHub-App or other token format wouldn't match. The primary literal-value-not-in-body assertion covers all formats, so this is a bonus check, but the plan shouldn't imply the regex is comprehensive.

## 4. Suggestions

- **Add a `pnpm sync:snapshot` step to the apply job (07-02 Task 3) after `sync:gsd --apply`.** This rebuilds `roadmap.json` fully from Linear — picking up the newly-created milestones/issues *and* leaving `planAhead: undefined` (badge hidden = in-sync). It satisfies success criterion 2 immediately (not via the next cron), and makes the durable state match the optimistic in-sync flip. It reuses the existing audited script, needs only `LINEAR_API_KEY` (already in the job env), and is idempotent. Then drop or rethink the `patchPlanAhead`-based commit (it's the source of the inverted badge).
- **Define a structured diff contract.** Cheapest option within "CLI unchanged": have `backfill.yml` extract `renderDiff`'s counts via a small `node -e` that parses the captured stdout (strip ANSI with `s/\x1b\[[0-9;]*m//g`, then regex `^\+ (\d+) milestones, \+ (\d+) issues` and `^~ (\d+) dates`) and emit a `___DIFF_JSON___{"milestones":N,"issues":M,"dates":D}___END_DIFF___` line. The UI then renders a typed object, not colored text. Alternatively, add a `--json` flag to the CLI (a small, justified change since the CLI is this project's own code and a structured output is a legitimate new consumer).
- **Complete or remove the `correlation_id` fallback.** If kept, add a `status.ts` mode that accepts `?correlation_id=` and lists runs filtered by `created>=` + the id. If dropped, stop emitting `correlationId` and document that `return_run_details` is a hard Phase-8 prerequisite.
- **Make the status.ts fetch sequence explicit.** Behavior should state: GET run → if `completed`, GET `/actions/runs/{id}/jobs` → take first job → GET `/actions/jobs/{jobId}/logs` → extract marker. Fixtures should stub the three-call chain.
- **Acknowledge the `planAhead` live-mode absence.** Either gate the Backfill control to snapshot mode (consistent with D-05-06's snapshot-first stance) or add a note that the optimistic flip operates on the snapshot's `planAhead` and is a no-op visual in live mode.
- **Fix the freshness hint.** Track the last successful Refresh time in client state (e.g. a `useRef` updated when `revalidator.state` transitions `loading → idle`), or display the snapshot's `generatedAt` (fetch the static file's timestamp separately). Do not use the live projection's `generatedAt`.
- **Add a minimal hook test for cleanup.** Even without jsdom, a `vi.useFakeTimers` test that starts a poll, unmounts (aborts), and asserts no further `fetch` calls would catch the common leak. This is a small addition to 07-03 Task 2's verify step.
- **Sequence 07-05 after 07-02.** Move 07-05 to Wave 2 (or add a `depends_on: ["07-02"]`) so the UAT checklist is written against the finalized route/workflow contract.

## 5. Risk Assessment

**MEDIUM-HIGH.** The unit-testable surface (R-4 fix, dispatch/status token-absence, optimistic rollback matrix, checkout layout) is solid and low-risk. But two HIGH concerns — the `planAhead`/R-3 semantic inversion and the apply job not refreshing the snapshot's records — mean **LIVE-02's success criteria 2 is not actually achieved by the apply commit**; it's deferred to the daily cron, and the badge actively misrepresents state after reload until then. These are not Phase-8 secrets problems; they are plan-correctness problems fixable now by adding a `sync:snapshot` step and reconciling the `planAhead` direction. The diff-readback contract (HIGH) is a live-UX fragility that will surface in Phase 8 with no automated test to catch it. The Phase-8 live-deferral itself is adequate *for the parts that genuinely need bound secrets* (real GitHub API behavior, Access gating), but it is being used as a reason to leave the *diff contract* underspecified, which it shouldn't. Recommend revising 07-02 (snapshot rebuild step + structured diff + explicit job-logs fetch sequence) and 07-04 (acknowledge planAhead live-mode semantics) before execution; 07-01 and 07-03 are ready as written.

---

## Consensus Summary

Overall risk: **Gemini LOW · OpenCode MEDIUM–HIGH · Codex HIGH.** The divergence is
explained by depth: Gemini reviewed the plan text; Codex and OpenCode read the code.
Both code-grounded reviewers independently reached the same HIGH findings, so those
should be treated as real. LIVE-01 (Refresh + R-4 fix) and 07-03's pure reducer core
are agreed to be sound. **LIVE-02's write path (07-02/07-04) has genuine
plan-correctness and security gaps that are fixable now — not Phase-8 secret problems.**

### Agreed Strengths (2+ reviewers)
- **R-4 `shouldRevalidateRoadmap` is a verified real bug** (all three); the additive,
  TDD-first fix is correct and preserves the Phase-5 zero-network filter behavior.
- **Faithful pattern reuse** of the Linear-proxy Pages Function shape (typed Env,
  validate-before-fetch, single try/catch → generic 5xx, token-only-in-header,
  token-absence asserted across status codes).
- **Simplicity-First discipline**: no new npm deps (job-logs-grep over fflate), local
  `useState` over a state library, raw fetch over an SDK, pure-core + thin-hook split.
- **Correct CI checkout-layout insight** (roadmap into a subdir, siblings alongside) and
  **appropriate reuse of `snapshot.yml`** for LIVE-03.
- **Honest, documented Phase-8 deferral** of live end-to-end verification.

### Agreed Concerns (raised by 2+ reviewers — highest priority)
1. **[HIGH] `planAhead` semantic inversion / durable state contradiction** (Codex + OpenCode,
   both cite `apply.ts:431`, `SyncBadge.tsx:12`). The apply path commits `planAhead=true`
   (renders "Out of sync"), the *opposite* of D-07-06's optimistic out-of-sync→in-sync
   flip. On reload the badge reverts. R-3's "durable flip" is inverted.
2. **[HIGH] Apply job does not refresh records into `roadmap.json`** (Codex + OpenCode,
   cite `apply.ts` patchPlanAhead + `transform.ts:147`). `patchPlanAhead` flips one
   boolean; new milestones/issues only appear via the daily cron's `buildSnapshot` — and
   that rebuild drops `planAhead` entirely. Success criterion 2 ("appears in the next
   snapshot") is not met by the apply commit. **Fix both #1 and #2 by adding a
   `pnpm sync:snapshot` step to the apply job** (rebuilds fully from Linear, leaves badge
   hidden = in-sync) and reconciling/removing the `patchPlanAhead` commit.
3. **[HIGH] Diff-readback is not a stable contract** (Codex + OpenCode). `renderDiff`
   emits ANSI-colored, header-prefixed human text; the plan wraps raw stdout and the UI
   regex-parses it. Define a structured `{milestones,issues,dates}` JSON contract (parse
   in `backfill.yml` with a `node -e` ANSI-strip, or add a small `--json` flag to the
   project's own CLI).
4. **[HIGH] 204 dispatch fallback is nonfunctional** (Codex HIGH, OpenCode MEDIUM,
   Gemini LOW). `dispatch.ts` emits `{runId:null, correlationId}` but `status.ts` only
   accepts `?run=<id>` — nothing lists-and-correlates. Either complete the fallback
   (a `?correlation_id=` status mode + a queryable `run-name`) or drop the emission and
   make `return_run_details` a hard Phase-8 prerequisite.
5. **[HIGH] `status.ts` omits the run→jobs→job-logs step** (Codex + OpenCode). A run ID
   is not a job ID; the plan jumps straight to `/actions/jobs/{jobId}/logs`. Must first
   `GET /actions/runs/{runId}/jobs`. The two-fetch tests validate an impossible sequence.
6. **[MEDIUM] Polling treats transient observation failures as job failures** (Codex +
   Gemini). Distinguish "terminal failure" from "outcome unknown"; retry transient 502s
   with backoff so a rollback+re-enable can't dispatch a second run over a live one.
7. **[MEDIUM] 07-05 (UAT doc) is ordered too early** (Codex + OpenCode). It documents
   07-02's route/workflow contract; move it after 07-02 (or add `depends_on: [07-02]`).

### Codex-only HIGH findings (single reviewer, but code-grounded and serious)
- **UI-only approval enforcement is bypassable** — an Access user can POST
  `{mode:"apply"}` directly to `/api/backfill/dispatch`, skipping preview. Violates the
  hard "printed diff → explicit yes per project" rule. Require server-verified proof of a
  recent successful preview (a `previewRunId` + project/diff digest).
- **Shell-injection: quoting `${{ inputs.project }}` is not safe** — GitHub expressions
  expand before the shell parses. Pass through `env:` and use `"$PROJECT_KEY"`, plus a
  server-side project-key allow-list.
- **UI→CLI project identity contract missing** — `sync.config.json` keys (`claude-workflow`,
  `cparx`, `fx-signal-agent`) ≠ Linear display names (`AgenticApps Roadmap`, `cPARX
  Prototype`). 07-04 passes the `RoadmapJson.Project` straight to the hook; most won't
  resolve. Need an explicit key mapping/allow-list.
- **`linear-map.json` not committed** — CLI persists new IDs to it (`cli.ts:143`) but the
  workflow commits only `roadmap.json`; CI loses the identity map → future dup risk.
- **Cross-workflow git-write races** — per-project concurrency + a separate `snapshot.yml`
  group can push `roadmap.json`/`linear-map.json` concurrently (non-fast-forward / lost
  writes). Needs shared serialization or rebase/retry.
- **Status endpoint as a log-exfiltration proxy** — accepts any nonempty `run`, never
  verifies the run belongs to `backfill.yml`/expected ref/mode/project. Validate a
  positive integer + workflow identity before reading logs. Return `Cache-Control: no-store`.

### Divergent Views
- **Overall risk**: Gemini LOW vs Codex HIGH / OpenCode MEDIUM-HIGH. Resolve in favor of
  the code-grounded reviewers — Gemini did not inspect the source and so missed the
  `planAhead`/apply-path realities.
- **Diff contract fix**: OpenCode/Codex accept either an in-workflow ANSI-strip+regex OR a
  new `--json` CLI flag. The `--json` flag is a small, legitimate change to the project's
  own CLI (a new structured consumer) and is the more robust option — weigh against the
  "CLI unchanged" preference in D-07-01.
- **Backfill in live mode**: OpenCode notes `planAhead` is absent in the live projection,
  so the optimistic flip is a snapshot-mode-only visual — either gate Backfill to snapshot
  mode or document the semantics (relates to #1/#2).

### Recommended next step
These are plan-level corrections, so the highest-leverage move is to **replan with this
feedback** rather than execute as-is:

    /gsd-plan-phase 7 --reviews

Priorities for the replan: (1) reconcile `planAhead` direction + add a `sync:snapshot`
rebuild to the apply job (fixes consensus #1, #2); (2) define a structured diff contract
(#3); (3) complete or drop the 204/correlation fallback and fix the run→jobs→logs
sequence (#4, #5); (4) enforce preview-before-apply server-side + env-var project passing
with an allow-list (Codex security set); (5) commit `linear-map.json` and serialize
git-writing workflows; (6) re-order 07-05 after 07-02.
