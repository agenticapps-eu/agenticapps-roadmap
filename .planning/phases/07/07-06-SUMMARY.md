---
phase: 07-live-refresh-write-back
plan: 06
subsystem: infra
tags: [github-actions, ci, workflow-dispatch, backfill, concurrency, security]

# Dependency graph
requires:
  - phase: 07-02
    provides: "functions/api/backfill/status.ts run-name + ___DIFF_JSON___ marker contract this workflow must satisfy byte-for-byte"
  - phase: 06
    provides: "scripts/sync-gsd-linear CLI (dry-run/apply truth table, linear-map.json identity map) invoked UNCHANGED"
provides:
  - ".github/workflows/backfill.yml — workflow_dispatch CI job: sibling checkout, env-var project passing, typed diff marker emit, apply + snapshot rebuild + dual-file commit"
  - "snapshot.yml serialized onto the same roadmap-git-writer concurrency group as backfill.yml"
affects: [07-03-client-backfill-wiring, 07-05-phase-8-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling-repo checkout-into-subdirectory layout reproducing sync.config.json's CWD-relative repoPaths inside $GITHUB_WORKSPACE"
    - "env: (PROJECT_KEY/MODE) + shell $VAR usage instead of ${{ inputs.* }} GitHub-expression interpolation inside any run: command"
    - "Dedicated marker-emit step building the ___DIFF_JSON___ token from concatenated string fragments so the step's own echoed command can never self-match"
    - "Shared roadmap-git-writer concurrency group across two workflows to serialize all git writers to public/roadmap.json + linear-map.json"

key-files:
  created:
    - .github/workflows/backfill.yml
  modified:
    - .github/workflows/snapshot.yml

key-decisions:
  - "Marker-emit is a separate dedicated step (not part of the dry-run CLI-invocation step) so GitHub's own echoed-command log line for that step can never contain the literal ___DIFF_JSON___ substring that status.ts scans for"
  - "Apply leg always runs sync:gsd --apply --yes then a full pnpm sync:snapshot rebuild before committing — buildSnapshot recomputes planAhead as undefined (in-sync), avoiding the stale planAhead:true the CLI's own patchPlanAhead call would otherwise leave behind"
  - "Apply commit stages BOTH public/roadmap.json and linear-map.json in one commit, with git pull --rebase origin main before push as defense-in-depth alongside the shared concurrency group"
  - "snapshot.yml's concurrency group changed from a workflow-local 'snapshot' string to the shared 'roadmap-git-writer' string — the one deliberate, review-driven exception to D-07-08's verify-and-reuse scope, justified by the finding #9 cross-workflow git race"

patterns-established:
  - "Pattern: CI workflows that need $VAR forms of workflow_dispatch inputs pass them through job/step-level env:, never through ${{ inputs.* }} inline in a run: script string"

requirements-completed: [LIVE-02]

# Metrics
duration: ~10min
completed: 2026-07-16
---

# Phase 07 Plan 06: Backfill CI workflow + shared git-writer concurrency Summary

**`.github/workflows/backfill.yml` runs the unmodified Phase-6 sync-gsd-linear CLI against a sibling-repo checkout layout, emits a sanitized typed diff marker for dry-run preview, and on apply rebuilds a durable in-sync snapshot and commits both `public/roadmap.json` and `linear-map.json` — serialized with `snapshot.yml` on one shared concurrency group so the two workflows' git writes can never race.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-16T08:16Z (approx, per prior commit timestamp)
- **Completed:** 2026-07-16T08:21:00+02:00
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `backfill.yml`: `workflow_dispatch` with `project`/`mode`/`correlation_id` inputs; `run-name: backfill [proj:...] [mode:...] [cid:...]` — the only channel `dispatch.ts`/`status.ts` (07-02) can read a run's project/mode/correlation from, since the runs API omits inputs.
- Four-step checkout layout (`agenticapps-roadmap`, `claude-workflow`, `factiv/cparx`, `factiv/fx-signal-agent`) reproducing `sync.config.json`'s CWD-relative `repoPath` values inside `$GITHUB_WORKSPACE`, working around `actions/checkout`'s inability to place a repo outside the workspace (RESEARCH Pitfall 2). `sync.config.json` and the CLI are untouched.
- `project`/`mode` cross into the shell exclusively via `env: { PROJECT_KEY, MODE }` and `"$PROJECT_KEY"`/`if: ${{ inputs.mode == '...' }}` step gating — never a `${{ inputs.* }}` GitHub-expression interpolated inside a `run:` command body (finding #6, T-07-12).
- Dry-run leg: CLI stdout captured to a file, then a **dedicated** emit step (separate from the CLI-invocation step) strips ANSI codes, regex-parses `renderDiff()`'s two count lines, and prints a single `___DIFF_JSON___{milestones,issues,labels,dates}___END_DIFF___` line built from concatenated string fragments (`"___DIFF" + "_JSON___"` / `"___END" + "_DIFF___"`) — so the step's own GitHub Actions-echoed command text can never contain the literal marker and be mismatched by `status.ts`'s line-scan.
- Apply leg: `sync:gsd --apply --yes` → **full** `pnpm sync:snapshot` rebuild (recovers a durable in-sync `planAhead` state, since a real apply's internal `patchPlanAhead(..., true)` would otherwise leave the badge showing "Out of sync" — findings #1/#2) → commit step stages **both** `public/roadmap.json` and `linear-map.json` (finding #3, the CLI's persisted identity map) → `git pull --rebase origin main` before push (defense-in-depth for finding #9).
- `snapshot.yml`: single-line surgical change — concurrency `group: snapshot` → `group: roadmap-git-writer` (unchanged `cancel-in-progress: false`) — so the daily/dispatch snapshot job and backfill's apply job serialize on one group and cannot push `roadmap.json`/`linear-map.json` concurrently.

## Task Commits

Each task was committed atomically:

1. **Task 1: backfill.yml — sibling checkout, env-var project, typed diff emit, snapshot rebuild + commit both** - `606f95e` (feat)
2. **Task 2: Serialize snapshot.yml with backfill's git writer** - `c03fa2a` (fix)

**Plan metadata:** (this commit, following SUMMARY)

## Files Created/Modified
- `.github/workflows/backfill.yml` - New CI workflow: sibling checkout, env-var-only input passing, typed diff marker emit, apply + snapshot rebuild + dual-file commit, `roadmap-git-writer` concurrency
- `.github/workflows/snapshot.yml` - One-line change: concurrency group aligned to `roadmap-git-writer`

## Decisions Made
- Followed the plan's locked `<interfaces>` contract verbatim: RESOLUTION 1 (typed-counts marker, CLI byte-for-byte unchanged), RESOLUTION 2 (run-name contract), and findings #1/#2/#3/#6/#9/#10 from `07-REVIEWS.md`, all already embedded in the plan text.
- Chose two separate mode-gated legs (dry-run leg, apply leg) each with its own step-level `if:` rather than one combined step branching internally on `$MODE` — both satisfy "never interpolate `${{ inputs.* }}` inside `run:`"; the separate-legs form is simpler (no dead-code branch) and matches the plan's explicit dry-run/apply leg structure.
- Used a `node <<'HEREDOC'` script (quoted heredoc, no shell variable expansion) for the marker-emit step instead of a `node -e "..."` one-liner, to avoid the quoting hazards of embedding a JSON.parse/regex script inside a shell `-e` string in YAML.

## Deviations from Plan

None - plan executed exactly as written, including the deliberate, review-driven `snapshot.yml` concurrency-group deviation from strict D-07-08 verify-and-reuse scope (explicitly authorized by Task 2's own instructions to fix the finding #9 cross-workflow git race).

## Issues Encountered
None. `npx tsc -b --noEmit` run after both commits reports zero errors (this plan touches only YAML, no TypeScript surface).

## User Setup Required

None from this plan directly. Both workflows depend on secrets that remain unbound Phase-8 items (already tracked, not new to this plan):
- `GH_CROSS_REPO_TOKEN` — fine-grained PAT scoped to the 4 `agenticapps-eu` repos, used by `backfill.yml`'s sibling checkout steps (T-07-03, Phase-8 binding, documented in `07-05-PLAN.md`).
- `LINEAR_API_KEY` — already a tracked open item in `STATE.md` (unset in this environment); used by both `backfill.yml`'s dry-run/apply/snapshot-rebuild steps and `snapshot.yml`.
- Live `workflow_dispatch` execution (real GitHub Actions run, real diff-marker readback through a real job log, real concurrent-writer race test) is a Phase-8 HUMAN-UAT item (R-1) — this plan's verification is structural/automated only (grep-style token checks over the committed YAML), per `07-06-PLAN.md`'s own `<verification>` section.

## Next Phase Readiness
- `backfill.yml`'s run-name format and `___DIFF_JSON___`/`___END_DIFF___` marker shape match `functions/api/backfill/status.ts` (07-02) exactly — no further coordination needed between the two.
- `snapshot.yml` and `backfill.yml` now share one `roadmap-git-writer` concurrency group; no code change needed elsewhere to benefit from this serialization.
- Remaining LIVE-02 work is Phase-8 HUMAN-UAT: bind `GH_CROSS_REPO_TOKEN`/`GH_BACKFILL_TOKEN`/`LINEAR_API_KEY` and dispatch a real dry-run + apply end-to-end (see `07-05-PLAN.md`).

---
*Phase: 07-live-refresh-write-back*
*Completed: 2026-07-16*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commit hashes (`606f95e`, `c03fa2a`) verified in `git log --oneline --all`.
