# agenticapps-roadmap — agent guidance

Roadmap web app that reads Linear and syncs with the repos' GSD `.planning/` plans.
Part of the AgenticApps family (see `~/Sourcecode/agenticapps/CLAUDE.md`).

<!-- spec-source: agenticapps-workflow-core@0.4.0 §11 -->
## Coding Discipline (NON-NEGOTIABLE)

These four rules are reread every session because the failure modes
they prevent recur every session.

### 1. Think Before Coding

State assumptions explicitly before writing any line. When the request
is ambiguous, present the alternative interpretations and ask which
applies. When the request contradicts itself, surface the contradiction
rather than silently picking one side. When you are confused, stop and
ask — confusion is signal, not friction.

Anti-patterns this rule prevents:

- Diving into implementation without restating what was actually requested.
- Picking one reading of an ambiguous instruction silently and shipping it.
- Treating two contradictory requirements as if both can be satisfied without comment.
- Treating "I'll figure it out as I go" as a substitute for understanding the goal.
- Generating code first and asking clarifying questions only after a failure.

### 2. Simplicity First

Write the smallest thing that satisfies the request. No features
beyond what was asked. No abstractions for code with one caller. No
flexibility for callers that do not exist. No error handling for
scenarios that cannot occur given the code's invariants. The
senior-engineer test: would a senior engineer reviewing this say it is
overcomplicated for what was asked?

Anti-patterns this rule prevents:

- Adding a helper function "in case we need to call this from elsewhere later."
- Introducing a configuration option for behavior that has one consumer.
- Wrapping internal calls in try/catch when no internal caller throws.
- Designing for a hypothetical second consumer that does not exist.
- Replacing three similar lines with a parameterised abstraction.
- Shipping a "framework" when a function would do.

### 3. Surgical Changes

Touch only what you must to satisfy the task. Adjacent code is out of
scope. Match the existing style of the file you are editing rather than
the style you would have chosen. Clean up only the orphans your own
change created. If you notice an unrelated improvement, leave it as a
follow-up note, not a diff.

Anti-patterns this rule prevents:

- Reformatting untouched lines to "fix style" while editing nearby.
- Refactoring a function that the task did not name.
- Renaming a variable across the file because the new name is "better."
- Deleting code you decided is unused without verifying it has no callers.
- Pulling adjacent code into the diff because "while I'm here."
- Bundling a cleanup pass into a feature commit.

### 4. Goal-Driven Execution

Every task is a goal, not a list of imperative steps. Restate the goal
in a form that is verifiable from on-disk artifacts before writing any
code. For bug fixes: write the failing test that reproduces the bug
first, then make it pass. For performance work: capture the measurement
first, then change the code, then capture it again. For behavioral
changes: define the assertion the diff must satisfy before the diff
exists. "Done" is "the goal is verifiably satisfied," not "the code now
exists."

Anti-patterns this rule prevents:

- "Fix the bug" without a failing test that reproduces it.
- "Improve performance" without a measurement before and a measurement after.
- "Make it work" without a definition of "work" the diff can be checked against.
- Marking a task complete on the basis of "the code now exists" rather than "the goal is satisfied."
- Writing implementation before there is anything that can fail to confirm the goal is met.

These four rules apply to every code-touching turn. They do not
replace the commitment ritual, the rationalisation table, the red
flags, or the evidence rules — they sit alongside them as the
session-level discipline the model brings to every diff.

## What this repo is

- A **Cloudflare Pages** React app (Vite + React 19 + Router 7 + Tailwind v4 + shadcn/ui).
- A **Pages Functions** layer that proxies Linear's GraphQL API with a server-side token.
- A **`sync-gsd-linear`** CLI that walks sibling repos' `.planning/` and upserts
  Linear milestones/issues — one project at a time, every write user-approved.

Full design rationale: `docs/architecture.md`. Build prompts: `docs/claude-code-prompts.md`.

## Always do

- **TypeScript everywhere.** No `any` in committed code; model Linear types explicitly.
- **Keep the Linear token server-side.** It may only appear in CI secrets and in
  Pages Functions bindings — never in the client bundle or `roadmap.json`.
- **Snapshot is the default data path.** The app must render fully from
  `public/roadmap.json` with no network. Live mode is an enhancement, not a requirement.
- **The GSD sync is dry-run-first and per-project.** No write to Linear without a
  printed diff and an explicit yes for that specific project.
- **Work phase by phase.** Follow `.planning/phases/NN/PLAN.md` in order; each phase
  maps to a Linear milestone in the "AgenticApps Roadmap" project.

## Never do

- Never commit `LINEAR_API_KEY` or any token, or bake it into `roadmap.json`.
- Never let `sync-gsd-linear` bulk-write all projects; the approval gate is mandatory.
- Never duplicate Linear records — match by stored id first, title-hash fallback.

## Data model mapping

| GSD concept | Linear concept |
|---|---|
| repo / product | Initiative (or Project) |
| `.planning/phases/NN/` | Project milestone |
| tasks in `PLAN.md` | Issues under the project |
| phase order | proposed relative target dates |

## Commands

```bash
pnpm dev
pnpm build
pnpm sync:snapshot                 # Linear → public/roadmap.json
pnpm sync:gsd -- --dry-run         # preview repo → Linear backfill
pnpm sync:gsd -- --project <name>  # apply one project after approval
```

## Workflow

This project uses the AgenticApps Superpowers + GSD + gstack workflow.
Full hooks, rituals, and red-flag tables: [`.claude/claude-md/workflow.md`](.claude/claude-md/workflow.md).
Vendored — re-sync via `/update-agenticapps-workflow`.
