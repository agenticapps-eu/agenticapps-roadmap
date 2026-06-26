# Phase 2 — REVIEW: Linear data layer & static snapshot

Two-stage review per the AgenticApps workflow. Branch `phase-02-linear-snapshot` vs `main`.

## Stage 1 — Spec compliance (orchestrator)

| PLAN task | Status | Evidence |
|---|---|---|
| 1. Typed Linear GraphQL client | ✅ | `scripts/linear/client.ts` — `fetch` to Linear GraphQL, token from env, explicit typed responses, no `any`. |
| 2. `sync-snapshot.ts` → `public/roadmap.json` per architecture shape | ✅ | `scripts/sync-snapshot.ts` + `pnpm sync:snapshot`; output matches `docs/architecture.md` shape (verified: keys `id,name,summary,initiativeId,status,priority,startDate,targetDate,milestones,issueCounts`). |
| 3. Zod schema + parser + typed loader hook | ✅ | `src/lib/roadmap/schema.ts` (single source, `z.infer`); `src/lib/roadmap/loader.ts` (data-router loader, Zod-parses); pages read via `useRouteLoaderData("root")`. |
| 4. Sanitization: no token/email leak | ✅ | `assertNoLeak` (TDD: RED `7372f45` → GREEN `f8d27bf`); allow-list projection; CSO audit 16/16 (SECURITY.md). |
| 5. GitHub Action `snapshot.yml` | ✅ | `.github/workflows/snapshot.yml` — `schedule` + `workflow_dispatch`, `LINEAR_API_KEY` from secrets, scoped `contents: write`, commit-if-changed. |

**"Done when":**
- *App renders the snapshot with zero network calls* — ✅ QA verified: both routes render real AGE data; only same-origin `/roadmap.json` fetched; zero external/Linear calls.
- *`pnpm sync:snapshot` produces a valid roadmap.json from the live AGE workspace* — ⚠️ **PARTIAL by design (user decision).** The script + token path are built and CI-wired. The committed `public/roadmap.json` is **real AGE data** seeded via the Linear MCP through the production `buildSnapshot` transform. The live token-based `pnpm sync:snapshot` run is exercised in CI once the `LINEAR_API_KEY` repo secret is set (the token never touches a dev machine, per CLAUDE.md). Tracked as a release step.

**Deviation handled mid-phase:** QA caught the loader-data crash (pages used `useLoaderData()` for parent-route data → undefined). Fixed `40836f6` (+ errorElement/HydrateFallback, closing the Phase 01 follow-up).

**Stage 1 verdict: PASS** (with the documented live-run-in-CI caveat).

## Stage 2 — Independent code quality

Independent reviewer (`pr-review-toolkit:code-reviewer`, separate context) on the branch diff.

| # | Sev (conf) | Finding | Disposition |
|---|---|---|---|
| 1 | Critical (97) | `useLoaderData()` returns undefined in child pages → render crash | **ALREADY FIXED** — QA caught the same bug; resolved in `40836f6` (`useRouteLoaderData("root")` + boundaries). Independent confirmation of the diagnosis. |
| 2 | Important (84) | `GqlIssue.state` typed non-nullable, but Linear allows stateless issues → null-deref in the CI live run | **FIXED** `ac027b3` — nullable type + skip-null guard in bucketing; regression test added (14 tests). |
| 3 | Important (80) | Loader's `Zod.parse` throws raw `ZodError` → schema path leaks into UI | **FIXED** `ac027b3` — `safeParse` → `Response(500, "malformed")`, consistent with the `!res.ok` branch. |
| — | Nit | `seed-placeholder.ts` is a committed one-off | **FIXED** `ac027b3` — removed (superseded by the real MCP-seeded snapshot). |
| — | Nit | Action has no `concurrency` group | **FIXED** `ac027b3` — added `concurrency: { group: snapshot }`. |
| — | Nit | `git push` without explicit branch / no concurrency | push is correct for scheduled default-branch runs; concurrency added. |

**Clean (reviewer-confirmed):** schema matches architecture.md; issueCounts bucketing correct; `assertNoLeak` runs before Zod parse; `roadmap.json` has no tokens/emails; token confined to `scripts/`, absent from bundle; strict TS, no `any`; errorElement/HydrateFallback present (Phase 01 follow-up resolved).

**Stage 2 verdict: PASS** — Critical was already QA-fixed; both Important findings + nits fixed and re-verified (14/14 tests, typecheck/lint/build green).

## Security gate

gstack `/cso` (gsd-security-auditor) → `.planning/phases/02/SECURITY.md`: **16/16 threats closed**
(15 PASS + 1 accepted PII). F1 (TOKEN_RE underscore) **fixed** in `569d812`. F2 (first names in
project summaries, private repo) accepted.
