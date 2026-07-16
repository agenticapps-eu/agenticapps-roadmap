---
status: pending
phase: 07-live-refresh-write-back
source: [07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md, 07-04-PLAN.md, 07-05-PLAN.md, 07-06-PLAN.md, 07-REVIEWS.md]
severity: blocking (Phase-8 completion gate for LIVE-02/LIVE-03)
started: 2026-07-16
updated: 2026-07-16
---

## Current Test

Consolidated Phase-8 live-verification checklist for LIVE-01..03. Nothing in this
document has been executed — every item below is BLOCKED-until-Phase-8 (secrets
unbound in this environment). This file supersedes ad hoc deferred-item notes
scattered across `07-01-SUMMARY.md`..`07-06-SUMMARY.md` and `STATE.md`'s Pending
Todos section (Phase 07 entries only; the Phase 03/06 blocking items remain in
their own files/STATE.md, unchanged by this plan).

## STATUS: LIVE-02 and LIVE-03 are OPERATIONALLY PENDING

- **LIVE-02** (UI-triggered per-project backfill, optimistic UI + rollback):
  code paths are built and unit-tested this phase (`functions/api/backfill/dispatch.ts`,
  `functions/api/backfill/status.ts`, `src/lib/backfill/backfill.ts`,
  `src/lib/backfill/useBackfill.ts`, `src/components/overview/ProjectDrillDownDialog.tsx`,
  `.github/workflows/backfill.yml`) — but **not verified complete**. No real GitHub
  `workflow_dispatch` has ever been triggered from this code; no real Linear write has
  occurred through this path; no real `roadmap.json`/`linear-map.json` commit from a CI
  apply run has been observed. 07-05 does **not** mark LIVE-02 complete.
- **LIVE-03** (scheduled snapshot refresh): `snapshot.yml`'s mechanism is verified
  structurally in Task 1 above (confirmed present, race-serialized with `backfill.yml`)
  — but no real scheduled cron run has ever fired successfully in this environment
  (`LINEAR_API_KEY` is unset per `STATE.md`'s Pending Todos, so the daily job would
  currently fail at the "Fetch Linear snapshot" step). 07-05 does **not** mark LIVE-03
  complete; it is re-confirmed as MECHANISM-PRESENT, not LIVE-PROVEN.
- Both requirements remain open in `.planning/REQUIREMENTS.md`'s traceability table
  until every item below is executed and recorded with a PASS result.

---

## Task 1 — Workflow structural verification (LIVE-03 mechanism re-confirmation)

### snapshot.yml claims (D-07-08)

| Claim | Verified | Evidence |
|---|---|---|
| Daily cron `0 6 * * *` (06:00 UTC) | YES | `.github/workflows/snapshot.yml:7` — `cron: "0 6 * * *"` under `schedule:` |
| Manual `workflow_dispatch` trigger | YES | `.github/workflows/snapshot.yml:4` — `workflow_dispatch:` (no inputs) |
| Commits `public/roadmap.json` only when it changes | YES | `.github/workflows/snapshot.yml:39-46` — `git diff --quiet public/roadmap.json && echo "No changes" && exit 0` guard before `git add`/`commit`/`push` |
| Shared `roadmap-git-writer` concurrency group (07-06 race fix) | YES | `.github/workflows/snapshot.yml:9-11` — `concurrency: { group: roadmap-git-writer, cancel-in-progress: false }` — matches `backfill.yml:24-26` exactly, confirming the two workflows now serialize on one queue |

**Result: all four D-07-08 claims confirmed present. LIVE-03's mechanism is
re-verified, now race-serialized with `backfill.yml` per 07-06.**

### backfill.yml claims (beyond naive substring matching)

Targeted structural assertions (not a full YAML-AST parse — `actionlint` is the
recommended Phase-8 validator for that, see below):

| Assertion | Verified | Evidence |
|---|---|---|
| `if: ${{ inputs.mode == 'dry-run' }}` branch present (dry-run leg) | YES | `.github/workflows/backfill.yml:87` (`Run dry-run preview` step) and `:102` (`Emit typed diff marker` step) both gated `if: ${{ inputs.mode == 'dry-run' }}` |
| `if: ${{ inputs.mode == 'apply' }}` branch present (apply leg) | YES | `.github/workflows/backfill.yml:126` (`Run apply`), `:133` (`Rebuild snapshot`), `:140` (`Commit roadmap.json and linear-map.json`) all gated `if: ${{ inputs.mode == 'apply' }}` |
| `working-directory: agenticapps-roadmap` on git/pnpm steps | YES | Present on `Install dependencies` (:80), `Run dry-run preview` (:88), `Emit typed diff marker` (:103), `Run apply` (:127), `Rebuild snapshot` (:134), `Commit roadmap.json and linear-map.json` (:141) — every step that runs `pnpm`/`git` inside the checked-out subdirectory |
| `cache-dependency-path: agenticapps-roadmap/pnpm-lock.yaml` on setup-node | YES | `.github/workflows/backfill.yml:77` |
| `env:`-var project/mode passing, no `${{ inputs.* }}` inside any `run:` body | YES | `PROJECT_KEY`/`MODE` set at job level (`:34-36`) via `env:`; every `run:` step references `"$PROJECT_KEY"` (`:92`, `:130`, `:147`) — no `${{ inputs.project }}` or `${{ inputs.mode }}` literal appears inside a `run:` command block (confirmed by direct read of every `run:` step body) |
| Shared `roadmap-git-writer` concurrency group | YES | `.github/workflows/backfill.yml:24-26` |

**Automated check (from 07-05-PLAN.md Task 1's `<verify>`) confirms all of the above
programmatically — exit 0, see Self-Check section in the plan's SUMMARY for the run
output.**

**Result: `backfill.yml` is structurally verified beyond substring matching —
both `if:` branches, every `working-directory`, the `cache-dependency-path`, the
env-var-only input passing (no unsafe `run:`-interpolation), and the shared
concurrency group are all present. Neither workflow file was modified by this task.**

### Recommended Phase-8 validator

`actionlint` (https://github.com/rhysd/actionlint) is recommended as the human-run
validator for full YAML-AST-level correctness (valid GitHub Actions expression syntax,
job/step schema conformance, shellcheck integration for `run:` blocks) — this task's
verification is targeted substring/structural assertions, not a full parse. Run:
```
actionlint .github/workflows/snapshot.yml .github/workflows/backfill.yml
```
as a Phase-8 pre-flight step before the first live dispatch.

### Runtime prerequisite

LIVE-03's **only** remaining runtime prerequisite is the Phase-8 `LINEAR_API_KEY`
binding (R-1) — already tracked as an open item since Phase 2 (`STATE.md` Pending
Todos: *"`LINEAR_API_KEY` repo secret still unset → daily CI snapshot Action fails
until set"*). No new secret is introduced by this task.

---

## Task 2 — Phase-8 HUMAN-UAT checklist (LIVE-01..03 live-verification items)

### Secrets to bind (Phase-8 prerequisite — none bound by this plan)

| Secret | Where | Used by |
|---|---|---|
| `GH_BACKFILL_TOKEN` | Cloudflare Pages Function binding | `functions/api/backfill/dispatch.ts`, `functions/api/backfill/status.ts` |
| `GH_CROSS_REPO_TOKEN` | GitHub repo secret (Settings → Secrets → Actions) | `.github/workflows/backfill.yml` sibling-repo `actions/checkout` steps |
| `LINEAR_API_KEY` | GitHub repo secret (already tracked since Phase 2) | `.github/workflows/snapshot.yml`, `.github/workflows/backfill.yml` (dry-run/apply/rebuild-snapshot steps) |

**Minimal PAT scope:** a single fine-grained Personal Access Token scoped to the
`agenticapps-eu` org, restricted to the 4 named repos this phase touches
(`agenticapps-roadmap`, `claude-workflow`, `cparx`, `fx-signal-agent`), with:
- `Actions: write` on `agenticapps-roadmap` only (needed to dispatch/read-status of
  `backfill.yml` runs)
- `Contents: read` on all 4 repos (needed for the sibling-repo checkout steps in CI)

No broader scope (no org-wide token, no write access to the sibling repos' contents,
no admin scopes) is required. **No secret is bound by this document** — binding is a
Phase-8 manual/dashboard step per `docs/access-setup.md`'s existing pattern for
`LINEAR_API_KEY`.

### Checklist (all items BLOCKED-until-Phase-8)

1. **[BLOCKED — secrets unbound]** Bind `GH_BACKFILL_TOKEN` (Pages Function binding,
   Cloudflare dashboard) and `GH_CROSS_REPO_TOKEN` + `LINEAR_API_KEY` (GitHub repo
   secrets) using the minimal-scope PAT described above.

2. **[BLOCKED — secrets unbound]** Confirm **unauthenticated** rejection of
   `/api/backfill/dispatch` and `/api/backfill/status`: from a shell/private browser
   with no Access session, both routes return a 302/403 (Access gate), never a 200 with
   real GitHub data. Mirrors `03-HUMAN-UAT.md` Test 1's methodology.

3. **[BLOCKED — secrets unbound]** Confirm a direct `POST /api/backfill/dispatch` with
   `{ mode: "apply" }` and **no** `previewRunId` (or an invalid one) is rejected `403` by
   `dispatch.ts`'s server-side two-phase enforcement — proving apply cannot bypass
   preview even if a caller skips the UI.

4. **[BLOCKED — secrets unbound]** Dispatch a dry-run via the UI (`ProjectDrillDownDialog`
   → Preview on the `claude-workflow`-mapped project): confirm the TYPED diff renders
   (`+ N milestones, + M issues, + L labels, ~ D dates`), and that the
   `___DIFF_JSON___`/`___END_DIFF___` marker readback in `status.ts` correctly extracts
   and `JSON.parse`s the typed counts payload from the real job log.

5. **[BLOCKED — secrets unbound]** Confirm `backfill.yml`'s sibling checkout resolves
   `sync.config.json`'s relative paths (`../claude-workflow`, `../../factiv/cparx`,
   `../../factiv/fx-signal-agent`) correctly in a real run (R-2) — the dry-run/apply leg
   must locate all three sibling repos' `.planning/` trees without a path error.

6. **[BLOCKED — secrets unbound]** Apply one project (`claude-workflow`) end-to-end:
   confirm the real Linear write (new milestone/issue visible in the Linear UI), the
   committed refreshed `public/roadmap.json` **and** `linear-map.json` in the same apply
   commit, and that the `SyncBadge` stays in-sync after a full page reload (R-3, durable
   `planAhead` via the apply job's `pnpm sync:snapshot` rebuild step) — not just an
   ephemeral client-side flip that reverts on refresh.

7. **[BLOCKED — secrets unbound]** Simulate or observe a cancelled/failed run: confirm
   the optimistic badge reverts to out-of-sync and the dismissible inline error renders
   (`useBackfill`'s `applyBackfillOutcome` failure/cancelled path).

8. **[BLOCKED — secrets unbound]** Confirm the GitHub token never appears in any
   `/api/backfill/*` network response body, across every status code (200/400/403/500/502)
   — extend the existing unit-test assertion pattern (REQ-PROXY-1..4 style) to a real
   deployed request/response pair, inspected via browser devtools Network tab.

9. **[BLOCKED — secrets unbound]** Exercise the 204 `return_run_details` fallback: if
   GitHub's dispatch API returns 204 for this org/repo/plan (Open Question A3), confirm
   `dispatch.ts`'s `{ runId: null, correlationId }` path and `backfill.yml`'s
   `run-name: backfill [proj:...] [mode:...] [cid:...]` correlation-id-in-run-name
   mechanism together let `status.ts` resolve the run via `?correlationId=` list-and-match.

10. **[BLOCKED — secrets unbound]** Confirm concurrent-writer behavior: trigger a
    `backfill.yml` apply and a `snapshot.yml` run close together and confirm the shared
    `roadmap-git-writer` concurrency group serializes their `git push`es (no
    non-fast-forward failure, no lost commit) — the live proof of 07-06's finding #9 fix.

11. **[BLOCKED — secrets unbound]** Confirm a REAL scheduled `snapshot.yml` cron run
    (not just `workflow_dispatch`) fires at 06:00 UTC and commits a fresh
    `public/roadmap.json` when Linear data has changed — the live proof that LIVE-03 is
    not just mechanism-present but actually running on schedule.

12. **[BLOCKED — secrets unbound]** Confirm the job-logs timestamp-prefix behavior
    (Open Question A2 / A3 in `07-RESEARCH.md`) against a real dispatched run: verify
    `status.ts`'s substring-match marker extraction (`___DIFF_JSON___...___END_DIFF___`)
    correctly tolerates whatever line-prefixing GitHub's `jobs/{id}/logs` endpoint
    actually applies in this account's configuration.

13. **[BLOCKED — secrets unbound]** (CR-01 follow-up) `dispatch.ts`'s `isValidPreviewRun`
    now enforces a 15-minute recency bound on `previewRunId` (using
    `run_started_at ?? created_at`), but has no one-time-use/consumption tracking — a
    single approved preview can still authorize more than one `apply` within that
    window. Add a KV or D1 binding (none exists in `wrangler.toml` today) to mark a
    `previewRunId` consumed after its first successful apply, and reject a repeat use.
    This is a Phase-8 infrastructure addition, not a Phase-7 code change.

## Summary

total: 13
passed: 0
issues: 0
pending: 13
skipped: 0
blocked: 13

## Gaps

- **BLOCKING (Phase-8 completion gate for LIVE-02/LIVE-03).** Neither requirement can
  be marked complete in `.planning/REQUIREMENTS.md` until every checklist item above is
  executed with a PASS result and recorded in this file (mirrors the
  `03-HUMAN-UAT.md`/`03-ACCESS-PROOF.md` deferral pattern).
- Requires out-of-band work: bind the three secrets above (Cloudflare dashboard +
  GitHub repo secrets), then run a real dispatch/apply/cron cycle. Overlaps Phase 8
  (Deploy, gate & document) by design (R-1).
- Setup steps for the PAT: `docs/access-setup.md`'s existing pattern for
  `LINEAR_API_KEY` should be mirrored for `GH_BACKFILL_TOKEN`/`GH_CROSS_REPO_TOKEN`
  (not written by this plan — Phase-8 scope).
- Proof-file template: extend this file in place with PASS/FAIL results per item, or
  create a dedicated `07-LIVE-PROOF.md` mirroring `03-ACCESS-PROOF.md`'s naming
  convention when Phase 8 executes these checks.
