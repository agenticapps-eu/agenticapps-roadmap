# Phase 05: Overview dashboard, filters & drill-down - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 9 (7 new, 2 modified)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/overview/selectors.ts` (new) | utility (pure) | transform | `src/lib/timeline/dateUtils.ts` + `colorUtils.ts` | exact |
| `src/lib/overview/selectors.test.ts` (new) | test | transform | `src/lib/timeline/colorUtils.test.ts` + `dateUtils.test.ts` | exact |
| `src/components/overview/KpiCards.tsx` (new) | component | request-response (props) | `src/components/timeline/ProjectPopoverContent.tsx` | role-match |
| `src/components/overview/HealthStrip.tsx` (new) | component | props | `src/components/timeline/InitiativeLane.tsx` + `ProjectPopoverContent.tsx` | role-match |
| `src/components/overview/FilterBar.tsx` (new) | component | event-driven (URL) | `src/components/AppHeader.tsx` (`useSearchParams`) | role-match |
| `src/components/overview/ProjectDrillDownDialog.tsx` (new) | component | event-driven (URL) | `src/components/timeline/ProjectPopoverContent.tsx` + `src/components/ui/popover.tsx` | role-match |
| `src/components/overview/SyncBadge.tsx` (new) | component | props | `src/components/ui/badge.tsx` (consumer in `ProjectPopoverContent.tsx`) | role-match |
| `src/components/ui/dialog.tsx` (new, scaffold) | ui-primitive | — | `src/components/ui/popover.tsx` / `hover-card.tsx` (+ plan `04-03`) | exact |
| `src/pages/OverviewPage.tsx` (replace) | page | request-response (loader) | `src/pages/TimelinePage.tsx` | exact |
| `src/lib/roadmap/schema.ts` (modify) | model | — | existing `url: z.string().nullish()` in same file | exact |

## Pattern Assignments

### `src/lib/overview/selectors.ts` (pure utility, transform)

**Analog:** `src/lib/timeline/dateUtils.ts`, `src/lib/timeline/colorUtils.ts`

This is the testable core (D-05-06): KPI distributions, health rollups, filter application, and URL-filter encode/decode. It must be pure and free of React/DOM imports so it unit-tests without a render harness.

**Conventions to copy:**
- **File header comment** stating purpose + "No external deps" (colorUtils.ts:1) or "No external date library" (dateUtils.ts:1-3). State the invariants (e.g. scheduled = has `targetDate`, per Phase-4 D-06).
- **Named `export function` per selector** — no default export, no class. Each function has a doc comment citing the decision it implements, e.g. `// D-05-01 ...` (mirrors dateUtils.ts's `(D-01, D-02)` citations).
- **Explicit exported interfaces/types for return shapes** (dateUtils.ts:5-9 `TimelineWindow`). Give KPI/health/filter results named types.
- **Structural (duck-typed) params, not schema imports where practical** — `resolveInitiativeColor` takes `{ id: string; color: string | null }` rather than importing `Initiative` (colorUtils.ts:16-19). This keeps selectors decoupled and trivially testable. For richer selectors, importing `type { RoadmapJson, Project, Initiative }` from `@/lib/roadmap/schema` is fine (see how TimelinePage consumes them).
- **Deterministic / stable ordering** — colorUtils.ts sorts lexicographically "stable across renders" (colorUtils.ts:21-24). Filter/sort selectors must be deterministic for reload-stability (OV-02 crux).
- **URL encode/decode as a pure round-trip pair** — do NOT touch `useSearchParams` here. Take/return plain `URLSearchParams` or a `string`→typed-filters object and back, so the round-trip is unit-testable (Risk Summary: "cover the encode/decode round-trip with unit tests"). The component layer owns `useSearchParams`; this module owns the parsing.

**Import style:** path alias `@/...`, `import type { ... }` for type-only imports (see loader.ts:2, TimelinePage.tsx:2).

---

### `src/lib/overview/selectors.test.ts` (test, transform)

**Analog:** `src/lib/timeline/colorUtils.test.ts` (whole file), `src/lib/timeline/dateUtils.test.ts:1-13`

**Conventions to copy:**
```typescript
import { describe, it, expect } from "vitest";
import { applyFilters, kpiDistributions, encodeFilters, decodeFilters } from "./selectors";
```
- **`describe` per exported function**, `it` per behavior, plain-English `it` strings (colorUtils.test.ts:4,35).
- **Inline literal fixtures** at top of each `describe` (colorUtils.test.ts:5-9) or a shared reference constant (dateUtils.test.ts:12-13 `JULY_2026`/`WINDOW`). Build minimal `RoadmapJson`-shaped fixtures by hand — do NOT fetch `roadmap.json`.
- **Pin non-determinism** — dateUtils tests pass a fixed `new Date(2026, 6, 1)` rather than real `now`. Any date-range filter selector must accept an injectable `now` and tests pass a fixed date.
- **Assert the round-trip explicitly** for encode/decode: `expect(decode(encode(f))).toEqual(f)`.
- **GOTCHA — run tests with `CI=true npx vitest run`** (or `pnpm test` which maps to `vitest run`). Do NOT run bare `vitest` / `vitest watch`: it aborts in the non-TTY executor environment. Vitest config (`vitest.config.ts`) uses `environment: "node"` and globs `src/**/*.test.ts`.
- **No React-render tests.** There is no jsdom/RTL harness (`environment: "node"`). Keep every assertion at the pure-function level; component visual fidelity is human-UAT (Phase-4 Path B, D-05-06).

---

### `src/pages/OverviewPage.tsx` (page, request-response) — REPLACE

**Analog:** `src/pages/TimelinePage.tsx` (whole file)

The current `OverviewPage.tsx` is the placeholder to replace. Copy TimelinePage's loader-wiring skeleton exactly:

**Loader-data wiring (TimelinePage.tsx:1-2, 13-26):**
```typescript
import { useRouteLoaderData } from "react-router-dom";
import type { RoadmapLoaderData } from "@/lib/roadmap/loader";

export function OverviewPage() {
  const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;
  // null = defensive out-of-band (loader throws on real failure → RoadmapError renders)
  if (!loaderData) {
    return (
      <p className="mt-8 text-sm text-(--color-muted-foreground)">
        Could not load roadmap data. Switch to Snapshot mode above.
      </p>
    );
  }
  const { data } = loaderData;
  // ...
}
```
- **Empty state** — copy TimelinePage.tsx:28-38 (centered emoji + "No projects found" + muted hint). Reuse for the zero-projects / zero-after-filter case.
- **Loading + hard-error are NOT this file's job** — they are the root route's `HydrateFallback: RoadmapLoading` and `errorElement: <RoadmapError />` (router.tsx:14-15). Reuse `RoadmapBoundaries` (D-05-06) via the router, not inline. Do not add a new route (D-05-04/05).
- **Named export `function OverviewPage()`** (no default) — router.tsx:3 imports it by name.
- **Derive-then-render** — TimelinePage computes `lanes` (a sorted/mapped array) before JSX (TimelinePage.tsx:45-65). Overview should call the pure selectors from `@/lib/overview/selectors` here, then pass results as props to the presentational components. Read filters via `useSearchParams` here (or in FilterBar), decode with the pure selector, apply, then render.
- **Root wrapper** — a `<section aria-label="Overview">` with an `<h1>` heading (TimelinePage.tsx:68-69). Tailwind v4 tokens: `text-(--color-muted-foreground)`, `border-(--color-border)`, `divide-(--color-border)`.

---

### `src/components/overview/KpiCards.tsx` + `HealthStrip.tsx` (components, props)

**Analog:** `src/components/timeline/ProjectPopoverContent.tsx`, `src/components/timeline/InitiativeLane.tsx`

**Conventions to copy from ProjectPopoverContent.tsx:**
- **Inline-typed destructured props object** (ProjectPopoverContent.tsx:15-21):
  ```typescript
  export function KpiCards({ data }: { data: RoadmapJson }) { ... }
  ```
  Prefer passing already-computed selector results as props (keep components dumb) over recomputing inside.
- **Module-level label maps** for enum-ish values (ProjectPopoverContent.tsx:4-13 `PRIORITY_LABELS` + `priorityLabel()`). Reuse the same priority label map for the by-priority KPI and drill-down.
- **Stacked-bar distribution pattern** (ProjectPopoverContent.tsx:45-64) — the `flex h-2 rounded-full` segmented bar with `style={{ width: \`${(n/total)*100}%\` }}` is the exact pattern for KPI by-status/by-priority and the health-strip backlog/started/done rollup. Copy the `total === 0` guard.
- **Initiative color chips** — call `resolveInitiativeColor(initiative, data.initiatives)` (colorUtils.ts:16) and apply via inline `style={{ color }}` (ProjectPopoverContent.tsx:75) — D-05-01 explicitly reuses this. TimelinePage.tsx:53 shows the call site.
- **Tailwind v4 token syntax** — `bg-(--color-muted)`, `text-(--color-muted-foreground)`, `border-(--color-border)` (arbitrary-property CSS-var form). Fixed accent colors use plain utilities (`bg-sky-500`, `bg-emerald-500`, ProjectPopoverContent.tsx:56-60). Do NOT use `bg-[var(--color-*)]` — match the `bg-(--color-*)` form used throughout.
- **HealthStrip** = one row per initiative — mirror TimelinePage.tsx:45-65 lane build (map initiatives → filter projects by `initiativeId` → derive counts → sort scheduled-count desc, name asc) and `InitiativeLane`'s row layout.

---

### `src/components/overview/FilterBar.tsx` (component, event-driven / URL)

**Analog:** `src/components/AppHeader.tsx` (the only `useSearchParams` consumer)

**URL-searchParams pattern to copy (AppHeader.tsx:1,5,15-29):**
```typescript
import { useSearchParams } from "react-router-dom";

const [params, setParams] = useSearchParams();
// read: params.get("status") / params.getAll("initiative")
function handleChange() {
  setParams((prev) => {
    prev.set("status", value);   // or prev.delete(key) to clear → clean default URL
    return prev;
  });
}
```
- **Functional `setParams(prev => ...)` mutation** (AppHeader.tsx:18-28) — mutate `prev` and return it; this preserves coexisting params, which is REQUIRED so filter params and `?project=<id>` (D-05-04) survive together in one URL.
- **Delete-to-default** — AppHeader removes the param entirely when toggling to default ("clean default URL (not ?source=snapshot)", AppHeader.tsx:16-21). Apply: an empty/all filter should `delete` its key, not encode a redundant value.
- **Delegate encode/decode to the pure selector** — FilterBar reads raw params, but parsing/serialization lives in `selectors.ts` so it's unit-tested. Multi-select initiative uses `params.getAll(...)` / repeated `append`.
- **`live` toggle is Phase 7** — this route reads `?source` only implicitly via the loader; do not add a live control here.

---

### `src/components/overview/ProjectDrillDownDialog.tsx` (component, event-driven / URL)

**Analogs:** `src/components/ui/dialog.tsx` (scaffolded below) for the shell; `src/components/timeline/ProjectPopoverContent.tsx` for the body.

- **Open state driven by `?project=<id>`** (D-05-04) — read `params.get("project")`, resolve the project from `data.projects`; **unknown/absent id renders nothing** (guarded — mirror the `if (!loaderData) return null` defensiveness and ProjectPopoverContent's conditional sections). Close = `setParams(prev => { prev.delete("project"); return prev; })`.
- **Body content = reuse ProjectPopoverContent's structure** (D-05-03): issue-counts breakdown (ProjectPopoverContent.tsx:42-68), milestones list (71-82), and the **guarded Linear deep-link** (94-105):
  ```typescript
  {project.url?.startsWith("https://linear.app/") && (
    <a href={project.url} target="_blank" rel="noopener noreferrer" ...>Open in Linear ↗</a>
  )}
  ```
  Copy the `url?.startsWith("https://linear.app/")` guard verbatim (Phase-4 04-04 pattern, D-05-03). Does NOT list individual issues.
- **Dialog primitive usage** — follow popover.tsx's compound-component shape (`Dialog`/`DialogTrigger`/`DialogContent`), but this dialog is URL-controlled: pass `open` + `onOpenChange` to the base-ui Root rather than using a `Trigger`.

---

### `src/components/overview/SyncBadge.tsx` (component, props) — OV-04

**Analog:** `src/components/ui/badge.tsx` (consumer pattern: ProjectPopoverContent.tsx:31-32)

- **Render only when truthy** (D-05-02) — exact graceful-nullish pattern as the Linear-link guard: `{project.planAhead && <Badge variant="destructive">Out of sync with plan</Badge>}`. Absent/false → renders nothing, never errors (Risk Summary: "degrade to invisible, not error").
- **Reuse the existing `Badge`** from `@/components/ui/badge` with a `variant` (destructive/outline) — do not build a new chip. `Badge` is base-ui-backed (`useRender`/`mergeProps`), CVA variants at badge.tsx:11-22.

---

### `src/components/ui/dialog.tsx` (ui-primitive, scaffold)

**Analog:** `src/components/ui/popover.tsx`, `src/components/ui/hover-card.tsx`; process analog: plan `.planning/phases/04/04-03-PLAN.md`

**Scaffold — do NOT hand-write (04-03-PLAN.md:74-95):**
```bash
npx shadcn add dialog
```
- **Style is `base-nova`** (`components.json` `"style": "base-nova"`) → sourced from **`@base-ui/react`, NOT `@radix-ui`**. `@base-ui/react` is already installed (v1.6.0) → **zero new npm deps** expected.
- **Post-scaffold verification (copy 04-03 acceptance):**
  - `grep -rl "@radix-ui" src/components/ui/dialog.tsx` returns nothing.
  - `grep -l "@base-ui/react" src/components/ui/dialog.tsx` lists it (expect `@base-ui/react/dialog`, matching popover.tsx:4's `@base-ui/react/popover`).
  - `grep -c "@radix-ui" package.json` returns 0.
  - `pnpm typecheck` passes.
- **If the registry fetch fails** (network/write-restricted executor): FLAG in the SUMMARY as manual-intervention-required with the exact CLI error + re-run command — do NOT hand-fabricate the file or silently pass (04-03-PLAN.md:84-92).
- **Expected shape** — compound `Dialog`/`DialogTrigger`/`DialogPortal`/`DialogContent` with `data-slot` attrs, `cn(...)` for class merge, base-ui `Positioner`/`Portal` wrapping (mirrors popover.tsx:8-48). Aligns with existing `button.tsx`/`popover.tsx` style.

---

### `src/lib/roadmap/schema.ts` (model, modify) — add `planAhead`

**Analog:** the existing `url: z.string().nullish()` field **in the same file** (schema.ts:19)

- **Add one field to `ProjectSchema`** (D-05-02), nullish so the current flagless snapshot stays valid:
  ```typescript
  planAhead: z.boolean().nullish(),   // OV-04 — populated by Phase 6 walker; absent/false until then
  ```
- **`.nullish()` is the established graceful-optional idiom** here (schema.ts:19 `url`) — accepts `undefined` AND `null`, keeps old `public/roadmap.json` valid without a re-sync (Phase-4 D-13 precedent).
- **Types auto-derive** — `type Project = z.infer<typeof ProjectSchema>` (schema.ts:44) picks it up; no manual type edit.
- **Surgical:** add only this line to `ProjectSchema`. Do NOT touch `IssueCountsSchema` (no per-issue growth, D-05-03) or other schemas.

## Shared Patterns

### Loader data access
**Source:** `src/pages/TimelinePage.tsx:14`, `src/components/AppHeader.tsx:12-13`
**Apply to:** OverviewPage (and any component needing snapshot data)
```typescript
const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;
const { data } = loaderData ?? {}; // read defensively — null during hydration
```
Prefer threading `data` down as props to leaf components rather than each calling the hook.

### URL searchParams (filters + drill-down coexist)
**Source:** `src/components/AppHeader.tsx:5,15-29`
**Apply to:** FilterBar, ProjectDrillDownDialog
Use `setParams(prev => { prev.set/delete(...); return prev; })` — never construct a fresh `URLSearchParams`, or you drop the other feature's params.

### Tailwind v4 token syntax
**Source:** every component (`ProjectPopoverContent.tsx`, `TimelinePage.tsx`, `AppHeader.tsx`)
**Apply to:** all new components
`bg-(--color-*)`, `text-(--color-*)`, `border-(--color-*)`, `divide-(--color-*)` — the arbitrary-property CSS-var form. Fixed accents use plain utilities. Dark mode is handled by the tokens (D-05-06 "dark mode required").

### Graceful-nullish guard (invisible-not-error)
**Source:** `src/components/timeline/ProjectPopoverContent.tsx:94` (`url`), `src/lib/roadmap/schema.ts:19`
**Apply to:** SyncBadge (`planAhead`), the guarded Linear link in the drill-down, unknown `?project` id
`{value && <X/>}` — render only when truthy; absent → nothing.

### Pure-selector + thin-component split (test strategy)
**Source:** `src/lib/timeline/*` (tested) vs `src/components/timeline/*` (human-UAT)
**Apply to:** all of Phase 05 (D-05-06)
All logic (aggregation, filter application, URL encode/decode) → `src/lib/overview/selectors.ts` with vitest node tests. Components stay presentational. Run tests via `CI=true npx vitest run` — bare `vitest` aborts in non-TTY; no React-render harness exists.

## No Analog Found

None. Every planned file maps to an existing analog in the codebase.

## Metadata

**Analog search scope:** `src/lib/`, `src/components/`, `src/pages/`, `src/router.tsx`, `.planning/phases/04/`, `components.json`, `package.json`, `vitest.config.ts`
**Files scanned:** ~18 source files + config + plan `04-03`
**Pattern extraction date:** 2026-07-14
