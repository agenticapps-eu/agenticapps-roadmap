---
phase: 07
slug: live-refresh-and-write-back
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `07-RESEARCH.md` § Validation Architecture. Live end-to-end
> backfill/dispatch is OUT of this phase's automated gate (R-1) and becomes a
> Phase-8 HUMAN-UAT item, mirroring Phase 3's Access-proof deferral.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (already configured) |
| **Config file** | `vitest.config.ts` — `include: ["scripts/**/*.test.ts", "functions/**/*.test.ts", "src/**/*.test.ts"]` (new files auto-discovered) |
| **Quick run command** | `CI=true npx vitest run functions/api/backfill` |
| **Full suite command** | `CI=true npx vitest run` |
| **Estimated runtime** | ~few seconds for targeted; existing full suite ~ per Phase 6 (251 tests green) |

*Note: `pnpm test` aborts in non-TTY agent shells — use `CI=true npx vitest run` directly.*

---

## Sampling Rate

- **After every task commit:** Run targeted `CI=true npx vitest run <changed-file-glob>`
- **After every plan wave:** Run `CI=true npx vitest run` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds (targeted)

---

## Per-Task Verification Map

| Requirement | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|------------|-----------------|-----------|-------------------|-------------|
| LIVE-01 | `shouldRevalidateRoadmap` lets an explicit same-URL revalidate through, still blocks filter/drill-down navigations | — | N/A | unit | `CI=true npx vitest run src/lib/roadmap/loader.test.ts` | ❌ W0 |
| LIVE-01 | `formatFreshness(generatedAt, now)` pure formatter → "updated Nh ago", null-safe when loaderData absent | — | N/A | unit | `CI=true npx vitest run src/lib/roadmap/freshness.test.ts` | ❌ W0 |
| LIVE-01 | Refresh button renders/enabled only in Live mode; disabled while `navigation.state === "loading"` | — | N/A | manual (human-check — no DOM test env; see Manual-Only) | N/A | N/A |
| LIVE-02 | Dispatch Function returns `{ runId }` on GitHub success; **GitHub token never in response body** | T-07 leak | Generic error, no upstream body/header echoed | unit | `CI=true npx vitest run functions/api/backfill/dispatch.test.ts` | ❌ W0 |
| LIVE-02 | Dispatch Function collapses any upstream failure to a generic error (single try/catch) | T-07 leak | Leak-safe generic 5xx | unit | `CI=true npx vitest run functions/api/backfill/dispatch.test.ts` | ❌ W0 |
| LIVE-02 | Status Function returns `{ status, conclusion, diff? }`; `diff` present only for a dry-run job whose marker line is found | T-07 leak | Token absent from body | unit | `CI=true npx vitest run functions/api/backfill/status.test.ts` | ❌ W0 |
| LIVE-02 | Optimistic `planAhead` flip on Apply; reverts on polled failure/cancelled; distinct non-reverting "unknown" outcome; error dismissible | — | N/A | unit (pure core + hook cleanup) | `CI=true npx vitest run src/lib/backfill/backfill.test.ts` | ❌ W0 |
| LIVE-02 | `project` dispatch input validated (non-empty string) before GitHub call; quoted CLI arg in `backfill.yml` | V5 input-validation | Reject empty/non-string; no shell interpolation | unit + manual (YAML) | `CI=true npx vitest run functions/api/backfill/dispatch.test.ts` | ❌ W0 |
| LIVE-03 | `snapshot.yml` already satisfies daily-cron + commit-on-change + concurrency | — | N/A | manual (file inspection vs D-07-08) | N/A | ✅ exists |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/roadmap/loader.test.ts` — new/extended; the `shouldRevalidateRoadmap` fix must have a **failing test first** (this is the exact R-4 bug the research uncovered)
- [ ] `functions/api/backfill/dispatch.test.ts` — mirror `functions/api/linear/[[path]].test.ts`'s context-helper + `vi.stubGlobal("fetch")` pattern
- [ ] `functions/api/backfill/status.test.ts` — same pattern + fixtures for the run→jobs→job-logs three-fetch sequence and the `?correlationId=` resolve variant
- [ ] `src/lib/backfill/backfill.test.ts` — pure dispatch/poll/reducer core (test-first) + the `useBackfill` fake-timers cleanup test (consolidated here; no standalone `useBackfill.test.ts`)
- [ ] `src/lib/roadmap/freshness.test.ts` — pure `formatFreshness` formatter, null-safe (new target)

*The Live-mode Refresh render gate (07-01) has no automated test — the repo has no DOM/component test env; it is a Manual-Only human-check (see below).*

*Existing infrastructure (Vitest, `vi.stubGlobal("fetch")` fixtures, `functions/**` glob) covers everything else — proven in Phase 3.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Refresh control renders only in Live mode + a real click re-pulls `/api/linear/snapshot` | LIVE-01 | No DOM/component test env in this repo; the additive same-URL revalidate predicate is unit-tested but does not uniquely prove a Refresh click | Human-check: in Live mode click Refresh, confirm a `/api/linear/snapshot` network request fires and the rendered dataset replaces; confirm no Refresh button in Snapshot mode |
| Live dispatch → Linear write → next snapshot reflects it | LIVE-02 | Requires Phase-8 secrets (`LINEAR_API_KEY` + GitHub PAT bound); no local test can exercise real `workflow_dispatch` | Phase-8 HUMAN-UAT: dispatch a dry-run, verify diff readback, apply, confirm Linear + committed `roadmap.json` |
| `backfill.yml` checkout layout resolves `sync.config.json` relative sibling paths | R-2 / LIVE-02 | `actions/checkout` workspace sandboxing is CI-only; correctness is structural | Phase-8: one live dispatched run; locally verify YAML checks out roadmap into a subdir with siblings alongside |
| Scheduled `snapshot.yml` cron actually runs & commits | LIVE-03 | Cron + `LINEAR_API_KEY` secret are Phase-8-bound | Phase-8: confirm a scheduled run committed a fresh `roadmap.json` |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`CI=true` non-watch only)
- [ ] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter (verified by plan-checker, reviews replan)

**Approval:** pending
