---
phase: 03-linear-proxy
plan: 02
subsystem: infra
tags: [cloudflare, workers-types, typescript, vitest, wrangler, tsconfig]

# Dependency graph
requires:
  - phase: 03-linear-proxy/03-01
    provides: functions/ directory with bundling probe handler; confirmed cross-dir import works
provides:
  - "@cloudflare/workers-types devDependency (4.20260629.1) — legitimacy-gated before install"
  - "tsconfig.functions.json — TS project for functions/** with Worker types, no node types"
  - "Root tsconfig.json references tsconfig.functions.json — pnpm typecheck covers functions/**"
  - "vitest.config.ts include glob widened to functions/**/*.test.ts — handler tests will not be silently skipped"
  - "preview:functions script via npx --yes wrangler@4 pages dev dist — clean-machine safe"
  - ".dev.vars gitignored — local LINEAR_API_KEY token file can never be committed"
affects: [03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: ["@cloudflare/workers-types ^4.20260629.1"]
  patterns:
    - "Mirror tsconfig.scripts.json for tsconfig.functions.json — same strict/bundler/paths settings, only types differs"
    - "npx --yes wrangler@4 for preview scripts — avoids adding wrangler as a project dependency"
    - ".dev.vars gitignored before any live-test workflow (token hygiene)"

key-files:
  created:
    - "tsconfig.functions.json"
  modified:
    - "package.json"
    - "pnpm-lock.yaml"
    - "tsconfig.json"
    - "vitest.config.ts"
    - ".gitignore"

key-decisions:
  - "Use npx --yes wrangler@4 in preview:functions (not a project dep) — per 03-RESEARCH Environment Availability finding"
  - "wrangler.toml needed no additional entries — name/compatibility_date/pages_build_output_dir already sufficient for Functions"
  - "tsconfig.functions.json mirrors tsconfig.scripts.json exactly except types ([@cloudflare/workers-types] not [node]) and tsBuildInfoFile path"

patterns-established:
  - "Legitimacy checkpoint (blocking-human gate) required before any new npm package install"
  - "Parallel TS projects (app / node / scripts / functions) each with isolated types — prevents node/worker type bleed"

requirements-completed: [REQ-TYPE]

# Metrics
duration: 15min
completed: 2026-06-29
---

# Phase 03 Plan 02: Config Foundation for Functions Summary

**@cloudflare/workers-types 4.20260629.1 installed behind legitimacy gate; functions/ covered by strict TS project, vitest glob, and token-hygiene gitignore rule**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-29T08:55:00Z
- **Completed:** 2026-06-29T09:00:00Z
- **Tasks:** 2 (plus 1 approved human-verify checkpoint)
- **Files modified:** 6

## Accomplishments

- `@cloudflare/workers-types 4.20260629.1` installed as devDependency after explicit human approval (no postinstall script confirmed)
- `tsconfig.functions.json` created — strict/bundler/paths mode, `types: ["@cloudflare/workers-types"]`, `include: ["functions/**/*"]`; `pnpm typecheck` now covers functions/ with no `any` leakage
- vitest include glob widened to `["scripts/**/*.test.ts", "functions/**/*.test.ts"]` — without this change handler tests in 03-03 would be silently skipped (load-bearing)
- `preview:functions` script added using `npx --yes wrangler@4 pages dev dist` (clean-machine safe, no wrangler project dependency)
- `.dev.vars` added to `.gitignore` — was confirmed NOT ignored; mandatory before any live-test workflow uses a real Linear token

## Task Commits

1. **Task 1: Install @cloudflare/workers-types** - `12a5a05` (chore)
2. **Task 2: functions tsconfig, root reference, vitest glob, preview script, .dev.vars gitignore** - `b315ed0` (feat)

## Files Created/Modified

- `tsconfig.functions.json` — new TS project for functions/** with `@cloudflare/workers-types`, mirrors tsconfig.scripts.json structure
- `tsconfig.json` — added fourth reference `./tsconfig.functions.json` so `tsc -b` covers all projects
- `vitest.config.ts` — widened include to `["scripts/**/*.test.ts", "functions/**/*.test.ts"]`
- `package.json` — added `@cloudflare/workers-types` devDep and `preview:functions` script
- `pnpm-lock.yaml` — lockfile updated for workers-types install
- `.gitignore` — added `.dev.vars` rule adjacent to `.wrangler/`

## Decisions Made

- **npx --yes wrangler@4** in preview:functions rather than adding wrangler to devDependencies — keeps wrangler ephemeral; per 03-RESEARCH "Environment Availability" finding (cross-AI review MEDIUM)
- **wrangler.toml unchanged** — `name`, `compatibility_date`, and `pages_build_output_dir` already present from phase 01; Functions routing requires no additional non-secret config
- **types: ["@cloudflare/workers-types"] only** in tsconfig.functions.json — deliberately excludes `@types/node` to prevent node/worker type bleed (worker globals like `fetch`, `Request`, `Response` must come from workers-types, not node)

## Deviations from Plan

None — plan executed exactly as written. wrangler.toml confirmed to need no changes (noted as expected outcome in plan action).

## Issues Encountered

- `package.json` was modified by pnpm during the workers-types install (added the devDep entry), causing the subsequent Edit for `preview:functions` to fail with a "file modified since read" error. Re-read the file and applied the edit cleanly. No impact on result.

## User Setup Required

None — no external service configuration required for this plan. `.dev.vars` is now gitignored; the user will populate it with `LINEAR_API_KEY=lin_api_...` before running `pnpm preview:functions` in plan 03-04.

## Next Phase Readiness

- 03-03 (Linear proxy Pages Function, TDD) is unblocked: Worker types installed, functions/ typechecked, vitest discovers functions tests
- The existing `functions/_middleware.ts` probe handler from 03-01 typechecks cleanly under the new project (`pnpm typecheck` exits 0)
- Existing 14 tests still pass under the widened vitest config

---
*Phase: 03-linear-proxy*
*Completed: 2026-06-29*
