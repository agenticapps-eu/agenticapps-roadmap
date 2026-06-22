# agenticapps-roadmap

A private, filterable roadmap for every AgenticApps / Factiv project, read from
**Linear** and kept in sync with the **GSD plans** (`.planning/`) that live in
each repo.

- **Reads** all Linear initiatives, projects, milestones and issues.
- **High-level overviews** — KPI cards + an initiative-swimlane timeline.
- **Filtering** by initiative, time range, status and priority (URL-encoded, shareable).
- **Backfills** Linear from the repos' GSD phase plans, one project at a time,
  with proposed dates inferred from phase order — every write approved by you.
- **Hosted** on Cloudflare Pages, gated privately by Cloudflare Access.

## Architecture (decided)

Concept C — hybrid. See [`docs/architecture.md`](docs/architecture.md).

```
Cloudflare Pages  ──  React roadmap app (static snapshot, instant load)
       │
   Pages Functions (Worker)  ──  Linear GraphQL (token server-side)
       │                          ↑ live refresh + write-back
   Cloudflare Access  ──  private email allow-list
       │
   sync-gsd-linear (CLI/CI)  ──  walks repos' .planning/ → per-project approval → Linear
```

## Stack

Vite · React 19 · React Router 7 · Tailwind v4 · shadcn/ui · Cloudflare Pages +
Pages Functions · TypeScript throughout.

## Status

Spec-first scaffold. Work is broken into eight GSD phases under `.planning/phases/`.
Execute them with the prompts in [`docs/claude-code-prompts.md`](docs/claude-code-prompts.md).
The matching Linear project is **AgenticApps Roadmap** (initiative: agenticapps-workflow).

## Local development

```bash
pnpm install
pnpm dev            # Vite dev server
pnpm sync:snapshot  # fetch Linear → public/roadmap.json  (needs LINEAR_API_KEY)
pnpm sync:gsd -- --dry-run   # preview repo → Linear backfill
```

## Environment

| Var | Where | Purpose |
|---|---|---|
| `LINEAR_API_KEY` | CI secret / Pages Functions binding | server-side Linear access |
| `LINEAR_TEAM_ID` | build env | `AGE` team id |
| `ROADMAP_REPOS_ROOT` | local | parent dir(s) to scan for `.planning/` |

Never ship `LINEAR_API_KEY` to the client bundle — it lives only in CI and in
Pages Functions.
