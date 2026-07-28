> Pre-review task group 0 (open questions) is gone — identity, specs-as-issues,
> and the write contract were decided during review. See design.md
> "Decisions taken after plan review".

## 1. New OpenSpec source reader

- [ ] 1.1 Write failing tests for `source.ts`: change discovery, missing slot,
      unresolvable repo path, zero-active-changes, archive-only
- [ ] 1.2 Define `RawChange` (name, dir, proposalPath, tasksPath, designPath)
- [ ] 1.3 Implement `readOpenSpecSource(repoPath)` reading `openspec/changes/`
      only, sorted for determinism; do not read `openspec/specs/`
- [ ] 1.4 Hard-error on missing `openspec/changes/` and on an unresolvable
      `repoPath`, each naming the repo and the offending path
- [ ] 1.5 Return zero changes — not an error — when the slot exists but holds no
      active change directories; exclude `archive/` from the active set
- [ ] 1.6 Confine reads to canonical paths inside the allow-listed repo (reject
      symlink escape) and cap per-artifact size before it reaches Linear
- [ ] 1.7 Land alongside the existing `walker.ts` — nothing consumes it yet,
      tree stays green

## 2. Retarget the parser

- [ ] 2.1 Write failing tests for parsing `proposal.md` (title, why) and
      `tasks.md` (checkbox progress)
- [ ] 2.2 Rewrite `parser.ts` against `RawChange`, dropping `PLAN.md` /
      `ROADMAP.md` / `STATE.md` handling
- [ ] 2.3 Replace `__fixtures__/` GSD phase trees with OpenSpec change fixtures
- [ ] 2.4 Port `dates.ts` and `hash.ts` call sites to the new shapes

## 3. Identity isolation from the GSD generation

- [ ] 3.1 Write failing tests: a Linear issue carrying `<!--gsd-key:...-->` is
      never adopted, updated, or archived by the new sync
- [ ] 3.2 Choose the new marker (distinct from `gsd-key`) and implement the
      identity derivation from repo name + change directory name
- [ ] 3.3 `git mv linear-map.json linear-map.gsd.json`; ensure nothing reads it
- [ ] 3.4 Start the new sync from an empty map at the canonical path
- [ ] 3.5 Add a distinct Linear label to new-generation issues so the two
      generations are filterable

## 4. Port the reconciliation stages

- [ ] 4.1 Update `resolve.ts` field references; enforce the new-marker-only
      lookup rule from 3.1
- [ ] 4.2 Update `diff.ts` for the new shapes; verify the no-op-on-unmodified
      guarantee still holds
- [ ] 4.3 Update `apply.ts` and `mutations.ts` call sites; confirm create+update
      only, no archive path added
- [ ] 4.4 A change absent from the source leaves its issue untouched and is
      reported as no longer present
- [ ] 4.5 Rework the flag contract: `--apply` is the sole write opt-in, `--yes`
      only suppresses the prompt and is inert alone; update `cli.ts:15-19` docs
- [ ] 4.6 Confirm the single-project bulk-write guard still holds under the new
      flag contract
- [ ] 4.7 Per-repo reporting: every run prints each listed repo's contributed
      change count, including zero

## 5. Cut over and delete the GSD path

- [ ] 5.1 Switch `cli.ts` from `walker.ts` to `source.ts`
- [ ] 5.2 Delete `walker.ts` and `walker.test.ts`
- [ ] 5.3 Full test suite green

## 6. Rename

- [ ] 6.1 `git mv scripts/sync-gsd-linear scripts/sync-openspec-linear`
- [ ] 6.2 `git mv scripts/sync-gsd-linear.ts scripts/sync-openspec-linear.ts`
- [ ] 6.3 `package.json`: `sync:gsd` → `sync:openspec`
- [ ] 6.4 Update all imports; confirm no `sync-gsd` string remains outside
      `docs/` history and `linear-map.gsd.json`

## 7. Config, UI, and docs

- [ ] 7.1 `sync.config.json`: drop the `claude-workflow` entry (no `openspec/`
      slot; would hard-error every run)
- [ ] 7.2 `src/components/overview/SyncBadge.tsx`: read the OpenSpec source; add
      a source-unavailable state distinct from zero-changes
- [ ] 7.3 `CLAUDE.md` lines 3, 91, 103, 111, 129-130: rename to
      `sync-openspec-linear` / `pnpm sync:openspec`
- [ ] 7.4 `CLAUDE.md` line 116: replace the GSD→Linear mapping table with
      change→Linear
- [ ] 7.5 `CLAUDE.md` ~line 139: remove the `.planning/` retention note added
      during the 3.0.0 migration — its only justification was this CLI
- [ ] 7.6 Document the identity cutover: the 77 abandoned records, why they were
      not translated, and where `linear-map.gsd.json` lives

## 8. Acceptance

- [ ] 8.1 Dry-run against `factiv/fx-signal-agent` (12 changes); confirm the
      printed plan matches its `openspec/changes/` contents exactly
- [ ] 8.2 Apply to a scratch Linear team, then re-run apply against the
      unmodified source; confirm the second run reports zero creates and zero
      updates and issues no mutation
      (the pre-review version compared two dry-runs, which cannot show this —
      neither run writes, so the second necessarily replans the same creates)
- [ ] 8.3 Point a fixture repo at a missing `openspec/` slot; confirm non-zero
      exit and that no Linear write was attempted for any repo in the run
- [ ] 8.4 Point a fixture repo at a slot with only `archive/` populated; confirm
      the run succeeds and reports 0 changes for it
- [ ] 8.5 Seed a scratch Linear issue carrying `<!--gsd-key:...-->`; confirm a
      full apply leaves it byte-identical
- [ ] 8.6 Confirm `--yes` without `--apply` issues no mutation
- [ ] 8.7 Confirm sibling repos' `.planning/` trees are byte-unchanged after a
      full run
