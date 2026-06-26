# Phase 1 — REVIEW: Project & tooling scaffold

Two-stage review per the AgenticApps workflow. Branch `phase-01-scaffold` vs `main`.

## Stage 1 — Spec compliance (orchestrator)

Maps the diff to `PLAN.md` tasks + "Done when" and the `CONTEXT.md` design contract.

| PLAN task | Status | Note |
|---|---|---|
| 1. pnpm + Vite + React 19 + TS strict + Router 7 data-router | ✅ | react 19.2.7, vite 8.1.0, react-router-dom 7.18.0; `createBrowserRouter`; `strict: true`. |
| 2. Tailwind v4 + shadcn/ui, theme tokens, dark mode | ✅ | `@tailwindcss/vite` plugin (v4 style, not v3 PostCSS); shadcn base-nova; `button` component proves wiring. |
| 3. ESLint + Prettier + typecheck + scripts | ✅ | Flat ESLint config + Prettier; scripts `dev`/`build`/`lint`/`typecheck` present. |
| 4. Cloudflare Pages config + functions/ placeholder + SPA fallback | ✅ | `wrangler.toml` (`pages_build_output_dir`), `public/_redirects`, `functions/.gitkeep`. |
| 5. App shell: header + `/` and `/timeline` route stubs | ✅ | Top-header shell (per CONTEXT.md), root layout + 2 child stubs, reserved Connect slot. |

**"Done when":** build → deployable `dist/` ✅; lint clean (1 accepted shadcn warning) ✅; typecheck clean ✅; `pnpm dev` serves shell ✅ (QA screenshots, zero console errors).

**Design contract (CONTEXT.md):** honored — top header + nav (not sidebar), data-router, reserved live-mode slot, stubs with no data wiring.

**Stage 1 verdict: PASS** — scope matches the plan exactly; no spec drift; no scope creep.

## Stage 2 — Independent code quality

Independent reviewer (`pr-review-toolkit:code-reviewer`, separate context) on the
full branch diff. No Critical. All CI gates confirmed green; no secrets committed;
`@/*` alias consistent; Tailwind v4 wired via Vite plugin; router correct.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 85 | High | `@vitejs/plugin-react` peer range excludes Vite 8 (unmet-peer + runtime warnings, latent lockfile risk) | **FIXED** — pinned `vite` to `^7` (7.3.6), the supported range. Warnings gone, dev boots clean. Decision confirmed with user. |
| 82 | High | `shadcn` (CLI) + `tw-animate-css` (build-time CSS) in `dependencies` | **FIXED** — moved both to `devDependencies`; `--prod` install confirms they're pruned from the production tree. |
| 78 | Med | Dead `/vite.svg` favicon reference 404s | **FIXED** — removed the `<link rel="icon">` from `index.html`. |
| 72 | Med | Two dark-mode CSS systems (`.dark` class vs `prefers-color-scheme`) never synchronise; `dark:` utilities have no activation path | **DEFERRED** — no dark-mode toggle exists yet (out of Phase 01 scope). Follow-up: wire a theme toggle / `color-scheme` and drop the redundant `@layer base @media` block when dark mode is implemented. |
| — | Nit | Root route has no `errorElement` | **DEFERRED** to the phase that wires loaders/actions (none this phase). |
| — | Nit | `tsconfig.{app,node}.json` lack `composite: true` | **ACCEPTED** — standard Vite scaffold convention; `tsc -b --noEmit` relaxes it; only matters if the project ever emits declarations. |
| — | Nit | `@apply border-border`/`bg-background` double-assign same token | **ACCEPTED** — shadcn-generated, harmless. |

**Stage 2 verdict: PASS** — all High findings fixed and re-verified; Mediums/Nits dispositioned (one deferred with a tracked follow-up, rest accepted). Fixes committed in `8fd3b3a`.

## Follow-ups for later phases
- Dark mode: implement a theme toggle / `color-scheme` wiring; remove the redundant `@layer base @media` dark block (finding 72).
- Add a root `errorElement` once data-router loaders/actions are introduced.
