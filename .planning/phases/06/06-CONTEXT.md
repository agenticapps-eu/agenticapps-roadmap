# Phase 6: sync-gsd-linear CLI (backfill engine) - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

A standalone Node/`tsx` CLI (`sync-gsd-linear`) that backfills Linear from the
sibling repos' GSD `.planning/` plans — **repos → Linear only** (no pull-down).
It walks each configured repo's `.planning/`, normalizes phases + plans, resolves
against existing Linear records, prints a **per-project dry-run diff**, and — on
explicit per-project approval — **idempotently upserts** Linear Projects,
milestones, and issues, proposing target dates from phase order. As a byproduct
it patches `public/roadmap.json` with the `planAhead` flag that lights the
Phase-5 OV-04 badge.

Delivers requirements **SYNC-01..SYNC-04**. Wired via a new `pnpm sync:gsd`
script (`--dry-run` default). Live UI-triggered backfill and refresh are **Phase
7**; production deploy/token binding is **Phase 8** — out of scope here.

</domain>

<decisions>
## Implementation Decisions

### Data model mapping (SYNC-01, SYNC-02)

- **D-06-01 (issue grain):** `repo → Linear Project`, `phases/NN/ → milestone`,
  **`NN-MM-PLAN.md` file → one Linear issue** (titled from the plan heading,
  bucketed into its phase-milestone). Task lines inside a PLAN.md stay as the
  issue body/checklist — **not** separate issues (too noisy, task lines churn
  during execution and break dedup identity). A phase with a single bare
  `PLAN.md` yields one issue.
- **D-06-02 (repo → Linear structure):** A repo maps to **one Linear Project**
  (forced: the locked `phase → milestone` mapping requires it, since Linear
  milestones are children of projects). The allow-list config may optionally
  name an **existing Initiative** to attach the project to (e.g. `cparx` under a
  Factiv initiative). Repos with no initiative in config stay standalone
  projects. **Not** all-repos-under-one-shared-initiative (would flatten
  distinct products).
- **D-06-03 (resolve/dedup — SYNC-02):** Resolve order stays locked: stored
  `linear-map.json` id first → `roadmap:<repo>` label → **title-hash fallback**
  (milestone hashed on phase name, issue hashed on plan heading). No duplicate
  records; re-run is a no-op. Successful upserts write ids back to the map.

### Repo scope & configuration

- **D-06-04 (scope):** A **committed allow-list config in THIS repo** (e.g.
  `sync.config.json`) is the single source of truth: each entry is
  `{ repo path → optional Linear initiative + `roadmap:<repo>` label }`.
  Explicitly **not** discover-all-siblings (~13 `.planning/` dirs incl.
  `bench-*`, testbeds, `opencode-workflow` must never reach Linear). `--project
  <name>` narrows a run to one config entry.
- **D-06-05 (map location):** `linear-map.json` lives **centrally in this repo**
  (not scattered per-sibling), alongside the allow-list config. One place to
  inspect/reset the id map.

### Date proposal (SYNC-03)

- **D-06-06 (date algorithm):** **Fixed cadence from an anchor, sequential by
  phase order.** Completed phases keep/leave their existing dates (no future
  date invented). The next-up phase anchors at a start date (**default: today**,
  overridable via flag/config), each subsequent phase `+N weeks` (**default
  cadence configurable**, e.g. 2wk). Proposed dates are shown in the diff for
  confirmation; **no interactive per-date editor** (adjust via `--anchor` /
  `--cadence` and re-run — YAGNI). Not horizon-spread, not preserve-only.

### Apply UX & write path (SYNC-04)

- **D-06-07 (approval flow):** `--dry-run` is the **default**. `--project
  <name>` prints the per-project diff, then an **interactive `y/N` prompt** gates
  the writes for that one project (best embodies architecture's "explicit yes for
  that specific project"). A `--yes` flag bypasses the prompt for CI/automation.
  The diff is a **human-readable summary** (`+ N milestones, + M issues, ~ D
  dates`) plus per-record detail.
- **D-06-08 (write mechanism):** Writes are **raw Linear GraphQL mutations
  authenticated with `LINEAR_API_KEY`** — a standalone CLI process **cannot** call
  the MCP `save_milestone`/`save_issue` tools referenced in the phase stub or the
  architecture doc; those names are MCP-only and do not apply here. Reuse the
  existing `scripts/linear/*` GraphQL plumbing for the read/resolve side.
- **D-06-09 (planAhead emission — closes D-05-02):** The CLI **emits `planAhead`
  per project into `public/roadmap.json`** as a byproduct of the diff (the walker
  already computes repo-`.planning`-vs-Linear state). This lights the Phase-5
  OV-04 badge. The snapshot patch is gated (only on a real apply / an explicit
  `--write-snapshot`, never during a plain `--dry-run`). Keeps the token-free
  contract of `roadmap.json` intact (planAhead is a boolean, no PII/token).

### Claude's Discretion

- Exact config filename/shape, CLI arg parser, and diff-rendering library.
- Internal module layout of the walker/parser/resolver/diff/date/apply stages.
- Precise GraphQL mutation set and pagination for reads (extend
  `scripts/linear/fetch-workspace.ts` as needed).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 6" — goal + success criteria (dry-run accuracy,
  idempotent apply, dates confirmed before write).
- `.planning/REQUIREMENTS.md` — SYNC-01..SYNC-04 (authoritative req text) +
  "Out of Scope" (two-way sync deferred).
- `.planning/phases/06/PLAN.md` — original one-page stub brief (superseded by
  real planning; keep for the "Done when" repo list: `claude-workflow`, `cparx`,
  `fx-signal-agent`).

### Architecture & data path
- `docs/architecture.md` §"`sync-gsd-linear` pipeline" + §"Decisions" table —
  per-project dry-run-first, dates-from-phase-order, resolve-via-map/label/hash.
  NOTE: its `save_milestone`/`save_issue` reference is MCP-tool shorthand and is
  overridden by D-06-08 (CLI uses raw GraphQL mutations).
- `CLAUDE.md` §"Data model mapping" + §"Never do" (no token in `roadmap.json`;
  no bulk-write; match by id then title-hash) — hard constraints for this phase.

### Prior-phase seam this phase closes
- `.planning/phases/05/05-CONTEXT.md` D-05-02 — the `planAhead?` optional-field
  badge seam Phase 6 now populates (see D-06-09).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/linear/client.ts` (`fetchWorkspace`), `map.ts`, `transform.ts`,
  `fetch-workspace.ts`, `query.ts` — the existing Node GraphQL read plumbing;
  reuse for the Linear-side read/resolve/diff. `client.ts` is intentionally
  Node-only (reads `process.env.LINEAR_API_KEY`) — fits a CLI.
- `src/lib/roadmap/schema.ts` — `RoadmapJson`/`Project`/`Initiative` Zod shapes;
  `planAhead?` optional field already added in Phase 5. The snapshot patch
  (D-06-09) must keep the file schema-valid.
- `scripts/sync-snapshot.ts` + `pnpm sync:snapshot` — the established
  `tsx scripts/*.ts` script pattern to mirror for `pnpm sync:gsd`.
- `tsx` already in devDeps; no new runtime dep needed for the CLI itself.

### Established Patterns
- Two-part complexity-safe Linear fetch (MAIN_QUERY + paginated ISSUES_QUERY,
  assembled in `fetch-workspace.ts`) — extend, don't fight, at production volume.
- Sanitization/leak-gate (`assertNoLeak`) already guards `roadmap.json`; the
  planAhead patch must not bypass it.

### Integration Points
- New `pnpm sync:gsd` script → `scripts/sync-gsd-linear/` (walker → parser →
  resolver → diff → date proposer → apply). Reads sibling `../<repo>/.planning/`.
- `public/roadmap.json` patched with `planAhead` (D-06-09) — the only write into
  the app's own data path.
- `linear-map.json` (new, central) + `sync.config.json` (new, committed).

</code_context>

<specifics>
## Specific Ideas

- Real sibling `.planning/` structure confirmed: `config.json` at root; `phases/`
  holds `NN-slug/` dirs; each dir has one or more `NN-MM-PLAN.md` files (and a
  bare `PLAN.md` in some). Some repos carry `ROADMAP.md`/`PROJECT.md`/`STATE.md`
  at `.planning/` root — usable for project summary/status enrichment.
- Initial target repos (from the stub "Done when"): `../claude-workflow`,
  `../../factiv/cparx`, `../../factiv/fx-signal-agent`.
- Approval prompt shape agreed (per D-06-07):
  ```
  $ pnpm sync:gsd -- --project claude-workflow
   claude-workflow → Linear
    + 3 milestones, + 11 issues, ~ 4 dates
    [diff detail...]
   Apply these writes? (y/N)
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Two-way sync (Linear → `.planning/` pull-down)** — explicitly out of scope
  (REQUIREMENTS "Out of Scope"); architecture follow-up.
- **UI-triggered per-project backfill + live refresh** — Phase 7 (LIVE-01..03).
- **Scheduled snapshot refresh cadence** (CI cron vs Pages cron) — Phase 7/8 open
  follow-up in `docs/architecture.md`.
- **`fbc-platform` pull-down** (Linear ahead of repo) — noted in architecture
  "Open follow-ups"; not this phase.
- **Interactive per-date editing** — dropped as YAGNI (D-06-06); revisit only if
  cadence+anchor flags prove insufficient.

</deferred>

---

*Phase: 06-sync-gsd-linear-cli*
*Context gathered: 2026-07-15*
