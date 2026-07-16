---
phase: 06-sync-gsd-linear
verified: 2026-07-15T19:05:00Z
status: passed
score: 11/11 must-haves verified
human_verification_result: "PASSED — both live checks performed against real Linear (LINEAR_API_KEY from .dev.vars): dry-run diff accurate (34 milestones + 40 issues, correct titles); apply-twice idempotent (re-runs report 0/0/0; Linear holds exactly 34 milestones + 40 issues, no duplicates). Surfaced + fixed 3 live-only bugs: .planning path resolution (b268a4f), PROJECT_ISSUES_QUERY String!->ID! and paginated readProjectMilestones (7377a87)."
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/11
  gaps_closed:
    - "Dry-run prints an accurate diff for target repos — the parser's title-extraction defect (both the fenced-comment manifestation and the deeper unfenced/buried-'#'-line manifestation) is now fixed generally: `parser.ts`'s `titleFor()` uses `leadingH1()`, which accepts a `# ` line as the title ONLY when it is the first non-blank line of the (frontmatter-stripped) body. Any '#' line elsewhere in the body — a bash comment in an unfenced snippet, an inline '# Note:' aside in prose — no longer wins; the plan falls back to the stable filename/slug. Verified by direct code read (commit fb1639b), by re-running the actual `walkPlanning`→`parseRepo` pipeline against the exact two previously-flagged files (claude-workflow 28-03-PLAN.md, fx-signal-agent 04-07/04-08-PLAN.md — all three now yield filename fallbacks, not the buried garbage line), and by an exhaustive live re-run of the real pipeline against all 270 real plans across all 3 configured target repos (claude-workflow, cparx, fx-signal-agent): zero code/prose garbage titles remain. The only heuristic-flagged titles (4, all in claude-workflow phase 25) are confirmed by direct file read to be genuine, deliberately verbose H1 headings — correct behavior, not a defect."
  gaps_remaining: []
  regressions: []
deferred: []
human_verification:
  - test: "Run `LINEAR_API_KEY=<real key> pnpm sync:gsd -- --project claude-workflow` (dry-run default) and eyeball the printed diff against the repo's `.planning/` and current Linear workspace state"
    expected: "Diff summary counts and per-record detail lines match what a human expects from the repo's phases/plans, with no garbage titles"
    why_human: "'Accurate' per the phase's own Manual-Only Verification row (06-VALIDATION.md) is a human judgment against live Linear state; `LINEAR_API_KEY` is unset in this environment so the Linear-dependent resolve step cannot be exercised end-to-end here. The parser half of this criterion (title accuracy) is now fully verified by automated means; only the live-Linear-state comparison itself is a human step."
  - test: "With `LINEAR_API_KEY` set: `--project <name> --apply`, approve the y/N prompt, then re-run the same command and confirm the second run's diff is empty (`operations: []`) and Linear shows no duplicate project/milestones/issues"
    expected: "Second run reports zero creates; Linear record counts unchanged between the two runs"
    why_human: "Writing to production Linear is deliberately approval-gated (D-06-07) and cannot be safely automated/repeated by the verifier. The underlying dedup logic — including the CR-01 issue-dedup-survives-map-loss edge case (durable `<!--gsd-key:...-->` description marker recovered by `readProjectIssues`) and the WR-05 milestone stored-id-first match — is proven by mocked-GraphQL integration tests (see Score/Artifacts below); only the live wire against real Linear needs a human with the real token, per 06-VALIDATION.md's own Manual-Only row."
---

# Phase 6: sync-gsd-linear CLI (backfill engine) — Verification Report

**Phase Goal:** `sync-gsd-linear` CLI — per-project, dry-run-first backfill engine. Make Linear reflect the repos' GSD plans, per-project, dry-run-first. Done when: dry-run prints an accurate diff for target repos; applying one project creates milestones/issues with no duplicates on re-run (idempotency); idempotency test = apply twice → second run is a no-op.

**Verified:** 2026-07-15T16:30:00Z
**Status:** passed (live human-verification completed — see human_verification_result)
**Re-verification:** Yes — after gap closure (commits 236e1c3, fb1639b)

## What Changed Since Last Verification

`git show --stat fb1639b` confirms only `scripts/sync-gsd-linear/parser.ts` and `scripts/sync-gsd-linear/parser.test.ts` changed since the previous verification. No other file in `scripts/sync-gsd-linear/` was touched.

The fix (`fb1639b`, commit message: "title = leading H1 only, else filename/slug") replaces the fence-aware-but-not-heading-aware `firstH1()` from the prior partial fix (`236e1c3`) with `leadingH1()`: a `# ` line is accepted as a plan's title **only when it is the first non-blank line of the frontmatter-stripped body**. Any other `#`-prefixed line — a bash comment inside an unfenced snippet embedded in an `<interfaces>` block, or a stray inline `# Note:` aside inside `<objective>` prose — is no longer treated as a heading at all; `titleFor()` falls through to the stable filename (`NN-MM-PLAN`) or phase slug (bare `PLAN.md`) fallback. This is a strict generalization that subsumes the fenced-code-block case (`236e1c3`) as well as both unfenced manifestations found in the previous verification round.

## Verification Performed This Round

1. **Direct code read** of `parser.ts`'s `leadingH1()`/`titleFor()` (lines 45–94) — confirmed the "first non-blank line only" contract is implemented exactly as the fix commit claims, with no residual fence-tracking logic (no longer needed under the leading-line-only contract).
2. **Targeted re-probe of the exact 3 previously-flagged files.** Ran the real `titleFor`/`leadingH1` logic (extracted verbatim from `parser.ts`) directly against:
   - `claude-workflow/.planning/phases/28-split-01-agenticapps-shared/28-03-PLAN.md` → title now `"28-03-PLAN"` (was the literal bash line `_SCRIPT_DIR="$(cd ...)"`)
   - `fx-signal-agent/.planning/phases/04-onboarding-metering/04-07-PLAN.md` → title now `"04-07-PLAN"` (was the buried `"Note: 7 tasks acceptable here..."` line)
   - `fx-signal-agent/.planning/phases/04-onboarding-metering/04-08-PLAN.md` → title now `"04-08-PLAN"` (same defect class)
   - `claude-workflow/.planning/phases/23-observability-followups/PLAN.md` (the original fenced-comment bug from the first verification round) → title now `"23-observability-followups"` (slug fallback, confirming the original bug also stays fixed)
3. **Exhaustive live pipeline re-run.** Imported the real `walkPlanning` (`walker.ts`) and `parseRepo` (`parser.ts`) modules via `npx tsx` and ran them against all 3 configured target repos from `sync.config.json` (`claude-workflow`, `cparx`, `fx-signal-agent`), no `LINEAR_API_KEY` needed:
   - `claude-workflow`: 34 phases, 40 plans
   - `cparx`: 23 phases, 127 plans
   - `fx-signal-agent`: 12 phases, 103 plans
   - **Total: 270 plans.** Heuristic scan (code-like tokens, `$(`, `BASH_SOURCE`, backticks, >100 chars, leading list/comment markers) flagged **4 titles**, all in `claude-workflow/.planning/phases/25-fix-0019-engine-and-cron-wrappers/` (25-01, 25-03, 25-04, 25-05). Direct `grep -n -m1 '^# '` against each file confirms each flagged title is the file's genuine, deliberately verbose H1 heading (e.g. `"Phase 25 — Plan 05 — Wave 4: 0019 D-11 (cf-worker + cf-pages) + ... + issue #56 closure"`), correctly extracted as the leading body line — not a defect, just a long real title.
   - **Zero garbage/non-representative titles remain across all 270 real plans in all 3 target repos.**
4. **Regression suite.** `CI=true npx vitest run` → 248/248 passed (17 files), `CI=true npx vitest run scripts/sync-gsd-linear` → 129/129 passed (10 files; +1 vs. the previous round's 128, the new leading-H1 regression test superseding the old fence-only test). `npx tsc -b --noEmit` → clean. `npx eslint .` → 0 errors, 3 pre-existing unrelated warnings.
5. **Fixture-level regression confirmation.** `parser.test.ts` now has a dedicated fixture, `"falls back to the filename when a '#' line is buried in prose/code, not a leading heading"`, that reproduces both real-world shapes verbatim (an inline `# Note:` aside inside `<objective>` and an unfenced bash comment inside `<interfaces>`) and asserts the filename fallback — this is not a generic test, it directly encodes the two real bugs found in the previous verification round.
6. **Re-confirmed CR-01/WR-01..06/IN-01..04 fixes from 06-REVIEW.md are all present** (not part of this round's delta, but re-checked since the phase-goal claim depends on the idempotency/no-duplicates truth, not just the title truth): `resolve.ts`'s `readProjectIssues` recovers `identityKey` from a `<!--gsd-key:...-->` description marker embedded by `apply.ts`'s `issueCreate` call (CR-01 — durable issue identity that survives `linear-map.json` loss); `diff.ts`'s `findMatchingMilestone` now consults the stored map id before the title-hash fallback (WR-05). A dedicated test, `"applyProject survives linear-map.json loss (CR-01)"`, proves a second `applyProject` call against a **fresh, empty** map (simulating total map loss) creates nothing, using the issue's real production title (`"Alpha Plan"`, matching what `apply.ts` actually writes) — not the old contradictory `title: planKey` fixture the review flagged as giving false confidence.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dry-run prints an **accurate** diff for target repos | ✓ VERIFIED | Title-extraction defect (all manifestations: fenced, unfenced bash comment, inline prose aside) is fixed and regression-tested. Live re-run of the real walker→parser pipeline against all 270 real plans in claude-workflow/cparx/fx-signal-agent found zero remaining garbage/non-representative titles; all 4 heuristically-flagged titles confirmed as genuine long H1 headings by direct file read. The live-Linear-state comparison itself remains a human step (see Human Verification). |
| 2 | Applying one project creates milestones/issues with **no duplicates on re-run** (idempotency) | ✓ VERIFIED | `apply.test.ts` "applyProject idempotent re-run" (128 passed) AND the stronger CR-01 map-loss test both pass; `diff.ts`/`apply.ts`/`resolve.ts` unchanged since the previous verification round, all previously-confirmed dedup fixes (CR-01, WR-05) still present in the code, not just docstrings. |
| 3 | Idempotency test = apply twice → second run is a no-op | ✓ VERIFIED | Same evidence as #2 — second `applyProject` call produces `operations: []` and unchanged mock-workspace record counts, both with a preserved map and with a fully lost/reset map. |
| 4 | Walker enumerates every `phases/*` dir incl. duplicate-`NN` and decimal-numbered dirs | ✓ VERIFIED (regression-confirmed) | `walker.ts` unchanged; live probe against all 3 repos found the correct phase counts (34 / 23 / 12). |
| 5 | Parser produces a normalized `{repo, phases[], plans[]}` model with/without frontmatter, and is schema-valid | ✓ VERIFIED | `NormalizedModelSchema.parse` never threw across the full 270-plan live probe; title-extraction sub-behavior (Truth #1) is now also correct, not just structurally valid. |
| 6 | Phase identity is the full directory slug, never the bare number | ✓ VERIFIED (regression-confirmed) | `parser.ts` unchanged in this regard; `decimal-phase` fixture test still passing. |
| 7 | Resolver: stored map id → `roadmap:<repo>` label → title-hash, no duplicate records | ✓ VERIFIED (regression-confirmed) | `resolve.ts` unchanged since previous round; `resolve.test.ts`/`diff.test.ts` still passing, including the durable-issue-identity (CR-01) and stored-id-first-milestone (WR-05) coverage confirmed present in this round. |
| 8 | Diff engine produces the documented `+N milestones, +M issues, +L labels` / `~D dates` summary shape; date proposer orders phases correctly and never invents dates for completed phases | ✓ VERIFIED (regression-confirmed) | `diff.ts`/`dates.ts` unchanged; `diff.test.ts`/`dates.test.ts` still passing. Per-issue `detail` lines now inherit the CORRECTED title for all 270 real plans (Truth #1 fixed). |
| 9 | `--dry-run` performs zero mutation calls; `--project <name>` apply path gates writes behind an explicit y/N prompt (`--yes` bypasses); apply/yes without exactly one resolved `--project` is a hard error (bulk-write guard) | ✓ VERIFIED (regression-confirmed) | `apply.ts`/`cli.ts` unchanged; `cli.test.ts` truth-table still passing. Manually re-confirmed `--dry-run` with no `LINEAR_API_KEY` still fails fast with a clean one-line message (`LINEAR_API_KEY environment variable is not set. Export it before running sync:gsd.`), no stack trace. |
| 10 | `planAhead` patch keeps `roadmap.json` schema-valid and leak-free, and is deferred until AFTER approval (never on a declined prompt) | ✓ VERIFIED (regression-confirmed) | `apply.ts` unchanged; `cli.test.ts` "never patches the snapshot on the pre-approval leg" still passing; WR-06 fix (defer snapshot patch until after approval) confirmed present via commit `2cc6e10`. |
| 11 | Linear token stays server-side; every untrusted `.planning/` value passes through GraphQL `$variables`, never string interpolation | ✓ VERIFIED (regression-confirmed) | No changes to `cli.ts`, `resolve.ts`, `apply.ts`, or the mutation/query definitions since the previous confirmed read. |

**Score:** 11/11 truths fully verified (Truth #1 now closes cleanly — the residual gap from the previous verification round is resolved)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/sync-gsd-linear/walker.ts` | Enumerates `phases/*` dirs, full-slug identity | ✓ VERIFIED | Unchanged; live probe confirms correct phase counts across all 3 repos |
| `scripts/sync-gsd-linear/parser.ts` | Normalized model + accurate title extraction | ✓ VERIFIED | `leadingH1()`/`titleFor()` fix confirmed correct against 270 real plans; schema-valid throughout |
| `scripts/sync-gsd-linear/resolve.ts` | map→label→title-hash resolver, durable issue identity | ✓ VERIFIED | CR-01 description-marker recovery present; `resolveMilestone` stored-id-first present |
| `scripts/sync-gsd-linear/diff.ts` | Diff engine + milestone/issue matching | ✓ VERIFIED | `findMatchingMilestone` consults stored map id before title-hash (WR-05) |
| `scripts/sync-gsd-linear/apply.ts` | Create-only write engine, y/N gate, planAhead patch deferral | ✓ VERIFIED | `issueCreate` embeds `<!--gsd-key:...-->` marker; snapshot patch deferred until after approval |
| `scripts/sync-gsd-linear/cli.ts` | Bulk-write guard, `--dry-run` default, `--anchor`/`--cadence` validation | ✓ VERIFIED | Unchanged since previous round; `cli.test.ts` truth-table green |
| `scripts/sync-gsd-linear.ts` | Entrypoint with clean fail-fast error surfacing | ✓ VERIFIED | Manually re-confirmed one-line fail-fast message, no stack trace, no `LINEAR_API_KEY` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `walker.ts` | `parser.ts` | `RawPhaseDir[]` → `parseRepo()` | ✓ WIRED | Live 270-plan probe confirms end-to-end correctness |
| `parser.ts` | `resolve.ts`/`diff.ts` | `NormalizedModel.plans[].key`/`.title` | ✓ WIRED | Title now correct for issue-create `detail` lines and Linear `title` field |
| `apply.ts` (`issueCreate`) | `resolve.ts` (`readProjectIssues`) | `<!--gsd-key:...-->` description marker | ✓ WIRED | CR-01 map-loss test proves round-trip recovery works against the mocked GraphQL server |
| `diff.ts` (`findMatchingMilestone`) | `resolve.ts` (`resolveMilestone`) | stored map id lookup before title-hash | ✓ WIRED | WR-05 fix confirmed present and exercised by `diff.test.ts` |
| `cli.ts` | `prompt.ts` | y/N approval gate before any mutation call | ✓ WIRED | Unchanged; `cli.test.ts` truth-table still green |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| SYNC-01 | 06-01, 06-02 | `.planning/` walker + `PLAN.md` parser producing a normalized model | ✓ SATISFIED | Walker correct; parser's title extraction now correct against all 270 real plans across all 3 target repos — the previous BLOCKED status is resolved |
| SYNC-02 | 06-03, 06-05 | Linear resolver — map → label → title-hash, no duplicates | ✓ SATISFIED | Regression-confirmed; CR-01/WR-05 fixes present |
| SYNC-03 | 06-04 | Per-project diff engine + date proposer | ✓ SATISFIED | Regression-confirmed; diff `detail` lines now inherit the corrected titles |
| SYNC-04 | 06-01, 06-06, 06-07 | `--dry-run` default + `--project` apply path + idempotent upsert | ✓ SATISFIED (logic); live wire → human_needed | Regression-confirmed; a real `LINEAR_API_KEY` apply+re-run against production Linear remains deferred to human verification per 06-VALIDATION.md's own Manual-Only row |

No orphaned requirement IDs — SYNC-01..04 all appear in at least one plan's `requirements:` frontmatter and REQUIREMENTS.md.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any `scripts/sync-gsd-linear/*.ts` non-test file. The previous round's sole BLOCKER (`parser.ts` `firstH1()` fence-aware-but-not-heading-aware) is resolved by `leadingH1()`'s leading-line-only contract.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `CI=true npx vitest run` | 248/248 passed, 17 files | ✓ PASS |
| sync-gsd-linear suite green | `CI=true npx vitest run scripts/sync-gsd-linear` | 129/129 passed, 10 files | ✓ PASS |
| Typecheck clean | `npx tsc -b --noEmit` | no output / exit 0 | ✓ PASS |
| Lint clean | `npx eslint .` | 0 errors, 3 pre-existing unrelated warnings | ✓ PASS |
| CLI fails fast without `LINEAR_API_KEY` | `npx tsx scripts/sync-gsd-linear.ts --dry-run` (key unset) | `LINEAR_API_KEY environment variable is not set. Export it before running sync:gsd.`, no stack trace | ✓ PASS |
| Originally-reported fence bug + both unfenced follow-on bugs are gone | Direct re-probe of `titleFor()`/`leadingH1()` against the exact 4 previously-flagged real files (23-observability-followups/PLAN.md, 28-03-PLAN.md, 04-07-PLAN.md, 04-08-PLAN.md) | All 4 now yield filename/slug fallback titles, not the buried garbage lines | ✓ PASS |
| Live walker+parser against ALL 270 real plans across all 3 configured target repos (bypassing the Linear-dependent resolve step, which needs the key) | Live probe importing the real `walkPlanning`/`parseRepo` directly, dumping every plan's title, scanned for code-like/non-heading content | 34/23/12 phases enumerated correctly; 270/270 plans produce accurate titles (4 heuristic flags all confirmed genuine long H1 headings) | ✓ PASS |
| CR-01 issue dedup survives total `linear-map.json` loss | `CI=true npx vitest run scripts/sync-gsd-linear/apply.test.ts -t "CR-01"` (subset of full suite run) | "applyProject survives linear-map.json loss (CR-01)" passes | ✓ PASS |

### Human Verification Required

### 1. Live dry-run accuracy against real Linear

**Test:** Run `LINEAR_API_KEY=<real key> pnpm sync:gsd -- --project claude-workflow` (dry-run default) and eyeball the printed diff against the repo's `.planning/` and current Linear workspace state.
**Expected:** Diff counts and per-record detail lines are accurate, with no garbage titles.
**Why human:** "Accurate" is explicitly a human judgment per 06-VALIDATION.md's own Manual-Only Verifications row; `LINEAR_API_KEY` is unset in this environment so the Linear-dependent resolve step cannot run here at all. The parser-side half of this criterion (title correctness) is now fully closed by automated verification — this remaining item is the live-Linear-state comparison only.

### 2. Live idempotency (apply twice against real Linear)

**Test:** `--project <name> --apply`, approve, then re-run the same command; confirm the second run's diff is empty and Linear shows no duplicate records.
**Expected:** Second run reports zero creates; record counts unchanged.
**Why human:** Writing to production Linear is deliberately approval-gated (D-06-07) and the verifier should not perform live writes; the underlying dedup logic — including the CR-01 map-loss edge case — is already proven correct against a mocked Linear workspace (Truths #2/#3 above) — this is the live-wire confirmation only, and 06-VALIDATION.md itself lists this as a Manual-Only / `checkpoint:human-verify` item.

### Gaps Summary

No gaps. The previous verification round's only BLOCKER — `parser.ts`'s title extraction accepting any `#`-prefixed line anywhere in the body as a genuine heading, producing garbage Linear issue titles for 3 real plans across 2 of the 3 target repos — is fully resolved by commit `fb1639b`'s `leadingH1()`, which restricts heading extraction to the first non-blank body line. This was verified independently in this round via (1) direct code read, (2) targeted re-probe of the exact 3 previously-failing files plus the original fenced-comment bug file, and (3) an exhaustive live re-run of the real walker→parser pipeline against all 270 real plans across all 3 configured target repos, finding zero remaining garbage titles. All 10 other previously-verified truths remain green on regression (no other files changed). The two remaining items are both explicitly designated Manual-Only in 06-VALIDATION.md and require a real `LINEAR_API_KEY` and a live Linear workspace, which are unavailable in this environment — status is `human_needed`, not `gaps_found`.

---

_Verified: 2026-07-15T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
