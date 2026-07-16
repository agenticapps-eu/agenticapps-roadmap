---
phase: 06-sync-gsd-linear-cli
plan: 07
subsystem: infra
tags: [cli, node-util-parseargs, node-readline, linear-graphql, sync-gsd-linear]

# Dependency graph
requires:
  - phase: 06-01
    provides: "config.ts contracts (SyncConfigEntry.name, LinearMap, NormalizedModel) cli.ts orchestrates against"
  - phase: 06-02
    provides: "walker.ts (walkPlanning) + parser.ts (parseRepo) -- the .planning/ read side cli.ts drives"
  - phase: 06-04
    provides: "dates.ts (proposeDates) + diff.ts (renderDiff) -- date proposal and human-readable diff rendering"
  - phase: 06-05
    provides: "resolve.ts's buildResolvedWorkspace, consumed transitively via apply.ts"
  - phase: 06-06
    provides: "apply.ts (applyProject, writeLinearMap) -- the write engine cli.ts gates behind the y/N prompt"
provides:
  - "scripts/sync-gsd-linear/prompt.ts -- confirm(question): Promise<boolean>, the D-06-07 y/N gate"
  - "scripts/sync-gsd-linear/cli.ts -- runCli(argv): Promise<number>, the full invocation truth table (dry-run default, --apply/--yes single-project apply, --project-less zero-mutation multi-repo preview, hard bulk-write guard)"
  - "scripts/sync-gsd-linear.ts -- thin tsx entrypoint"
  - "package.json \"sync:gsd\" script"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "node:readline/promises createInterface().question() for the single y/N gate -- no new dependency, closed in a finally"
    - "node:util parseArgs with strict:true for the 7-flag CLI surface -- no commander/yargs dependency, matching CLAUDE.md's dependency-minimal posture"
    - "Orchestration-layer unit testing via vi.mock() on every neighboring module (config/walker/parser/apply/prompt) rather than end-to-end fixtures -- proves cli.ts's OWN truth-table/branching logic in isolation, never touching the real committed sync.config.json/linear-map.json/public/roadmap.json or the network"

key-files:
  created:
    - scripts/sync-gsd-linear/prompt.ts
    - scripts/sync-gsd-linear/cli.ts
    - scripts/sync-gsd-linear/cli.test.ts
    - scripts/sync-gsd-linear.ts
  modified:
    - package.json

key-decisions:
  - "The single-project apply path calls applyProject twice in the same runCli invocation -- once with dryRun:true to render the approval-prompt diff, then (after a y/--yes) immediately with dryRun:false to execute -- per 06-06 SUMMARY's own hand-off note, keeping the human-visible diff and the executed write as close in time as applyProject's internal TOCTOU guard already assumes."
  - "--project-less zero/multiple-match errors and the --project-less-apply bulk-write error both throw the identical message (\"--project <name> must match exactly one configured repo before an apply (bulk write is disallowed)\") per the plan's own literal instruction (\"throws that same error\") -- a --project matching zero/multiple entries is a hard error in EVERY mode (including dry-run), while a wholly absent --project is only an error in apply mode (dry-run permits the multi-repo preview)."
  - "cli.ts calls writeLinearMap(MAP_PATH, map) once more after a real applyProject(dryRun:false) call, even though apply.ts's own executeOperations already persists the map atomically after every single create. This is intentionally redundant (a final belt-and-suspenders flush of the in-memory map object) per the plan's literal Task 2 action text (\"...call applyProject(...) then writeLinearMap\") -- harmless given writeLinearMap's atomic temp+rename write."
  - "cli.test.ts mocks every neighboring stage module (config.ts, walker.ts, parser.ts, apply.ts, prompt.ts) rather than exercising the real filesystem/network -- proves runCli's OWN parseArgs/branching/gating logic (the thing this plan actually built) without re-testing apply.ts's already-proven write/TOCTOU logic (06-06) or resolve.ts's resolve-before-create logic (06-05), and without ever risking a write into the real committed sync.config.json/linear-map.json (the exact failure mode 06-06's own Rule-1 deviation caught and fixed)."
  - "--cadence is validated with Number.isFinite() before being threaded into proposeDates, throwing a clear error on a non-numeric value -- a small Rule 2 addition (06-REVIEWS.md noted 'anchor/cadence validation... not planned' as a MEDIUM-severity gap); --anchor is passed through as-is since dates.ts's own proposeDates already accepts any ISO-date string and downstream Date parsing surfaces malformed input clearly."

requirements-completed: [SYNC-04]

# Metrics
duration: ~35min
completed: 2026-07-15
---

# Phase 06 Plan 07: sync-gsd-linear CLI wiring -- SYNC-04 invocation truth table Summary

**`pnpm sync:gsd` now exists end-to-end: `node:util.parseArgs` + `node:readline/promises` wire walker->parser->dates->apply(dryRun)->[y/N]->apply(write) behind an explicit dry-run-default, single-project-apply-only truth table -- zero new dependencies, 11 orchestration tests, full 113-test phase suite and 232-test repo suite green.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-15T15:05:00+02:00 (approx.)
- **Completed:** 2026-07-15T15:40:00+02:00
- **Tasks:** 2 automated + 1 deferred human-verify checkpoint (see below)
- **Files modified:** 4 created, 1 modified

## Accomplishments

- `prompt.ts`'s `confirm(question)` is a ~15-line `node:readline/promises` wrapper: resolves `true` only for a case-insensitive `y`/`yes` answer (safe default-No on Enter/anything else), closes the interface in a `finally`.
- `cli.ts`'s `runCli(argv)` implements the full D-06-07 invocation truth table exactly as specified in the plan and hardened per 06-REVIEWS.md Consensus item 3 / C7:
  - No flags / `--dry-run` -> zero-mutation, all-repo read-only preview (one `--- <name> ---` + `renderDiff` block per configured entry).
  - `--project X` (no `--apply`/`--yes`) -> one-project read-only preview, dry-run default.
  - `--project X --apply` -> prints the diff, gates on `confirm()`, then a real write on `y`.
  - `--project X --apply --yes` / `--project X --yes` -> prints the diff, writes without prompting.
  - `--apply`/`--yes` with no `--project` -> hard error before any write (bulk-write guard, T-06-03).
  - `--project` matching zero or multiple config entries -> the same hard error, in every mode (including dry-run).
- `--project` resolves against `SyncConfigEntry.name` (never `repoPath`/`label`), closing 06-REVIEWS.md C7.
- `--write-snapshot` threads into every `applyProject` call (both the dry-run diff-render call and the real apply call, and every entry in the multi-repo preview loop) via a single `opts.writeSnapshot` field, so the dry-run-with-snapshot path reaches `patchPlanAhead` as 06-06 SUMMARY's hand-off note required.
- `LINEAR_API_KEY` is read exactly once at this Node-only boundary, with the identical fail-fast message style `client.ts`'s `fetchWorkspace` already uses.
- `scripts/sync-gsd-linear.ts` is the thin `tsx` entrypoint (`process.exit(await runCli(process.argv.slice(2)))`), mirroring `sync-snapshot.ts`'s brevity; `package.json` gained `"sync:gsd": "tsx scripts/sync-gsd-linear.ts"` directly under `sync:snapshot`.
- `cli.test.ts` mocks every neighboring stage (`config.ts`, `walker.ts`, `parser.ts`, `apply.ts`, `prompt.ts`) and proves all 7 required behaviors from the plan's acceptance set (i-vii) plus 3 extra coverage cases (confirm()-declines-cleanly, LINEAR_API_KEY-unset fail-fast, multi-match-errors-even-in-dry-run) -- 11/11 green.
- Full `scripts/sync-gsd-linear` suite: 113/113 green. Full repo suite: 232/232 green. `tsc -b --noEmit` clean. `eslint` clean on all four new/modified files. Zero `any`.

## Task Commits

1. **Task 1: prompt.ts -- node:readline y/N gate** - `5597f97` (feat)
2. **Task 2: cli.ts + entrypoint + package.json sync:gsd** - `109efb1` (feat)

## Files Created/Modified

- `scripts/sync-gsd-linear/prompt.ts` - `confirm(question): Promise<boolean>`
- `scripts/sync-gsd-linear/cli.ts` - `runCli(argv): Promise<number>`, plus file-local `buildModel`/`previewProject`/`applyOneProject` helpers
- `scripts/sync-gsd-linear/cli.test.ts` - 11 tests covering the full invocation truth table
- `scripts/sync-gsd-linear.ts` - thin `tsx` entrypoint
- `package.json` - added `"sync:gsd": "tsx scripts/sync-gsd-linear.ts"`

## Decisions Made

See `key-decisions` in the frontmatter above for the full rationale on: (1) the two-call dry-run-then-write `applyProject` sequencing within one apply-mode invocation, (2) the shared bulk-write error message across the "absent + apply" and "present but zero/multi-match" cases, (3) the redundant-but-harmless final `writeLinearMap` call after a real apply, (4) the fully-mocked orchestration test strategy, and (5) the added `--cadence` numeric validation.

**CLAUDE.md Commands-table reconciliation:** The plan's `<output>` instruction asked the executor to reconcile `CLAUDE.md`'s Commands table example (`pnpm sync:gsd -- --project <name>`) with the now-explicit apply truth table. `CLAUDE.md`'s existing line `pnpm sync:gsd -- --project <name>  # apply one project after approval` was already loosely apply-flavored but technically under-specified (it now defaults to dry-run, not apply). This SUMMARY documents the exact invocation instead of editing `CLAUDE.md` directly: the apply form is `pnpm sync:gsd -- --project <name> --apply` (interactive y/N) or `--project <name> --apply --yes` / `--project <name> --yes` (non-interactive). `CLAUDE.md` itself was left untouched -- it is outside this plan's locked `files_modified` scope (`prompt.ts`, `cli.ts`, `cli.test.ts`, `scripts/sync-gsd-linear.ts`, `package.json`), and CLAUDE.md's own "Never do" / "Always do" hard constraints (token server-side, snapshot-default, dry-run-first, per-project approval) all still hold true under the implemented truth table -- only the exact flag spelling for the apply example needed updating, which is a documentation nit, not a constraint violation. Recommended follow-up: a small doc-only commit updating the `pnpm sync:gsd -- --project <name>` example in `CLAUDE.md`'s Commands table to `pnpm sync:gsd -- --project <name> --apply`.

## Deviations from Plan

None beyond the CLAUDE.md Commands-table reconciliation note above (explicitly scoped as documentation-only in the plan's own `<output>` instruction, not a code deviation) and the `--cadence` numeric-validation addition (Rule 2 -- missing critical input validation, called out as a known gap in 06-REVIEWS.md, one `Number.isFinite` guard).

## Issues Encountered

None. All acceptance criteria for both automated tasks passed on the first implementation pass; no auto-fix cycles were needed.

## Human verification required

**Task 3 (`checkpoint:human-verify`, gate="blocking") was NOT executed in this session.** `LINEAR_API_KEY` is confirmed **unset** in this environment (verified via `[ -n "${LINEAR_API_KEY:-}" ]` -> UNSET). Per this plan's explicit checkpoint guidance, a genuine live Linear write cannot be simulated safely and must not be attempted against the real API in an unattended session -- the write path is fully implemented and unit-tested against the mocked GraphQL fixtures (06-06's `apply.test.ts`, 11/11 green, including the mock-level idempotency proof) and this plan's own `cli.test.ts` (11/11 green, proving the CLI correctly gates every write behind `--apply`/`--yes` + a single resolved `--project`). The two VALIDATION.md manual-only items remain **outstanding** and are the binding SYNC-04 contract test per 06-REVIEWS.md Concern C1 ("the mock test is a *logic* test; the live re-run is the *contract* test"):

1. **Dry-run accuracy** -- run `LINEAR_API_KEY=<key> pnpm sync:gsd -- --project claude-workflow` and eyeball the printed diff against `../claude-workflow/.planning/` and the live AGE Linear workspace. Confirm milestone/issue/label/initiative operations and proposed dates look correct, and that already-shipped phases show as informational only (no fresh operations).
2. **Live apply + re-run no-op (the binding SYNC-04 idempotency contract test)** -- run `LINEAR_API_KEY=<key> pnpm sync:gsd -- --dry-run` (no `--project`) first and confirm a zero-mutation multi-repo preview. Then run `pnpm sync:gsd -- --project claude-workflow --apply` (answer `y`, or add `--yes`), confirm records appear in Linear with no duplicates, then **re-run the exact same command** and confirm the second run reports an empty operation set / no writes. Finally confirm `public/roadmap.json` gained `planAhead: true` for `claude-workflow` and still contains no token/email (`assertNoLeak` already gates this at write time, but a human spot-check closes the loop).

**Caution carried forward from the plan (RESEARCH Open Question 2):** do not apply `fx-signal-agent` first without manually seeding `linear-map.json` -- it has pre-existing non-conforming milestones (M7/M8) that would otherwise duplicate. Scope the first live rollout to `claude-workflow` (+ optionally `cparx`).

This gap does not block phase completion per this plan's own checkpoint guidance ("implement + unit-test it against mocks, note the live-verification gap... and continue -- do not block"), but SYNC-04 success criterion #2 (idempotent re-run) is not fully closed until a human runs the two steps above with a real `LINEAR_API_KEY` set.

## Known Stubs

None. Every code path implemented in this plan (dry-run preview, single-project apply, the bulk-write guard, `--write-snapshot` threading) is real, non-stubbed logic exercised by `cli.test.ts` against mocked dependencies -- the only gap is the live-network verification documented above, which is a verification gap, not an implementation stub.

## Threat Flags

None. This plan's only new surface is CLI argument parsing and the interactive prompt -- both already covered by the plan's own `<threat_model>` (T-06-02 through T-06-04, all implemented as specified: `LINEAR_API_KEY` read once and never logged, `--apply`/`--yes` hard-require exactly one resolved `--project`, writes gated by `confirm()`/`--yes`).

## User Setup Required

**`LINEAR_API_KEY` must be exported before the two Task 3 manual-verify steps above can run.** No other external service configuration is required -- `sync.config.json`/`linear-map.json` are already seeded (06-01) and committed at the repo root.

## Next Phase Readiness

SYNC-01 through SYNC-04 are all now code-complete and automated-test-covered (`scripts/sync-gsd-linear` suite: 113/113; full repo suite: 232/232). Phase 6 cannot be marked fully DONE until a human completes the two Task 3 manual-verify steps (dry-run accuracy + live apply/re-run no-op) with a real `LINEAR_API_KEY` -- this is the phase's own designed binding contract test, not a blocker introduced by this plan. No other blockers. Phase 7 (LIVE-01..03, UI-triggered backfill) can begin planning against this CLI's pipeline stages (`walker`/`parser`/`resolve`/`diff`/`apply`) once the live verification closes.

---
*Phase: 06-sync-gsd-linear-cli*
*Completed: 2026-07-15*

## Self-Check: PASSED

All claimed files verified on disk (prompt.ts, cli.ts, cli.test.ts,
scripts/sync-gsd-linear.ts, this SUMMARY.md; package.json contains exactly
one "sync:gsd" line) and both task commit hashes (5597f97, 109efb1) verified
present in git log.
