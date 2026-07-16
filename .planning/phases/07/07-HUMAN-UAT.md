---
status: pending
phase: 07-live-refresh-write-back
source: [07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md, 07-04-PLAN.md, 07-05-PLAN.md, 07-06-PLAN.md, 07-REVIEWS.md]
severity: blocking (Phase-8 completion gate for LIVE-02/LIVE-03)
started: 2026-07-16
updated: 2026-07-16
---

## Current Test

Consolidated Phase-8 live-verification checklist for LIVE-01..03 (in progress —
Task 1 records the workflow structural re-verification; Task 2 will append the
operationally-pending record and the expanded checklist).

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
