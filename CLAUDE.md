# agenticapps-roadmap — agent guidance

Roadmap web app that reads Linear and syncs with the repos' GSD `.planning/` plans.
Part of the AgenticApps family (see `~/Sourcecode/agenticapps/CLAUDE.md`).

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
