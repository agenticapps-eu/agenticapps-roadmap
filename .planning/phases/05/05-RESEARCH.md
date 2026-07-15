# Phase 05: Overview dashboard, filters & drill-down - Research

**Researched:** 2026-07-14
**Domain:** React Router 7 URL-state filters, base-ui Dialog (base-nova), pure selector/aggregation layer, optional Zod schema growth
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-05-01 (OV-01):** KPI cards from root loader snapshot — initiatives count, projects count, scheduled-vs-undated (scheduled = has `targetDate`, Phase-4 D-06), by-priority, by-status. Plus a per-initiative health strip: one row per initiative (scheduled/undated split + rolled-up issueCounts backlog/started/done). All derived from `RoadmapJson`; no new fetch. Reuse `resolveInitiativeColor` for color chips.
- **D-05-02 (OV-04):** Build the "out of sync with plan" badge UI in Phase 5, driven by an **optional** per-project field (`planAhead?: boolean`) absent/false until Phase 6's `.planning/` walker populates it. Badge renders only when truthy — same graceful-nullish pattern as Phase-4 D-13 (`project.url`). Add the field to `RoadmapJsonSchema` as optional/nullish so the current flagless snapshot stays valid. **No `.planning/` scanning logic in Phase 5.**
- **D-05-03 (OV-03):** Drill-down shows issueCounts breakdown (backlog/started/done), milestones list, and a guarded Linear deep-link (prefix-checked `https://linear.app/`, omit when `url` null — reuse Phase-4 04-04 pattern). Does NOT list individual issues. Snapshot-first, zero network.
- **D-05-04:** Drill-down opens as a dialog/drawer whose open state is driven by a `?project=<id>` URL param — shareable, survives reload, composes with filter params. **No new route.** Reuse base-ui/shadcn dialog primitive (scaffold via shadcn CLI if not present, base-nova approach). Unknown/absent `?project` id renders no dialog (guarded).
- **D-05-05 (OV-02):** Filters live on the Overview route only, encoded as URL searchParams (shareable, survive reload). Controls: initiative (multi-select), time range (quarter presets + custom range), status, priority. Filters compose (AND across dimensions). Timeline keeps its own fixed 7-month window — no shared cross-route filter state. Use React Router 7 `useSearchParams`. `?project=<id>` and filter params coexist in one URL.
- **D-05-06:** Snapshot-first, zero network — all views derive from `RoadmapLoaderData.data`. Responsive + dark mode + empty/loading/error states required (reuse `RoadmapBoundaries`). Build KPI/health/filter/drill-down as testable pure selectors + thin presentational components, mirroring Phase-4's `src/lib/timeline` + `src/components/timeline` split (pure logic unit-tested; no React-render harness — component fidelity is human-UAT per Phase-4 Path B).

### Claude's Discretion
- Exact selector module names/signatures, KPI card visual layout, filter control widget choices (as long as they encode to searchParams), quarter-preset definitions.

### Deferred Ideas (OUT OF SCOPE)
- Actual `planAhead` computation (Phase 6 CLI walker).
- Individual issue lists / live issue fetch (Linear deep-link covers it).
- Shared Overview↔Timeline filter state (would couple routes).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OV-01 | KPI cards (initiatives, projects, scheduled vs undated, by-priority, by-status) + per-initiative health strip | §Selector layer — `computeKpis`, `rollupInitiativeHealth` pure functions over `RoadmapJson` |
| OV-02 | Filters (initiative, time range, status, priority) URL-encoded, shareable, survive reload | §URL filter state — `encodeFilters`/`decodeFilters` pure round-trip + `useSearchParams` |
| OV-03 | Drill-down project → milestones + guarded Linear deep-link | §Drill-down dialog — reuse `ProjectPopoverContent` layout patterns; guarded-link |
| OV-04 | "Out of sync with plan" badge | §Schema growth — optional `planAhead` field, nullish-guarded badge |
</phase_requirements>

## Summary

This phase is almost entirely **client rendering over an already-loaded snapshot** — no network, no new route, no new runtime dependencies. Every hard part reduces to two well-trodden patterns already proven in this codebase: (1) React Router 7 `useSearchParams` for URL-encoded state (Phase-3 live toggle + AppHeader already use it), and (2) the Phase-4 "pure `src/lib/*` selectors + thin presentational `src/components/*`" split with vitest unit tests on the logic only.

The three genuinely new pieces are: a **filter encode/decode module** (the crux of OV-02 — must be a pure, round-trippable, defensively-parsing function), an **aggregation/selector module** (`src/lib/overview/`) computing KPI distributions and per-initiative health rollups, and a **URL-param-controlled base-ui Dialog** for the drill-down (base-ui `1.6.0` is already installed; the `dialog` and `card` shadcn wrappers are NOT yet scaffolded — scaffold both via the base-nova shadcn CLI).

**Primary recommendation:** Create `src/lib/overview/` with three pure modules — `filters.ts` (encode/decode + `applyFilters`), `aggregate.ts` (KPI + health rollups), and their `.test.ts` siblings — then build thin presentational components in `src/components/overview/`. Drive both the filter state and the `?project` drill-down from a single `useSearchParams` hook in `OverviewPage`. Add `planAhead: z.boolean().nullish()` to `ProjectSchema`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| KPI/health aggregation | Browser (pure lib) | — | Snapshot already in memory via root loader; pure reduce over arrays |
| Filter encode/decode | Browser (pure lib) | Browser/URL (searchParams) | Serialization is pure & testable; URL is the persistence medium |
| Filter application | Browser (pure lib) | — | AND-composition over the in-memory project list |
| Drill-down open state | Browser/URL (searchParams) | Browser (dialog UI) | `?project` param is the single source of truth; dialog is controlled by it |
| Linear deep-link | Browser (static href) | — | Guarded anchor to `linear.app`; no proxy call |
| `planAhead` badge data | (Phase 6 CLI) | Browser (render only) | Data seam deferred; Phase 5 only renders when field truthy |

## Standard Stack

### Core — all already installed; no new runtime packages
| Library | Version (installed) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| react-router-dom | 7.18.0 | `useSearchParams` for URL filter + drill-down state | Already the data-router; AppHeader/loader use it `[VERIFIED: package.json + AppHeader.tsx]` |
| @base-ui/react | 1.6.0 | `Dialog` primitive for drill-down; already backs badge/popover/hover-card | base-nova style; `dialog/` present in node_modules `[VERIFIED: node_modules/@base-ui/react/dialog]` |
| zod | 4.4.3 | Add optional `planAhead` to `ProjectSchema` | Schema is already Zod `[VERIFIED: package.json + schema.ts]` |
| vitest | 4.1.9 | Unit-test pure selectors (`src/**/*.test.ts` already globbed) | Phase-4 lib tests use it `[VERIFIED: vitest.config.ts]` |

### Supporting — scaffold via shadcn CLI (local base-nova registry, not new npm deps)
| Component | Source | Purpose | When to Use |
|-----------|--------|---------|-------------|
| `dialog` | shadcn base-nova registry | Drill-down container (`src/components/ui/dialog.tsx`) | Not yet present — scaffold `[VERIFIED: ls src/components/ui — no dialog.tsx]` |
| `card` | shadcn base-nova registry | KPI card container (`src/components/ui/card.tsx`) | Not yet present — scaffold, or hand-build a div with existing tokens `[VERIFIED: ls — no card.tsx]` |
| `badge` | existing `src/components/ui/badge.tsx` | Status/priority chips + OV-04 badge | Reuse `variant="outline"` / `destructive` `[VERIFIED: badge.tsx]` |

**Scaffold command (base-nova, matches `components.json` style):**
```bash
pnpm dlx shadcn@latest add dialog card
```
`components.json` is already configured (`"style": "base-nova"`, aliases `@/components/ui`), so the CLI emits base-ui-wrapped files identical in shape to the existing `popover.tsx`/`hover-card.tsx`. `[CITED: components.json]` If the CLI is unavailable offline, hand-author `dialog.tsx` mirroring `popover.tsx` against the `@base-ui/react/dialog` parts (see Code Examples). Card can be a plain token-styled `<div>` — no primitive needed.

**Version verification:** No new registry installs. All runtime packages already pinned in `package.json` and present in `node_modules` (base-ui `1.6.0` confirmed via its `package.json`).

## Package Legitimacy Audit

**No external packages are installed in this phase.** All runtime dependencies (react-router-dom, @base-ui/react, zod, vitest) are already present and pinned. The shadcn `dialog`/`card` additions are code generated from the already-installed `shadcn` devDep (4.11.0) into local source files — not new registry dependencies. slopcheck N/A.

## Architecture Patterns

### System Architecture Diagram

```
public/roadmap.json ──(root loader, Phase 2/3)──► RoadmapLoaderData.data (in memory)
                                                        │
                          ┌─────────────────────────────┴───────────────────────────┐
                          ▼                                                           ▼
                  useRouteLoaderData("root")                              useSearchParams()  ◄──► URL
                          │                                                           │
                          ▼                                            decodeFilters(searchParams) → Filters
              data.projects / data.initiatives                                        │  (pure, defensive)
                          │                                                           ▼
                          │                                            applyFilters(projects, filters) → Project[]
                          ├──────────────────────────┬──────────────────────────────┤
                          ▼                          ▼                                ▼
              computeKpis(filtered)      rollupInitiativeHealth(filtered, inits)   filtered list
                          │                          │                                │
                          ▼                          ▼                                ▼
                  <KpiCards/>            <InitiativeHealthStrip/>           (project rows / bars)
                                                                                      │
                                    searchParams.get("project") ──► guarded lookup ──┤
                                                                                      ▼
                                                    open={!!project} <ProjectDrillDownDialog/>
                                                    onOpenChange(false) → delete "project" param
```
Filter params (`initiative`, `q`/`quarter`, `from`, `to`, `status`, `priority`) and the `project` drill-down param live in **one** `URLSearchParams`; `decodeFilters` ignores `project` and vice-versa, so they compose without collision. `[VERIFIED: loader.ts reads searchParams; AppHeader mutates them independently]`

### Recommended Project Structure
```
src/
├── lib/
│   └── overview/
│       ├── filters.ts          # Filter type, encodeFilters, decodeFilters, applyFilters (PURE)
│       ├── filters.test.ts     # round-trip + AND-composition + defensive-parse tests
│       ├── aggregate.ts        # computeKpis, rollupInitiativeHealth, isScheduled (PURE)
│       └── aggregate.test.ts
└── components/
    ├── overview/
    │   ├── KpiCards.tsx
    │   ├── InitiativeHealthStrip.tsx
    │   ├── FilterBar.tsx                 # reads/writes searchParams
    │   └── ProjectDrillDownDialog.tsx    # controlled by ?project
    └── ui/
        ├── dialog.tsx          # scaffolded (base-nova)
        └── card.tsx            # scaffolded or hand-rolled
```

### Pattern 1: URL filter state as a pure encode/decode boundary (OV-02 crux)
**What:** All filter logic is a pure function of `URLSearchParams`; React only holds the hook. Use **repeated params** for multi-value dimensions (`?initiative=A&initiative=B`) via `getAll`, not CSV — it is the URL-native list encoding, avoids delimiter-escaping bugs, and round-trips cleanly.
**When:** Always for the filter layer.
**Example:**
```typescript
// src/lib/overview/filters.ts — PURE, no React import
export interface Filters {
  initiatives: string[];          // repeated ?initiative=<id>
  quarter: string | null;         // preset, e.g. "2026-Q3"; mutually informs from/to
  from: string | null;            // custom range lower bound (YYYY-MM-DD)
  to: string | null;              // custom range upper bound
  statuses: string[];             // repeated ?status=<value>
  priorities: number[];           // repeated ?priority=<0..4>
}

// Decode is DEFENSIVE: searchParams are attacker-controllable. Drop anything invalid.
export function decodeFilters(sp: URLSearchParams): Filters {
  const priorities = sp.getAll("priority")
    .map((p) => Number(p))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 4);
  return {
    initiatives: sp.getAll("initiative"),
    quarter: sp.get("quarter"),
    from: isIsoDate(sp.get("from")) ? sp.get("from") : null,
    to: isIsoDate(sp.get("to")) ? sp.get("to") : null,
    statuses: sp.getAll("status"),
    priorities,
  };
}

// Encode writes ONLY set dimensions (empty → omitted → clean shareable URL).
// Preserves any non-filter params (e.g. ?project, ?source) the caller passes in.
export function encodeFilters(filters: Filters, base = new URLSearchParams()): URLSearchParams {
  const sp = new URLSearchParams(base);
  ["initiative", "status", "priority", "quarter", "from", "to"].forEach((k) => sp.delete(k));
  filters.initiatives.forEach((id) => sp.append("initiative", id));
  filters.statuses.forEach((s) => sp.append("status", s));
  filters.priorities.forEach((p) => sp.append("priority", String(p)));
  if (filters.quarter) sp.set("quarter", filters.quarter);
  if (filters.from) sp.set("from", filters.from);
  if (filters.to) sp.set("to", filters.to);
  return sp;
}
```
`encodeFilters(decodeFilters(sp)) ≡ sp` for the filter dimensions is the key round-trip invariant to unit-test. Passing the existing `searchParams` as `base` is how `?project`/`?source` survive a filter change.

### Pattern 2: `useSearchParams` functional updater preserving co-resident params (matches AppHeader)
**What:** Mutate the `prev` `URLSearchParams` and return it — never construct from scratch, or you drop `?project`/`?source`.
**Example:**
```typescript
// In FilterBar / OverviewPage
const [searchParams, setSearchParams] = useSearchParams();
const filters = decodeFilters(searchParams);

function toggleInitiative(id: string) {
  setSearchParams((prev) => {
    const next = decodeFilters(prev);
    next.initiatives = next.initiatives.includes(id)
      ? next.initiatives.filter((x) => x !== id)
      : [...next.initiatives, id];
    return encodeFilters(next, prev); // prev carries ?project/?source through
  });
}
```
`[VERIFIED: AppHeader.tsx uses the identical `setParams((prev) => { …; return prev; })` mutate-and-return idiom]`

### Pattern 3: URL-param-controlled base-ui Dialog (D-05-04)
**What:** No `Dialog.Trigger`. `open` is derived from `?project`; closing deletes the param. The base-ui `onOpenChange` signature is **`(open: boolean, eventDetails) => void`** — two args, unlike Radix's one. `[VERIFIED: node_modules/@base-ui/react/dialog/root/DialogRoot.d.ts]`
**Example:**
```typescript
// src/components/overview/ProjectDrillDownDialog.tsx
const [searchParams, setSearchParams] = useSearchParams();
const projectId = searchParams.get("project");
const project = projectId
  ? data.projects.find((p) => p.id === projectId) ?? null   // guarded: unknown id → null → no dialog
  : null;

<Dialog
  open={project !== null}
  onOpenChange={(open) => {                                   // NOTE: base-ui passes (open, details)
    if (!open) {
      setSearchParams((prev) => { prev.delete("project"); return prev; }, { replace: true });
    }
  }}
>
  {project && <DialogContent>{/* issueCounts + milestones + guarded Linear link */}</DialogContent>}
</Dialog>
```
Use `{ replace: true }` on close so the back button doesn't re-open the dialog. Opening a row sets `?project=<id>` (push, so back closes it).

### Anti-Patterns to Avoid
- **CSV-encoding multi-selects (`?initiative=A,B`):** fragile delimiter escaping when ids contain commas; prefer repeated params + `getAll`.
- **Storing filter state in React `useState` mirrored to the URL:** two sources of truth drift; the URL *is* the state — derive on every render via `decodeFilters`.
- **Constructing `new URLSearchParams()` in the updater:** silently drops `?project`/`?source`. Always thread `prev`.
- **Reading `?project` before guarding against unknown ids:** an arbitrary/stale id must render *no* dialog, not crash.
- **Putting aggregation inside components:** keep it in `src/lib/overview/` so it is unit-testable without a render harness (repo has none — Phase-4 Path B).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL list/param serialization | Custom string split/join with escaping | `URLSearchParams.getAll`/`append` | Native, handles encoding, round-trips |
| Reactive URL state | `window.history` + popstate listeners | `useSearchParams` | Router-integrated, already used here |
| Modal focus-trap/scroll-lock/ESC/backdrop | Custom overlay + keydown handlers | base-ui `Dialog` (`modal` default true) | Accessibility, focus return, dismissal all handled `[CITED: DialogRoot.d.ts]` |
| Priority label mapping | Re-derive per component | Reuse `PRIORITY_LABELS` from `ProjectPopoverContent` (extract to shared) | Already defined; single source |
| Initiative color | Recompute palette | `resolveInitiativeColor` (Phase-4 colorUtils) | Deterministic, tested `[VERIFIED: colorUtils.ts]` |

**Key insight:** The entire filter+drill-down surface is expressible with `URLSearchParams` + `useSearchParams` + one controlled Dialog. The only bespoke code worth writing is the *pure* encode/decode/aggregate logic — everything stateful is delegated to the router and base-ui.

## Common Pitfalls

### Pitfall 1: base-ui `onOpenChange` arity mismatch
**What goes wrong:** Copying a Radix example that treats `onOpenChange` as `(open) => …` works, but assuming the 2nd arg doesn't exist can bite when wiring `Dialog.Close`. base-ui's is `(open, eventDetails)`.
**Why:** base-ui ≠ Radix API. `[VERIFIED: DialogRoot.d.ts]`
**Avoid:** Type the handler as `(open: boolean) => void` (2nd arg optional) and derive close from `open === false`.
**Warning signs:** TS complaining about handler signature when passing to `Dialog.Root`.

### Pitfall 2: Dropped co-resident params on filter change
**What goes wrong:** Changing a filter clears `?project` or `?source=live`.
**Why:** Rebuilding `URLSearchParams` from filters only.
**Avoid:** Thread `prev`/existing searchParams as the `base` in `encodeFilters`.
**Warning signs:** Live-mode toggle resets when you touch a filter; open drill-down closes on filter change.

### Pitfall 3: Quarter preset vs custom range coupling
**What goes wrong:** `?quarter=2026-Q3` and `?from/?to` both set → ambiguous window.
**Why:** Two representations of the same dimension.
**Avoid:** Decide precedence in `decodeFilters` (e.g. explicit `from/to` overrides `quarter`, or setting a quarter clears `from/to` on write). Encode a resolved `{start,end}` for `applyFilters` via a pure `resolveRange(filters)` helper; unit-test the precedence.
**Warning signs:** Filter shows a quarter chip active but results match a different range.

### Pitfall 4: "Scheduled" definition drift
**What goes wrong:** Counting `startDate` as scheduled.
**Why:** Phase-4 D-06 defines scheduled strictly as **has `targetDate`**.
**Avoid:** Single `isScheduled(p) = p.targetDate !== null` in `aggregate.ts`; reuse everywhere. `[CITED: CONTEXT.md D-05-01]`

### Pitfall 5: Time-range filter on undated projects
**What goes wrong:** A time-range filter silently hides all undated projects, or includes them unexpectedly.
**Why:** Undated projects have no `targetDate` to test against the window.
**Avoid:** Decide + test the rule explicitly (recommend: undated projects are excluded when a time range is active, since the range is a scheduling filter). Document in `applyFilters`.

## Code Examples

### Aggregation selector (OV-01)
```typescript
// src/lib/overview/aggregate.ts — PURE
import type { RoadmapJson, Project, Initiative } from "@/lib/roadmap/schema";

export const isScheduled = (p: Project): boolean => p.targetDate !== null;

export interface Kpis {
  initiatives: number;
  projects: number;
  scheduled: number;
  undated: number;
  byPriority: Record<number, number>;   // 0..4 → count
  byStatus: Record<string, number>;
}

export function computeKpis(projects: Project[], initiativeCount: number): Kpis {
  const byPriority: Record<number, number> = {};
  const byStatus: Record<string, number> = {};
  let scheduled = 0;
  for (const p of projects) {
    if (isScheduled(p)) scheduled++;
    byPriority[p.priority] = (byPriority[p.priority] ?? 0) + 1;
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  }
  return {
    initiatives: initiativeCount,
    projects: projects.length,
    scheduled,
    undated: projects.length - scheduled,
    byPriority,
    byStatus,
  };
}

export interface InitiativeHealth {
  initiative: Initiative;
  projectCount: number;
  scheduled: number;
  undated: number;
  backlog: number;
  started: number;
  done: number;
}

export function rollupInitiativeHealth(
  projects: Project[],
  initiatives: Initiative[]
): InitiativeHealth[] {
  return initiatives.map((initiative) => {
    const own = projects.filter((p) => p.initiativeId === initiative.id);
    return {
      initiative,
      projectCount: own.length,
      scheduled: own.filter(isScheduled).length,
      undated: own.filter((p) => !isScheduled(p)).length,
      backlog: own.reduce((s, p) => s + p.issueCounts.backlog, 0),
      started: own.reduce((s, p) => s + p.issueCounts.started, 0),
      done: own.reduce((s, p) => s + p.issueCounts.done, 0),
    };
  });
  // Consider whether to also surface projects with initiativeId === null as an
  // "Unassigned" pseudo-row — decide + test.
}
```

### `applyFilters` AND-composition (OV-02)
```typescript
// src/lib/overview/filters.ts — PURE
export function applyFilters(
  projects: Project[],
  filters: Filters,
  range: { start: string; end: string } | null   // from resolveRange(filters)
): Project[] {
  return projects.filter((p) => {
    if (filters.initiatives.length && !filters.initiatives.includes(p.initiativeId ?? ""))
      return false;
    if (filters.statuses.length && !filters.statuses.includes(p.status)) return false;
    if (filters.priorities.length && !filters.priorities.includes(p.priority)) return false;
    if (range) {
      if (!p.targetDate) return false;                  // undated excluded when range active
      if (p.targetDate < range.start || p.targetDate > range.end) return false;
    }
    return true;
  });
}
```

### Hand-authored dialog fallback (if CLI offline) — mirrors popover.tsx shape
```typescript
// src/components/ui/dialog.tsx
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}
function DialogContent({ className, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-popover p-5 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-hidden",
          className
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}
export { Dialog, DialogContent };
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;
```
`[VERIFIED: parts list in node_modules/@base-ui/react/dialog/index.parts.d.ts — Root, Portal, Backdrop, Popup, Title, Description, Close, Trigger, Viewport]`

### Optional schema field (OV-04, D-05-02)
```typescript
// src/lib/roadmap/schema.ts — add inside ProjectSchema, mirroring url: z.string().nullish()
const ProjectSchema = z.object({
  // …existing fields…
  url: z.string().nullish(),
  planAhead: z.boolean().nullish(),   // absent/false until Phase 6 walker; badge renders only when truthy
  // …
});
```
Because existing `roadmap.json` omits the field and `.nullish()` accepts `undefined`, the current snapshot stays valid — identical to how `url` was introduced in Phase 4. `[VERIFIED: schema.ts line 19 `url: z.string().nullish()`]` Badge render guard: `{project.planAhead && <Badge variant="destructive">Out of sync with plan</Badge>}`.

## Runtime State Inventory

Not applicable — this is a greenfield UI phase (new components + one optional additive schema field). No rename/refactor/migration. The only stored-data touch is the additive optional `planAhead` field, which is backward-compatible (existing snapshot omits it and remains schema-valid). No data migration required.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Radix UI dialog (single-arg `onOpenChange`) | base-ui Dialog (`onOpenChange(open, details)`) | base-ui 1.x | Handler arity differs; controlled `open` prop pattern otherwise identical |
| React Router v6 `useSearchParams` | v7 `useSearchParams` (same API, `react-router-dom` 7.x) | RR7 | No change to the hook; functional updater still supported `[VERIFIED: AppHeader]` |

**Deprecated/outdated:** none relevant. Do not reach for `nuqs` or other URL-state libs — `useSearchParams` + pure encode/decode is sufficient and keeps zero new deps.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Undated projects should be excluded when a time-range filter is active | Filters / Pitfall 5 | Low — a decision point; unit-test whichever rule is chosen. Surface to planner. |
| A2 | Quarter preset and custom from/to should have explicit precedence (custom overrides, or quarter clears custom on write) | Pitfall 3 | Low — UX decision; pick one and test it |
| A3 | `null` `initiativeId` projects may warrant an "Unassigned" health row | aggregate.ts | Low — cosmetic; decide during planning |
| A4 | shadcn base-nova registry is reachable to scaffold `dialog`/`card`; else hand-author | Standard Stack | Low — hand-authored fallback provided and verified against installed parts |

## Open Questions (RESOLVED)

None blocking. RESOLVED: A1 (undated-exclusion when range active), A2 (custom-over-quarter range precedence, coexist), and A3 (Unassigned health row) are settled and pinned as tests in 05-02; A4 (registry-failure-is-blocking with verified hand-authored fallback) is settled in 05-03. All four are unit-tested or acceptance-gated in the finalized plans.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @base-ui/react | Dialog | ✓ | 1.6.0 | — |
| react-router-dom | useSearchParams | ✓ | 7.18.0 | — |
| zod | schema field | ✓ | 4.4.3 | — |
| vitest | selector tests | ✓ | 4.1.9 | — |
| shadcn CLI (devDep) | scaffold dialog/card | ✓ | 4.11.0 | Hand-author dialog.tsx (Code Examples); card = plain div |

No blocking missing dependencies. Zero network at runtime (snapshot-first), consistent with D-05-06.

## Validation Architecture

> nyquist_validation is not disabled in `.planning/config.json` (key absent → treated as enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 |
| Config file | `vitest.config.ts` (env `node`, globs `src/**/*.test.ts`) |
| Quick run command | `pnpm test -- src/lib/overview` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OV-01 | `computeKpis` counts scheduled/undated/by-priority/by-status | unit | `pnpm test -- src/lib/overview/aggregate.test.ts` | ❌ Wave 0 |
| OV-01 | `rollupInitiativeHealth` sums issueCounts per initiative | unit | `pnpm test -- src/lib/overview/aggregate.test.ts` | ❌ Wave 0 |
| OV-02 | `encodeFilters(decodeFilters(sp))` round-trips filter dims | unit | `pnpm test -- src/lib/overview/filters.test.ts` | ❌ Wave 0 |
| OV-02 | `decodeFilters` drops invalid priority/date; ignores `project`/`source` | unit | `pnpm test -- src/lib/overview/filters.test.ts` | ❌ Wave 0 |
| OV-02 | `applyFilters` AND-composes all dimensions + range | unit | `pnpm test -- src/lib/overview/filters.test.ts` | ❌ Wave 0 |
| OV-02 | `resolveRange` quarter/custom precedence | unit | `pnpm test -- src/lib/overview/filters.test.ts` | ❌ Wave 0 |
| OV-03 | (dialog render + guarded link) | manual-only | human UAT (no React-render harness — Phase-4 Path B) | n/a |
| OV-04 | schema accepts snapshot without `planAhead`; badge guard on truthy | unit (schema) + manual (badge) | `pnpm test` (schema parse) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- src/lib/overview` (+ `pnpm typecheck`)
- **Per wave merge:** `pnpm test`
- **Phase gate:** `pnpm test` + `pnpm lint` + `pnpm typecheck` green before `/gsd:verify-work`; drill-down/badge/filters visual fidelity via human UAT (Path B).

### Wave 0 Gaps
- [ ] `src/lib/overview/filters.test.ts` — covers OV-02 (round-trip, defensive parse, AND-composition, range precedence)
- [ ] `src/lib/overview/aggregate.test.ts` — covers OV-01 (KPIs, health rollup)
- [ ] Schema parse test asserting a `planAhead`-less snapshot still validates (OV-04 back-compat) — extend existing schema/loader tests if present, else add `src/lib/roadmap/schema.test.ts`
- Framework install: none — vitest already configured.

## Security Domain

> `security_enforcement` hooks trigger only on scope `auth|storage|api|llm`. This phase is pure client rendering with no auth/storage/api/llm — the CSO gate will not trigger. One input-validation control is nonetheless genuinely relevant:

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `decodeFilters` treats `URLSearchParams` as untrusted: whitelist/clamp priority (0–4), ISO-date-validate `from`/`to`, ignore unknown initiative/status ids in aggregation, and guard `?project` against unknown ids (renders no dialog). Never interpolate a param into an href without the existing `linear.app` prefix check. |
| V2/V3/V4/V6 | no | No auth/session/access-control/crypto in this phase |

### Known Threat Patterns for React + URL state
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reflected param → unguarded `href` (open-redirect / javascript:) | Tampering | Reuse Phase-4 04-04 guard: only render link when `url.startsWith("https://linear.app/")` `[VERIFIED: ProjectPopoverContent.tsx line 94]` |
| Malformed/oversized searchParams crashing render | DoS | Defensive `decodeFilters`; unknown ids simply match nothing |

## Sources

### Primary (HIGH confidence)
- Codebase: `src/lib/roadmap/schema.ts`, `src/lib/roadmap/loader.ts`, `src/components/AppHeader.tsx`, `src/components/timeline/ProjectPopoverContent.tsx`, `src/lib/timeline/*`, `src/components/ui/{badge,popover,hover-card}.tsx`, `vitest.config.ts`, `package.json`, `components.json`, `.planning/config.json`
- `node_modules/@base-ui/react/dialog/root/DialogRoot.d.ts` — `open`/`onOpenChange(open, details)`/`modal` props (base-ui 1.6.0)
- `node_modules/@base-ui/react/dialog/index.parts.d.ts` — Dialog part inventory
- `.planning/phases/05/05-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`

### Secondary (MEDIUM confidence)
- React Router 7 `useSearchParams` behavior — confirmed against in-repo usage (AppHeader functional updater) rather than external docs.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps installed and version-verified; no new packages.
- Architecture: HIGH — mirrors proven Phase-4 lib/component split and Phase-3 searchParams usage.
- Pitfalls: HIGH — base-ui API verified from installed type defs; param-threading verified from AppHeader.

**Research date:** 2026-07-14
**Valid until:** 2026-08-13 (stable; no fast-moving external deps)
</content>
</invoke>
