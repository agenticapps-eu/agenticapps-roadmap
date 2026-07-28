## 0. Resolve the design's open questions

- [ ] 0.1 Decide whether a repo with only `openspec/changes/archive/` populated
      counts as empty under the hard-error rule; record the answer in design.md
- [ ] 0.2 Decide whether `openspec/specs/` capabilities map to Linear issues or
      are read-only context; if the latter, amend the `plan-sync` spec's mapping
      requirement before implementing it
- [ ] 0.3 Confirm `factiv/cparx` has finished migrating and its `openspec/`
      slot is populated, so it is usable as a fixture source

## 1. New OpenSpec source reader

- [ ] 1.1 Write failing tests for `source.ts`: change discovery, capability
      discovery, missing slot, empty slot, unresolvable repo path
- [ ] 1.2 Define `RawChange` (name, dir, proposalPath, tasksPath, designPath,
      specPaths) and `RawCapability` (name, dir, specPath)
- [ ] 1.3 Implement `readOpenSpecSource(repoPath)` returning both, sorted for
      determinism
- [ ] 1.4 Implement hard-error behaviour: throw on missing slot, empty slot, and
      unresolvable path, each naming the repo and the offending path
- [ ] 1.5 Land alongside the existing `walker.ts` — nothing consumes it yet,
      tree stays green

## 2. Retarget the parser

- [ ] 2.1 Write failing tests for parsing `proposal.md` (title, why), `tasks.md`
      (checkbox progress), and `specs/**/spec.md` (requirement count)
- [ ] 2.2 Rewrite `parser.ts` against `RawChange` / `RawCapability`, dropping
      `PLAN.md` / `ROADMAP.md` / `STATE.md` handling
- [ ] 2.3 Replace `__fixtures__/` GSD phase trees with OpenSpec change fixtures
- [ ] 2.4 Port `dates.ts` and `hash.ts` call sites to the new shapes

## 3. Port the reconciliation stages

- [ ] 3.1 Update `resolve.ts` field references; keep the stable-identity rule
      (repo name + change/capability directory name)
- [ ] 3.2 Update `diff.ts` for the new shapes; verify the no-op-on-unmodified
      guarantee still holds
- [ ] 3.3 Update `apply.ts` and `mutations.ts` call sites
- [ ] 3.4 Verify dry-run-first and single-project-apply guards are intact
      (they are Linear-side and should need no change — confirm, don't assume)

## 4. Cut over and delete the GSD path

- [ ] 4.1 Switch `cli.ts` from `walker.ts` to `source.ts`
- [ ] 4.2 Delete `walker.ts` and `walker.test.ts`
- [ ] 4.3 Full test suite green

## 5. Rename

- [ ] 5.1 `git mv scripts/sync-gsd-linear scripts/sync-openspec-linear`
- [ ] 5.2 `git mv scripts/sync-gsd-linear.ts scripts/sync-openspec-linear.ts`
- [ ] 5.3 `package.json`: `sync:gsd` → `sync:openspec`
- [ ] 5.4 Update all imports; confirm no `sync-gsd` string remains outside
      `docs/` history

## 6. Config, UI, and docs

- [ ] 6.1 `sync.config.json`: drop the `claude-workflow` entry (no `openspec/`
      slot; would hard-error every run)
- [ ] 6.2 `src/components/overview/SyncBadge.tsx`: read the OpenSpec source;
      add a source-unavailable state if 0.1/0.3 call for it
- [ ] 6.3 `CLAUDE.md` lines 3, 91, 103, 111, 129-130: rename to
      `sync-openspec-linear` / `pnpm sync:openspec`
- [ ] 6.4 `CLAUDE.md` line 116: replace the GSD→Linear mapping table with
      change/spec→Linear
- [ ] 6.5 `CLAUDE.md` ~line 139: remove the `.planning/` retention note added
      during the 3.0.0 migration — its only justification was this CLI

## 7. Acceptance

- [ ] 7.1 Dry-run against `factiv/fx-signal-agent` (12 changes); confirm the
      printed plan matches its `openspec/changes/` contents exactly
- [ ] 7.2 Re-run the same dry-run; confirm zero creates, zero updates, zero
      archives
- [ ] 7.3 Point a fixture repo at a missing `openspec/` slot; confirm non-zero
      exit and that no Linear write was attempted
- [ ] 7.4 Confirm sibling repos' `.planning/` trees are byte-unchanged after a
      full run
