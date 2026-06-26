# Phase 2 — VERIFICATION: Linear data layer & static snapshot

Verified 2026-06-26 on branch `phase-02-linear-snapshot` by the orchestrator
(independent re-run + browser QA, not trusting subagent self-reports).

## Goal
Read Linear into a sanitized, token-free `roadmap.json` the app renders from.

## "Done when" — 1:1 evidence

- **App renders the snapshot with zero network calls.**
  - **Evidence:** dev server QA via gstack `/browse` — `/` renders "5 initiatives, 16 projects" + the real project list; `/timeline` renders projects sorted by targetDate (2026-05-08 cPARX, 2026-08-17 AgenticApps Roadmap) + "no target date" group. Network panel: the only data request is same-origin `GET /roadmap.json` — **zero external/Linear calls**. Fresh console (post-clear): zero errors, zero warnings. Screenshots `/tmp/p02-overview-fixed.png`, `/tmp/p02-timeline-fixed.png`.

- **`pnpm sync:snapshot` produces a valid roadmap.json from the live AGE workspace.**
  - **Evidence (partial-by-design, user decision):** the token-based script (`scripts/sync-snapshot.ts` + `scripts/linear/client.ts`) is built and wired to CI (`snapshot.yml`, secret-driven). The committed `public/roadmap.json` is **real AGE data** (5 initiatives, 16 projects, 21 milestones, ~260 issues bucketed) seeded via the Linear MCP through the same production `buildSnapshot` transform, so it is byte-shape-identical to CI output. The live token run executes in CI once `LINEAR_API_KEY` is set as a repo secret. `generatedAt: 2026-06-26T17:23:47.189Z`.

## Quality gates (independently re-run)
- **`pnpm test`** → 13/13 pass (sanitization + schema; TDD RED `7372f45` → GREEN `f8d27bf` confirmed).
- **`pnpm typecheck`** → exit 0, zero errors, no `any`.
- **`pnpm lint`** → 0 errors, 1 warning (the known Phase 01 shadcn `button.tsx` re-export).
- **`pnpm build`** → `dist/` produced clean.

## Security (SECURITY.md)
- **Evidence:** CSO audit 16/16 closed. `public/roadmap.json` grep: **no `lin_api_`, no `LINEAR_API_KEY`, no email patterns**. Token confined to `scripts/` (never imported by `src/`, never in the client bundle, never committed). F1 (regex underscore) fixed `569d812`; F2 (first names in summaries, private repo) accepted.

## Guardrails (CLAUDE.md)
- **Evidence:** TypeScript everywhere, no `any`; token server-side only; snapshot is the default data path and renders with no external network; no token in `roadmap.json` or bundle.

## Verdict
**PASS** — goal achieved: the app renders a real, sanitized, token-free snapshot with zero
external network. The only deferred item (live token-based `sync:snapshot` run) is a
deliberate CI-bound step pending the `LINEAR_API_KEY` secret, not a gap in the code.
