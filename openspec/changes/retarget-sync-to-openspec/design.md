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

- Read plans from `openspec/changes/`. Capability specs under `openspec/specs/`
  are not read at all — see the post-review decisions below.
- Fail loudly when a listed source is MISCONFIGURED (missing slot, unresolvable
  path). A correctly configured repo with no active work succeeds and reports
  zero; the original defect was that the two were indistinguishable, not that a
  repo contributed nothing.
- Remove every GSD-era name from the sync path and its documentation.
- Keep the Linear-side write contract — team keys, labels, dry-run-first,
  per-project approval — intact. NOT a claim that the Linear layer is unchanged:
  it moves from create-only to create-and-update, and milestone disposition is an
  open item below.

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
different shape: `changes/<name>/{proposal,design,tasks}.md` versus
`phases/<slug>/*PLAN.md` plus two repo-level files. Editing in place would leave
`RawPhaseDir`'s vocabulary (`slug`, `planFiles`, `roadmapPath`, `statePath`)
describing fields that no longer exist. A new module exporting `RawChange` keeps
the naming honest and lets the old tests be deleted alongside the old module
rather than half-ported. (An earlier draft paired it with a `RawCapability`;
that went away with the decision not to sync specs.)

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

### Decisions taken after plan review

Both reviewers returned REQUEST-CHANGES. These four decisions close their
findings; the corresponding requirements carry the rationale inline.

**Identity resets; the 77 GSD records are abandoned in place.** Codex found what
the original design missed: `linear-map.json` holds 77 records and `apply.ts:376`
writes `<!--gsd-key:${plan.key}-->` into every issue description as its identity
anchor. A cutover that mints new keys without addressing this would either adopt
legacy issues under a mismatched shape or treat them as orphans. Options were
translate-forward (map GSD phase identities onto change identities) or clean
break. **Clean break chosen.** The phase→change mapping is not one-to-one — a
phase was an execution unit, a change is a spec delta — so any translation would
be a guess encoded as data. Isolation is therefore promoted to a hard
requirement: the new sync is forbidden from touching anything carrying the old
marker. Cost: visible duplication in Linear where old and new issues describe
related work. Accepted deliberately.

**Capability specs are not synced.** Both reviewers objected independently. A
spec is durable truth; as a Linear issue it never closes, so it accumulates as
permanent non-actionable noise. `openspec/specs/` is therefore not read at all —
which also simplifies the source reader and the empty-source rule to one
directory.

**`--apply` is the only write opt-in.** `cli.ts:18` documents `--project X --yes`
as writing without `--apply`, so the predecessor had two independent write
triggers. `--yes` is demoted to a prompt suppressor, inert on its own. One path
to a write is easier to reason about and to test than two.

**Empty is not an error; misconfigured is.** The first draft made both fatal, and
gemini caught the contradiction against this document's own risk section. The
original defect was never "a repo contributed nothing" — it was that
contributing nothing and being broken looked identical. Splitting them is the
actual fix: a missing slot or unresolvable path fails the run, while zero active
changes succeeds and is reported as zero. This also stops a newly-initialised or
fully-archived repo from failing a run it has no business failing.

**Archive stays out of scope.** `mutations.ts` implements `issueCreate` and
`issueUpdate` only — there is no archive path, and the first draft's "zero
archives" scenario referenced a capability that does not exist. Rather than build
one, a change that disappears from the source leaves its Linear issue untouched
and is reported. Disposal stays a human decision.

## Risks / Trade-offs

- **Historical phase data stops syncing** → Accepted, explicitly. Whatever prior
  runs wrote to Linear remains; the frozen `.planning/` trees stay on disk and
  readable. If the history turns out to matter, a one-shot backfill can be
  written against the archived trees later — deleting the walker does not
  destroy its input.

- **Duplication in Linear after the identity reset** → The 40 abandoned issues
  stay visible alongside newly created change issues, and nothing in the tool
  distinguishes them. Mitigate with a distinct label on the new issues so the
  two generations are filterable, and note the cutover date in the Linear team
  description. There is no automated cleanup; retiring the old issues is manual
  and optional.

- ~~Hard-erroring on an empty slot could block routine runs~~ → Resolved: empty
  and misconfigured are now separate cases. See the decision above.

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
6. Acceptance: dry-run against `fx-signal-agent` (10 active changes today) and confirm the
   printed plan matches its `openspec/changes/` contents.

**Rollback**: the code is confined to `scripts/`, one component, and docs, so a
revert restores it. But a revert alone is NOT sufficient — step 3 renames
`linear-map.json` to `linear-map.gsd.json`, and the restored GSD-era code reads
the original path. Reverting without restoring that file would leave it unable to
find its identity map and re-creating all 40 issues as duplicates. Rollback is
therefore: revert the code, THEN `git mv linear-map.gsd.json linear-map.json`,
and verify a dry-run reports zero creates before any apply. Sibling repos'
`.planning/` trees are never modified, so nothing outside this repo needs
unwinding.

## Open Questions

All three questions from the pre-review draft are now closed — archived-changes
handling, specs-as-issues, and the write contract are decided above. Remaining:

- `SyncBadge.tsx` needs a source-unavailable state now that a misconfigured repo
  fails the whole run. Its exact states depend on what the component currently
  renders; settle during task 6.2 rather than guessing here.
- Codex raised a PII/secret boundary for copying repository documents into
  Linear. Lower risk than it first appears — these are OpenSpec proposals and
  task lists, already committed to the repo, and the predecessor has been
  copying `PLAN.md` bodies into Linear for months. Worth an explicit size cap
  and a path-confinement check (canonical path must stay inside the allow-listed
  repo, no symlink escape) rather than a content scanner. Tracked as task 1.6;
  raise it to its own change if the cap turns out to need real policy.
