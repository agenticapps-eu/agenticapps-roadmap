---
phase: 04-roadmap-timeline-ui
plan: 01
subsystem: linear-snapshot-pipeline
tags: [pipeline, schema, security, D-13, TL-03]
requires: []
provides:
  - "project.url threaded query -> map -> transform -> schema"
  - "ProjectSchema.url (nullish) backward-compatible with urlless roadmap.json"
affects:
  - scripts/linear/query.ts
  - scripts/linear/map.ts
  - scripts/linear/transform.ts
  - scripts/linear/fetch-workspace.ts
  - src/lib/roadmap/schema.ts
tech-stack:
  added: []
  patterns: [explicit-allow-list-mapping, fail-closed-leak-gate, zod-nullish-backward-compat]
key-files:
  created: []
  modified:
    - scripts/linear/query.ts
    - scripts/linear/map.ts
    - scripts/linear/transform.ts
    - scripts/linear/fetch-workspace.ts
    - src/lib/roadmap/schema.ts
    - scripts/linear/__fixtures__/raw-clean.ts
    - scripts/linear/transform.test.ts
    - src/lib/roadmap/loader.test.ts
decisions:
  - "url added to RawMainProject in fetch-workspace.ts (Rule 3) — required so the reassembled GqlProject satisfies its type after MAIN_QUERY gained url."
metrics:
  tasks: 3
  files-changed: 8
  completed: 2026-07-14
---

# Phase 04 Plan 01: D-13 project.url pipeline Summary

Threaded Linear's authoritative `Project.url` through the snapshot pipeline (query -> map
-> transform -> schema) as an additive, backward-compatible, PII-safe field, so the Phase-4
timeline popover can link to the real Linear project URL (TL-03). No live Linear call and no
`public/roadmap.json` regeneration — that is gated plan 04-07 (needs LINEAR_API_KEY).

## What Was Built

- `MAIN_QUERY` now selects `url` in the `projects { nodes }` node.
- `GqlProject` gained `url: string`; `mapWorkspace` maps it as a named allow-list key
  (`url: proj.url`) — no `...proj` spread introduced (grep count 0).
- `RawProject` gained optional `url?: string | null`; `buildSnapshot` emits
  `url: proj.url ?? null` after `summary`.
- `ProjectSchema` gained `url: z.string().nullish()` — accepts url present / null / absent,
  so the current urlless snapshot still validates (Pitfall 1 avoided).
- Fixtures (`raw-clean.ts` x3 projects, loader `validSnapshot`) carry `https://linear.app/...`
  URLs reflecting the post-D-13 shape.
- New tests: url passthrough (present -> carried, absent -> null) and assertNoLeak does not
  throw on a Linear URL (T-04-03).

## Tasks Completed

| Task | Name | Commit |
|------|------|--------|
| 1 | Thread url through query -> map -> transform | 6a9f854 |
| 2 | Add url to ProjectSchema and update fixtures | 60b75e5 |
| 3 | Add url-passthrough and assertNoLeak-URL tests | 0751fda |

## Verification Evidence

- `npx tsc -b --noEmit` — EXIT 0 (clean).
- `CI=true npx vitest run` — Test Files 3 passed (3), Tests 47 passed (47).
- `npx eslint .` — 0 errors, 1 pre-existing warning (button.tsx react-refresh, unrelated/out of scope).
- Grep gates: `url` in MAIN_QUERY projects node; `url: proj.url` in map.ts; `...proj` count = 0;
  `url: proj.url ?? null` in transform.ts; `url: z.string().nullish()` in schema.ts;
  linear.app URL count = 3 in raw-clean, 1 in loader.test.

Note: `pnpm typecheck` / `pnpm test` cannot run in this non-TTY environment (the pnpm pre-hook
attempts a modules-dir purge/reinstall that aborts without a TTY). Ran the underlying binaries
directly (`npx tsc -b --noEmit`, `CI=true npx vitest run`, `npx eslint .`) — equivalent output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `url` to RawMainProject in fetch-workspace.ts**
- **Found during:** Task 1 (typecheck)
- **Issue:** The plan said not to alter `fetch-workspace.ts`, but adding `url` to `GqlProject`
  made the reassembled projects (`RawMainProject` spread into `GqlProject` at line 154) fail
  the type check (`Property 'url' is missing in type ... but required in type 'GqlProject'`).
- **Fix:** Added `url: string` to the `RawMainProject` interface. This is truthful — MAIN_QUERY
  now returns `url`, so the runtime shape carries it. Purely a type declaration; no logic change.
- **Files modified:** scripts/linear/fetch-workspace.ts
- **Commit:** 6a9f854

## Threat Flags

None. The new `url` value crosses the Linear -> snapshot boundary but passes the existing
`assertNoLeak` gate (matches neither TOKEN_RE nor EMAIL_RE), now asserted explicitly (T-04-03).
No new endpoints, auth paths, or schema surface at a trust boundary beyond the planned field.

## Known Stubs

None. `public/roadmap.json` is intentionally left without real `url` values — populating it
requires LINEAR_API_KEY and is the scope of gated plan 04-07 (documented in the plan). The
schema's `.nullish()` makes the urlless snapshot valid in the meantime.

## Self-Check: PASSED

- Modified files exist on disk (all 8).
- Commits present: 6a9f854, 60b75e5, 0751fda (git log verified).
