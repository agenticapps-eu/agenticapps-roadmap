# Phase 1 — PLAN: Project & tooling scaffold

Stand up the app skeleton and Cloudflare Pages wiring.

## Tasks
1. Init pnpm + Vite + React 19 + TypeScript (strict). React Router 7 in data-router mode.
2. Tailwind v4 + shadcn/ui; base theme tokens; dark mode.
3. ESLint + Prettier + typecheck script; `pnpm` scripts (`dev`, `build`, `lint`, `typecheck`).
4. Cloudflare Pages config (`wrangler.toml`/Pages preset), `functions/` dir placeholder, SPA fallback.
5. App shell: header, route stubs for `/` (overview) and `/timeline`.

## Done when
- `pnpm dev` serves the shell; `pnpm build` produces a deployable `dist/`.
- Lint + typecheck pass clean.

## Gates
- verification (build + lint + typecheck green).
