# Claude Code prompts — agenticapps-roadmap

Copy-paste these into Claude Code (run from `~/Sourcecode/agenticapps/agenticapps-roadmap`),
one phase at a time. Each phase maps to a milestone in the Linear project
**AgenticApps Roadmap**. Commit and let gates pass before moving on.

> Tip: start each session with `Read CLAUDE.md and docs/architecture.md, then read
> .planning/phases/NN/PLAN.md` so Claude has the constraints in context.

---

## 0 · Bootstrap

```
Read CLAUDE.md, docs/architecture.md, and every file under .planning/phases/.
Summarize the eight-phase plan back to me in 5 bullets and list the exact tools,
versions, and Cloudflare bindings we'll need before Phase 1. Do not write code yet.
```

## Phase 1 · Scaffold

```
Implement .planning/phases/01/PLAN.md. Initialize pnpm + Vite + React 19 + TypeScript
(strict) + React Router 7 (data router) + Tailwind v4 + shadcn/ui. Add ESLint, Prettier,
and pnpm scripts dev/build/lint/typecheck. Add Cloudflare Pages config with a functions/
placeholder and SPA fallback, plus route stubs for "/" (overview) and "/timeline".
Run lint + typecheck + build and make them pass. Then stop and show me the tree.
```

## Phase 2 · Linear data layer & snapshot

```
Implement .planning/phases/02/PLAN.md. Build a typed Linear GraphQL client and
scripts/sync-snapshot.ts that writes public/roadmap.json in the shape from
docs/architecture.md. Add a Zod schema + a typed loader hook so the app renders
purely from roadmap.json. Read LINEAR_API_KEY from env (never commit it) and add a
GitHub Action snapshot.yml (schedule + manual). Prove it: run `pnpm sync:snapshot`
against the AGE workspace and confirm the app renders with no network calls.
Assert no token or secret leaks into roadmap.json.
```

## Phase 3 · Functions proxy + Access

```
Implement .planning/phases/03/PLAN.md. Add functions/api/linear/[[path]].ts that
proxies Linear GraphQL using the LINEAR_API_KEY Functions binding, with an
operation allow-list and no token echo. Add a client Connect toggle (snapshot vs
live) that falls back to snapshot if Functions are unavailable. Write
docs/access-setup.md describing the Cloudflare Access email allow-list over the
Pages project and /api/*. Verify no secret appears in the bundle or network logs.
```

## Phase 4 · Timeline UI

```
Implement .planning/phases/04/PLAN.md. Build the initiative-swimlane timeline:
month axis, scheduled projects as bars, undated projects as dashed needs-backfill
pills, milestone markers, color-by-initiative, dark mode, and empty/loading/error
states. Match the approved concept. Then run the design-critique gate to a 90 bar
and show me a preview before committing.
```

## Phase 5 · Dashboard, filters, drill-down

```
Implement .planning/phases/05/PLAN.md. Add the overview route with KPI cards and a
per-initiative health strip. Add URL-encoded filters (initiative, time range,
status, priority) that compose and survive reload, and project drill-down with
deep links to Linear. Add the "out of sync with plan" badge. Verify filter state
round-trips through the URL.
```

## Phase 6 · sync-gsd-linear (backfill)

```
Implement .planning/phases/06/PLAN.md. Build the sync-gsd-linear CLI: a .planning/
walker + PLAN.md parser, a Linear resolver (linear-map.json, then roadmap:<repo>
label, then title-hash), a per-project diff report, and a date proposer from phase
order. Default to --dry-run; --project <name> applies after an explicit approval
prompt. Upserts must be idempotent (apply twice → second run is a no-op) and write
ids back to .planning/linear-map.json. Test the dry-run against claude-workflow,
cparx, and fx-signal-agent. Do NOT write to Linear without my per-project yes.
```

## Phase 7 · Live refresh & write-back

```
Implement .planning/phases/07/PLAN.md. Add live "Refresh from Linear" via Functions
and a write-back surface that runs a one-project backfill from the UI behind Access,
with optimistic UI + rollback. Add a scheduled snapshot refresh. Confirm a backfill
applied from the UI shows up in Linear and in the next snapshot.
```

## Phase 8 · Deploy & document

```
Implement .planning/phases/08/PLAN.md. Connect the repo to Cloudflare Pages with
prod + preview builds and the LINEAR_API_KEY binding, apply the Cloudflare Access
allow-list, and verify gating end-to-end. Write docs/runbook.md (deploy, rotate
token, refresh snapshot, run backfill), optionally publish a GitHub Pages mirror of
the snapshot, tag v0.1.0, and record an ADR for the hosting/sync decision.
```

---

## Running the backfill afterward (per-project)

```
Run `pnpm sync:gsd -- --dry-run` and show me the diff for every repo. Then, for the
project I name, run `pnpm sync:gsd -- --project "<name>"`, show the proposed dates,
and apply only after I confirm. Never touch a project I didn't name.
```
