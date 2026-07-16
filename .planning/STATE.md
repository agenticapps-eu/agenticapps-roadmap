---
gsd_state_version: 1.0
milestone: v0.1.0
milestone_name: milestone
status: executing
last_updated: "2026-07-16T06:25:58.837Z"
last_activity: 2026-07-16
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 32
  completed_plans: 30
  percent: 38
---

# Project State

## Project Reference

No `.planning/PROJECT.md` — design rationale lives in `docs/architecture.md` (decided 2026-06-22).

**Core value:** A private, snapshot-default roadmap dashboard that reads Linear and syncs with the repos' GSD `.planning/` plans, keeping the Linear token server-side at all times.
**Current focus:** Phase 07 — Live refresh & write-back

## Current Position

Phase: 07 (Live refresh & write-back) — EXECUTING
Plan: 4 of 6
Status: Ready to execute
Last activity: 2026-07-16

Progress: [█████████░] 94%

## Phase 3 Wave Plan

| Wave | Plan | Autonomous | Notes |
|------|------|-----------|-------|
| 1 | 03-01 | yes | Shared runtime-agnostic query/map; Worker-import probe |
| 1 | 03-02 | no (checkpoint) | Worker types legitimacy gate |
| 2 | 03-03 | yes (TDD) | Linear proxy Pages Function, test-first |
| 3 | 03-04 | no (checkpoint) | Live smoke; client toggle + fallback |
| 4 | 03-05 | no (blocking) | Access proof — phase not done until captured |

Execution mode: **sequential on main** (user-selected). Worktree isolation disabled for this run.

## Accumulated Context

### Decisions

- 2026-06-22 (architecture): Hybrid pattern C — static snapshot default + Pages Functions for live refresh/write-back; Cloudflare Pages host; Cloudflare Access (email allow-list) gating; per-project dry-run-first backfill.
- 2026-06-28 (phase 03 planning): Folded cross-AI review feedback — process-free `scripts/linear/map.ts` boundary, single-try/catch live fallback, fixture full-`GqlResponse` contract, blocking Access-proof gate.
- 2026-06-28 (this session): Continue without prior STATE/ROADMAP → user chose to reconstruct them first before executing phase 03.
- 2026-06-28 (03-01): Cross-dir .ts import CONFIRMED — functions/ → scripts/linear/ bundles correctly under wrangler@4 esbuild; src/lib/linear relocation NOT needed. mapWorkspace lives in process-free map.ts; Worker must import map.ts, never client.ts. fetchWorkspaceWith NOT built (YAGNI).
- 2026-06-29 (03-02): npx --yes wrangler@4 in preview:functions keeps wrangler ephemeral (no project dep added); wrangler.toml unchanged — existing entries sufficient; types:[@cloudflare/workers-types] only in tsconfig.functions.json to prevent node/worker type bleed.
- 2026-06-29 (03-03): Full GqlResponse fixture contract confirmed — gqlClean/gqlWithEmail carry top-level `data` key; stubs return directly (no double-wrap). Single try/catch body-handling stretch maps any throw (malformed JSON, assertNoLeak, schema parse) to generic 502. transform.ts process-guard ported to globalThis cast — typechecks under both node and workers-types tsconfigs. REQ-PROXY-1..4 all green (13/13 tests).
- 2026-06-30 (03-05): Access enforcement proof DEFERRED as a blocking HUMAN-UAT item (user decision). The console-only runbook (`docs/access-setup.md`) is committed, but the captured proof needs a deployed Pages env + Access config (dashboard-only), pulled forward from Phase 08. Phase 03 stays at 4/5 and is NOT marked complete until `03-ACCESS-PROOF.md` records a blocked unauth result.
- 2026-06-29 (03-04): Two-part Linear fetch design chosen — MAIN_QUERY (bounded, no issues) + ISSUES_QUERY (cursor-paginated, flat top-level) assembled in fetch-workspace.ts to avoid Linear "Query too complex" at production data volumes; map.ts/transform.ts/schema.ts unchanged. Live field names corrected to live schema (Initiative.status, Project.initiatives.nodes[].id, Project.status). Both fixes also correct the Phase-02 CI snapshot path once LINEAR_API_KEY secret is set. REQ-LOADER satisfied; live smoke passed (271 issues, 5 initiatives, 20 projects; no token/PII in responses).
- [Phase 06]: 06-01: SyncConfigSchema is a flat z.array(...); resolved-state/operation contracts (ResolvedIssue/ResolvedProject/ResolvedWorkspace/SyncOperation/DiffSummary) are plain TS interfaces, not Zod-validated (internal computed state, not untrusted input).
- [Phase 06]: 06-01: linear-mutation-mock.ts's dup-create resolve check approximates the CLI's title-hash step by exact name/title string match, since hash.ts doesn't exist yet in Wave 0 (same name always yields the same hash).
- [Phase 06]: 06-02: Walker sorts phase-dir/plan-file listings alphabetically for deterministic output; parser.ts helpers stay module-private (transform.ts style); completionStatusFor ROADMAP match checks both full slug and number-stripped suffix.
- [Phase 06]: 06-03: titleHash() is identity-agnostic; slug-not-title / plan-key-not-title contract lives in the file header. mutations.ts adds target-scoped paginated PROJECT_ISSUES_QUERY beyond scripts/linear/query.ts's workflow-state-only ISSUES_QUERY, plus PROJECT_UPDATE/PROJECT_MILESTONE_UPDATE/ISSUE_UPDATE beyond RESEARCH's verified *_CREATE examples (same id+input pattern; may go uncalled by 06-06's create-only v1 apply).
- [Phase 06-04]: comparePhaseNumber orders decimal phase numbers component-wise (never whole-string float coercion); proposeDates re-sorts before assigning dates and leaves completed phases untouched. buildDiff(model, resolved) emits the full enumerated SyncOperation[] write set matched by titleHash of identity; drifted existing-milestone dates surface as informational only (v1 apply is create-only).
- [Phase 06]: 06-05: resolveProjectByLabel added as a file-local, soft-failing (null-on-error) lookup since RawWorkspace's MAIN_QUERY read omits per-project label attachment; resolveProject takes labeledProjectId as an explicit parameter rather than making its own network call.
- [Phase 06]: 06-05: idempotency proof (resolve-before-create finds existing records, no duplicate) tested at the resolveProject/resolveMilestone/resolveIssue function level against linear-mutation-mock.ts's real create handlers + direct in-memory state reads, not through buildResolvedWorkspace's full network path.
- [Phase 06]: 06-06: apply.ts (SYNC-04) -- create-only write engine with TOCTOU abort-on-drift, atomic per-create linear-map.json write-back (temp+rename), and a map-based (not title-hash-based) issue-identity dedup so Linear issue titles stay human-readable (D-06-01) while still satisfying diff.ts's identityKey-field matching contract. — PROJECT_ISSUES_QUERY has no description field to carry a hidden identity token, and hash.ts's contract forbids hashing the display title, so identity/dedup for issues is recovered via a reverse lookup through the already-persisted linear-map.json issues pool instead of overloading the Linear issue's title field.
- [Phase 06]: 06-07: cli.ts's single-project apply path calls applyProject twice in one invocation (dryRun:true to render the y/N-gated diff, dryRun:false immediately after approval to execute) per 06-06's TOCTOU hand-off note; --project-less zero/multiple-match and --project-less-apply both throw the identical bulk-write-guard error string, while a wholly absent --project is only an error in apply mode (dry-run permits the zero-mutation multi-repo preview). Task 3 live-verify checkpoint deferred (LINEAR_API_KEY unset) -- documented under 'Human verification required' in 06-07-SUMMARY.md.
- [Phase 07]: 07-01: Kept both branches of shouldRevalidateRoadmap (source-mode-flip AND identical-URL) -- additive R-4 fix, not a reversion; freshness hint tracks client-side lastRefreshedAt (seeded from initial load, bumped on revalidator loading-to-idle), not the live projection's own generatedAt, since the latter is always 'just now' in live mode.
- [Phase 07]: 07-02: GH_BACKFILL_TOKEN kept distinct from LINEAR_API_KEY binding name; diff readback uses run->jobs->job-logs grep (no fflate/artifact path); preview-run verification collapses all failing checks to an undifferentiated 403
- [Phase 07-06]: snapshot.yml concurrency group aligned to backfill.yml's shared roadmap-git-writer group (deliberate D-07-08 deviation to fix finding #9 cross-workflow git race)
- [Phase 07-06]: dry-run diff marker emitted from a dedicated step (separate from CLI invocation) so the step's own echoed command text can never self-match the ___DIFF_JSON___ literal that status.ts scans for

### Pending Todos / Open Items

- **Phase 07 human-check (07-01):** Task 2's browser verification not yet run (no browser tool available to the executor) — in `pnpm dev` with `?source=live`, confirm the Refresh button + freshness hint appear, click Refresh and confirm a `/api/linear/snapshot` Network call fires (the unique proof a click re-pulls data), and confirm no Refresh button renders in Snapshot mode. See `.planning/phases/07/07-01-SUMMARY.md` § "Human Verification Required".
- `LINEAR_API_KEY` repo secret still unset → daily CI snapshot Action fails until set (GitHub → Settings → Secrets → Actions). Committed `roadmap.json` stays as real MCP-seeded data.
- Phase 03 human checkpoints: 03-02 DONE (workers-types legitimacy approved), 03-04 DONE (live smoke APPROVED — 271 issues, no token leak, latent bugs fixed), 03-05 runbook DONE / **Access proof DEFERRED (BLOCKING)** — see `.planning/phases/03/03-HUMAN-UAT.md`.
- **BLOCKING (Phase 03 completion gate):** capture `.planning/phases/03/03-ACCESS-PROOF.md` — deploy a Pages preview, configure Cloudflare Access (email allow-list over the domain AND `/api/*`), prove unauth `GET /api/linear/snapshot` → 302/403 and an allowed identity → 200. Runbook: `docs/access-setup.md`. Likely captured alongside Phase 08 deploy.
- **BLOCKING (Phase 06 completion gate):** 06-07 Task 3 (`checkpoint:human-verify`) deferred — `LINEAR_API_KEY` is unset in the execution environment, so the live-wire verification could not run. A human must, with `LINEAR_API_KEY` exported: (1) run `pnpm sync:gsd -- --project claude-workflow` (dry-run) and judge the diff accurate against the real repo/Linear state, and (2) run a real apply for one project followed by an identical re-run and confirm the second run is a no-op (the binding SYNC-04 idempotency contract test). Full instructions: `.planning/phases/06/06-07-SUMMARY.md` § "Human verification required". Caution: do not apply `fx-signal-agent` first (pre-existing non-conforming M7/M8 milestones) without manually seeding `linear-map.json`.

## Completed Phases

| Phase | Name | Verdict | Date |
|-------|------|---------|------|
| 1 | Project & tooling scaffold | PASS | 2026-06-24 |
| 2 | Linear data layer & static snapshot | PASS | 2026-06-26 |
