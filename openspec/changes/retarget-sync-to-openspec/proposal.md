## Why

The sync CLI reads sibling repos' GSD `.planning/phases/` trees, but the fleet
has migrated to OpenSpec and that input is drying up. Measured on 2026-07-28
across the three repos in `sync.config.json`:

| Repo | `.planning/phases/` | ROADMAP.md / STATE.md | `openspec/changes/` |
|---|---|---|---|
| `factiv/fx-signal-agent` | **0 dirs** | **both missing** | 12 |
| `claude-workflow` | 35 dirs | frozen 2026-06-03 | 0 |
| `factiv/cparx` | 39 dirs | mid-migration | 1 |

One of three sources is already gone — its history moved to
`docs/legacy-planning/` — and `walker.ts:40-44` handles that with
`console.warn(...); return []`. The arm is dead, the run still reports success,
and nobody noticed. The other two are frozen or emptying. The roadmap app is
becoming a viewer for data that stopped being written.

## What Changes

- **BREAKING**: the sync source moves from `.planning/phases/` to
  `openspec/changes/` (in-flight work) and `openspec/specs/` (current truth).
  Repos with no `openspec/` slot are no longer syncable.
- **BREAKING**: `scripts/sync-gsd-linear/` → `scripts/sync-openspec-linear/`,
  and the `pnpm sync:gsd` script → `pnpm sync:openspec`. The GSD-era names
  describe a planning system this repo no longer reads.
- `walker.ts` is deleted. `parser.ts` is rewritten against the OpenSpec artifact
  shape (`proposal.md`, `tasks.md`, `design.md`, `specs/**/*.md`) instead of
  `PLAN.md` / `ROADMAP.md` / `STATE.md`.
- A missing or empty source becomes a **hard error**, not a `console.warn`. The
  current silent-skip is what let a dead arm run unnoticed for weeks.
- The GSD→Linear concept mapping in `CLAUDE.md:116` is replaced by a
  change/spec→Linear mapping; the prose at `CLAUDE.md:3, 91, 103, 111, 129-130`
  is updated to the new names.
- **Not** carried over: the 74 historical GSD phase directories. This is a clean
  cutover — whatever the sync already pushed to Linear stays in Linear, and the
  frozen `.planning/` trees are left in place, unread, as repo history.

## Capabilities

### New Capabilities

- `plan-sync`: reading sibling repos' OpenSpec artifacts and reconciling them
  into Linear issues — source discovery, artifact parsing, change/spec→Linear
  mapping, dry-run-first reconciliation, and the per-project approval gate.

### Modified Capabilities

<!-- None. openspec/specs/ is empty: the slot was created by migration 0032 on
     2026-07-28 and this is the repo's first change, so there is no existing
     requirement to delta. -->

## Impact

**Code**
- `scripts/sync-gsd-linear/` → `scripts/sync-openspec-linear/` (21 files):
  `walker.ts` + `walker.test.ts` deleted; `parser.ts`, `resolve.ts`, `diff.ts`,
  `apply.ts`, `mutations.ts`, `cli.ts`, `config.ts` retargeted.
- `scripts/sync-gsd-linear.ts` entry point and the `sync:gsd` key in
  `package.json`.
- `src/components/overview/SyncBadge.tsx` — reads `.planning`.
- `__fixtures__/` — GSD phase fixtures replaced with OpenSpec change fixtures.
- 132 existing tests across 10 files will need rewriting alongside the parsers
  they cover.

**Config**
- `sync.config.json`: the three `repoPath` entries stay, but each target must
  now have an `openspec/` slot. `claude-workflow` currently has none — it is
  the workflow product repo and is still on `.planning/`. Syncing it is out of
  scope here and it should be dropped from the allow-list until it migrates.

**Docs**
- `CLAUDE.md` lines 3, 91, 103, 111, 116, 129-130, and the `.planning/`
  retention note added at line 139 during the 3.0.0 migration — that note exists
  only to explain why `.planning/` was kept for this CLI, so it goes too.

**Not affected**
- The Linear side: team keys, labels, and the dry-run-first + per-project
  approval gate are unchanged. This changes where plans are read from, not how
  they are written.
