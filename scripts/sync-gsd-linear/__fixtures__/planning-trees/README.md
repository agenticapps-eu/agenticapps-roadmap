# planning-trees fixtures

Real, on-disk synthetic `.planning/`-shaped trees (each subtree here plays the
role of one sibling repo's `.planning/` root) reproducing the structural
quirks `06-RESEARCH.md` found across the three real target repos
(`claude-workflow`, `cparx`, `fx-signal-agent`). `walker.test.ts` /
`parser.test.ts` (Wave 1+) point their walker/parser at these subtrees
instead of reading real sibling repos, so behavior tests are test-first and
hermetic.

## Subtrees

### `duplicate-NN/`
Two phase directories that share the leading number `01` but are distinct
phases (`01-go-routing/`, `01-gsd-bug-fixes/`) — reproduces
`claude-workflow`'s real duplicate-`01`/`02`/`03`/`04`/`05` directories. The
walker/parser MUST key everything (map storage, hash input, display name) on
the full directory slug, never the bare number, or these two phases collide.
`01-01-PLAN.md` in each carries YAML frontmatter, a descriptive H1, and
task/checklist lines (real input for `taskLines` extraction).
`01-go-routing/` additionally has a sibling `01-01-VERIFICATION.md` (one of
the two completion-status signals from RESEARCH Pitfall 3). This subtree also
carries `ROADMAP.md` — an intentionally **partial stub** that only enumerates
`01-gsd-bug-fixes`, not `01-go-routing` (mirrors `claude-workflow`'s real
ROADMAP.md, which only covers phases 25+) — proving the walker must never
treat `ROADMAP.md` as the source of phase *existence*, only as an optional
completion-status enrichment layer.

### `decimal-phase/`
Three decimal-numbered phase directories: `03.5-quality/`, `04.10-x/`,
`04.2-y/`. Reproduces the `03.5-*`/`04.9-*`/`04.13-*`-style decimal insertion
seen in `cparx`/`fx-signal-agent`. Numeric ordering must compare the
dot-separated segments component-wise (`4.2` sorts before `4.10`), not via
`parseFloat` (which would read `"04.10"` as `4.1` and could collide with a
hypothetical `04.1` phase). `03.5-quality/` additionally has a sibling
`03.5-01-SUMMARY.md` next to its `03.5-01-PLAN.md` (the second completion
signal from RESEARCH Pitfall 3 — "every `NN-MM-PLAN.md` has a sibling
`NN-MM-SUMMARY.md`").

### `frontmatter-less/`
`09-legacy/PLAN.md` has no YAML frontmatter and a generic, non-descriptive H1
(`# Phase 09 — PLAN`) — reproduces `claude-workflow`'s pre-migration-era
plans. Issue-title extraction must fall back to the directory slug
(`09-legacy`) rather than the generic heading.

### `two-generic-plans-in-one-phase/`
`20-execution/` contains **two** frontmatter-less `NN-MM-PLAN.md` files
(`20-01-PLAN.md`, `20-02-PLAN.md`) whose H1s are byte-identical
(`# Phase 20 — Execution Plan`). Proves the identity key must be the full
relative plan path (`repo/phaseSlug/relativePlanPath`), not a hash of the
(generic, collision-prone) display title — the exact defect 06-REVIEWS.md
Consensus item 1 flags.

### `bare-PLAN/`
`05-bare/PLAN.md` — a single bare `PLAN.md` (no `NN-MM-` prefix, no
frontmatter) in an otherwise-empty phase directory. Per D-06-01, a phase with
exactly one bare `PLAN.md` yields exactly one Linear issue.

## Not covered here (by design)
Live Linear GraphQL read/write shapes are covered by `linear-responses.ts`
and `linear-mutation-mock.ts` in this same `__fixtures__/` directory, not by
these on-disk trees.
