# Phase 2 — CONTEXT: Linear data layer & static snapshot

Captured from the pre-phase architecture brainstorm (2026-06-26), grounded in the
real AGE workspace shape pulled via the Linear MCP.

## Approved design

### Schema = single source of truth
- One Zod schema `src/lib/roadmap/schema.ts` matching `docs/architecture.md`:
  `{ generatedAt, initiatives: [{id,name,color,status}], projects: [{id,name,summary,initiativeId,status,priority,startDate,targetDate,milestones:[{id,name,targetDate}],issueCounts:{backlog,started,done}}] }`.
- Types via `z.infer`. Imported by BOTH the sync script (validate before write) and
  the app loader (validate on load). (Rejected: hand-written types + separate validation → drift.)

### Linear client = thin typed fetch client
- `scripts/linear/client.ts`: `fetch` to `https://api.linear.app/graphql` with explicit
  GraphQL query strings + typed response interfaces. Token from `process.env.LINEAR_API_KEY`
  (throws if unset). (Rejected: `@linear/sdk` — heavier dep, less control over the projection.)

### Sanitization = secure by construction (TDD, /cso-audited)
- `buildSnapshot(rawLinearData) → RoadmapJson` is a PURE function: allow-list projection
  (copy only schema fields) → `assertNoLeak(serialized)` scans for token shapes
  (`/lin_api_[A-Za-z0-9]+/`, any `LINEAR_API_KEY` value present in env) and email addresses
  (`/[\w.+-]+@[\w-]+\.[\w.-]+/`), THROWS on match → `RoadmapJsonSchema.parse()`.
  (Rejected: deny-list scrub → new fields leak by default.)
- TDD: write the failing test first — a malicious fixture with a planted `lin_api_…`
  token and an email MUST make `buildSnapshot` throw; a clean fixture MUST pass + validate.

### App load = data-router loader + same-origin fetch
- A React Router 7 route `loader` does `fetch('/roadmap.json')` then `RoadmapJsonSchema.parse()`.
  Same-origin static asset = zero EXTERNAL/Linear calls (the "zero network calls" intent);
  snapshot updates deploy without an app rebuild. (Rejected: `import` bundling — couples
  every snapshot refresh to a rebuild.) Overview/Timeline read via `useLoaderData()`.

### CI = scheduled GitHub Action
- `.github/workflows/snapshot.yml`: `workflow_dispatch` + `schedule` (cron). Runs
  `pnpm sync:snapshot` with `LINEAR_API_KEY` from repo secrets; commits the refreshed
  `public/roadmap.json`. The token NEVER appears locally or in the artifact.

## issueCounts state-type → bucket mapping (Linear state types)
- `backlog`  = state.type ∈ { triage, backlog, unstarted }
- `started`  = state.type == started
- `done`     = state.type == completed
- canceled   = excluded from all buckets

## Snapshot seeding methodology (this session)
- No `LINEAR_API_KEY` locally → the committed `public/roadmap.json` is seeded from REAL
  AGE workspace data fetched via the Linear MCP and shaped through the SAME `buildSnapshot`
  transform, so the artifact is shape-identical to the CI script output.
- The live `pnpm sync:snapshot` token path is exercised in CI (user decision).

## Real workspace (reference — initiative → projects)
- **agenticapps-workflow** (this app's home): "AgenticApps Roadmap" (High, 2026-06-22→2026-08-17, Backlog), "Dashboard: Codex host integration" (Medium, Backlog)
- **Callbot**: 10 projects (Operations/Runbook, Pilot #1/#2, Sales Ops, Compliance, Branche Hausarzt/Non-Healthcare, Admin UI MVP, Backend MVP, Infrastructure)
- **Factiv**: (no projects), **cPARX**: cPARX Prototype, **fx-signals**: Web App V1/V2, Website
- Team: AgenticApps (key AGE). Initiative `color` may be null → schema `color` is nullable.

## Out of scope this phase
- Live-mode `/api/linear/*` Pages Functions (later phase). Write-back / GSD sync (later).
