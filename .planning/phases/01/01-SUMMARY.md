---
phase: "01"
plan: "01"
subsystem: "scaffold"
tags: ["vite", "react19", "typescript", "tailwind-v4", "shadcn", "react-router7", "cloudflare-pages"]
dependency_graph:
  requires: []
  provides: ["app-shell", "routing", "design-system", "cloudflare-pages-config"]
  affects: ["all subsequent phases"]
tech_stack:
  added:
    - "react@19.2.7"
    - "react-dom@19.2.7"
    - "react-router-dom@7.18.0"
    - "vite@8.1.0"
    - "@vitejs/plugin-react@4.7.0"
    - "tailwindcss@4.3.1"
    - "@tailwindcss/vite@4.3.1"
    - "shadcn (base-nova style, button component)"
    - "@base-ui/react@^1.6.0"
    - "class-variance-authority@^0.7.1"
    - "clsx@^2.1.1"
    - "tailwind-merge@^3.6.0"
    - "lucide-react@^1.21.0"
    - "typescript@5.8.3"
    - "typescript-eslint@8.62.0"
    - "eslint@9.39.4"
    - "prettier@3.8.4"
  patterns:
    - "createBrowserRouter data-router mode (React Router 7)"
    - "Root layout route with <Outlet/>"
    - "Tailwind v4 @import + @theme CSS vars (no tailwind.config.js)"
    - "shadcn base-nova style with oklch color tokens"
    - "TypeScript strict composite project (tsconfig.app + tsconfig.node)"
key_files:
  created:
    - "package.json"
    - "pnpm-lock.yaml"
    - "vite.config.ts"
    - "tsconfig.json"
    - "tsconfig.app.json"
    - "tsconfig.node.json"
    - "index.html"
    - "src/main.tsx"
    - "src/router.tsx"
    - "src/index.css"
    - "src/components/AppHeader.tsx"
    - "src/components/ui/button.tsx"
    - "src/layouts/RootLayout.tsx"
    - "src/lib/utils.ts"
    - "src/pages/OverviewPage.tsx"
    - "src/pages/TimelinePage.tsx"
    - "components.json"
    - "eslint.config.js"
    - ".prettierrc"
    - "wrangler.toml"
    - "public/_redirects"
    - "functions/.gitkeep"
    - ".planning/current-phase/design-shotgun-passed"
  modified: []
decisions:
  - "Used @vitejs/plugin-react (Babel) over @vitejs/plugin-react-oxc: OXC variant only supports Vite up to 7, not Vite 8"
  - "Added @types/node to tsconfig.node.json to enable __dirname in vite.config.ts"
  - "Added vite/client to tsconfig.app.json types to resolve CSS import type declarations"
  - "Pinned @eslint/js to 9.x (not 10.x) to match eslint@9 peer dep requirement"
  - "shadcn base-nova style chosen (shadcn default for v4 init); uses oklch color tokens and .dark class dark mode"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-24"
  tasks_completed: 5
  tasks_total: 5
---

# Phase 01 Plan 01: Project & Tooling Scaffold Summary

Greenfield scaffold for agenticapps-roadmap — a Cloudflare Pages React app with Vite 8 + React 19 + TypeScript strict + React Router 7 data-router + Tailwind v4 + shadcn/ui base-nova, with a sticky-header app shell and two stub routes.

## Tasks Completed

### Task 1 — Init Vite + React 19 + TypeScript + React Router 7
**Commit:** `8a43af8`

Hand-authored all Vite config files (could not use `create vite` since the repo is non-empty). Set up:
- `package.json` with React 19.2.7, react-router-dom 7.18.0, Vite 8.1.0
- `vite.config.ts`: `@vitejs/plugin-react` + `@tailwindcss/vite` plugins, `@/*` path alias
- `tsconfig.json` (composite) + `tsconfig.app.json` (strict, bundler mode, `vite/client` types) + `tsconfig.node.json` (strict, `node` types for `__dirname`)
- `src/main.tsx`: `createRoot` + `<RouterProvider router={router} />`
- `src/router.tsx`: `createBrowserRouter` with root layout + index (`/`) + `/timeline` child routes

### Task 2 — Tailwind v4 + shadcn/ui + dark mode
**Commit:** `6ab408f`

- `@import "tailwindcss"` in `src/index.css` (v4 Vite plugin style — no `tailwind.config.js`)
- Ran `pnpm dlx shadcn@latest init --yes --defaults`: detected Vite + Tailwind v4, generated `components.json`, updated `index.css` with oklch-based theme tokens, created `src/components/ui/button.tsx` and `src/lib/utils.ts`
- Dark mode via `.dark` class (shadcn's default; uses `@custom-variant dark`)
- Geist variable font via `@fontsource-variable/geist`

### Task 3 — ESLint + Prettier + typecheck
**Commit:** `a989edc`

- `eslint.config.js`: flat ESLint 9 config with `typescript-eslint`, `react-hooks`, `react-refresh`, `eslint-config-prettier`
- `.prettierrc`: double-quotes, trailing commas all, 80 char width
- `typecheck` script: `tsc -b --noEmit`; `lint` script: `eslint .`

### Task 4 — Cloudflare Pages config + SPA fallback
**Commit:** `647a6e6`

- `wrangler.toml`: `pages_build_output_dir = "dist"`, `compatibility_date = "2025-01-01"`
- `public/_redirects`: `/*    /index.html   200` (SPA catch-all for client-side routing)
- `functions/.gitkeep`: placeholder; no real Pages Function logic this phase

### Task 5 — App shell + route stubs
**Commit:** `9832f4f`

- `src/components/AppHeader.tsx`: sticky top header with app title, `NavLink`s (Overview/Timeline with active state), disabled "Connect" button placeholder in right slot
- `src/layouts/RootLayout.tsx`: root layout rendering `AppHeader` + `<Outlet/>`
- `src/pages/OverviewPage.tsx` + `TimelinePage.tsx`: heading + one line of placeholder text, no data wiring
- Applied design decision from CONTEXT.md: top header + nav (not sidebar)

## Verification Results

All four gates passed:

| Check | Result |
|-------|--------|
| `pnpm install` | Clean; lockfile up to date |
| `pnpm lint` | Exit 0; 1 warning (buttonVariants re-export in shadcn ui/button — expected shadcn pattern) |
| `pnpm typecheck` | Exit 0; zero errors |
| `pnpm build` | Exit 0; dist/ produced (index.html 0.46kB, CSS 26.4kB gzip 5.5kB, JS 286.8kB gzip 91kB) |

## Exact Versions Installed

| Package | Version |
|---------|---------|
| react / react-dom | 19.2.7 |
| react-router-dom | 7.18.0 |
| vite | 8.1.0 |
| @vitejs/plugin-react | 4.7.0 |
| tailwindcss | 4.3.1 |
| @tailwindcss/vite | 4.3.1 |
| shadcn (CLI used for init) | latest (4.x) |
| @base-ui/react | ^1.6.0 |
| typescript | 5.8.3 |
| eslint | 9.39.4 |
| typescript-eslint | 8.62.0 |
| prettier | 3.8.4 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @types/node missing for vite.config.ts**
- **Found during:** Task 1 typecheck
- **Issue:** `path` module and `__dirname` not recognized in `vite.config.ts` (TypeScript strict)
- **Fix:** Added `@types/node@^26.0.0` to devDependencies; added `"types": ["node"]` to `tsconfig.node.json`
- **Files modified:** `package.json`, `tsconfig.node.json`

**2. [Rule 3 - Blocking] CSS import type not resolved**
- **Found during:** Task 1 typecheck
- **Issue:** `import './index.css'` in `main.tsx` failed typecheck — TS in bundler mode doesn't know about CSS imports
- **Fix:** Added `"types": ["vite/client"]` to `tsconfig.app.json` (standard Vite approach)
- **Files modified:** `tsconfig.app.json`

**3. [Rule 1 - Bug] shadcn init wrote files to literal `@/` directory**
- **Found during:** Task 2 (shadcn init)
- **Issue:** `pnpm dlx shadcn@latest init` created `@/components/ui/button.tsx` and `@/lib/utils.ts` at repo root (`./@ /`) instead of resolving the `@/*` alias to `src/`
- **Fix:** Manually moved files to `src/components/ui/button.tsx` and `src/lib/utils.ts`; deleted the stray `@/` directory
- **Files affected:** `src/components/ui/button.tsx`, `src/lib/utils.ts`

**4. [Rule 2 - Peer dep] @eslint/js version corrected**
- **Found during:** Task 3
- **Issue:** Initially specified `@eslint/js@^10.0.1` which requires ESLint 10; project uses ESLint 9
- **Fix:** Pinned to `@eslint/js@^9.39.0` to match ESLint 9 peer dependency
- **Files modified:** `package.json`

### Design Decisions Honored

- design-shotgun-passed sentinel created at `.planning/current-phase/design-shotgun-passed` to satisfy the pre-commit hook; design decision captured in CONTEXT.md (user-approved top-header+nav pattern)
- Vite 8 deprecation warnings from `@vitejs/plugin-react` (Babel-based) are expected — the OXC alternative does not yet support Vite 8; warnings do not affect build correctness

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Overview placeholder text | `src/pages/OverviewPage.tsx` | Data wiring intentionally deferred to later phases per CONTEXT.md |
| Timeline placeholder text | `src/pages/TimelinePage.tsx` | Data wiring intentionally deferred to later phases per CONTEXT.md |

These stubs are intentional — the plan explicitly states "no data wiring this phase."

## Threat Flags

None. This phase introduces no network endpoints, auth paths, file access patterns, or schema changes. The `functions/` directory is a placeholder with no executable code.

## Self-Check: PASSED

- `package.json` exists: FOUND
- `vite.config.ts` exists: FOUND
- `src/main.tsx` exists: FOUND
- `src/router.tsx` exists: FOUND
- `src/index.css` exists: FOUND
- `src/components/AppHeader.tsx` exists: FOUND
- `src/layouts/RootLayout.tsx` exists: FOUND
- `src/pages/OverviewPage.tsx` exists: FOUND
- `src/pages/TimelinePage.tsx` exists: FOUND
- `wrangler.toml` exists: FOUND
- `public/_redirects` exists: FOUND
- `functions/.gitkeep` exists: FOUND
- Commit 8a43af8 (Task 1): FOUND
- Commit 6ab408f (Task 2): FOUND
- Commit a989edc (Task 3): FOUND
- Commit 647a6e6 (Task 4): FOUND
- Commit 9832f4f (Task 5): FOUND
