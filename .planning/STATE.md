# Project State

## Project Reference

No `.planning/PROJECT.md` — design rationale lives in `docs/architecture.md` (decided 2026-06-22).

**Core value:** A private, snapshot-default roadmap dashboard that reads Linear and syncs with the repos' GSD `.planning/` plans, keeping the Linear token server-side at all times.
**Current focus:** Phase 3 — Linear proxy & Access

## Current Position

Phase: 3 of 8 (Linear proxy & Access)
Plan: 1 of 5 in current phase
Status: In progress — executing phase 3 (sequential, on branch `phase-03-linear-proxy`)
Last activity: 2026-06-28 — completed 03-01 (shared runtime-agnostic query/map + bundling probe)

Progress: [██░░░░░░░░] 25% (2 of 8 phases complete)

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

### Pending Todos / Open Items

- `LINEAR_API_KEY` repo secret still unset → daily CI snapshot Action fails until set (GitHub → Settings → Secrets → Actions). Committed `roadmap.json` stays as real MCP-seeded data.
- Phase 03 human checkpoints: 03-02 (workers-types legitimacy), 03-04 (live smoke + UI preview), 03-05 (Access proof — BLOCKING).

## Completed Phases

| Phase | Name | Verdict | Date |
|-------|------|---------|------|
| 1 | Project & tooling scaffold | PASS | 2026-06-24 |
| 2 | Linear data layer & static snapshot | PASS | 2026-06-26 |
