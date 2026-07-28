## Context

`scripts/sync-gsd-linear/` (21 files, 132 tests) walks sibling repos'
`.planning/phases/` trees, parses `PLAN.md` / `ROADMAP.md` / `STATE.md`, and
reconciles the result into Linear issues. It was built against GSD, which the
fleet has since replaced with OpenSpec.

The pipeline is already well-separated: `walker` (filesystem discovery) →
`parser` (text → structured phases) → `resolve` (identity + Linear lookup) →
`diff` (plan mutations) → `apply`/`mutations` (execute). Only the first two
stages are GSD-shaped. `resolve`, `diff`, `apply`, `dates`, and `hash` operate on
an intermediate structure and are largely source-agnostic — which is what makes a
cutover tractable rather than a rewrite.

This repo migrated to workflow 3.0.0 on 2026-07-28. `openspec/specs/` is empty;
this is the first change, so `plan-sync` is a new capability rather than a delta.

## Goals / Non-Goals

**Goals:**

- Read plans from `openspec/changes/` and `openspec/specs/`.
- Fail loudly when a listed source contributes nothing.
- Remove every GSD-era name from the sync path and its documentation.
- Preserve the Linear-side contract: team keys, labels, dry-run-first, and the
  per-project approval gate are unchanged.

**Non-Goals:**

- Migrating the 74 historical GSD phase directories into Linear. Explicitly
  decided against a backfill: whatever earlier runs pushed stays, the rest is
  repo history.
- Deleting sibling repos' `.planning/` trees. Not this repo's call.
- Changing Linear issue schema, team routing, or the approval UX.
- Retargeting `claude-workflow`, which has no `openspec/` slot yet.

## Decisions

**Delete `walker.ts` rather than generalise it.** A source-kind union threaded
through the pipeline would preserve a code path with no live producer — one of
its three inputs is already empty and the other two are frozen. The union's cost
lands in `resolve`/`diff`, the stages that are currently source-agnostic and
worth keeping that way. Alternative considered: `walker` gains a `SourceKind`
discriminator and both readers stay behind a per-repo `legacy: true` flag.
Rejected — it buys history preservation this change has already scoped out, and
pays for it in the stages most expensive to complicate.

**A new `source.ts`, not an edited `walker.ts`.** The OpenSpec reader has a
different shape: `changes/<name>/{proposal,design,tasks}.md` plus
`specs/<cap>/spec.md`, versus `phases/<slug>/*PLAN.md` plus two repo-level files.
Editing in place would leave `RawPhaseDir`'s vocabulary (`slug`, `planFiles`,
`roadmapPath`, `statePath`) describing fields that no longer exist. A new module
with a `RawChange` / `RawCapability` pair keeps the naming honest and lets the
old tests be deleted alongside the old module rather than half-ported.

**Hard error over `console.warn`.** The predecessor's warn-and-continue is the
specific defect that hid a dead source arm for weeks (see the spec's stated
reason). Failing the whole run — not just the affected repo — is deliberate: a
partial sync that silently drops one repo's issues looks identical to a repo
with no work, and Linear cannot distinguish them after the fact.

**Rename in the same change as the retarget.** The alternative — retarget now,
rename later — leaves `sync-gsd-linear` reading OpenSpec, which is worse than
either end state and tends to persist. The rename is mechanical (directory,
entry point, one `package.json` key, seven CLAUDE.md lines) and the tests are
being rewritten anyway.

**Drop `claude-workflow` from the allow-list.** It has 35 frozen phase dirs and
no `openspec/` slot, so under the new hard-error rule it would fail every run.
Removing it is the honest encoding of "not syncable yet"; it can be re-added
when it migrates.

## Risks / Trade-offs

- **Historical phase data stops syncing** → Accepted, explicitly. Whatever prior
  runs wrote to Linear remains; the frozen `.planning/` trees stay on disk and
  readable. If the history turns out to matter, a one-shot backfill can be
  written against the archived trees later — deleting the walker does not
  destroy its input.

- **Hard-erroring on an empty slot could block routine runs** → A repo that has
  genuinely finished all its changes and archived them would fail a run. Mitigate
  by treating archived changes as valid content: a repo with
  `openspec/changes/archive/` populated but no active changes is *not* empty.
  Worth confirming during implementation against a repo in that state.

- **132 tests rewritten at once is a large, hard-to-review diff** → Sequence the
  tasks so `source.ts` and its tests land before the downstream stages are
  touched, keeping each commit independently green rather than one big-bang
  rewrite.

- **`cparx` is mid-migration as this is written** → Its `openspec/specs/` was
  empty at proposal time. Verify its slot is populated before relying on it as a
  test fixture, or the acceptance run reads a repo that is itself in flux.

## Migration Plan

1. Land `source.ts` + tests alongside the existing `walker.ts`; nothing consumes
   it yet, so the tree stays green.
2. Retarget `parser.ts` onto the new raw types; port `resolve`/`diff` field
   references.
3. Switch `cli.ts` to `source.ts`; delete `walker.ts` and `walker.test.ts`.
4. Rename the directory, entry point, and `package.json` key.
5. Update `sync.config.json` (drop `claude-workflow`), `SyncBadge.tsx`, and
   CLAUDE.md.
6. Acceptance: dry-run against `fx-signal-agent` (12 changes) and confirm the
   printed plan matches its `openspec/changes/` contents.

**Rollback**: the change is confined to `scripts/`, one component, and docs. The
prior implementation is one revert away and its input trees were never modified.

## Open Questions

- Does a repo with only archived changes count as empty? Leaning no — see the
  risk above — but it needs deciding before the hard-error rule ships.
- Should `openspec/specs/` capabilities become Linear issues at all, or only
  `changes/`? The spec currently says both. Specs are durable truth rather than
  work items, so they may map better to a Linear document or project than to an
  issue.
- Does `SyncBadge.tsx` surface per-repo source health? If a hard error now fails
  the whole run, the badge's states may need a "source unavailable" variant.
