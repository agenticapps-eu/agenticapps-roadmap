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
  `openspec/changes/`. Repos with no `openspec/` slot are no longer syncable.
- **BREAKING**: `scripts/sync-gsd-linear/` → `scripts/sync-openspec-linear/`,
  and the `pnpm sync:gsd` script → `pnpm sync:openspec`. The GSD-era names
  describe a planning system this repo no longer reads.
- **BREAKING — identity resets.** `linear-map.json` holds **77 records** keyed to
  GSD phase identities, anchored by `<!--gsd-key:...-->` markers embedded in
  Linear issue descriptions (`apply.ts:376`). The new sync uses its own marker
  and its own map, and is forbidden from reading, adopting, or modifying any
  issue carrying the old one. Those 77 records are **abandoned in place** — not
  translated, not archived, not deleted. Expect visible duplication in Linear
  where old phase issues and new change issues describe related work.
- **BREAKING**: `--apply` becomes the sole write opt-in. `--yes` currently
  triggers a write on its own (`cli.ts:18`); it is demoted to a prompt
  suppressor and is inert without `--apply`.
- `openspec/specs/` capabilities are **not** synced to Linear at all. A spec is
  durable truth, not a work item; syncing it produces issues that never close.
- `walker.ts` is deleted. `parser.ts` is rewritten against the OpenSpec change
  shape (`proposal.md`, `tasks.md`, `design.md`) instead of `PLAN.md` /
  `ROADMAP.md` / `STATE.md`.
- A **misconfigured** source becomes a hard error (missing slot, unresolvable
  path). A correctly configured source with **no active work** is not an error —
  it succeeds and reports zero. The original defect was that success and failure
  looked identical, which per-repo reporting fixes; failing on legitimate empty
  states would break repos that are merely between changes or newly initialised.
- Reconciliation stays create-and-update only. `mutations.ts` has no archive
  path, and adding one is out of scope: a change vanishing from the source
  leaves its Linear issue untouched.
- The GSD→Linear concept mapping in `CLAUDE.md:116` is replaced by a
  change→Linear mapping; the prose at `CLAUDE.md:3, 91, 103, 111, 129-130`
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
- `src/components/overview/SyncBadge.tsx` — reads `.planning`; needs a
  source-unavailable state now that a misconfigured repo fails the run.
- `__fixtures__/` — GSD phase fixtures replaced with OpenSpec change fixtures.
- 132 existing tests across 10 files will need rewriting alongside the parsers
  they cover.

**Live Linear data**
- `linear-map.json` (9.6k, 77 records: projects, milestones, issues,
  projectLabels, issueLabels) is retired to `linear-map.gsd.json`, read by
  nothing, kept so the abandoned identities remain traceable. The new sync
  starts from an empty map.
- The 77 existing Linear issues are left exactly as they are.

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
