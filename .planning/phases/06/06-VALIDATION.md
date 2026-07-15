---
phase: 6
slug: sync-gsd-linear-cli
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `06-RESEARCH.md` §"Validation Architecture". Per-task rows are
> populated when plans exist (planner/executor); the requirement→test map below
> is the source of truth for coverage.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.9 (already configured — `vitest.config.ts` present) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `CI=true npx vitest run scripts/sync-gsd-linear/<touched-file>.test.ts` |
| **Full suite command** | `CI=true npx vitest run` |
| **Estimated runtime** | ~seconds (unit + mocked-GraphQL integration; no live network) |

*Non-TTY note: `pnpm test` can hang in agent shells — always use `CI=true npx vitest run` directly.*

---

## Sampling Rate

- **After every task commit:** `CI=true npx vitest run scripts/sync-gsd-linear/<touched-file>.test.ts`
- **After every plan wave:** `CI=true npx vitest run scripts/sync-gsd-linear`
- **Before `/gsd-verify-work`:** Full suite green (`CI=true npx vitest run`) + the two manual-only items below captured in a UAT/verification artifact.
- **Max feedback latency:** < 30s

---

## Requirement → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | Walker discovers all `phases/*` dirs incl. duplicate-`NN` and decimal-phase names; parser extracts plan headings with/without frontmatter | unit | `vitest run scripts/sync-gsd-linear/walker.test.ts scripts/sync-gsd-linear/parser.test.ts` | ❌ W0 |
| SYNC-02 | Resolver honors map → project-label → issue-label → title-hash order; no duplicate on re-resolve | unit | `vitest run scripts/sync-gsd-linear/resolve.test.ts` | ❌ W0 |
| SYNC-02 | Title-hash stable across runs (same slug/heading → same hash; different slug → different) | unit | `vitest run scripts/sync-gsd-linear/hash.test.ts` | ❌ W0 |
| SYNC-03 | Diff engine produces the documented summary shape (`+ N milestones, + M issues, ~ D dates`) | unit | `vitest run scripts/sync-gsd-linear/diff.test.ts` | ❌ W0 |
| SYNC-03 | Date proposer: completed phases untouched; anchor/cadence math + decimal-phase ordering correct | unit | `vitest run scripts/sync-gsd-linear/dates.test.ts` | ❌ W0 |
| SYNC-04 | `--dry-run` performs zero mutation calls (mock mutation `fetch` never invoked) | unit | `vitest run scripts/sync-gsd-linear/apply.test.ts -t "dry-run"` | ❌ W0 |
| SYNC-04 | Idempotency: apply → mutate mock → re-resolve against populated mock → second diff empty | integration (mocked GraphQL) | `vitest run scripts/sync-gsd-linear/apply.test.ts -t "idempotent"` | ❌ W0 |
| SYNC-04 | `planAhead` patch keeps `roadmap.json` schema-valid and leak-free (`RoadmapJsonSchema` + `assertNoLeak`) | unit | `vitest run scripts/sync-gsd-linear/apply.test.ts -t "planAhead"` | ❌ W0 |

---

## Wave 0 Requirements

- [ ] `scripts/sync-gsd-linear/__fixtures__/planning-trees/` — synthetic `.planning/` fixtures reproducing: duplicate-`NN` dirs, decimal-phase dirs, frontmatter-less `PLAN.md`, a bare bodyless `PLAN.md`, a `ROADMAP.md` stub covering only a phase subset.
- [ ] `scripts/sync-gsd-linear/__fixtures__/linear-responses.ts` — mock `GqlResponse`-shaped fixtures for teams/labels/projects/milestones reads (mirror the `gqlClean`/`gqlWithEmail` contract in `functions/api/linear/[[path]].test.ts`).
- [ ] `scripts/sync-gsd-linear/__fixtures__/linear-mutation-mock.ts` — in-memory mock GraphQL server (mutation name → handler mutating in-memory workspace) to drive the "apply twice → second run no-op" idempotency test without the real API.
- [ ] Framework install: none — Vitest already configured project-wide.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dry-run against a **real** target repo (`claude-workflow`) produces a diff a human judges accurate | SYNC-01..04 (E2E) | "Accurate" per success criterion #1 is a human judgment against real Linear state, not a fixture-derivable assertion | Run `pnpm sync:gsd -- --project claude-workflow` (dry-run default), eyeball the printed diff vs. the repo's `.planning/` and Linear |
| A real apply run followed by a real re-run is a no-op | SYNC-04 (E2E, `checkpoint:human-verify`) | Writing to production Linear is deliberate + approval-gated (D-06-07); CI cannot safely repeat it. Mocked integration test covers the *logic*; this covers the *live wire* | With `LINEAR_API_KEY` set, apply one project, then re-run — second run must report an empty diff / no writes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
