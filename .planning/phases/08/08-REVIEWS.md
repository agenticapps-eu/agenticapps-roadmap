---
phase: 8
reviewers: [gemini, codex, opencode]
reviewed_at: 2026-07-16T10:50:22Z
plans_reviewed: [08-01-PLAN.md, 08-02-PLAN.md, 08-03-PLAN.md]
self_skipped: claude (running inside Claude Code CLI)
---

# Cross-AI Plan Review — Phase 8

## Gemini Review

Here is a review of the implementation plans for Phase 8.

## `08-01-PLAN.md` — KV binding & consume-once nonce

### Summary
This is a precise and well-designed plan for implementing the consume-once nonce logic, which is the only code-creation task in this phase. The plan is surgically focused on modifying three specific files to add the KV binding, implement the check-then-set logic, and provide robust unit test coverage. It correctly follows project conventions and is grounded in prior research.

### Strengths
*   **Surgical Focus**: The plan's tasks are tightly scoped to the required changes, adhering to the "Surgical Changes" principle by explicitly warning against modifying adjacent code.
*   **Test-Driven Development**: A dedicated task enforces writing unit tests for the new functionality, covering both the replay-rejection case and the success case for distinct IDs. This significantly mitigates implementation risk.
*   **Grounded in Research**: The plan directly references patterns from the research documents, particularly for the `wrangler.toml` configuration and the test mock strategy, ensuring the approach is consistent with platform capabilities and project patterns.
*   **Excellent Verifiability**: The acceptance criteria are concrete and mostly automated, using `grep`, `tsc`, and `vitest` to provide a strong guarantee of correctness before merging.

### Concerns
*   None. This plan is exemplary.

### Suggestions
*   No improvements are needed. The plan is clear, complete, and low-risk.

### Risk Assessment
*   **LOW**. The plan addresses a small, isolated change. The risk is heavily mitigated by the emphasis on TDD, clear acceptance criteria, and adherence to established patterns. The plan's threat model correctly identifies and accepts the residual risk of KV's eventual consistency, which is appropriate for the threat context.

---

## `08-02-PLAN.md` — Documentation (ADR, runbook, README)

### Summary
This plan comprehensively covers the creation of all required documentation for the v0.1.0 release. It orchestrates the authoring of a new architectural decision record (ADR), a detailed operational runbook, and necessary updates to the project's README, ensuring the project is maintainable and the deployment process is well-documented.

### Strengths
*   **Consistency and Convention**: The plan demonstrates strong adherence to project conventions by sourcing the ADR format from a sibling repository and modeling the runbook's style on existing documentation within this project.
*   **Thorough and Accurate Content**: The tasks specify the exact, critical information to be included, such as the accepted security risks (PAT scope, KV consistency) in the ADR and crucial operational details (merge-to-main prerequisite, two-secret-name PAT rotation) in the runbook.
*   **Good Information Architecture**: The plan correctly separates concerns, keeping the README high-level while delegating detailed procedures to the runbook and architectural rationale to the ADR.
*   **Security-Aware**: The threat model correctly identifies the risk of leaking secrets in documentation and specifies mitigation through placeholder usage and existing CI checks.

### Concerns
*   **(LOW)** As the documentation is written before the final deployment, there's a minor risk of drift if the manual steps in plan `08-03` deviate unexpectedly. The plans mitigate this by being very prescriptive, but a final post-deployment doc review is always wise.

### Suggestions
*   Consider adding a final step to the `08-03-PLAN.md` to explicitly have the operator re-read the `docs/runbook.md` as they perform the steps, to catch any discrepancies between the documentation and the live dashboard reality.

### Risk Assessment
*   **LOW**. This is a documentation-only plan. The risk of error is contained and has no impact on production stability. The plan is thorough and ensures all documentation requirements for the phase are met completely and accurately.

---

## `08-03-PLAN.md` — Live deploy, UAT, and tag

### Summary
This plan is an exceptionally detailed and well-sequenced guide for the human-driven deployment, verification, and release of the application. It correctly identifies the critical-path dependency of merging to `main` first and meticulously breaks down the complex series of manual and automated steps required to stand up infrastructure, bind secrets, and perform end-to-end user acceptance testing.

### Strengths
*   **Correct Critical-Path Sequencing**: The plan's greatest strength is forcing the merge to `main` as the very first task. This correctly identifies and mitigates "Pitfall 1" from the research, preventing the entire UAT process from failing. This is a sign of robust, adversarial planning.
*   **Proactive Security Hardening**: The plan introduces a new, critical decision (D-08-07) to keep live secrets out of the ungated preview environment. This closes a security gap not explicitly identified in the initial context and demonstrates proactive risk management.
*   **Clarity in Hybrid Execution**: The plan excels at delineating between human-driven actions (in the Cloudflare/GitHub dashboards) and automatable commands (`wrangler`, `git`, `curl`), providing a clear playbook for the operator.
*   **Comprehensive Live Verification**: The UAT task is exhaustive, referencing the 13-item checklist and adding the crucial preview-build check. It demands the creation of a `08-LIVE-PROOF.md` artifact to record evidence, ensuring auditability and a high bar for success.

### Concerns
*   **(HIGH) Inherent Operational Risk**: The risk here is not from the plan's quality, but from the nature of the task. The plan involves manual configuration of production infrastructure, secrets, and permissions. Human error during these dashboard-driven steps could lead to misconfiguration, security issues, or deployment failure. The plan's detail mitigates this as much as possible, but the risk remains.
*   **(MEDIUM) Complexity**: The process involves many steps across multiple systems (Git, GitHub, Cloudflare, Linear). An operator must execute the plan with care and precision. A failure in one of the UAT steps could require significant debugging.

### Suggestions
*   In Task 2, Step 1, the action should be more explicit that the `wrangler.toml` change (adding the real KV ID) must be committed *and pushed* to `main` before the Cloudflare Pages project is created or redeployed, to ensure the build pipeline uses the correct configuration.

### Risk Assessment
*   **MEDIUM**. While the plan itself is of HIGH quality and significantly de-risks the process, the underlying task of a first-time production deployment is inherently risky. The plan's meticulous detail, correct sequencing, and comprehensive verification checks are the best possible mitigation for this operational complexity. The risk is managed, but not eliminated.

---

## Codex Review

# Review verdict

The plans are thoughtful and cover the intended deliverables, but they are not execution-ready. Overall risk is **HIGH** because four blocking contradictions could produce either an insecure release or a false completion:

- Workers KV cannot provide the claimed “exactly once” guarantee.
- The sequence merges an invalid KV placeholder, then implicitly commits its replacement directly to `main`.
- Cloudflare Pages binding and Access setup do not match current platform mechanics.
- The release gate alternates between “all 13 UAT items pass” and “only load-bearing items pass,” while one UAT expectation contradicts the implementation.

## 08-01 — KV nonce and unit tests

### Summary

The plan is appropriately narrow and preserves the existing recency defense, validation, dispatch body, and error-handling structure. Its fundamental defect is architectural: a KV `get` followed by `put` is not an atomic claim and therefore cannot satisfy the plan’s repeated “exactly one” or “at most one” assertions. The test design also needs correction because separate `ctx()` calls will otherwise receive separate in-memory stores.

### Strengths

- Keeps the change surgical and confined to the apply branch.
- Retains the 15-minute preview recency check as defense-in-depth.
- Writes only an opaque marker to KV, never secret material.
- Claims the nonce before dispatch, which is the correct ordering if the intended property is best-effort at-most-once behavior.
- Includes typecheck, isolated tests, full-suite tests, no-store, and token-leak assertions.
- Uses the existing `textResponse` and single `try/catch` conventions rather than introducing unnecessary abstractions.

### Concerns

- **HIGH — The claimed security property is impossible with Workers KV.** Cloudflare states that KV is eventually consistent, changes may remain invisible in other locations for 60 seconds or more, negative reads are cached, and KV is unsuitable for atomic read/write operations. The plan’s description of this as only a “same-millisecond” race materially understates the exposure. A second request routed elsewhere during the consistency window can pass the same `get(null) → put → dispatch` sequence. [Cloudflare KV consistency documentation](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

- **HIGH — The plan contradicts itself about assurance.** The objective promises “exactly one,” while the threat register accepts that duplicate authorization remains possible. Both cannot be true. See [08-01-PLAN.md](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/.planning/phases/08/08-01-PLAN.md:39).

- **HIGH — The proposed test helper does not clearly preserve state across requests.** Building a Map-backed KV inside the default `ctx()` environment creates a new store for each `ctx()` call. A replay test invoking `ctx()` twice will not see the first request’s marker unless both calls explicitly reuse the same environment/KV instance. The current helper also types `env` as `Record<string, string>`, which cannot contain a KV object. See [dispatch.test.ts](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/functions/api/backfill/dispatch.test.ts:20).

- **MEDIUM — The placeholder is not a valid deployable configuration.** `id = "PLACEHOLDER_FILLED_IN_08-03"` is scheduled to reach `main`. Cloudflare treats the Wrangler file as deployment configuration, so an invalid namespace ID can break or complicate the first Pages deployment. See [08-01-PLAN.md](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/.planning/phases/08/08-01-PLAN.md:89).

- **MEDIUM — Failure semantics after claiming are undocumented.** Because `put()` occurs before GitHub dispatch, a transient dispatch failure permanently burns that preview ID until expiry. That is defensible for at-most-once behavior, but the UI/runbook must say that a new preview is required after an upstream failure.

- **MEDIUM — Important failure tests are absent.** The plan does not explicitly test KV `get()` failure, `put()` failure, dry-run avoiding KV, invalid previews avoiding KV, or `put()` occurring before the dispatch request.

- **LOW — Requirement attribution is misleading.** This plan hardens CR-01 but does not itself connect Pages or configure Access. Marking it as satisfying DEPLOY-01 and DEPLOY-02 overstates its contribution.

### Suggestions

- Make an explicit decision:

  - If “exactly once” is non-negotiable, reopen D-08-06 and use a Durable Object or transactional D1 claim.
  - If KV is non-negotiable, rename the guarantee everywhere to “best-effort sequential replay suppression” and record that duplicates remain possible during the consistency window.

- Use an explicit shared fixture:

  ```ts
  const kv = createFakeKv();
  const env = { GH_BACKFILL_TOKEN: TEST_TOKEN, BACKFILL_NONCE: kv };

  await onRequestPost(ctx(firstBody, env));
  await onRequestPost(ctx(secondBody, env));
  ```

- Assert dispatch calls by URL, not total `fetch` count. A replay still performs the preview-run GET, so two attempts produce three total fetches: two preview GETs and one dispatch POST.

- Add tests for:

  - `get()` failure → 502 and no dispatch.
  - `put()` failure → 502 and no dispatch.
  - Dry-run → no KV access.
  - Invalid preview → no KV access.
  - TTL exactly 900.
  - `put()` invocation before the dispatch POST.
  - Dispatch failure after claim → subsequent reuse rejected, documenting the re-preview requirement.

- Do not merge a placeholder ID. Create the namespace during the human pre-merge gate and commit the real ID through the release PR.

### Risk Assessment

**HIGH.** The implementation is small, but its headline security guarantee is unsupported by the selected storage primitive.

---

## 08-02 — ADR, runbook, and README

### Summary

The documentation split is sensible: ADR for rationale, runbook for operations, and README for discovery. However, the plan would leave contradictory Cloudflare instructions in the repository, omits several deploy-critical settings, and authors the ADR before the later plan invents D-08-07. As written, an operator could follow two different Access and KV-binding procedures.

### Strengths

- Clear ownership between ADR, runbook, and README.
- Correctly documents the dual secret stores and the broader uniform PAT scope.
- Includes rotation, deployment, snapshot refresh, and backfill as required by DEPLOY-03.
- Records rejected alternatives and accepted risks instead of presenting the design as risk-free.
- Avoids copying secret values into tracked files.
- Keeps detailed operational material out of the README.

### Concerns

- **HIGH — The runbook mixes two incompatible KV configuration models.** The plans declare KV in `wrangler.toml` and also instruct the human to attach the same binding in the dashboard. Cloudflare states that when a Pages Wrangler file is used, it is the source of truth and matching fields become non-editable in the dashboard. Pick one mechanism; this project has already picked Wrangler. [Cloudflare Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

- **HIGH — Existing Access documentation directly conflicts with D-08-01.** [docs/access-setup.md](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/docs/access-setup.md:64) says a separate `/api/*` path target is mandatory and omission exposes the proxy. Current Cloudflare documentation says a hostname with an empty path protects the hostname and all paths, including `/api/*`. Leaving this file untouched creates two authoritative but contradictory runbooks. [Cloudflare Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)

- **MEDIUM — D-08-07 is decided too late.** Plan 08-03 introduces production-only secrets after the ADR and runbook are authored, then proposes patching only the ADR at tag time. The runbook and README may still omit the production/preview boundary.

- **MEDIUM — The deploy section is underspecified for a from-scratch project.** It should capture the actual build command, output directory, root directory, production branch, package manager/Node assumptions, GitHub App repository access, and redeploy requirements after secret updates.

- **MEDIUM — GitHub write prerequisites are missing.** The workflows push directly to `main`. The runbook should verify that repository/org Actions policy allows `GITHUB_TOKEN` contents write and that branch rules permit the Actions bot push. Otherwise UAT fails late.

- **MEDIUM — PAT lifecycle guidance is incomplete.** Fine-grained PATs may remain pending until organization approval. Rotation should create and approve the replacement, update both stores, run a dry-run/status/checkout smoke, and only then revoke the old token. [GitHub PAT documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

- **MEDIUM — The backfill section risks becoming a link rather than a runbook.** Referencing `07-HUMAN-UAT.md` is appropriate for release verification, but normal operators still need concise UI steps, expected outcomes, retry behavior, and failure recovery without navigating planning artifacts.

- **LOW — Other documentation will remain stale.** [docs/architecture.md](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/docs/architecture.md:25) still describes the schedule choice as open/optional, and [README.md](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/README.md:35) still calls the product a spec-first scaffold. Plan 08-03 does not actually assign the README status update it promises.

### Suggestions

- Add `docs/access-setup.md` and preferably `docs/architecture.md` to `files_modified`.
- Make `wrangler.toml` the sole KV-binding source of truth; use the dashboard only for encrypted secrets and Access configuration.
- Move D-08-07 into `08-CONTEXT.md` before Wave 1 and cover it consistently in the ADR, runbook, and README.
- Include exact Pages build settings and post-secret redeploy steps.
- Add PAT approval, expiry, two-store rotation ordering, smoke verification, and rollback.
- Add a normal backfill operator procedure separate from the 13-item release UAT.
- Assign the README release-status update explicitly to the final release task.

### Risk Assessment

**MEDIUM-HIGH.** The artifacts are well chosen, but contradictory operational guidance could cause an insecure or failed deployment.

---

## 08-03 — Merge, deploy, live UAT, and tag

### Summary

This is appropriately human-gated and attempts to prove the entire production loop, including previews, Access, writes, concurrency, cron, and tagging. It is nevertheless the least executable plan: its git ordering violates repository policy, its Cloudflare setup is partly wrong, its UAT contains an incorrect expected status, and its release gate can tag while required items remain failed or pending.

### Strengths

- Correctly recognizes that `main` is a hard prerequisite for both `workflow_dispatch` and scheduled workflows. GitHub confirms that manually dispatched workflows must exist on the default branch and scheduled workflows run only there. [GitHub workflow dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [scheduled workflow documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- Makes the live deploy non-autonomous and pauses for irreversible/dashboard actions.
- Tests production and preview deployments separately.
- Keeps live secrets out of intentionally public preview deployments.
- Requires concrete evidence: URLs, status codes, run links, and commit SHAs.
- Correctly keeps the tag behind real Access, apply, and cron proof.
- Retains the live `return_run_details` check even though GitHub now documents the 200 response. [GitHub changelog](https://github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids/)

### Concerns

- **HIGH — The git sequence is internally contradictory.** Task 1 merges a Wrangler placeholder to `main`; Task 2 replaces it and says to “commit it to `main`,” despite Task 1 explicitly prohibiting direct commits to `main`. See [08-03-PLAN.md](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/.planning/phases/08/08-03-PLAN.md:132).

- **HIGH — Current repository state makes the merge preflight incomplete.** The branch is currently 158 commits ahead of and 3 behind `origin/main`, and 148 commits ahead of its remote branch. The plan must synchronize with current `main`, rerun verification, push the actual branch state, and prove local and remote SHAs match before creating the PR.

- **HIGH — KV is configured twice.** The plan says the Wrangler file is authoritative and also tells the human to attach the binding in the dashboard. Under current Pages behavior, those are alternatives, not cumulative steps.

- **HIGH — Pages Access setup depends on the production hostname type.** Protecting `<project>.pages.dev` uses a Pages-specific Access flow; Cloudflare documents editing the generated wildcard application to cover the base Pages hostname. A custom domain uses a normal self-hosted application. The generic “create one self-hosted app” instruction may not secure the actual production hostname. [Cloudflare Pages Access known issue](https://developers.cloudflare.com/pages/platform/known-issues/)

- **HIGH — Access bypass through alternate production hostnames is not tested.** If both a custom domain and `<project>.pages.dev` reach the production deployment, gating only one leaves the other as an origin bypass carrying production secrets. Inventory and test every production hostname.

- **HIGH — UAT item 3 has the wrong expected result.** The deployed implementation returns 400 when `previewRunId` is absent or non-positive, before GitHub verification. It returns 403 only for a positive run ID whose fetched run fails identity/recency checks. See [dispatch.ts](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/functions/api/backfill/dispatch.ts:199) and [08-03-PLAN.md](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/.planning/phases/08/08-03-PLAN.md:176).

- **HIGH — The release gate is inconsistent.** [08-VALIDATION.md](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/.planning/phases/08/08-VALIDATION.md:33) requires every UAT item to pass. Plan 08-03 tags after only the load-bearing items pass and its resume signal also mentions only load-bearing items. This permits tagging while Phase 7’s blocking checklist remains incomplete.

- **HIGH — Proof validation is false-green prone.** `grep -c 'item' >= 13` does not establish that items 1–13 exist, are unique, or are PASS. A prose paragraph could satisfy it.

- **HIGH — The tag target is ambiguous.** A scheduled snapshot may add a commit after the release PR. The plan must fetch and tag the intended current `origin/main`, not whatever stale local `HEAD` happens to reference. ADR/proof edits also need PRs, not post-merge direct edits.

- **MEDIUM — Preview verification proves only HTML delivery.** A root `curl` returning 200 does not prove the React app renders or that `public/roadmap.json` loads. Also, deleting the branch does not necessarily remove the immutable public hash deployment; Pages previews are public by default and hash URLs persist. [Cloudflare preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)

- **MEDIUM — The cron commit criterion may block indefinitely.** A successful scheduled run creates no commit if the snapshot is unchanged. Because D-08-05 explicitly requires a commit, the plan needs a controlled pre-cron Linear change that guarantees a sanitized snapshot delta.

- **MEDIUM — Several UAT items need safer deterministic procedures.** Cancellation should target a dry-run, not an apply; nonce replay needs an exact authenticated request procedure; and “token absent across every live status including 500” is not safely inducible on a correctly configured production deployment.

- **MEDIUM — Access evidence is too weak.** A 302 should be verified as an Access redirect through its `Location` target, not accepted as any arbitrary application redirect. Authenticated checks should also prove the Functions are reachable with their expected semantic statuses.

### Suggestions

Reorder the plan:

1. Resolve the KV guarantee and D-08-07 in context.
2. Create the KV namespace before merge; replace the placeholder on the feature branch.
3. Update ADR/runbook/Access docs on that branch.
4. Merge/rebase current `origin/main`, run tests, typecheck, build, and `actionlint`.
5. Push the feature branch and verify remote SHA equality.
6. Merge one complete PR containing the real KV ID.
7. Create Pages using Wrangler as the binding source of truth; bind only encrypted production secrets separately.
8. Configure Access according to whether the production URL is `pages.dev` or a custom domain, then test every reachable production hostname.
9. Prove preview root, `roadmap.json`, and actual browser rendering.
10. Require all 13 UAT rows to be `PASS`, with explicit per-item IDs and evidence, before release.
11. Commit final code/docs through a PR, fetch `origin/main`, verify a clean synchronized checkout, then tag that exact SHA.
12. If the proof file must record the pushed tag, add a small post-release evidence commit rather than moving the tag.

For UAT item 3, require:

- Missing/non-positive `previewRunId` → 400.
- Positive but wrong-project/non-preview run → 403.
- Valid preview first use → accepted.
- Same preview reuse → 403, while explicitly acknowledging this proves only the observed sequential case, not atomic global exclusion.

### Risk Assessment

**HIGH.** The intended gate is strong, but the current ordering and acceptance tests can either block for the wrong reasons or release without satisfying the declared completion contract.

# Overall Risk Assessment

**HIGH.** The phase goals are covered conceptually, but the plans should not be executed until these minimum corrections are made:

1. Reconcile KV with the “exactly once” claim.
2. Eliminate the placeholder-on-`main` sequence.
3. Use one authoritative KV configuration mechanism.
4. Correct and consolidate Access documentation and hostname coverage.
5. Fix UAT item 3 and require all 13 items to pass.
6. Define a PR-safe, SHA-explicit release/tag sequence.

After those revisions, the phase should fall to **MEDIUM operational risk**, driven mainly by external dashboard configuration and live cron timing rather than plan defects.

---

## OpenCode Review


---

# Phase 8 Plan Review — Cross-AI Adversarial Review

## Verification performed against the live repo
- Confirmed `origin/main` is missing `functions/api/backfill/*`, `backfill.yml`, and the KV-ready `wrangler.toml` (158 commits behind HEAD) — Pitfall 1 is real and load-bearing.
- Confirmed `dispatch.ts:19-21` `Env` interface has only `GH_BACKFILL_TOKEN` and the `TODO(phase-8)` block lives at `dispatch.ts:97-100`, exactly as 08-01's insertion-point spec claims.
- Confirmed `dispatch.test.ts`'s `ctx(body, env)` is a 2-arg helper with a default-env literal — 08-01's "option (a) to avoid touching ~30 call sites" is well-grounded.
- Confirmed `07-HUMAN-UAT.md` item #7 (rollback) and #12 (job-logs prefix) exist as 08-03 claims; item #13 is the CR-01 nonce.

---

## Overall Summary

The three-plan structure is coherent and the dependency ordering (08-01 + 08-02 in Wave 1 → 08-03 in Wave 2) is correct. The most important insight — research's Pitfall 1, that `origin/main` lacks all the Phase-7 write-path code, so nothing in live verification works until the branch merges — is correctly seized on and made the blocking first task of 08-03. The KV consume-once nonce is scoped to a genuinely small additive change (~10 lines in `dispatch.ts`) with honest acknowledgement of the TOCTOU race. **However, there is one serious scope contradiction (D-08-07), a latent timezone pitfall the plans introduce themselves, a pair of acceptance criteria that silently pass on a half-written ADR, and a token-leak gap in the preview build verification.** The plans are close to shippable but need four corrections first.

---

## Strengths

- **Pitfall 1 is treated as a hard ordering dependency, not a footnote.** 08-03 Task 1 (merge to `main` before any live verification) is correctly `gate="blocking"` and its acceptance criteria verify `origin/main` actually contains `dispatch.ts`, `backfill.yml`, and the KV-ready `wrangler.toml` via `git ls-tree`/`git show`. Good.
- **The nonce design is honest about its limits.** Both 08-01's threat model (T-08-03 "accept" with rationale) and 08-02's ADR acceptance criteria requiring `grep -qi 'eventual'` explicitly document that KV is eventual-consistency without compare-and-swap. This is the right disposition for a single-trusted-user threat model and prevents a future reviewer from over-trusting the nonce.
- **Surgical Changes discipline on `dispatch.ts` is explicit and enforced.** 08-01's `<action>` names exactly what NOT to touch (rate limiter, allow-list guards, dispatch POST body) and the acceptance criteria grep for `MAX_PREVIEW_AGE_MS = 15 * 60 * 1000` to prove the recency bound is preserved. Good defense against the temptation to "harden" adjacent code.
- **Test plan extends existing mocks rather than rewriting.** 08-01 Task 2 chose PATTERNS.md option (a) — keep `ctx`'s 2-arg shape, add the KV mock into the default env — explicitly to avoid touching ~30 existing call sites. This respects the repo's `ctx` convention rather than imposing a new shape.
- **08-02's docs are correctly deferred-details, not duplicated.** README gets a `## Deploy` pointer to the runbook; the runbook references `07-HUMAN-UAT.md` by name rather than duplicating the 13-item checklist. Good.
- **Two-secret-name PAT pattern is explicitly documented.** `GH_BACKFILL_TOKEN` (Pages) vs `GH_CROSS_REPO_TOKEN` (Actions) — the same token value under two names, in two independent secret stores. This is non-obvious and easy to get wrong; surfacing it in the runbook is valuable.
- **TDD discipline on the nonce test.** 08-01 Task 2 is `tdd="true"`, Test 1 asserts the dispatch `fetch` is called exactly once across two apply attempts (proving short-circuit, not just the 403 status), and Test 3 separately verifies the 403 body never matches the token regex. These are real behavioral assertions, not presence checks.

---

## Concerns

### HIGH

**C1. [HIGH] D-08-07 introduces new scope mid-phase that is neither in CONTEXT.md nor in any prior decision record, and it contradicts the validation architecture as written.** 08-03 Task 2's `<action>` declares "Decision (D-08-07, made here — DEPLOY-01 'production + preview builds')" that Preview builds carry NO live secrets and live secrets are Production-only. But:
- CONTEXT.md's locked decisions are D-08-01 through D-08-06; **D-08-07 does not exist in CONTEXT.md.** A plan is not authorized to mint a new "D-08-07" during execution — CONTEXT.md is the decision record the discuss phase signed off on.
- RESEARCH's Validation Architecture explicitly lists DEPLOY-01's test as a single `curl` smoke on one domain, implying production-only; RESEARCH Pattern 2 / Assumption A1 explicitly says a single top-level `[[kv_namespaces]]` block "applies to both Production and Preview Pages deployments" — which **contradicts** D-08-07's "Preview carries no live secrets" because the KV binding is platform-level, not secret-selectable by environment in `wrangler.toml` (preview vs prod secret scoping is a dashboard-side setting, but the KV **binding** is not).
- 08-03 Task 3 then asks the human to "add a one-line note to the ADR if it is not already captured" for D-08-07 — i.e., the ADR authored in 08-02 (parallel wave) cannot have recorded D-08-07 because D-08-07 didn't exist yet. The ADR will ship stale or be patched post-hoc.

This is a scope expansion invented during planning, not a settled decision. **Either delete D-08-07 and rely on RESEARCH's already-confirmed single-binding-applies-to-both with a *preview env has no secrets* note (the simpler path that fits CLAUDE.md Simplicity First), or push it back through a discuss/context amendment and re-record CONTEXT.md first.** Don't let a plan silently mint a decision.

**C2. [HIGH] The DEPLOY-01 "preview build" acceptance criterion is weaker than the truth it claims and creates a known token-leak window.** 08-03 Task 2's preview-build check verifies only `curl -sS -o /dev/null -w "%{http_code}\n" https://<hash>.agenticapps-roadmap.pages.dev/` returns **200** for the static app. But:
- The plan itself says Preview URLs are ungated by Access (D-08-02) and `/api/*` on the preview URL is "expected to fail/500 (no LINEAR_API_KEY/PAT) — that is intended per D-08-07."
- A 500 on `/api/backfill/*` at an unauthenticated public URL is **not a benign failure** — it means the Function executes at an unauthenticated URL. Whether it leaks the raw error, the token, or the upstream GitHub error needs to be *verified*, not assumed. The 08-03 verification skips this entirely (only records the root `/` 200).
- The threat model row T-08-09 claims mitigation via D-08-07 ("Secrets live only in Production") — but D-08-07 is the contested decision (C1), and even granting it, the threat model doesn't enumerate what happens when the Function code runs without its secrets bound at the edge of an ungated domain.

**Specific gap:** the preview-build verification should at minimum `curl` `/api/backfill/dispatch` and `/api/linear/snapshot` on the preview URL and record the behavior — either the route 500s cleanly without leaking the GitHub/Linear upstream body, or it leaks something. As written, "200 on the static app" proves nothing about the write-path's safety on an ungated domain.

**C3. [HIGH — correctness, not just doc] The cron-recognition caveat (Pitfall 3) is documented but the plan's success criterion can be satisfied without actually observing a fired cron.** D-08-05 (CONTEXT.md) and 08-03 Task 3 acceptance criteria both say "a real scheduled snapshot.yml cron run URL + timestamp recorded (may be a later day)." But 08-03 `<success_criteria>` says *"...a real preview→apply backfill and a real scheduled cron fire both succeed, and v0.1.0 is tagged..."* — and the acceptance criteria allow v0.1.0 to be tagged once the *other* load-bearing items pass. There's no language preventing "we'll come back tomorrow for the cron" from becoming "we tagged v0.1.0 today without the cron, intending to verify later." 

**Specific gap:** the v0.1.0 tag act in Task 3 should be **gated to require a recorded observable scheduled cron run before tagging** — or, if same-day proof is needed, the plan should explicitly require `workflow_dispatch`-proof of mechanism today + a recorded scheduled run as a *post-tag verification*, with thelive gate being "mechanism proven by `workflow_dispatch` + schedule configured on main." As written, the plan could tag v0.1.0 with LIVE-03's "real scheduled fire" pending, satisfying neither DEPLOY's "snapshot auto-refreshes" success criterion nor D-08-05.

---

### MEDIUM

**C4. [MEDIUM] 08-02's ADR acceptance criteria are too weak — a grep for 5 H2 sections passes on any five-section file.** 08-02 Task 1 verifies:
- `grep -c '^## ' docs/decisions/...` returns ≥ 5
- `grep -qi 'eventual'` and `grep -qi 'all 4'`

But these don't verify the five sections are the *right* ones (Context/Decision/Alternatives Rejected/Consequences/References). A half-written ADR with `## Context`, `## Decision`, `## Notes`, `## TODO`, `## Scratch` passes the count check. The PAT-scope grep `all 4` is similarly weak — the ADR could say "we explicitly chose NOT to grant all 4" and still match `all 4`.

**Specific gap:** each H2 title should be grep-checked individually: `grep -q '^## Context'`, `grep -q '^## Decision'`, `grep -q '^## Alternatives Rejected'`, `grep -q '^## Consequences'`, `grep -q '^## References'`.

**C5. [MEDIUM] 08-01's acceptance criteria grep namespace ID presence in dispatch.ts but not in wrangler.toml's binding block, and the placeholder-vs-real-id question is split across plans without a glue mechanism.** 08-01 Task 1 leaves `id = "PLACEHOLDER_FILLED_IN_08-03"` in `wrangler.toml`, with a comment. 08-03 Task 2 step 1 says "paste the printed id into wrangler.toml's `[[kv_namespaces]]` block (replacing the 08-01 placeholder) and commit it to main." But:
- 08-01's acceptance criteria grep for `BACKFILL_NONCE` in `wrangler.toml` — which passes for the placeholder, so 08-01 commits a placeholder binding.
- 08-03 Task 2's acceptance criteria check `npx --yes wrangler@4 kv namespace list` includes `BACKFILL_NONCE` and `grep -q 'id = ' wrangler.toml` shows "a real id (not the placeholder)" — but it doesn't define what distinguishes "real" from "placeholder" syntactically. A reviewer can't verify "a real id (not the placeholder)" without eyeballing it.

**Specific gap:** the placeholder should be syntactically identifiable, e.g., `id = "PLACEHOLDER"` so 08-03's gate can be `grep -q '^id = "PLACEHOLDER"' wrangler.toml && exit 1 || true` — a real id never equals the literal string `PLACEHOLDER`. Cleaner than "looks real."

**C6. [MEDIUM] The merge-to-main task (08-03 Task 1) doesn't verify that 08-01 and 08-02's *commits* are the ones being merged — opening a window for "merge main but without the KV nonce."** Task 1's acceptance criteria verify `dispatch.ts`, `backfill.yml`, and `BACKFILL_NONCE` in `wrangler.toml` exist on `origin/main` — good. But it doesn't verify `dispatch.ts`'s nonce *logic* is present on main (only that the file exists). If the Wave 1 commits somehow get dropped during merge (rebases, conflicts), the file exists but the nonce block is missing, and 08-03 Task 3 item #13 would fail against live KV with no obvious cause.

**Specific gap:** add a grep gate: `git show origin/main:functions/api/backfill/dispatch.ts | grep -q 'NONCE_TTL_SECONDS'` to verify the actual nonce landed on main, not just the file.

**C7. [MEDIUM] 08-03 Task 2 step 5 ("push a throwaway commit to a non-main branch") creates a preview deployment, but doesn't clean up the Preview environment's KV binding or state afterward — and doesn't address whether the preview deployment inherits the Production KV namespace ID.** If a Preview `*.pages.dev` deployment binds the same KV namespace as Production (per RESEARCH Assumption A1), then any apply calls against the preview URL write nonce-consumed markers to the Production KV namespace — polluting production state. The plan's preview verification only curls `/`, but the Function code is deployed and present; a future test against the preview URL's `/api/backfill/*` would be writing to the live KV namespace.

**Specific gap:** explicitly state "Preview deployments inherit the Production KV namespace per Assumption A1 — do NOT exercise `/api/backfill/*` on the preview URL; its KV writes would land in Production KV." Document the cross-contamination risk in the runbook, or create a `--preview` KV namespace as part of Task 2.

**C8. [MEDIUM] No acceptance criterion verifies that DEPLOY-03's README + `docs/runbook.md` actually cover *all four* DEPLOY-03 areas.** 08-02 Task 2 (runbook) grep checks `rotation`, `GH_CROSS_REPO_TOKEN`, `BACKFILL_NONCE`, `07-HUMAN-UAT`, `http_code`, and `default branch`. 08-02 Task 3 (README) checks for the three binding names + the runbook pointer. But DEPLOY-03 explicitly requires coverage of **deploy, token rotation, snapshot refresh, and backfill** — four areas. The runbook acceptance criteria grep for "rotation" (one area), but don't grep for "refresh" or "snapshot" or "backfill." A runbook that covers rotation thoroughly but omits snapshot refresh would pass.

**Specific gap:** add `grep -qi 'snapshot' docs/runbook.md` and `grep -qi 'backfill' docs/runbook.md` and `grep -qi 'deploy' docs/runbook.md` — one per required area.

---

### LOW

**C9. [LOW] Potential priv الشرق conflict: `gh secret list` currently shows only `LINEAR_API_KEY`, and 08-02's runbook says to set `GH_CROSS_REPO_TOKEN` — but 08-03 Task 2 doesn't verify `GH_CROSS_REPO_TOKEN` exists in `gh secret list` via an automated gate.** Task 2 acceptance criteria say "HUMAN: `gh secret list` shows both" — this is marked HUMAN, so no automation, but the verify block of the task could include `gh secret list | grep -q GH_CROSS_REPO_TOKEN` as a machine-checkable confirmation.

**C10. [LOW] "Test 3: the 403-consumed response body never matches TOKEN_REGEX" in 08-01 Task 2 is good, but doesn't verify the *KV namespace value* never contains a token.** The threat model T-08-02 mitigates "secret value written into the KV namespace" by noting "the KV value is the opaque marker '1' only." But there's no test asserting the test's KV mock saw `"1"` (or any non-token string) rather than, say, accidentally `previewRunId` as a string. A test asserting `expect(kv.put).toHaveBeenCalledWith(\`previewRunId:${id}\`, "1", ...)` would nail down that the marker is `"1"`, not "a marker of some kind." Minor hardening for an invariant already in the threat model.

**C11. [LOW] 08-01 Task 1 uses `id = "PLACEHOLDER_FILLED_IN_08-03"` — a 28-character string that doesn't look like a real Cloudflare namespace id (32-hex), but a regex-based reviewer can't distinguish.** Same root cause as C5; resolved together.

**C12. [LOW] The `<resume-signal>` strings in 08-03 are human-prompted triggers (`"merged"`, `"bound"`, `"shipped"`) but Task 3 says "If a live item FAILS, report which item + the observed behavior instead." — there's no `"failed"` resume-signal defined.** An executor who hits a failure has no documented escape hatch other than prose. Add `<resume-signal>"failed at item N — describe the failure"</resume-signal>` semantics or a "do not tag v0.1.0 on any load-bearing FAIL" note.

---

## Suggestions

- **Resolve C1 first.** Either (a) **drop D-08-07 entirely** — RESEARCH already establishes the single KV binding applies to both prod + preview, and the "Preview has no secrets" rule is a dashboard-side choice that doesn't need a numbered decision — or (b) **amend CONTEXT.md with D-08-07 via a quick discuss amendment** before plans execute. Option (a) is simpler and matches CLAUDE.md Simplicity First.
- **Split the preview-build verification (C2).*: record the preview URL's behavior on `/`, `/api/linear/snapshot`, AND `/api/backfill/dispatch` explicitly — even if each is expected to error. The point is to *prove* the erroring path doesn't leak. Add: "`curl -sS` the body of `/api/backfill/*` on the preview URL; assert the body contains no `ghp_`/`github_pat_`/`lin_api_` pattern (same grep as the CI secret gate)."
- **Gate the v0.1.0 tag more strictly (C3).** Either (a) require a recorded scheduled cron fire *before* tagging, with a documented "if next-day wait is needed, the tag waits too" rule, or (b) redefine the success criterion as "snapshot-refresh mechanism proven by `workflow_dispatch` + schedule configured on `main` (LIVE-03 mechanism-verified)" and split "real scheduled fire proofs" into a post-tag verification log. Don't leave it ambiguous.
- **Add per-H2-title ADR grep checks (C4)** — five `grep -q '^## <Title>'` lines, plus a per-DEPLOY-03-area grep check for the runbook (C8).
- **Use a recognizable placeholder id string (C5, C11)** — `id = "PLACEHOLDER"` so the real-vs-placeholder test is syntactic.
- **Add a nonce-on-main grep gate (C6)**: `git show origin/main:functions/api/backfill/dispatch.ts | grep -q 'NONCE_TTL_SECONDS'`.
- **Add a KV-cross-contamination warning (C7)** to the runbook and to 08-03 Task 2 step 5.
- **Add `gh secret list | grep -q GH_CROSS_REPO_TOKEN` (C9)** to Task 2's `<how-to-verify>` block.
- **Tighten T-08-02 mitigation with a value-assertion test** that `kv.put` is called with `"1"`.

---

## Risk Assessment

**Overall risk: MEDIUM-HIGH** (bordering on HIGH if C1/C2/C3 aren't addressed).

**Justification:**
- The structural and sequencing design is **sound** — Wave 1/Wave 2 ordering is correct, the merge-to-main hard prerequisite is well-handled, the nonce's limits are honestly documented, and surgical-changes discipline is explicit.
- **However, the trio of HIGH concerns cluster around a single failure mode: the plans invent scope (D-08-07) mid-execution to handle a real edge case (preview build secret exposure), but do so without amending the decision record, without verifying the preview build doesn't leak at its `/api/*` routes, and without preventing the v0.1.0 tag from landing before the scheduled-cron proof.** These three together could yield a v0.1.0 tag that ships with (a) a decision not authorized by discuss, (b) an unverified-yet-public preview endpoint running the write-path code, and (c) a LIVE-03 item "pending" that the success criteria claimed was delivered.
- The MEDIUM concerns (C4–C8) are collectively a pattern: **acceptance criteria favor cheap greps over semantic checks**, so a half-written ADR or a coverage-gapped runbook can pass. Fixable in planning, expensive to find in review.
- The LOW concerns are hardening, not blockers.

**Recommended disposition:** Address C1, C2, C3 before execution begins (small plan edits, no re-architecture); address C4–C8 in the same planning pass; C9–C12 can be patched during execution.

---

## Consensus Summary

Three independent reviewers assessed the Phase 8 plans. **Codex** and **OpenCode**
both verified claims against the live codebase and cite platform docs; **Gemini**
reviewed the plans on their own terms without codebase verification. This matters:
Gemini rated the plans exemplary/LOW–MEDIUM, while the two codebase-verifying
reviewers independently converged on **MEDIUM-HIGH / HIGH** with overlapping,
concrete defects. Weight the code-verified findings accordingly.

**Overall risk (reviewer verdicts):** Gemini LOW–MEDIUM · OpenCode MEDIUM-HIGH
(HIGH if C1–C3 unaddressed) · Codex HIGH. The plans are structurally sound but
**not execution-ready as written.**

### Agreed Strengths (2+ reviewers)

- **Merge-to-main is correctly treated as a hard, first, blocking prerequisite**
  (all three) — the load-bearing RESEARCH Pitfall 1 (origin/main lacks the Phase-7
  write path; cron/dispatch only fire on the default branch) is seized on, not buried.
- **The KV nonce is scoped as a small, surgical, additive change** with explicit
  "do not touch adjacent code" discipline (Gemini, OpenCode).
- **The nonce test uses TDD with real behavioral assertions** and extends the
  existing ctx() mock rather than rewriting ~30 call sites (Gemini, OpenCode).
- **Docs are correctly layered** (README pointer -> runbook -> ADR), with the dual
  secret-store PAT pattern surfaced (Gemini, OpenCode, Codex).
- **Live deploy is human-gated with concrete evidence requirements** (URLs, status
  codes, SHAs, run links) recorded in 08-LIVE-PROOF.md (Gemini, Codex).

### Agreed Concerns (2+ reviewers — highest priority)

1. **[HIGH] D-08-07 is minted mid-phase and not in CONTEXT.md; docs are authored
   before it exists** (OpenCode C1, Codex 08-02). A plan should not silently create a
   numbered decision the discuss phase never signed off on. The ADR/runbook (Wave 1)
   are written before D-08-07 (decided in Wave 2 / 08-03), so they ship stale or get
   patched post-hoc. Fix: either drop D-08-07 and rely on RESEARCH's already-
   established "single KV binding applies to both envs; preview simply has no secrets
   bound" (simpler, matches CLAUDE.md Simplicity First), or amend 08-CONTEXT.md with
   D-08-07 before Wave 1 executes.

2. **[HIGH] The preview-build verification is too weak and ignores an ungated
   write-path endpoint** (OpenCode C2, Codex 08-03 MEDIUM). curl / -> 200 proves only
   that static HTML is served; it does not prove the React app renders, that
   roadmap.json loads, or — critically — that /api/backfill/* and /api/linear/*
   running at an ungated public *.pages.dev URL don't leak upstream errors/tokens.
   Fix: curl the /api/* routes on the preview URL and assert the body contains no
   ghp_/github_pat_/lin_api_ pattern (reuse the CI secret-gate grep); verify real
   render, not just a 200.

3. **[HIGH] The v0.1.0 release gate is internally inconsistent** (OpenCode C3, Codex
   08-03 HIGH). 08-VALIDATION.md requires all 13 UAT items to pass; 08-03 tags after
   only the load-bearing items, and the resume signal mentions only load-bearing
   items — permitting a v0.1.0 tag while Phase-7's checklist is incomplete or the real
   scheduled-cron fire is still "pending." Fix: make the gate single-valued — require
   all 13 rows PASS (with a recorded scheduled-cron run) before tagging, or explicitly
   redefine the snapshot-refresh criterion and split real-cron proof into a documented
   post-tag verification. Do not leave it ambiguous.

4. **[HIGH] Acceptance criteria favor cheap greps that pass false-green** (OpenCode
   C4/C8, Codex 08-03). grep -c '^## ' >= 5 passes on any five H2s; grep -c 'item'
   >= 13 passes on prose; the runbook greps "rotation" but not the other three
   required DEPLOY-03 areas (deploy/snapshot-refresh/backfill). Fix: per-title ADR
   greps (^## Context, ^## Decision, ^## Alternatives Rejected, ^## Consequences,
   ^## References); one grep per DEPLOY-03 area; per-item UAT PASS assertions.

5. **[HIGH/MEDIUM] A placeholder KV namespace id is committed to main** (OpenCode
   C5/C11, Codex 08-01/08-03, Gemini suggestion). Wrangler treats wrangler.toml as
   deployment config, so id = "PLACEHOLDER_FILLED_IN_08-03" on main can break the
   first Pages deploy. Fix: create the KV namespace before merge and land the real id
   through the release PR; if a placeholder is unavoidable, make it syntactically
   detectable (id = "PLACEHOLDER") so a gate can reject it.

6. **[HIGH/varies] The KV nonce guarantee is overclaimed** (Codex HIGH; OpenCode notes
   the limit but disposes it "accepted"; Gemini says the threat model correctly accepts
   residual risk). Workers KV is eventually consistent (up to ~60s, negative reads
   cached) — a get(null)->put->dispatch sequence is NOT atomic, so "exactly one" /
   "at most one" is not literally achievable. Fix (Codex): rename the property
   everywhere to "best-effort sequential replay suppression" and record that duplicates
   remain possible during the consistency window — OR, if exactly-once is truly
   required, reopen D-08-06 for a Durable Object / D1 transactional claim (heavier;
   likely overkill for a single-trusted-user app).

### Codex-unique findings worth acting on (code-verified, single-reviewer)

- **[HIGH] The nonce test as specified won't actually test replay.** A Map-backed KV
  built inside the default ctx() env gives each ctx() call its own store, so a
  two-request replay test sees no shared marker; also env is typed
  Record<string,string> which cannot hold a KV object. Use one shared env/KV instance
  across both onRequestPost calls, and assert dispatch by URL (a replay still does the
  preview-GET -> 3 total fetches, 1 dispatch POST), not by total fetch count.
- **[HIGH] UAT item 3's expected status is wrong.** dispatch.ts returns 400 for a
  missing/non-positive previewRunId (before any GitHub check) and 403 only for a
  positive id whose fetched run fails identity/recency. The plan's flat "no/invalid
  previewRunId -> 403" will fail against real behavior. Split into 400 vs 403 cases.
- **[HIGH] The git sequence contradicts itself.** 08-03 Task 1 forbids direct commits
  to main; Task 2 says "commit [the real KV id] to main." Route the real id through a
  PR. Also: the branch is currently ~3 commits behind origin/main — sync/rebase, re-run
  tests+typecheck+build+actionlint, push, and verify local==remote SHA before the PR.
- **[HIGH] KV is configured twice** (wrangler.toml and dashboard-attach). With a Pages
  Wrangler file, it is the source of truth and the dashboard fields become non-editable —
  pick one (this project has picked Wrangler); use the dashboard only for encrypted
  secrets + Access.
- **[HIGH] Access setup is hostname-type-dependent and alternate hostnames aren't
  tested.** Securing <project>.pages.dev uses the Pages-specific wildcard-app flow; a
  custom domain uses a normal self-hosted app. If both hostnames reach production,
  gating only one leaves the other as a secret-carrying origin bypass. Inventory and
  gate every reachable production hostname; verify a 302 by its Access Location header,
  not any redirect.
- **[HIGH] docs/access-setup.md (untouched) contradicts D-08-01.** It says a separate
  /api/* path target is mandatory; current Cloudflare docs say an empty-path hostname
  app protects all paths including /api/*. Add it (and likely docs/architecture.md,
  still describing the schedule as "optional") to files_modified so the repo doesn't
  ship two contradictory runbooks.
- **[MEDIUM] The cron-commit criterion can block forever** — a scheduled run makes no
  commit if the snapshot is unchanged, yet D-08-05 requires a commit. Stage a controlled
  Linear delta before the observed run.

### Divergent Views (worth investigating)

- **08-01 quality:** Gemini calls it "exemplary — none" and LOW risk; Codex finds a
  HIGH test-helper correctness bug and an overclaimed guarantee; OpenCode lands in
  between. The divergence tracks whether the reviewer executed against the codebase —
  Gemini did not. Treat the code-verified findings (shared-env test bug, 400-vs-403) as
  the reliable signal.
- **KV nonce disposition:** OpenCode accepts KV's residual race as fine for a single-
  trusted-user threat model; Codex insists the language "exactly once" must change
  regardless. These are compatible — keep KV, fix the wording and the test.
- **Overall risk:** Gemini LOW–MEDIUM vs Codex HIGH is the widest gap; the two
  code-verifying reviewers cluster at the higher end.

### Recommended disposition

Address the six agreed concerns plus the Codex-unique HIGH items (test-helper,
UAT-item-3, git/PR sequence, single KV config source, Access hostname coverage,
access-setup.md contradiction) before execution — these are plan edits, not
re-architecture. The cleanest path is a single --reviews replanning pass:
/gsd-plan-phase 8 --reviews
