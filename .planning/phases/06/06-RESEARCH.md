# Phase 6: sync-gsd-linear CLI (backfill engine) - Research

**Researched:** 2026-07-15
**Domain:** Node/TypeScript CLI, Linear GraphQL write API, GSD `.planning/` filesystem parsing
**Confidence:** MEDIUM-HIGH (Linear API surface verified live via GraphQL introspection; `.planning/` structure verified by direct inspection of the three real target repos; CLI ergonomics HIGH — builtin Node only)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data model mapping (SYNC-01, SYNC-02)**
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

**Repo scope & configuration**
- **D-06-04 (scope):** A **committed allow-list config in THIS repo** (e.g.
  `sync.config.json`) is the single source of truth: each entry is
  `{ repo path → optional Linear initiative + `roadmap:<repo>` label }`.
  Explicitly **not** discover-all-siblings (~13 `.planning/` dirs incl.
  `bench-*`, testbeds, `opencode-workflow` must never reach Linear). `--project
  <name>` narrows a run to one config entry.
- **D-06-05 (map location):** `linear-map.json` lives **centrally in this repo**
  (not scattered per-sibling), alongside the allow-list config. One place to
  inspect/reset the id map.

**Date proposal (SYNC-03)**
- **D-06-06 (date algorithm):** **Fixed cadence from an anchor, sequential by
  phase order.** Completed phases keep/leave their existing dates (no future
  date invented). The next-up phase anchors at a start date (**default: today**,
  overridable via flag/config), each subsequent phase `+N weeks` (**default
  cadence configurable**, e.g. 2wk). Proposed dates are shown in the diff for
  confirmation; **no interactive per-date editor** (adjust via `--anchor` /
  `--cadence` and re-run — YAGNI). Not horizon-spread, not preserve-only.

**Apply UX & write path (SYNC-04)**
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

### Deferred Ideas (OUT OF SCOPE)

- **Two-way sync (Linear → `.planning/` pull-down)** — explicitly out of scope
  (REQUIREMENTS "Out of Scope"); architecture follow-up.
- **UI-triggered per-project backfill + live refresh** — Phase 7 (LIVE-01..03).
- **Scheduled snapshot refresh cadence** (CI cron vs Pages cron) — Phase 7/8 open
  follow-up in `docs/architecture.md`.
- **`fbc-platform` pull-down** (Linear ahead of repo) — noted in architecture
  "Open follow-ups"; not this phase.
- **Interactive per-date editing** — dropped as YAGNI (D-06-06); revisit only if
  cadence+anchor flags prove insufficient.
</user_constraints>

## Summary

This phase is a backend-only Node CLI with two external integration surfaces: (1) the
local filesystem across three sibling GSD repos with **meaningfully divergent
`.planning/` shapes**, and (2) Linear's GraphQL **write** API, which this codebase has
never called before (all existing `scripts/linear/*` code is read-only).

The Linear write surface was verified directly against the **live production schema**
via unauthenticated GraphQL introspection (`https://api.linear.app/graphql` allows
`__type`/`__schema` queries without a token) — this is the highest-confidence source
available, stronger than blog posts or even Linear's own prose docs, because it is the
actual schema the CLI will call. Two non-obvious findings from that introspection
materially change the design from what CONTEXT.md's prose implies: **(a)** Project
labels and Issue labels are *different types* (`ProjectLabel` vs `IssueLabel`) with
separate create mutations, so the `roadmap:<repo>` label must be created/resolved
**twice** (once per pool) — or applied via `projectAddLabel`/`issueAddLabel` against two
separately-resolved label ids; **(b)** `ProjectCreateInput.teamIds` is a **required**
`[String!]!`, not optional, so a Linear "Team" (not just an Initiative) must be resolved
before a Project can be created at all — the CLI needs a team-key config value, and the
workspace observed here uses a single shared team (`AGE`) across all three target repos.

The `.planning/` walk revealed structural facts that CONTEXT.md's locked decisions did
not anticipate and that materially affect the walker/parser design: `claude-workflow`
has **duplicate phase-number directories** (two different `01-*` dirs, two `02-*`, two
`03-*`, two `04-*`, two `05-*`), so "phase NN" is not a unique key — the milestone
identity and its title-hash input must be the **full directory slug**, not the bare
number. `cparx` and `fx-signal-agent` use **decimal phase numbers** (`03.5-*`, `04.9-*`,
`04.13-*`) that sort lexicographically wrong if compared as plain strings. `PLAN.md`
frontmatter is **not universal** — `cparx`/`fx-signal-agent` plans carry structured YAML
frontmatter (`phase:`, `plan:`, `wave:`, `depends_on:`), but `claude-workflow`'s
(pre-migration-era) plans have **no frontmatter and often no descriptive H1** (`# Phase
09 — PLAN`), so issue-title extraction needs a directory-slug fallback. Finally,
per-phase **completion status has no single canonical source**: `ROADMAP.md` format
varies per repo (and `claude-workflow`'s is an explicit partial "stub" that only covers
phases 25+), and `STATE.md` frontmatter gives an aggregate count, not a per-phase list.

**Primary recommendation:** Build the walker to treat the **phase directory slug**
(`NN[.M]-slug`) as the canonical phase identity everywhere (dedup key input, hash input,
fallback title source), read `ROADMAP.md`/`STATE.md` only as an optional completion-status
enrichment layer (never as the source of phase existence), and resolve every Linear
write through **two lookups before any create** (stored map → label query → title-hash
query) using the raw GraphQL mutations confirmed below. Ship zero new npm dependencies —
`node:util.parseArgs`, `node:readline/promises`, and `node:crypto` cover CLI args, the
y/N prompt, and the title-hash respectively; the existing `zod` dependency covers the
`sync.config.json`/`linear-map.json` schemas.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `.planning/` walk + parse (SYNC-01) | CLI / Node script | Local filesystem (sibling repos) | Pure local file I/O, no network; must run before any Linear call |
| Linear read/resolve (SYNC-02) | CLI / Node script | Linear GraphQL API (read) | Reuses `scripts/linear/{query,fetch-workspace,map}.ts`; process-free modules stay importable, `client.ts`-style wrapper stays Node-only |
| Diff + date proposal (SYNC-03) | CLI / Node script | — | Pure computation over the normalized model + resolved Linear state; no I/O |
| Approval prompt + apply/write (SYNC-04) | CLI / Node script | Linear GraphQL API (write) | Raw `fetch` POSTs with `LINEAR_API_KEY`; gated by interactive prompt or `--yes` |
| `linear-map.json` persistence | CLI / Node script | Local filesystem (this repo) | Written back only after a successful mutation; central, not per-sibling |
| `roadmap.json` `planAhead` patch | CLI / Node script | Local filesystem (this repo, `public/`) | Reuses `assertNoLeak` + `RoadmapJsonSchema.parse`; gated to apply / `--write-snapshot` |

No browser, SSR, or CDN tier is involved — this phase is entirely a Node CLI process
invoked via `pnpm sync:gsd`, matching `scripts/sync-snapshot.ts`'s existing pattern.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tsx` | ^4.22.4 (already in devDeps) | Run TS scripts without a build step | Already the established pattern (`pnpm sync:snapshot`) [VERIFIED: package.json] |
| `zod` | ^4.4.3 (already in deps) | Validate `sync.config.json`, `linear-map.json`, and normalized `.planning/` model shapes | Already the project's schema-validation library (`src/lib/roadmap/schema.ts`) [VERIFIED: package.json] |
| `node:util` (`parseArgs`) | Node 24 builtin | CLI flag parsing (`--dry-run`, `--project`, `--yes`, `--anchor`, `--cadence`, `--write-snapshot`) | Builtin since Node 18.3/20; confirmed present in this environment (`node --version` → v24.16.0, `typeof parseArgs === "function"`) [VERIFIED: node runtime probe] — avoids a new `commander`/`yargs` dependency |
| `node:readline/promises` | Node builtin | Interactive `y/N` apply prompt | Builtin `createInterface().question()`; no dependency needed for a single yes/no gate |
| `node:crypto` (`createHash`) | Node builtin | Title-hash fallback (SYNC-02 dedup) | `createHash("sha256").update(str).digest("hex")` — stable, no dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ANSI escape codes (hand-rolled) | n/a | Colored diff output (`+`/`~`/`-` lines) | A ~10-line `const color = { green: (s) => `\x1b[32m${s}\x1b[0m`, ... }` helper is sufficient for the diff shape in CONTEXT.md's mockup; no `chalk`/`picocolors` needed given the CLAUDE.md "TypeScript everywhere, minimal deps" posture |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:util.parseArgs` | `commander` / `yargs` | Richer help text and subcommands, but this CLI has ~6 flags total on one entrypoint — a new dependency is not justified (CONTEXT.md explicitly leaves "CLI arg parser" to discretion and the project posture is dependency-minimal) |
| Hand-rolled ANSI diff | `chalk` / `picocolors` | Nicer API, but adds a dependency for something 10 lines of template-literal ANSI codes already does; `picocolors` (~0 deps, ~600B) would be the acceptable minimal choice **if** the hand-rolled approach proves awkward during implementation |
| Raw `fetch` GraphQL POSTs | `@linear/sdk` | Typed client with pagination helpers, but D-06-08 already locks "raw GraphQL mutations"; the SDK would also pull in its own GraphQL codegen runtime — against the "reuse `scripts/linear/*` plumbing" instruction |

**Installation:**
No new runtime or dev dependency is required for this phase. All CLI/crypto/prompt
primitives are Node builtins already available at the project's pinned Node version
(`engines`/CI use Node 24; confirmed via `node --version`).

**Version verification:** `tsx` (^4.22.4) and `zod` (^4.4.3) are already pinned in
`package.json` [VERIFIED: package.json read directly] — no version bump needed for this
phase's scope.

## Package Legitimacy Audit

**No external packages are introduced by this phase.** Every new capability (arg
parsing, interactive prompt, hashing, colored output) is covered by Node builtins
(`node:util`, `node:readline/promises`, `node:crypto`) plus the project's existing
`zod`/`tsx` dependencies. The Package Legitimacy Gate (slopcheck, registry checks) is
therefore not applicable — there is nothing to audit. If, during implementation, the
hand-rolled ANSI helper proves insufficient and `picocolors` is added, run the gate
protocol at that time before merging.

**Packages removed due to slopcheck verdict:** none (n/a — no packages proposed).
**Packages flagged as suspicious:** none (n/a).

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────┐
                    │   sync.config.json (repo)    │
                    │  allow-list: repo path,      │
                    │  optional initiative, team   │
                    └───────────────┬──────────────┘
                                    │ read
                                    ▼
 ../<repo>/.planning/  ──walk──▶ ┌─────────────┐
 (config.json, phases/NN-slug/,  │   Walker    │
  ROADMAP.md, STATE.md)          │  + Parser   │──▶ normalized
                                 └─────────────┘    { repo, phases[], plans[] }
                                                            │
                                                            ▼
 linear-map.json (repo) ───read──▶ ┌──────────────┐   Linear GraphQL (READ)
 roadmap:<repo> label    ────────▶ │   Resolver   │◀── MAIN_QUERY + ISSUES_QUERY
 title-hash fallback     ────────▶ │ (map→label→  │    (extend fetch-workspace.ts
                                    │  hash order) │     with teams/labels/          │
                                    └──────┬───────┘     projectMilestones reads)
                                           │ resolved ids + missing-record list
                                           ▼
                                    ┌──────────────┐
                                    │ Diff Engine  │──▶ "+ N milestones, + M issues,
                                    │ + Date       │     ~ D dates" (human summary)
                                    │ Proposer     │     + per-record detail
                                    └──────┬───────┘
                                           │ (--dry-run stops here)
                                           ▼
                              y/N prompt (node:readline) or --yes
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │ Apply/Upsert │──▶ Linear GraphQL (WRITE)
                                    │ (raw fetch   │    projectCreate, projectUpdate,
                                    │  mutations)  │    projectMilestoneCreate/Update,
                                    └──────┬───────┘    issueCreate/Update,
                                           │             projectLabelCreate,
                                           │             issueLabelCreate,
                                           │             initiativeToProjectCreate
                                           ▼
                          linear-map.json (ids written back)
                          + public/roadmap.json (planAhead patch,
                            gated to apply / --write-snapshot,
                            through assertNoLeak + RoadmapJsonSchema.parse)
```

### Recommended Project Structure
```
scripts/sync-gsd-linear/
├── config.ts          # sync.config.json + linear-map.json Zod schemas + loaders
├── walker.ts           # .planning/ directory walk → phase dir list
├── parser.ts           # phase dir + PLAN.md(s) → normalized { repo, phases[], plans[] }
├── resolve.ts           # map id → label query → title-hash query, against Linear reads
├── hash.ts               # stable title-hash helper (sha256 over slug/heading)
├── mutations.ts           # raw GraphQL mutation strings (mirrors scripts/linear/query.ts)
├── diff.ts                 # normalized model + resolved Linear state → diff summary
├── dates.ts                  # anchor + cadence → per-phase target dates
├── apply.ts                   # upsert orchestration + linear-map.json write-back
├── prompt.ts                   # node:readline y/N gate
├── cli.ts                       # parseArgs + orchestrates walker→resolve→diff→apply
└── *.test.ts                     # per-module unit tests (Vitest, mocked fetch)
scripts/sync-gsd-linear.ts        # thin entrypoint, mirrors scripts/sync-snapshot.ts
sync.config.json                  # committed allow-list (repo root)
linear-map.json                   # committed/central id map (repo root)
```
This keeps every stage independently unit-testable (Vitest, `fetch` injected like
`fetch-workspace.ts` already does) and mirrors the existing `scripts/linear/` module
boundary discipline (process-free pure functions vs. the Node-only entrypoint).

### Pattern 1: Process-free vs. Node-only boundary (reuse existing discipline)
**What:** `scripts/linear/map.ts`, `transform.ts`, `query.ts`, `fetch-workspace.ts` are
intentionally free of `process`/Node-only globals; only `client.ts` reads
`process.env.LINEAR_API_KEY`. This phase's CLI is 100% Node-only (it's a script, not a
Worker-shared module), so this boundary does **not** need to be preserved inside
`scripts/sync-gsd-linear/` — but the **read** side should still literally reuse
`fetchAssembledWorkspace(fetch, url, apiKey)` and `mapWorkspace` rather than
re-implementing project/initiative/issue fetching.
**When to use:** Any time this phase needs the current Linear state (for resolve/diff),
call the existing function; only the **new** reads (teams, labels, milestones-by-project
detail beyond what `MAIN_QUERY` returns) need new query strings in a new `mutations.ts`/
`queries.ts` file colocated with `scripts/sync-gsd-linear/`.
**Example:**
```typescript
// Source: scripts/linear/client.ts (existing, read-only reuse)
import { fetchAssembledWorkspace } from "../linear/fetch-workspace.ts";
import { mapWorkspace } from "../linear/map.ts";

const apiKey = process.env["LINEAR_API_KEY"];
if (!apiKey) throw new Error("LINEAR_API_KEY not set");
const assembled = await fetchAssembledWorkspace(fetch, LINEAR_API_URL, apiKey);
const workspace = mapWorkspace(assembled); // { initiatives, projects } — reuse for resolve
```

### Pattern 2: Resolve-then-create (never create-or-fail)
**What:** Every Linear write target (Project, ProjectMilestone, Issue, ProjectLabel,
IssueLabel, InitiativeToProject join) must be **queried first** by the locked resolve
order (stored id → label → title-hash) and only created if all three lookups miss.
Creating without checking first breaks idempotency (SYNC-04's "re-run is a no-op").
**When to use:** Every entity type in the apply stage, including labels — see the
"Don't Hand-Roll" section below on why labels need this too.
**Example (verified against live schema, see Code Examples):**
```typescript
// 1. stored id (from linear-map.json)
let projectId = map.projects[repoKey]?.id;
// 2. label query — roadmap:<repo> on the project label pool
if (!projectId) {
  const byLabel = workspace.projects.find(p => /* has roadmap:<repo> project-label */);
  projectId = byLabel?.id;
}
// 3. title-hash fallback (only if config-declared project name matches)
if (!projectId) {
  const byName = workspace.projects.find(p => p.name === config.projectName);
  projectId = byName?.id;
}
// 4. create only if all three missed
if (!projectId) {
  projectId = await createProject(...); // projectCreate mutation
}
```

### Anti-Patterns to Avoid
- **Trusting `ROADMAP.md` as the source of phase existence:** `claude-workflow`'s
  `ROADMAP.md` is an explicit partial stub (only phases 25+ enumerated; phases 01-24
  "shipped, see git history"). Always enumerate phases from `phases/*` directory
  listing; use `ROADMAP.md`/`STATE.md` only to *enrich* (completion status, dates), never
  to *discover*.
- **Hashing on the bare phase number:** `claude-workflow` has two `01-*` directories, two
  `02-*`, two `03-*`, two `04-*`, two `05-*` (different slugs, same leading number).
  Hashing/naming a milestone as "Phase 01" collides. Always hash and display using the
  full directory slug (`01-go-routing` vs `01-gsd-bug-fixes`).
- **Assuming `PLAN.md` has usable frontmatter or a descriptive H1:** `cparx`/
  `fx-signal-agent` plans have structured YAML frontmatter; `claude-workflow`'s do not,
  and its H1s are sometimes generic (`# Phase 09 — PLAN`, `# Phase 20 — Execution Plan`).
  Fall back to the directory slug for the issue title when the H1 is one of a small
  generic-heading denylist or frontmatter is absent.
- **Treating Project labels and Issue labels as the same pool:** they are distinct
  Linear types (`ProjectLabel` vs `IssueLabel`) with separate mutations. Applying only
  one will silently leave the other resource unlabeled, breaking the label-based resolve
  step on the next run for that resource type.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Linear complexity-safe pagination | A new bespoke paginator | Extend `fetchAssembledWorkspace`'s existing cursor-loop pattern (`ISSUES_QUERY` style: `first`, `after`, `pageInfo.hasNextPage/endCursor`) | Already solved and tested for the "Query too complex" failure mode this workspace hit in Phase 3 (03-04 STATE.md decision) — copy the loop shape, don't reinvent it |
| Token/PII leak prevention on `roadmap.json` writes | A new sanitizer for the `planAhead` patch | `assertNoLeak` + `RoadmapJsonSchema.parse` from `scripts/linear/transform.ts` / `src/lib/roadmap/schema.ts` | Already audited (SNAP-04); the patch must go through the same gate the full snapshot does — never write `roadmap.json` via a separate unaudited path |
| Stable content hashing | A custom string-hash function | `node:crypto.createHash("sha256")` | Builtin, deterministic across Node versions/platforms, no dependency |
| GraphQL request/response typing | Hand-typed `any`-laden fetch calls | Mirror the existing `scripts/linear/query.ts` pattern: typed request/response interfaces per query/mutation, explicit allow-list mapping (as `map.ts` already does for reads) | Keeps "no `any` in committed code" (CLAUDE.md) and matches established file-local typing style |

**Key insight:** Nothing in this phase's Linear-write surface is genuinely novel
engineering — Linear's GraphQL API already provides idempotent-friendly create mutations
with server-generated ids; the actual engineering risk is entirely in **not skipping the
resolve-before-create step** for every one of the six mutation targets (project,
milestone, issue, project-label, issue-label, initiative-join), because skipping it for
even one silently breaks the "re-run is a no-op" requirement (SYNC-04).

## Common Pitfalls

### Pitfall 1: Treating "phase number" as a unique key
**What goes wrong:** A resolver keyed on `phase: "01"` overwrites or conflates two
distinct milestones in `claude-workflow` (`01-go-routing` and `01-gsd-bug-fixes`), or
mis-sorts decimal phases (`03.5`, `04.10` sorting as strings after `04.1` but before
`04.2` when compared lexicographically instead of numerically).
**Why it happens:** GSD's own phase-numbering convention allows both duplicate integer
prefixes (repo migrated numbering schemes over time) and decimal insertions
(`phase_naming` config value seen as `"sequential"` in `cparx`, but decimal phases like
`03.5-quality-scoring` exist alongside it — decimal insertion is evidently allowed even
under "sequential" numbering).
**How to avoid:** Key everything (map storage, hash input, display name) on the full
directory slug string (`NN[.M]-slug`). For date-ordering (SYNC-03's "sequential by phase
order"), parse the leading numeric token as a **float** (`03.5` → `3.5`, `04.10` →
`4.1` — note `04.10` and `04.1` are numerically different strings but the same float if
not parsed carefully; use `parseFloat("04.10")` → `4.1` **not** `4.10`, so prefer
comparing the raw dot-separated numeric segments component-wise, not `parseFloat`, to
avoid `04.10` colliding with `04.1`).
**Warning signs:** Two milestones created with the identical Linear name; phases
appearing out of order in the date-proposal diff.

### Pitfall 2: Resolving labels against the wrong label pool
**What goes wrong:** Code queries/creates via `issueLabelCreate`/`issueLabels` for the
`roadmap:<repo>` label and then tries to attach the *same* label id to a Project's
`labelIds` — Linear will reject it or silently no-op, because `ProjectLabel` and
`IssueLabel` are different GraphQL types with different id spaces (confirmed via live
introspection — `Project.labels: ProjectLabelConnection!` vs `Issue.labels` via
`IssueLabel`, with separate `projectLabelCreate`/`issueLabelCreate` mutations and
separate `projectLabels`/`issueLabels` root queries).
**Why it happens:** The label *name string* (`roadmap:<repo>`) is the same for both,
which makes it easy to assume the underlying id is shared too.
**How to avoid:** Resolve/create the label **twice** — once in the `ProjectLabel` pool
for the project, once in the `IssueLabel` pool for each issue — and store both ids
(or re-resolve by name each run, which is cheap: a single filtered query per pool).
**Warning signs:** The project-level resolve-by-label step never finds an existing
project on re-run (falls through to title-hash or duplicate-creates) even though the
label was "created" in a prior run.

### Pitfall 3: `ROADMAP.md`/`STATE.md` completion signals are per-repo-inconsistent
**What goes wrong:** A parser that expects a `## Completed Phases` table (present in
`claude-workflow`'s `STATE.md`) or a `- [x] Phase N: ... (k/k)` line (present in
`fx-signal-agent`/`cparx` `ROADMAP.md`) will silently treat phases as "not complete" (and
propose fresh dates for them, violating D-06-06 "completed phases untouched") in repos
where that exact format doesn't hold — e.g. `cparx`'s `STATE.md` has no `## Completed
Phases` heading at all; `claude-workflow`'s `ROADMAP.md` only enumerates phases 25+.
**Why it happens:** Each repo's GSD tooling evolved independently over time (visible in
the differing `.planning/config.json` shapes across the three repos — `claude-workflow`'s
is minimal, `cparx`/`fx-signal-agent` carry the full `hooks`/`workflow` block).
**How to avoid:** Use a **layered, lenient** heuristic, not a single format assumption:
(1) if `ROADMAP.md` exists and lists the phase with `[x]`/`✅` → completed; (2) else if
`VERIFICATION.md` exists in the phase directory → completed (this file was present for
every genuinely-shipped phase observed across all three repos); (3) else if every
`NN-MM-PLAN.md` has a sibling `NN-MM-SUMMARY.md` → completed; (4) else → treat as
in-progress/not-complete and propose a date. Because D-06-06 only affects *date
proposal* (not milestone/issue identity or dedup), a false "not complete" is a low-harm
failure mode (worst case: a shipped phase gets a proposed date shown in the diff, which
the human reviewer can decline) — bias the heuristic toward this safer direction rather
than toward false "complete" (which would silently skip a phase that needs a date).
**Warning signs:** Diff proposes new/changed dates for phases the user knows already
shipped.

### Pitfall 4: Assuming `issueCreate`/`projectCreate` are safe to call without a team
**What goes wrong:** `projectCreate` fails outright (`teamIds` is `[String!]!`,
non-nullable) and `issueCreate` fails outright (`teamId` is `String!`, non-nullable) if
the CLI doesn't resolve a Linear Team id first — this is not optional even though
CONTEXT.md's `roadmap.json` shape example has no team concept anywhere in the app's read
side.
**Why it happens:** The read-side `scripts/linear/*` code (Phases 1-2) never needed
teams — `MAIN_QUERY` fetches projects/initiatives, and issues are only read in bulk via
`ISSUES_QUERY` for counting, with no team association ever mapped.
**How to avoid:** Resolve a team id once per config entry (`teams(filter: {key: {eq:
"<TEAM_KEY>"}})`) before any create call in that project's apply pass; fail with a clear,
actionable error if the configured team key doesn't resolve. This workspace's three
target repos all use Linear issue prefixes under a single shared team (`AGE` — visible in
`fx-signal-agent`'s and `cparx`'s existing Linear-issue references, e.g. `AGE-51`,
`M7`/`332f9fe5-...`), and this repo's own `.planning/config.json` also has
`linear.team: "AGE"` — strongly suggesting a single default team key is sufficient for
v1, with a per-entry override in `sync.config.json` for future multi-team workspaces.
**Warning signs:** `projectCreate`/`issueCreate` GraphQL errors on the very first apply.

## Code Examples

Verified patterns from live GraphQL introspection (`https://api.linear.app/graphql`,
unauthenticated `__type`/`__schema` queries — this endpoint's introspection is public,
so these are the actual current production field names, not training-data guesses):

### Resolve a team by key
```typescript
// Source: live introspection of TeamFilter / Query.teams (2026-07-15)
const TEAMS_QUERY = `
  query TeamByKey($key: String!) {
    teams(filter: { key: { eq: $key } }, first: 1) {
      nodes { id name key }
    }
  }
`;
```

### Create a Project (team required, initiative attached separately)
```typescript
// Source: live introspection of ProjectCreateInput / Mutation.projectCreate (2026-07-15)
// ProjectCreateInput required: name: String!, teamIds: [String!]!
// ProjectCreateInput optional (relevant): description, labelIds, color, icon
const PROJECT_CREATE = `
  mutation ProjectCreate($input: ProjectCreateInput!) {
    projectCreate(input: $input) {
      success
      project { id name }
    }
  }
`;
// variables: { input: { name: "claude-workflow", teamIds: [teamId], labelIds: [projectLabelId] } }
```

### Attach a Project to an Initiative (separate join mutation — NOT a projectCreate field)
```typescript
// Source: live introspection of InitiativeToProjectCreateInput (2026-07-15)
// Required: projectId: String!, initiativeId: String!
const INITIATIVE_TO_PROJECT_CREATE = `
  mutation InitiativeToProjectCreate($input: InitiativeToProjectCreateInput!) {
    initiativeToProjectCreate(input: $input) {
      success
      initiativeToProject { id }
    }
  }
`;
```

### Create a ProjectMilestone
```typescript
// Source: live introspection of ProjectMilestoneCreateInput (2026-07-15)
// Required: name: String!, projectId: String!. Optional: description, targetDate (TimelessDate, "YYYY-MM-DD")
const MILESTONE_CREATE = `
  mutation ProjectMilestoneCreate($input: ProjectMilestoneCreateInput!) {
    projectMilestoneCreate(input: $input) {
      success
      projectMilestone { id name targetDate }
    }
  }
`;
```

### Create an Issue (team + project + milestone + labels)
```typescript
// Source: live introspection of IssueCreateInput (2026-07-15)
// Required: teamId: String!. Optional (relevant): title, description, projectId,
// projectMilestoneId, labelIds: [String!]
const ISSUE_CREATE = `
  mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { id identifier title }
    }
  }
`;
// variables: { input: { teamId, title, description, projectId, projectMilestoneId, labelIds: [issueLabelId] } }
```

### Resolve-or-create a label in the correct pool
```typescript
// Source: live introspection — Project.labels: ProjectLabelConnection! (via projectLabels
// query / projectLabelCreate mutation) is DISTINCT from Issue labels (issueLabels query /
// issueLabelCreate mutation). Both input shapes are structurally similar
// ({ name: String!, teamId?: String, color?, description? }) but are different types.
const PROJECT_LABELS_QUERY = `
  query ProjectLabelByName($name: String!) {
    projectLabels(filter: { name: { eq: $name } }, first: 1) { nodes { id name } }
  }
`;
const ISSUE_LABELS_QUERY = `
  query IssueLabelByName($name: String!) {
    issueLabels(filter: { name: { eq: $name } }, first: 1) { nodes { id name } }
  }
`;
// Create with projectLabelCreate / issueLabelCreate respectively if the query misses.
```

### Idempotent apply pattern (pseudocode, ties the above together)
```typescript
async function upsertMilestone(project: ResolvedProject, phase: NormalizedPhase, map: LinearMap) {
  const stored = map.milestones[`${project.repoKey}/${phase.slug}`];
  if (stored) return stored.id;

  const hash = titleHash(phase.slug); // sha256 over full directory slug
  const existing = project.milestones.find(m => titleHash(m.name) === hash);
  if (existing) return existing.id;

  const created = await createProjectMilestone({ name: phase.slug, projectId: project.id, targetDate: phase.proposedDate });
  map.milestones[`${project.repoKey}/${phase.slug}`] = { id: created.id };
  return created.id;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — this is a new integration surface for this codebase (no prior write path existed) | Raw GraphQL mutations via `fetch` + `LINEAR_API_KEY` | This phase (D-06-08, superseding the architecture doc's MCP-tool-name placeholder) | The architecture doc's `save_milestone`/`save_issue` reference is stale/MCP-only and must not be treated as real API surface — confirmed both by CONTEXT.md D-06-08 and by this research (no such mutation names exist in the live schema) |

**Deprecated/outdated:**
- `docs/architecture.md`'s `save_milestone` / `save_issue` pipeline step names: these do
  not exist as GraphQL mutations (verified — the live `Mutation` type has no field by
  those names). They were always MCP-tool shorthand; CONTEXT.md already flags this, and
  this research confirms no such mutation exists to call directly.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `AGE` team key is a valid single default for all three target repos' Linear team resolution | Pitfall 4, Code Examples | If some target repo actually needs a different team, `projectCreate`/`issueCreate` will hard-fail with a clear GraphQL error at apply time (fail-closed, not silent) — low risk, but `sync.config.json` should still allow a per-entry override rather than hardcoding "AGE" |
| A2 | The layered completion heuristic (ROADMAP checkbox → VERIFICATION.md presence → SUMMARY.md completeness → else in-progress) correctly classifies "completed" phases across repos beyond the three inspected here | Pitfall 3 | If wrong for a repo added later, worst case is a stale/already-shipped phase gets a proposed date shown in the diff — human reviewer catches it before any write (dry-run-first mitigates) |
| A3 | `ProjectLabelCreateInput` and `IssueLabelCreateInput` behave symmetrically (both accept an optional `teamId` to scope the label, both default to workspace-wide if omitted) — only field *names* were introspected, not runtime create behavior | Pitfall 2, Code Examples | If the create mutation actually requires `teamId` at runtime despite being nullable in the schema, the first apply run will surface a clear GraphQL error, not silent data corruption |
| A4 | A single `roadmap:<repo>` label per repo (not per-phase or per-issue-type) is sufficient as the label-based resolve signal, consistent with CONTEXT.md's stated design | Pitfall 2 | Low risk — this is a locked decision (D-06-04), not a research finding; flagged only because the two-pool label mechanics change *how* it's implemented, not *whether* |

**If this table is empty:** N/A — see entries above. All Linear GraphQL *field names,
mutation names, and required/optional-ness* claims in this document are `[VERIFIED:
live GraphQL introspection]`, not assumptions — only *runtime behavior* not observable
via introspection (e.g., "does creating a duplicate-named label error or succeed?") is
flagged as assumed.

## Open Questions

1. **What exact string is the milestone/issue title-hash input — bare phase number, full
   directory slug, or the human-readable `ROADMAP.md` phase title?**
   - What we know: D-06-03 says "milestone hashed on phase name, issue hashed on plan
     heading" — but "phase name" is ambiguous given the duplicate-`NN` collision found in
     `claude-workflow`.
   - What's unclear: whether the planner/user intends "phase name" to mean the
     directory slug (`01-go-routing`) or a prose title pulled from `ROADMAP.md`/the
     phase's own doc (which may not exist for every phase, e.g. `claude-workflow`'s
     ROADMAP.md stub doesn't cover phases 01-24 at all).
   - Recommendation: use the **directory slug** as the canonical hash input (guaranteed
     to exist and be unique per repo, unlike a prose title) and display a
     humanized version (slug → Title Case) in the diff/Linear UI for readability. Confirm
     this choice explicitly during planning since it affects the very first thing the
     resolver does.

2. **Does `fx-signal-agent`'s pre-existing Linear milestone naming (`M7`, `M8` — not
   phase-name-based) create a duplicate-milestone risk on first run?**
   - What we know: `fx-signal-agent/.planning/ROADMAP.md` explicitly states "Linear is
     source of truth" and references existing Linear milestone ids (`M7` =
     `332f9fe5-5b20-4df1-8e0b-ef540f46c3a1`) that don't follow this CLI's
     slug-based naming/hash convention.
   - What's unclear: whether the CLI's first run against `fx-signal-agent` should attempt
     to match those pre-existing milestones (would require a manual seed entry in
     `linear-map.json` before the first apply) or simply create new, differently-named
     milestones alongside them (creating visible duplication in Linear, though not a
     dedup *bug* since the CLI's own re-runs would still be idempotent against what it
     created).
   - Recommendation: for `fx-signal-agent` specifically, seed `linear-map.json` manually
     (human-provided ids) for phases 9-10 before the first `--project fx-signal-agent`
     apply, or scope the initial rollout to `claude-workflow` + `cparx` first and treat
     `fx-signal-agent` as a follow-up once its Linear structure is reconciled. Surface
     this explicitly to the user during planning — it's a real product decision, not a
     pure engineering one.

3. **Should the walker restrict itself to `phases/*` or also read the milestone-scoped
   `milestones/vX.Y.Z-ROADMAP.md` files seen in `fx-signal-agent` (and, by extension,
   might other repos have similarly nested/archival roadmap structures)?**
   - What we know: `fx-signal-agent` splits historical milestone detail into
     `.planning/milestones/v1.18.0-ROADMAP.md` while the live `.planning/ROADMAP.md`
     only summarizes; `cparx` keeps everything in one flat `.planning/ROADMAP.md`.
   - What's unclear: whether phase-level success-criteria/status detail living only in
     the nested `milestones/` file matters for this phase's scope (issue *body* content
     is out of scope per D-06-01 — only the plan-file heading + phase slug are needed),
     so this is likely a non-issue, but flagging since it's a structural asymmetry
     the walker must not choke on (must not assume `milestones/` doesn't exist, must not
     require it either).
   - Recommendation: walker only needs `phases/*` + optionally `ROADMAP.md`/`STATE.md`
     at the `.planning/` root for completion enrichment; treat `milestones/*` as
     out-of-scope for v1 (confirm during planning if OV-03-style drill-down ever wants
     richer milestone descriptions later — not this phase).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (`node:util.parseArgs`, `node:readline/promises`, `node:crypto`) | CLI args, prompt, hashing | ✓ | v24.16.0 | — |
| `tsx` | Script execution (`pnpm sync:gsd` entrypoint) | ✓ | ^4.22.4 (devDep) | — |
| `zod` | Config/map schema validation | ✓ | ^4.4.3 (dep) | — |
| Sibling repo `.planning/` dirs (`../claude-workflow`, `../../factiv/cparx`, `../../factiv/fx-signal-agent`) | Walker input | ✓ (all three confirmed present on this machine) | — | If a configured repo path is missing at run time, the walker should skip that entry with a warning, not crash the whole run |
| `LINEAR_API_KEY` env var | Linear read + write calls | Present in CI secret per `docs/architecture.md`/STATE.md notes, **not required for `--dry-run` against cached/read state alone** but IS required for the resolve step (reads real Linear state) | — | None — SYNC-01..04 all require at least a read; fail fast with the same clear error `client.ts`'s `fetchWorkspace` already throws |
| Linear GraphQL API reachability (`https://api.linear.app/graphql`) | Resolve + apply | ✓ (confirmed reachable + introspectable during this research session) | — | None for apply; `--dry-run` could theoretically run fully offline only if map + a cached workspace snapshot were reused, which is out of scope — every dry-run still does a live read |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** sibling repo path missing → skip that config
entry with a warning (documented above).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.9 (already configured, `vitest.config.ts` present) [VERIFIED: package.json + repo file listing] |
| Config file | `vitest.config.ts` |
| Quick run command | `CI=true npx vitest run scripts/sync-gsd-linear` (per the project's documented non-TTY workaround — `pnpm test` can hang in agent shells) |
| Full suite command | `CI=true npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | Walker discovers all `phases/*` dirs incl. duplicate-`NN` and decimal-phase names; parser extracts plan headings with/without frontmatter | unit | `vitest run scripts/sync-gsd-linear/walker.test.ts scripts/sync-gsd-linear/parser.test.ts` | ❌ Wave 0 — needs fixture `.planning/` trees mirroring the 3 real repos' quirks (duplicate `01-*`, decimal `03.5-*`, frontmatter-less `PLAN.md`) |
| SYNC-02 | Resolver honors map → project-label → issue-label → title-hash order; no duplicate on re-resolve | unit | `vitest run scripts/sync-gsd-linear/resolve.test.ts` | ❌ Wave 0 — needs a mocked `fetch` returning a fixture `GqlResponse` (reuse the `gqlClean`-style fixture pattern from `functions/api/linear/[[path]].test.ts`) |
| SYNC-02 | Title-hash is stable across runs (same slug/heading → same hash, different slug → different hash) | unit | `vitest run scripts/sync-gsd-linear/hash.test.ts` | ❌ Wave 0 |
| SYNC-03 | Diff engine produces the documented human summary shape (`+ N milestones, + M issues, ~ D dates`) | unit | `vitest run scripts/sync-gsd-linear/diff.test.ts` | ❌ Wave 0 |
| SYNC-03 | Date proposer: completed phases untouched, anchor/cadence math correct, decimal-phase ordering correct | unit | `vitest run scripts/sync-gsd-linear/dates.test.ts` | ❌ Wave 0 |
| SYNC-04 | `--dry-run` performs zero mutation calls (assert mock mutation `fetch` never invoked) | unit | `vitest run scripts/sync-gsd-linear/apply.test.ts -t "dry-run"` | ❌ Wave 0 |
| SYNC-04 | Idempotency: apply → mutate mocked Linear state → re-resolve against the now-populated mock → second diff is empty | integration (mocked GraphQL) | `vitest run scripts/sync-gsd-linear/apply.test.ts -t "idempotent"` | ❌ Wave 0 — this is the core "Applying one project creates ... no duplicates on re-run" success criterion; must be automated against a mock, not deferred to manual-only, since the mock can simulate "run twice" cheaply |
| SYNC-04 | `planAhead` patch keeps `roadmap.json` schema-valid and leak-free | unit | `vitest run scripts/sync-gsd-linear/apply.test.ts -t "planAhead"` | ❌ Wave 0 — reuse `assertNoLeak`/`RoadmapJsonSchema` already under test in `schema.test.ts`/`transform.test.ts` |
| SYNC-01..04 (end-to-end) | Dry-run against a **real** target repo (`claude-workflow`) produces a diff a human judges accurate | manual-only | N/A — human review of printed diff output | Justified: "accurate" per the phase's own success criterion #1 is a human judgment call against real Linear state, not a fixture-derivable assertion |
| SYNC-04 (end-to-end) | A real apply run against Linear, followed by a real re-run, is a no-op | manual-only (`checkpoint:human-verify`) | N/A — requires live `LINEAR_API_KEY` + willingness to write test data into the real workspace | Justified: writing to production Linear data is a deliberate, approval-gated action per D-06-07; automated CI cannot safely do this repeatedly. The mocked integration test above covers the *logic*; this manual step covers the *live wire*. |

### Sampling Rate
- **Per task commit:** `CI=true npx vitest run scripts/sync-gsd-linear/<touched-file>.test.ts`
- **Per wave merge:** `CI=true npx vitest run scripts/sync-gsd-linear`
- **Phase gate:** Full suite green (`CI=true npx vitest run`) before `/gsd-verify-work`, plus the two manual-only items above captured in a UAT/verification artifact.

### Wave 0 Gaps
- [ ] `scripts/sync-gsd-linear/__fixtures__/planning-trees/` — synthetic `.planning/` directory fixtures reproducing: duplicate-`NN` dirs, decimal-phase dirs, frontmatter-less `PLAN.md`, a bare bodyless `PLAN.md`, a `ROADMAP.md` stub that only covers a phase subset
- [ ] `scripts/sync-gsd-linear/__fixtures__/linear-responses.ts` — mock `GqlResponse`-shaped fixtures for teams/labels/projects/milestones reads, mirroring the `gqlClean`/`gqlWithEmail` fixture-contract pattern already used in `functions/api/linear/[[path]].test.ts`
- [ ] `scripts/sync-gsd-linear/__fixtures__/linear-mutation-mock.ts` — an in-memory mock GraphQL server (map of mutation name → handler that mutates an in-memory workspace state) to drive the "apply twice → second run no-op" idempotency test without hitting the real API
- [ ] Framework install: none — Vitest is already configured project-wide

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This CLI authenticates *to* Linear (outbound), it does not authenticate inbound users — n/a |
| V3 Session Management | no | No sessions — single-process CLI invocation |
| V4 Access Control | partial | The "explicit per-project approval" gate (D-06-07) is the access-control-equivalent here: no write happens without an interactive `y/N` or explicit `--yes`; enforce this as a hard gate in code (not just documentation) |
| V5 Input Validation | yes | `sync.config.json`/`linear-map.json` and the normalized `.planning/` model must be Zod-validated before use (matches `RoadmapJsonSchema` precedent); untrusted Markdown/YAML content read from sibling repos (plan headings, frontmatter) must never be interpolated unescaped into GraphQL string variables — always pass via GraphQL `variables`, never string-concatenated into the query body (the existing `scripts/linear/*` code already does this correctly; mutations.ts must follow the same discipline) |
| V6 Cryptography | n/a | No cryptographic operations beyond a non-security-sensitive content hash (`sha256` for dedup identity, not secrecy) — no key management needed |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| GraphQL query/variable injection via untrusted `.planning/` content (a malicious/malformed plan heading containing GraphQL-breaking characters) | Tampering | Always pass values through the GraphQL `variables` object, never string-interpolate into the query document (already the pattern in `scripts/linear/fetch-workspace.ts`) |
| `LINEAR_API_KEY` leaking into `linear-map.json`, `sync.config.json`, or committed diff output | Information Disclosure | Never log the raw header value; the existing `assertNoLeak` token-pattern check (`lin_api_[A-Za-z0-9_-]+`) should be run over any new file this CLI writes (`linear-map.json` if it ever logs request metadata — it should not) |
| Unintended bulk write (looping over all configured repos without the per-project gate) | Elevation of Privilege / unintended Tampering | Hard-enforce D-06-07 in code: the apply function must require an explicit single resolved `--project <name>` (or an equivalent per-entry loop with a prompt **per entry**, never a single prompt covering multiple projects) — CLAUDE.md's "Never let `sync-gsd-linear` bulk-write all projects" is a hard constraint, not just a UX preference |
| Reading arbitrary paths from `sync.config.json` (path traversal into unintended directories) | Tampering | `sync.config.json` is a **committed, human-reviewed** file (not user input at runtime) — treat it as trusted config, but still resolve repo paths and confirm each resolves to a `.planning/` directory before walking, failing closed if not |

## Project Constraints (from CLAUDE.md)

- **TypeScript everywhere; no `any` in committed code** — explicit interfaces for every
  GraphQL request/response shape in `scripts/sync-gsd-linear/*`, matching the existing
  `scripts/linear/*` typing discipline.
- **Linear token stays server-side** — `LINEAR_API_KEY` is read only via
  `process.env` inside the Node-only CLI entrypoint (never bundled, never written to
  `sync.config.json`/`linear-map.json`/`roadmap.json`).
- **`sync-gsd-linear` is dry-run-first and per-project; no bulk write** — `--dry-run` is
  the default; every write requires an explicit per-project approval (interactive `y/N`
  or `--yes` for CI, but always scoped to one resolved project per invocation).
- **Never duplicate Linear records — match by stored id first, title-hash fallback** —
  the full three-step resolve order (map → label → title-hash) from D-06-03 satisfies
  this; the label step is an addition beyond CLAUDE.md's literal two-step wording but
  does not contradict it (CONTEXT.md's D-06-03 supersedes with the fuller order).
- **Snapshot (`roadmap.json`) stays token-free and schema-valid** — the `planAhead` patch
  must go through `RoadmapJsonSchema.parse` + `assertNoLeak`, exactly like the full
  `sync:snapshot` path.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | `.planning/` walker + `PLAN.md` parser producing a normalized `{ repo, phases[], tasks[] }` model | Confirmed real on-disk structure across all 3 target repos incl. edge cases (duplicate-`NN` dirs, decimal phases, frontmatter-optional `PLAN.md`, generic H1s) — see "State of the Art" absent (n/a) / Pitfalls 1 & 3, "Recommended Project Structure" (`walker.ts`/`parser.ts`) |
| SYNC-02 | Linear resolver — stored `linear-map.json` first, then `roadmap:<repo>` label, then title-hash fallback — with no duplicate records | Verified exact Linear GraphQL types/mutations for both label pools (`ProjectLabel` vs `IssueLabel`), confirmed `teams`/`issueLabels`/`projectLabels` filterable queries for lookup-before-create — see "Code Examples", Pitfall 2, Pitfall 4 |
| SYNC-03 | Per-project diff engine + date proposer (relative dates from phase order, shown for confirmation) | Confirmed `TimelessDate` (`YYYY-MM-DD`) format for `targetDate` fields via live introspection; confirmed decimal-phase ordering hazard requiring component-wise numeric comparison — see Pitfall 1, "Recommended Project Structure" (`diff.ts`/`dates.ts`) |
| SYNC-04 | `--dry-run` default and `--project <name>` apply path with explicit approval; idempotent upsert (re-run is a no-op) | Confirmed all six mutation names/payload shapes (`projectCreate`, `projectUpdate`, `projectMilestoneCreate/Update`, `issueCreate/Update`, `projectLabelCreate`, `issueLabelCreate`, `initiativeToProjectCreate`) plus rate limits (5,000 req/hr, 3,000,000 complexity/hr) confirming no throttling concern at this scale — see "Code Examples", "Validation Architecture" idempotency test plan |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- Live GraphQL introspection of `https://api.linear.app/graphql` (unauthenticated `__type`/`__schema` queries run directly during this research session, 2026-07-15) — `IssueCreateInput`, `IssueUpdateInput`, `ProjectCreateInput`, `ProjectUpdateInput`, `ProjectMilestoneCreateInput`, `ProjectMilestoneUpdateInput`, `IssueLabelCreateInput`, `ProjectLabelCreateInput`, `InitiativeToProjectCreateInput`, `IssuePayload`, `ProjectPayload`, `ProjectMilestonePayload`, `IssueLabelPayload`, `InitiativeToProjectPayload`, `Mutation` field signatures for all 8 mutations used, `Query` field list (`teams`, `issueLabels`, `projectLabels`, `projectStatuses`), `TeamFilter` shape, `Project.labels`/`Project.teams`/`Project.initiatives` field list.
- Direct filesystem inspection of `.planning/` in all three target repos (`../claude-workflow`, `../../factiv/cparx`, `../../factiv/fx-signal-agent`) on this machine, 2026-07-15.
- `package.json`, `vitest.config.ts`, `scripts/linear/{client,map,transform,fetch-workspace,query}.ts`, `src/lib/roadmap/schema.ts`, `scripts/sync-snapshot.ts` — direct repo reads.
- Node runtime probe (`node --version`, `node -e "typeof require('node:util').parseArgs"`) confirming builtin availability at v24.16.0.

### Secondary (MEDIUM confidence)
- [Linear Developers — Getting started](https://linear.app/developers/graphql) — auth header format (`Authorization: <API_KEY>` for personal keys).
- [Linear Developers — Rate limiting](https://linear.app/developers/rate-limiting) — 5,000 req/hr, 3,000,000 complexity/hr, 10,000 complexity/query cap, `X-RateLimit-*` headers.
- [Linear Docs — Labels](https://linear.app/docs/labels) — labels can be workspace-level or team-scoped (confirms the optional `teamId` field seen in both label input types).

### Tertiary (LOW confidence — cross-verified against live introspection above, retained only where introspection didn't cover runtime/behavioral nuance)
- [WithOne AI — Create a Project Milestone](https://www.withone.ai/knowledge/linear/conn_mod_def::GJ4vMUTeKdw::AqBn2vvSTsy3A1KqMWKcMA) and [Update a Project](https://www.withone.ai/knowledge/linear/conn_mod_def::GJ4vMIxn3RY::XfpxdsXNS9isj8qzbxlwvQ) — third-party summaries; used only for example-call shape, all field names cross-checked against live introspection.
- [GitHub — linear/linear issue #156](https://github.com/linear/linear/issues/156) ("Labels in Linear belong to a Team however through the API one can create issues with label id from other teams") — anecdotal confirmation that label/team scoping has known edge cases; informed Pitfall 2's caution but not directly relied upon for field names.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all Node builtins/existing deps verified directly against this repo's `package.json` and runtime.
- Architecture (Linear write API): HIGH — every mutation/input/payload field name verified via live schema introspection against the real production endpoint, the strongest possible source short of Linear's own (non-public-facing) internal docs.
- Architecture (`.planning/` parsing): MEDIUM-HIGH — verified directly against the three real named target repos on disk (not hypothetical), but the structural quirks found (duplicate-`NN`, decimal phases, frontmatter-optional plans, inconsistent completion markers) mean any *fourth* repo added later could surface a new shape not covered here.
- Pitfalls: HIGH — all four are grounded in direct filesystem/schema evidence gathered this session, not speculation.
- Security: MEDIUM — ASVS mapping is standard reasoning for a CLI-with-a-token shape; no CLI-specific Linear-API security advisory was found (none searched-for exists publicly), so the mitigations are derived from this codebase's existing patterns (`assertNoLeak`) rather than an external authority.

**Research date:** 2026-07-15
**Valid until:** ~30 days for the `.planning/` structural findings (stable, low churn); ~90 days for the Linear GraphQL schema findings (Linear's public schema is stable but not contractually versioned — re-verify via introspection if implementation is delayed significantly past this window).
