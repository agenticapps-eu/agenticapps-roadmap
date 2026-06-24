# Phase 1 — CONTEXT: Project & tooling scaffold

Captured from the pre-phase brainstorm (2026-06-24). PLAN.md locks the stack;
this records the one open structural decision and the framing for the stubs.

## Locked by PLAN.md / architecture.md
- pnpm + Vite + React 19 + TypeScript (strict), React Router 7 **data-router mode**.
- Tailwind v4 + shadcn/ui, dark mode, base theme tokens.
- ESLint + Prettier + typecheck; scripts: `dev`, `build`, `lint`, `typecheck`.
- Cloudflare Pages wiring: `wrangler.toml`/Pages preset, `functions/` placeholder, SPA fallback.
- Two views: `/` (Overview) and `/timeline` (Timeline) — stubs only this phase.
- App renders from `public/roadmap.json` (no network); live mode is a later enhancement.

## Decision — app-shell navigation pattern
**Top header + nav** (chosen by user over left-sidebar).
- Sticky top header: app title, inline nav links (Overview / Timeline), and a
  right-side slot reserved for the future Connect / live-mode toggle.
- Content fills the width below the header.
- Rationale: a 2-view private dashboard does not justify sidebar chrome; matches
  shadcn defaults and keeps the scaffold minimal (Simplicity First).

## Routing structure
- Single root layout route renders the header + `<Outlet/>`.
- Two child routes: index (`/` → Overview stub) and `/timeline` (Timeline stub).
- Stubs render placeholder content + a heading only — no data wiring this phase.

## Out of scope this phase
- Any real `roadmap.json` rendering, Linear data, or Pages Function logic.
- Visual design of Overview/Timeline (lands in later phases).
