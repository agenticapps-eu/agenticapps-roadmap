---
phase: "02"
plan: "02"
subsystem: "data-layer"
tags: [linear, snapshot, zod, tdd, security, ci]
dependency_graph:
  requires: ["01"]
  provides: ["roadmap-schema", "linear-client", "snapshot-transform", "app-loader", "snapshot-ci"]
  affects: ["src/router.tsx", "src/pages/OverviewPage.tsx", "src/pages/TimelinePage.tsx", "public/roadmap.json"]
tech_stack:
  added: ["zod@4.4.3", "vitest@4.1.9", "tsx@4.22.4"]
  patterns: ["data-router loader", "allow-list projection", "assertNoLeak guard", "TDD red-green"]
key_files:
  created:
    - src/lib/roadmap/schema.ts
    - src/lib/roadmap/loader.ts
    - scripts/linear/client.ts
    - scripts/linear/transform.ts
    - scripts/linear/__fixtures__/raw-clean.ts
    - scripts/linear/__fixtures__/raw-malicious.ts
    - scripts/linear/transform.test.ts
    - scripts/sync-snapshot.ts
    - scripts/seed-placeholder.ts
    - .github/workflows/snapshot.yml
    - tsconfig.scripts.json
    - vitest.config.ts
    - public/roadmap.json
  modified:
    - src/router.tsx
    - src/pages/OverviewPage.tsx
    - src/pages/TimelinePage.tsx
    - package.json
    - pnpm-lock.yaml
    - tsconfig.json
    - .gitignore
decisions:
  - "Use relative imports in scripts/ (not @/ alias) — tsx CLI does not resolve Vite path aliases"
  - "Remove public/roadmap.json from .gitignore — committed placeholder; CI regenerates via pnpm sync:snapshot"
  - "Schema imported by both scripts and app (via relative path in scripts, @/ in src) — single source of truth"
  - "assertNoLeak runs before RoadmapJsonSchema.parse — fail-fast on security, then on shape"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-26"
  tasks: 6
  files: 20
---

# Phase 02 Plan 02: Linear Data Layer & Static Snapshot Summary

Zod schema + leak-proof transform with TDD, typed Linear GraphQL client, sync-snapshot CLI, data-router loader wired into app pages, and daily CI snapshot refresh action.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 (RED) | Failing sanitization + schema tests | 7372f45 |
| 2 (GREEN) | Roadmap schema + leak-proof snapshot transform | f8d27bf |
| 3 | Typed Linear GraphQL client | f798046 |
| 4 | sync-snapshot script + sync:snapshot npm script | 0ddbd68 |
| 5 | App loader wired into Overview/Timeline pages | 8a08fd8 |
| 6 | Scheduled snapshot GitHub Action | 362c845 |

## TDD Red-Green Evidence

**RED (commit 7372f45):** Tests written before any implementation. Running `pnpm test` produced:

```
FAIL  scripts/linear/transform.test.ts
Error: Cannot find module './transform.ts'
Test Files  1 failed (1)
Tests  no tests
```

**GREEN (commit f8d27bf):** After implementing `schema.ts` and `transform.ts`:

```
Test Files  1 passed (1)
Tests  13 passed (13)
Duration  147ms
```

RED observed before GREEN. All 13 tests remain green through final verification.

## Verification Results

```
pnpm test       → 13/13 passed
pnpm typecheck  → 0 errors, 0 warnings
pnpm lint       → 0 errors, 1 pre-existing warning (button.tsx, Phase 01, out of scope)
pnpm build      → dist/ produced, 353.97 kB JS bundle
```

No token literals (`lin_api_*`) or email addresses in `public/roadmap.json` — confirmed by grep.

## Files Created

### `src/lib/roadmap/schema.ts`
Zod schema for `roadmap.json`. Exports `RoadmapJsonSchema` and `RoadmapJson` (via `z.infer`). Shared by both scripts and app. Fields: `generatedAt` (ISO string), `initiatives[]` (id, name, color nullable, status), `projects[]` (id, name, summary nullable, initiativeId nullable, status, priority, startDate nullable, targetDate nullable, milestones[], issueCounts{backlog,started,done}).

### `scripts/linear/transform.ts`
Pure function `buildSnapshot(raw, opts?) → RoadmapJson`. Allow-list projection only — never spreads raw Linear objects. State-type → bucket mapping: `triage|backlog|unstarted → backlog`, `started → started`, `completed → done`, `cancelled → excluded`. `assertNoLeak()` throws on `/lin_api_[A-Za-z0-9-]+/`, live `LINEAR_API_KEY` value, or `/[\w.+-]+@[\w-]+\.[\w.-]+/`. `RoadmapJsonSchema.parse()` as final gate.

### `scripts/linear/client.ts`
Typed `fetchWorkspace() → Promise<RawWorkspace>`. Explicit GraphQL query string. Typed response interfaces (no `any`). Throws clear error if `LINEAR_API_KEY` unset. Throws on non-2xx HTTP or GraphQL errors. Maps GQL nodes to `RawWorkspace` via explicit allow-list.

### `scripts/sync-snapshot.ts`
CLI entry: `fetchWorkspace()` → `buildSnapshot()` → `writeFileSync('public/roadmap.json', …)`. Runs via `pnpm sync:snapshot` (tsx).

### `.github/workflows/snapshot.yml`
`workflow_dispatch` + `schedule: cron 0 6 * * *`. Steps: checkout, pnpm@9, node 24, `pnpm install --frozen-lockfile`, `pnpm sync:snapshot` with `LINEAR_API_KEY: ${{ secrets.LINEAR_API_KEY }}`, guarded commit+push with `[skip ci]`. Token never in artifact. No untrusted GitHub event context in `run:` steps.

### `src/lib/roadmap/loader.ts`
React Router 7 data-router loader: `fetch('/roadmap.json')` → `RoadmapJsonSchema.parse()`. Zero external/Linear network calls. Throws `Response` on HTTP error for React Router error boundary handling.

## .gitignore / Snapshot Decision

`public/roadmap.json` was previously gitignored. Removed the ignore line because:
- The committed snapshot enables the app to render without a build-time Linear call
- CI regenerates it daily via `pnpm sync:snapshot`
- The placeholder (from `rawClean` fixture) is safe to commit — no secrets, verified by `assertNoLeak`

## Known Stubs / Placeholder

**`public/roadmap.json` is a PLACEHOLDER.** It was generated from `scripts/linear/__fixtures__/raw-clean.ts` (synthetic fixture data), not from the live AGE Linear workspace. It contains 2 initiatives and 3 projects from the fixture, not real workspace data.

A separate agent (or the user running `LINEAR_API_KEY=<key> pnpm sync:snapshot`) must replace it with real data. The `pnpm sync:snapshot` script is fully wired — it only requires the environment variable to be set.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Relative import path in scripts/ instead of @/ alias**
- **Found during:** Task 5 (app loader wiring / seed-placeholder run)
- **Issue:** `tsx` CLI does not resolve Vite/TypeScript `@/` path aliases. Running `node --import tsx/esm scripts/seed-placeholder.ts` failed with `Cannot find package '@/lib'`.
- **Fix:** Changed `import … from "@/lib/roadmap/schema.ts"` to `import … from "../../src/lib/roadmap/schema.ts"` in `scripts/linear/transform.ts` and `scripts/linear/transform.test.ts`. The app's `src/` files continue to use `@/` (Vite resolves it). Vitest also resolves `@/` via its config, so tests pass either way — but the relative path is unambiguous for both runners.
- **Files modified:** `scripts/linear/transform.ts`, `scripts/linear/transform.test.ts`
- **Commit:** 8a08fd8

## Threat Flags

None. No new network endpoints, auth paths, or trust boundary crossings introduced in app code. The Linear API token is handled exclusively in `scripts/linear/client.ts` (CI/server-side only) and in the GitHub Actions secret binding — never in the client bundle or snapshot artifact. `assertNoLeak` is a compile-time + runtime guard on the transform output.

## Self-Check

Files exist:
- [x] `src/lib/roadmap/schema.ts`
- [x] `src/lib/roadmap/loader.ts`
- [x] `scripts/linear/client.ts`
- [x] `scripts/linear/transform.ts`
- [x] `scripts/linear/transform.test.ts`
- [x] `scripts/sync-snapshot.ts`
- [x] `.github/workflows/snapshot.yml`
- [x] `public/roadmap.json`

Commits exist:
- [x] 7372f45 — test(02): sanitization rejects leaked secrets
- [x] f8d27bf — feat(02): roadmap schema + leak-proof snapshot transform
- [x] f798046 — feat(02): typed Linear GraphQL client
- [x] 0ddbd68 — feat(02): sync-snapshot script
- [x] 8a08fd8 — feat(02): app loader wires roadmap.json
- [x] 362c845 — ci(02): scheduled snapshot GitHub Action

## Self-Check: PASSED
