---
phase: 05
slug: overview-dashboard
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-15
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Test infrastructure and req→test map seeded from `05-RESEARCH.md` § Validation Architecture,
> then reconciled against the finalized plans (05-01..05-07, incl. the 05-07 router-revalidation
> plan added during the `--reviews` revision). The pure-logic plans (05-01 schema, 05-02
> selectors, 05-07 revalidation) are test-first (RED→GREEN), so their test files are authored
> in-plan — there is no separate Wave-0 test-authoring pass.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4.1.9 |
| **Config file** | `vitest.config.ts` (env `node`, globs `src/**/*.test.ts`) |
| **Quick run command** | `CI=true npx vitest run src/lib/overview` |
| **Full suite command** | `CI=true npx vitest run` |
| **Typecheck** | `npx tsc -b --noEmit` |
| **Lint** | `npx eslint .` |
| **Build** | `CI=true npx vite build` |
| **Estimated runtime** | ~5 seconds (unit suite) |

> Non-TTY note: `pnpm test` / `pnpm typecheck` abort in agent shells; the plans use
> `CI=true npx vitest run <path>` and `npx tsc -b --noEmit` directly. This doc mirrors that.

---

## Sampling Rate

- **After every task commit:** `CI=true npx vitest run src/lib/overview` + `npx tsc -b --noEmit`
- **After every plan wave:** `CI=true npx vitest run` + `npx tsc -b --noEmit`
- **Before `/gsd:verify-work`:** `CI=true npx vitest run` + `npx tsc -b --noEmit` + `CI=true npx vite build` + `npx eslint .` all green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

> Reconciled against the finalized plan/task IDs. Pure-logic plans carry `<automated>` verify;
> presentational + assembly plans are compile/lint-gated with visual fidelity deferred to human
> UAT (D-05-06 "Path B" — the repo has no React-render harness).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 05-01 | 1 | OV-04 | T-05-01 (tampering) | snapshot without `planAhead` still parses; `planAhead:true/false/null` accepted, wrong-type rejected | unit | `CI=true npx vitest run src/lib/roadmap/schema.test.ts` | in-plan | ⬜ pending |
| 05-02-T1 | 05-02 | 1 | OV-01 | — | `computeKpis(filtered)` counts scheduled/undated/by-priority/by-status + distinct non-null initiatives | unit | `CI=true npx vitest run src/lib/overview/selectors.test.ts` | in-plan | ⬜ pending |
| 05-02-T1 | 05-02 | 1 | OV-01 | — | `rollupInitiativeHealth` sums issueCounts + scheduled/undated per initiative; zero-project row; Unassigned row iff null-initiative projects | unit | `CI=true npx vitest run src/lib/overview/selectors.test.ts` | in-plan | ⬜ pending |
| 05-02-T2 | 05-02 | 1 | OV-02 | T-05-02 (tampering/DoS) | `decodeFilters(encodeFilters(f))` round-trips; defensive parse (priority clamp 0..4, real-calendar ISO date, reversed range, ignore `project`/`source`) | unit | `CI=true npx vitest run src/lib/overview/selectors.test.ts` | in-plan | ⬜ pending |
| 05-02-T2 | 05-02 | 1 | OV-02 | — | `resolveRange` custom-over-quarter precedence (coexist — both params reachable); `applyFilters` AND-composition + undated exclusion when range active | unit | `CI=true npx vitest run src/lib/overview/selectors.test.ts` | in-plan | ⬜ pending |
| 05-07-T1 | 05-07 | 1 | OV-02 | T-05-09 (refetch DoS), T-05-10 (stale-source spoof) | `shouldRevalidateRoadmap`: no revalidate on filter/`?project`-only change; revalidate on snapshot↔live flip | unit | `CI=true npx vitest run src/lib/roadmap/loader.test.ts` | in-plan | ⬜ pending |
| 05-03-T1 | 05-03 | 1 | OV-01, OV-03 | T-05-SC (supply chain) | dialog+card scaffolded from base-ui (no Radix, no dep drift) | compile | `npx tsc -b --noEmit` + `git diff --quiet -- package.json pnpm-lock.yaml` | in-plan | ⬜ pending |
| 05-04-T1/T2 | 05-04 | 2 | OV-01 | T-05-07 (DoS) | KpiCards + HealthStrip render from props; `total===0` guard; shared `PRIORITY_LABELS` | compile | `npx tsc -b --noEmit` + `npx eslint src/components/overview` | in-plan | ⬜ pending |
| 05-05-T1/T2 | 05-05 | 2 | OV-02, OV-03, OV-04 | T-05-04 (open redirect), T-05-05 (`?project` guard), T-05-03 (badge) | FilterBar delegates to selectors; guarded `?project` dialog; guarded linear.app link; `SyncBadge` truthy-guard | compile | `npx tsc -b --noEmit` + `npx eslint src/components/overview` | in-plan | ⬜ pending |
| 05-06-T1 | 05-06 | 3 | OV-01..OV-04 | T-05-06, T-05-08 | OverviewPage wires `decodeFilters→resolveRange→applyFilters→computeKpis(filtered)`; both hooks before guard; SyncBadge mounted | full suite | `CI=true npx vitest run` + `npx tsc -b --noEmit` + `CI=true npx vite build` + `npx eslint .` | in-plan | ⬜ pending |
| 05-06-T2 | 05-06 | 3 | OV-01..OV-04 | — | Visual/interaction fidelity, shareable-URL reload, drill-down, dark/mobile, OV-04 badge smoke | manual | human UAT (Path B) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Satisfied in-plan: the pure-logic plans are test-first (RED→GREEN), so the test files below
> are authored as the first task of their own plan rather than in a separate Wave-0 pass. No
> pre-existing test infra gap — vitest is already configured.

- [x] `src/lib/overview/selectors.test.ts` — OV-01 (KPIs, health rollup, zero-project + Unassigned rows) + OV-02 (round-trip, defensive parse, AND-composition, resolveRange coexist-precedence) — authored in 05-02
- [x] `src/lib/roadmap/schema.test.ts` — OV-04 back-compat (`planAhead` absent/true/false/null/wrong-type) — authored in 05-01
- [x] `src/lib/roadmap/loader.test.ts` — OV-02 `shouldRevalidateRoadmap` 4 cases — extended in 05-07
- [x] Framework install: none — vitest already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| KPI cards + health strip visual fidelity | OV-01 | No React-render harness (Path B) | `pnpm dev`, load Overview `/`, confirm five KPI cards + one health row per initiative (color chip + backlog/started/done bar), Unassigned row iff null-initiative projects |
| Filters shareable + survive reload; custom-over-quarter; undated drop when range active | OV-02 | URL/browser interaction not assertable in node unit tests | Set filters, copy URL, reload → filters persist; set custom from/to over a quarter → custom wins; clear → params disappear |
| Drill-down dialog render + guarded Linear link | OV-03 | Dialog render + live Linear destination need a human eye | Click a project row → dialog opens with counts + milestones; `?project` in URL; reload re-opens; close removes `?project`; garbage `?project` → no dialog/crash |
| OV-04 "out of sync" badge appears when `planAhead` truthy | OV-04 | Badge is invisible until Phase-6 data; visual confirm only | Temporarily set `"planAhead": true` on one project in `public/roadmap.json`, reload, confirm badge in list row + dialog header, then `git checkout -- public/roadmap.json` |
| Zero-network under filter/drill-down interaction | OV-02 | Network behavior needs devtools observation | With `shouldRevalidate` wired (05-07), toggle filters / open-close drill-down in snapshot mode → no `/roadmap.json` refetch in the Network panel |

---

## OV-03 Conditional Verification Note

The committed `public/roadmap.json` currently has no project `url` fields (Phase-4's gated URL
re-sync has not run), so the guarded Linear deep-link renders nothing by default. The OV-03
seam is correct and the guard is unit-safe; full end-to-end demonstration of "drill-down links
resolve to Linear" is **conditionally verified** pending the external Phase-4 snapshot URL
regeneration. No URL-scanning/re-sync task belongs in Phase 5 (that is Phase-6/Phase-4 scope).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are compile/lint-gated or explicit manual (Path B)
- [x] Sampling continuity: no 3 consecutive tasks without automated/compile verify
- [x] Wave 0 covered in-plan (test-first plans author their own test files)
- [x] No watch-mode flags (all runs use `CI=true npx vitest run`)
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
