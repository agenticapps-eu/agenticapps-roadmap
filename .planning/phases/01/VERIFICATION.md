# Phase 1 — VERIFICATION: Project & tooling scaffold

Verified 2026-06-24 on branch `phase-01-scaffold` by the orchestrator
(independent re-run, not trusting the executor's self-report).

## Goal
Stand up the app skeleton and Cloudflare Pages wiring so `pnpm dev` serves the
shell and `pnpm build` produces a deployable `dist/`, lint + typecheck clean.

## "Done when" — 1:1 evidence

- **`pnpm dev` serves the shell.**
  - **Evidence:** dev server booted on `http://localhost:5173`, HTTP 200, `<title>AgenticApps Roadmap</title>`. Browser QA (gstack `/browse`) screenshot of `/` (Overview) and `/timeline` (Timeline): sticky top header with title + Overview/Timeline nav + reserved disabled "Connect to Linear (coming soon)" slot; client-side routing swaps active nav state; each route renders its stub heading + placeholder line. **Zero console errors on both routes.** Screenshots: `/tmp/phase01-overview.png`, `/tmp/phase01-timeline.png`.

- **`pnpm build` produces a deployable `dist/`.**
  - **Evidence:** `pnpm build` exit 0; `dist/` contains `index.html`, `assets/` (index JS 286.82 kB / gzip 91.31 kB, index CSS 26.41 kB / gzip 5.51 kB, Geist fonts), and `_redirects` (`/* /index.html 200` SPA fallback) — confirming the Pages deploy artifact is complete.

- **Lint passes clean.**
  - **Evidence:** `pnpm lint` → 0 errors, 1 warning (`src/components/ui/button.tsx` `react-refresh/only-export-components` for the shadcn `buttonVariants` re-export — a standard, accepted shadcn convention; not a defect).

- **Typecheck passes clean.**
  - **Evidence:** `pnpm typecheck` (`tsc -b --noEmit`) → exit 0, zero errors. `grep` for `any` across `src/` → none.

## Design-contract compliance (CONTEXT.md)
- **Evidence:** Shell is the approved **top header + nav** (not sidebar); Router 7 data-router (`createBrowserRouter`) with one root layout route (`RootLayout` + `<Outlet/>`) and two child routes (`/` index → Overview, `/timeline` → Timeline); reserved Connect/live-mode slot present and disabled; stubs carry no data wiring. Confirmed in screenshots + `git diff`.

## Guardrails (CLAUDE.md)
- **Evidence:** No `LINEAR_API_KEY`/token committed (diff grep clean); `functions/` is a `.gitkeep` placeholder only — no Pages Function logic this phase; protected files (`README.md`, `CLAUDE.md`, `docs/`, `templates/`, `.planning/`, `.claude/`, `session-handoff.md`) unmodified by the branch (`git diff --name-status main..HEAD`).

## Versions (from 01-SUMMARY.md, confirmed in lockfile)
react/react-dom 19.2.7 · react-router-dom 7.18.0 · vite 8.1.0 · @tailwindcss/vite 4.3.1 · typescript 5.8.3 · eslint 9.39.4 · prettier 3.8.4 · shadcn (base-nova).

## Verdict
**PASS** — all "Done when" criteria met with on-disk/observed evidence; design contract honored; guardrails intact.
