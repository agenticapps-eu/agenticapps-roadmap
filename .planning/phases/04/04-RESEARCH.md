# Phase 04: Roadmap Timeline UI — Research

**Researched:** 2026-07-01
**Domain:** React 19 / Tailwind v4 / shadcn base-nova timeline UI + Linear GraphQL pipeline
**Confidence:** HIGH (all critical claims verified from repo files or official SDK)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Fixed window — current month → +6 months, one column per month.
- **D-02:** Render a "today" marker line on the axis.
- **D-03:** Scheduled project outside the window is clamped to the window edge with a "continues" cue. Never silently hidden, never demoted to a pill.
- **D-04:** Undated projects in a parking rail on the LEFT of the month grid, grouped per initiative lane. Always visible.
- **D-05:** A scheduled bar spans startDate → targetDate, with milestone markers along it.
- **D-06:** "Scheduled" = has a `targetDate`. A project with no `targetDate` is a pill.
- **D-07:** If a scheduled project has `targetDate` but no `startDate`, draw a 64px-wide bar ending at the targetDate.
- **D-08:** Popover trigger = hover on desktop / tap on touch (Radix/shadcn HoverCard + Popover). Responsive is a hard requirement.
- **D-09:** Popover contents: project summary + Linear link + issue-counts bar + milestones list + status + priority + start/target dates.
- **D-10:** Milestone markers appear on the bar; the popover milestone list reinforces them.
- **D-11:** Color-by-initiative ramp. 2 of 5 initiatives have `null` color — assign fallback from a deterministic palette stable per initiative id.
- **D-12:** Responsive + dark mode required; empty/loading/error states required.
- **D-13:** Add `project.url` to the Linear data pipeline: fetch `Project.url` in `MAIN_QUERY`, carry through `map.ts` → `schema.ts` → `roadmap.json`, then re-run snapshot. Client reconstruction is unreliable (slug-id, not UUID).

### Claude's Discretion

- Lane ordering (by initiative name vs. by scheduled-project count) — pick a sensible default.
- Exact fallback color palette and within-initiative ramp treatment (D-11).
- Pill ordering within the rail.
- Reuse the existing "live unavailable" loader pattern for the error state (D-12).
- Whether to introduce shadcn Card/Popover primitive vs. hand-rolled.

### Deferred Ideas (OUT OF SCOPE)

- Filters / time-range / status / priority controls — Phase 5 (OV-02).
- KPI cards + per-initiative health strip — Phase 5 (OV-01).
- Drill-down: project → milestones + issues — Phase 5 (OV-03).
- Live "Refresh from Linear" interactions — Phase 7.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TL-01 | Timeline with a month axis, one lane per initiative, and scheduled projects rendered as bars | Date math functions; CSS Grid/Flex absolute positioning; UI-SPEC layout tree verified |
| TL-02 | Undated projects render as dashed "needs-backfill" pills in-lane | Parking rail pattern; 14 of 16 current projects are undated (verified from roadmap.json) |
| TL-03 | Milestone markers on bars with a hover popover (project summary + Linear link) | D-13 pipeline trace complete; shadcn hover-card/popover confirmed (base-ui backed) |
| TL-04 | Color-by-initiative ramp, responsive, dark mode, and empty/loading/error states | CSS tokens verified in index.css; dark mode auto-switches via existing .dark class |
</phase_requirements>

---

## Summary

Phase 4 delivers the hero timeline view: initiative swimlanes across a fixed 7-month axis (July 2026 → January 2027), scheduled projects as position-absolute bars, undated projects as dashed pills in a per-lane parking rail, milestone diamond markers, hover/tap popovers, and color-by-initiative. This is a pure UI phase over `public/roadmap.json`, plus one deliberate pipeline reach-back (D-13) to add `project.url` to the snapshot.

**D-13 status (VERIFIED):** The Linear GraphQL `Project.url` field is confirmed to exist and be non-nullable via the official `@linear/sdk` v87.0.0 type declarations (`/** Project URL. */`). The pipeline touch points are fully traced from `MAIN_QUERY` through `map.ts`, `transform.ts`, `schema.ts`, and the snapshot script. The URL contains no token or email pattern and will pass the existing `assertNoLeak` gate. The two-part MAIN/ISSUES fetch split is unaffected. Four files require surgical edits; the snapshot must be re-run.

**Shadcn components (VERIFIED):** The `base-nova` style ships `hover-card` (`@base-ui/react/preview-card`) and `popover` (`@base-ui/react/popover`). Both use the `@base-ui/react` package already installed at v1.6.0 — **zero new npm dependencies** from `npx shadcn add hover-card popover badge`. The badge also uses base-ui internally.

**Current data facts (VERIFIED from `public/roadmap.json`):** 5 initiatives, 16 projects, 2 scheduled, 14 undated. Both scheduled projects fall at least partially outside the July 2026 window and require D-03 clamping. Factiv has 0 projects. The Callbot initiative has 9 undated projects — the dominant presence in the parking rail.

**Primary recommendation:** Implement D-13 pipeline edits in a dedicated Wave 0 plan (before any UI plans) so the snapshot can be re-run and `project.url` is present in `roadmap.json` before the popover plan runs.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Timeline layout and rendering | Browser/Client | — | Pure React rendering from loader data; no server involvement |
| Date math and window calculation | Browser/Client | — | Pure deterministic functions on string dates; testable offline |
| Initiative color resolution | Browser/Client | — | Deterministic algorithm on `initiative.color` field |
| `project.url` field in snapshot | Snapshot pipeline (Node script) | Worker (Pages Function — same transform path) | Must come from server-side Linear API call; client cannot reconstruct slug-id reliably (D-13) |
| Hover/tap popover trigger | Browser/Client | — | Browser interaction layer; pointer detection via `window.matchMedia` |
| Loading/error states | Browser/Client | — | React Router loader state + HydrateFallback |
| Snapshot re-generation | CI / manual `pnpm sync:snapshot` | — | Runs `scripts/sync-snapshot.ts` which calls `buildSnapshot` and writes `public/roadmap.json` |

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Installed Version | Purpose | Confirmed Via |
|---------|-----------------|---------|---------------|
| `react` | 19.2.0 | UI rendering | `package.json` [VERIFIED: package.json] |
| `react-router-dom` | 7.18.0 | Loader data (`useRouteLoaderData`) | `package.json` [VERIFIED: package.json] |
| `tailwindcss` | 4.3.1 | Utility CSS, custom properties | `package.json` [VERIFIED: package.json] |
| `@base-ui/react` | 1.6.0 | HoverCard (PreviewCard), Popover, Badge primitives | `package.json` + registry fetch [VERIFIED: shadcn registry] |
| `lucide-react` | 1.22.0 (registry) / 1.21.0 (installed) | ChevronLeft/Right cue icons; no other icon deps | `package.json` + npm view [VERIFIED: npm registry] |
| `zod` | 4.4.3 | Schema validation for loader + snapshot | `package.json` [VERIFIED: package.json] |

### Shadcn Components to Add (scaffolded via CLI, no npm install)

| Component | Shadcn Style | Underlying Primitive | Files Added |
|-----------|-------------|---------------------|-------------|
| `hover-card` | base-nova | `@base-ui/react/preview-card` (PreviewCard.Root/Trigger/Popup/Positioner/Portal) | `src/components/ui/hover-card.tsx` |
| `popover` | base-nova | `@base-ui/react/popover` (Popover.Root/Trigger/Popup/Positioner/Portal) | `src/components/ui/popover.tsx` |
| `badge` | base-nova | `@base-ui/react` (`mergeProps`, `useRender`) | `src/components/ui/badge.tsx` |

**Installation command (zero new npm deps):**
```bash
npx shadcn add hover-card popover badge
```

All three components source their primitives from `@base-ui/react` which is already at v1.6.0 in the project. No Radix UI packages will be installed. [VERIFIED: shadcn registry at ui.shadcn.com/r/styles/base-nova/hover-card.json + popover.json + badge.json]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure CSS Grid / absolute positioning | A charting library (react-flow, recharts, vis-timeline) | Charting libraries are overkill for a fixed 7-column month grid; CSS positioning gives exact UI-SPEC control with zero bundle cost |
| `@base-ui/react/preview-card` (HoverCard) | `@radix-ui/react-hover-card` | Radix is not installed; base-ui is already present; base-nova style targets base-ui — use base-ui |
| Pure JS Date arithmetic | `date-fns` or `dayjs` | The window is a fixed 7-month span; the only math needed is `daysBetween` and `startOfMonth`. No library justified. |

---

## Package Legitimacy Audit

This phase adds zero new npm dependencies (shadcn add scaffolds source files, not packages). The three shadcn components pull from `@base-ui/react` which is already installed and was legitimacy-vetted in Phase 1.

| Package | Registry | Notes | Disposition |
|---------|----------|-------|-------------|
| `@base-ui/react` (already installed) | npm | v1.6.0, official Meta/MUI team project | Approved (pre-existing) |
| `hover-card`, `popover`, `badge` via shadcn | shadcn official registry | Source-only scaffold, no new npm package | Approved |

**slopcheck:** Could not be installed (auto mode classifier blocked). All packages above are [ASSUMED] except `@base-ui/react` which was previously vetted. No new packages are added by this phase — the legitimacy question is moot for source-only scaffold components.

---

## Architecture Patterns

### System Architecture Diagram

```
User browser
    │
    ├──[initial load]──► /roadmap.json (static Cloudflare CDN)
    │                        │
    │                   roadmapLoader validates via RoadmapJsonSchema
    │                        │
    └──[data available]──► TimelinePage (React)
                               │
                ┌──────────────┴──────────────┐
                │                             │
           dateUtils.ts                 colorUtils.ts
           (pure, testable)             (pure, testable)
                │                             │
         AxisRow + TodayMarker       InitiativeLane × N
                                           │
                              ┌────────────┴────────────┐
                         ParkingRail              ScheduledGrid
                         (UndatedPill × K)        (ScheduledBar × J)
                                                       │
                                              MilestoneMarker × M
                                                       │
                                           ProjectPopoverContent
                                           (via HoverCard or Popover)
                                                       │
                                              project.url ──► Linear web app
```

### Recommended Project Structure

```
src/
├── components/
│   ├── timeline/
│   │   ├── AxisRow.tsx            # Month header row (RailHeader + MonthColumns + TodayMarker)
│   │   ├── InitiativeLane.tsx     # LaneHeader + LaneBody (ParkingRail + ScheduledGrid)
│   │   ├── UndatedPill.tsx        # Dashed pill + hover/tap trigger
│   │   ├── ScheduledBar.tsx       # Positioned bar + clamping + MilestoneMarkers
│   │   ├── MilestoneMarker.tsx    # Diamond marker + cluster collapse
│   │   └── ProjectPopoverContent.tsx  # Shared popover body (same for HoverCard and Popover)
│   └── ui/
│       ├── button.tsx             # existing
│       ├── hover-card.tsx         # new (shadcn add)
│       ├── popover.tsx            # new (shadcn add)
│       └── badge.tsx              # new (shadcn add)
├── lib/
│   ├── timeline/
│   │   ├── dateUtils.ts           # windowStart/End, daysBetween, barPosition, clampBar, todayOffset
│   │   └── colorUtils.ts          # resolveInitiativeColor, luminanceFor (bar text contrast)
│   └── roadmap/
│       ├── schema.ts              # +url field (z.string().nullish())
│       └── loader.ts              # unchanged
└── pages/
    └── TimelinePage.tsx           # Full replacement (currently a placeholder list)

scripts/linear/
├── query.ts                       # +url field in MAIN_QUERY projects node
├── map.ts                         # +url in GqlProject interface + mapWorkspace return
└── transform.ts                   # +url in RawProject + buildSnapshot return
```

### Pattern 1: Date Math — Bar Position Calculation

```typescript
// Source: derived from UI-SPEC § Bar Contract — pure functions, no external lib

/** Window constants for the current session */
export function getWindow(now: Date = new Date()) {
  const windowStart = new Date(now.getFullYear(), now.getMonth(), 1); // first of current month
  // last day of (currentMonth + 6)
  const windowEnd = new Date(now.getFullYear(), now.getMonth() + 7, 0);
  const windowDays = daysBetween(windowStart, windowEnd);
  return { windowStart, windowEnd, windowDays };
}

export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Returns { left, width } as percentage of the grid width.
 * Applies D-03 clamping. Returns null if project should not be a bar (never happens
 * for scheduled projects — D-03 ensures they always render).
 */
export function barPosition(
  startDate: string | null,
  targetDate: string,
  window: { windowStart: Date; windowEnd: Date; windowDays: number }
): { left: number; width: number; clampedLeft: boolean; clampedRight: boolean } {
  const { windowStart, windowEnd, windowDays } = window;
  const target = new Date(targetDate + "T00:00:00");
  // D-07: no startDate → 64px fixed-width bar (returned differently, handled in ScheduledBar)
  const start = startDate ? new Date(startDate + "T00:00:00") : null;

  const effectiveStart = start ? (start < windowStart ? windowStart : start) : null;
  const effectiveEnd = target > windowEnd ? windowEnd : target;
  const clampedLeft = start !== null && start < windowStart;
  const clampedRight = target > windowEnd;

  if (effectiveStart === null) {
    // D-07: fixed-width bar — caller handles the 64px special case
    const rightPct = (daysBetween(windowStart, effectiveEnd) / windowDays) * 100;
    return { left: rightPct, width: 0, clampedLeft: false, clampedRight };
  }

  const left = (daysBetween(windowStart, effectiveStart) / windowDays) * 100;
  const width = (daysBetween(effectiveStart, effectiveEnd) / windowDays) * 100;
  return { left: Math.max(0, left), width: Math.max(0, width), clampedLeft, clampedRight };
}
```

### Pattern 2: Initiative Color Resolution (D-11)

```typescript
// Source: UI-SPEC § Initiative Color Ramp — deterministic, stable

const FALLBACK_PALETTE = ["#10b981", "#6366f1", "#14b8a6", "#ec4899", "#f97316"];

export function resolveInitiativeColor(
  initiative: { id: string; color: string | null },
  allInitiatives: Array<{ id: string; color: string | null }>
): string {
  if (initiative.color) return initiative.color;
  const sortedNullIds = allInitiatives
    .filter((i) => !i.color)
    .map((i) => i.id)
    .sort(); // lexicographic — stable across renders
  const idx = sortedNullIds.indexOf(initiative.id);
  return FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}
```

### Pattern 3: Hover vs. Tap Trigger (D-08)

```typescript
// Source: UI-SPEC § Hover/Tap Popover Contract

// In the bar/pill component — switch trigger mode at mount:
const [isTouch, setIsTouch] = React.useState(false);
React.useEffect(() => {
  setIsTouch(window.matchMedia("(pointer: coarse)").matches);
}, []);

// Render either HoverCard (desktop) or Popover (touch) around the same content:
if (isTouch) {
  return (
    <Popover>
      <PopoverTrigger asChild>{barElement}</PopoverTrigger>
      <PopoverContent><ProjectPopoverContent project={project} color={color} /></PopoverContent>
    </Popover>
  );
}
return (
  <HoverCard openDelay={300} closeDelay={200}>
    <HoverCardTrigger asChild>{barElement}</HoverCardTrigger>
    <HoverCardContent><ProjectPopoverContent project={project} color={color} /></HoverCardContent>
  </HoverCard>
);
```

**Note on `openDelay`/`closeDelay`:** The base-ui `PreviewCard.Root` (which backs `HoverCard`) supports these props. Verify exact prop names against `@base-ui/react` v1.6.0 docs at [base-ui.com/react/components/hover-card](https://base-ui.com/react/components/hover-card.md) at implementation time. [ASSUMED: prop names match the UI-SPEC; verify at implementation]

### Pattern 4: D-13 Pipeline — Adding `project.url`

Four surgical edits, one snapshot re-run:

**`scripts/linear/query.ts`** — add `url` to projects node in `MAIN_QUERY`:
```graphql
projects(first: 50) {
  nodes {
    id
    name
    description
    url          # ← add this line
    initiatives(first: 3) { ... }
    ...
  }
}
```

**`scripts/linear/map.ts`** — two changes (interface + explicit mapping):
```typescript
// In GqlProject interface:
url: string;   // ← add (non-nullable per Linear SDK)

// In mapWorkspace return:
projects: projects.nodes.map((proj) => ({
  id: proj.id,
  name: proj.name,
  description: proj.description,
  url: proj.url,    // ← add explicitly (allow-list mapping, not spread)
  initiativeId: proj.initiatives.nodes[0]?.id ?? null,
  // ... rest unchanged
})),
```

**`scripts/linear/transform.ts`** — two changes (RawProject + buildSnapshot):
```typescript
// In RawProject interface:
url: string;   // ← add

// In buildSnapshot return (inside projects.map):
return {
  id: proj.id,
  name: proj.name,
  summary: proj.description,
  url: proj.url,    // ← add
  // ... rest unchanged
};
```

**`src/lib/roadmap/schema.ts`** — add to ProjectSchema:
```typescript
const ProjectSchema = z.object({
  // ... existing fields ...
  url: z.string().nullish(),  // nullish = optional + nullable — backward compat with existing snapshot
});
```

Then run: `pnpm sync:snapshot` to populate `url` in `public/roadmap.json`.

### Anti-Patterns to Avoid

- **Reconstructing Linear URLs client-side:** `https://linear.app/{workspace}/project/{slugId}` looks tempting but `slugId` in the API is not the URL slug-id that Linear uses in the browser URL. The authoritative URL comes from `Project.url` on the API response. (D-13 — confirmed by the presence of both `url: string` and `slugId: string` as distinct fields in the SDK types.)
- **Making `url` non-nullable in the schema:** The current `roadmap.json` was generated without `url`. If `url: z.string()` (required), the schema validation will reject the existing snapshot. Use `z.string().nullish()`.
- **Spreading `proj` in `mapWorkspace`:** The existing `mapWorkspace` uses an explicit allow-list (no spread). This is intentional security design. Do not refactor to a spread; add `url` explicitly.
- **Using Radix UI for hover-card/popover:** Radix UI is not installed in this project and the `base-nova` style does not use it. The shadcn `add hover-card popover` command fetches base-ui-backed implementations.
- **Importing a date library for window math:** The 7-month fixed window only needs `daysBetween` and `startOfMonth`. Date-fns or dayjs are not needed and would add bundle weight.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hover popup (desktop) | Custom mouseenter/mouseleave handler + manual z-index overlay | `hover-card` (shadcn add) → base-ui PreviewCard | Portal management, stacking context, focus trapping, animation — all handled |
| Tap popup (mobile) | Custom click handler + backdrop div | `popover` (shadcn add) → base-ui Popover | Backdrop click dismiss, scroll-lock, positioning — all handled |
| Status/priority labels | Custom styled span | `badge` (shadcn add) → base-ui Badge | CVA variants match the existing button.tsx style system |
| Popover positioning | `getBoundingClientRect` + absolute position | base-ui Positioner (built into hover-card/popover) | Viewport-aware repositioning, sideOffset, alignment — complex edge cases |

**Key insight:** base-ui Positioner handles viewport collision detection automatically (e.g., popover near the right edge flips to the left). Hand-rolling this is a multi-day effort with poor edge-case coverage.

---

## D-13 Deep Dive: Linear `Project.url` Evidence

### Claim: `Project.url` exists in the Linear GraphQL API

**Evidence (VERIFIED):** Extracted from `@linear/sdk@87.0.0` type declarations at `/tmp/package/dist/index.d.mts` (fetched via `npm pack`):

```typescript
// Line 10325 in dist/index.d.mts (Project class body):
/** Project URL. */
url: string;

// Line 10260 (slugId — distinct from url):
/** The project's unique URL slug, used to construct human-readable URLs. */
slugId: string;
```

The `url` field is non-nullable (`string`, not `string | null`). It coexists with `slugId` — confirming that the slug-id in the URL is distinct from the raw UUID `id` field and is not reconstructable client-side from stored data. [VERIFIED: @linear/sdk v87.0.0 dist/index.d.mts]

### Claim: The URL is PII-safe

The `assertNoLeak` function in `scripts/linear/transform.ts` rejects strings matching:
- `TOKEN_RE = /lin_api_[A-Za-z0-9_-]+/` — API token pattern
- `EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/` — email address

A Linear project URL has the form: `https://linear.app/{workspace-slug}/project/{url-slug}`. The workspace slug (e.g., `agenticapps`) is a public identifier, not PII. Neither the token regex nor the email regex will match a URL of this form. [VERIFIED: assertNoLeak source read from `scripts/linear/transform.ts`]

### Claim: Adding `url` doesn't break the two-part fetch or Worker import

The two-part fetch in `fetch-workspace.ts` assembles projects as:
```typescript
const assembledProjects = mainJson.data.projects.nodes.map((proj) => ({
  ...proj,                                      // ← spread of RawMainProject
  issues: { nodes: bucket[proj.id] ?? [] },
}));
```

Since `url` is a field on `RawMainProject` (sourced from `MAIN_QUERY`), the spread will include it automatically. No changes to `fetch-workspace.ts` are needed — only `MAIN_QUERY`, `GqlProject` interface in `map.ts`, and the mapping return. [VERIFIED: fetch-workspace.ts source read]

The Worker (`functions/api/linear/[[path]].ts`) imports `fetchAssembledWorkspace` from `scripts/linear/fetch-workspace.ts` and `buildSnapshot` from `scripts/linear/transform.ts`. Both are process-free. Adding a string field to the data flow does not affect the import boundary. [VERIFIED: [[path]].ts source read]

### Pipeline touch-point summary

| File | Change | Breaking? |
|------|--------|-----------|
| `scripts/linear/query.ts` | Add `url` to `MAIN_QUERY` projects node | No — additive field |
| `scripts/linear/map.ts` | Add `url: string` to `GqlProject`; add `url: proj.url` to `mapWorkspace` return | No — explicit allow-list add |
| `scripts/linear/transform.ts` | Add `url: string` to `RawProject`; add `url: proj.url` to `buildSnapshot` | No — additive field |
| `src/lib/roadmap/schema.ts` | Add `url: z.string().nullish()` to `ProjectSchema` | No — nullish = backward compat |
| `public/roadmap.json` | Re-run `pnpm sync:snapshot` (requires `LINEAR_API_KEY`) | No — additive field in output |

---

## Snapshot Data Facts (Verified from `public/roadmap.json`)

| Stat | Value |
|------|-------|
| Total initiatives | 5 |
| Total projects | 16 |
| Scheduled (targetDate !== null) | 2 |
| Undated (targetDate === null) | 14 |

### Scheduled Projects and D-03 Clamping

| Project | Initiative | startDate | targetDate | Window relation | D-03 action |
|---------|-----------|-----------|------------|-----------------|-------------|
| AgenticApps Roadmap | agenticapps-workflow | 2026-06-22 | 2026-08-17 | Starts before window (Jun 22 < Jul 1), ends within | Clamp left to column 0, show ◀ at left edge |
| cPARX Prototype | cPARX | 2026-04-13 | 2026-05-08 | Entirely before window | 32px stub at left edge of column 0, show ◀ |

**Both scheduled projects need D-03 clamping.** Neither renders as a "normal" unclamped bar in the July 2026 window.

### Projects Per Initiative (parking rail composition)

| Initiative | Scheduled | Undated | Note |
|-----------|-----------|---------|------|
| Callbot | 0 | 9 | Dominant parking rail presence |
| agenticapps-workflow | 1 | 1 | One scheduled (clamped left), one pill |
| Factiv | 0 | 0 | 0 projects in current snapshot — lane renders with header only, collapses to header height |
| cPARX | 1 | 0 | One scheduled (32px stub), no pills |
| fx-signals | 0 | 3 | Three pills; "Web App V2" has milestones but no targetDate → pill |

### Initiative Colors

| Initiative | API Color | Rendered As | Fallback? |
|-----------|-----------|-------------|-----------|
| Callbot | `#0ea5e9` | Use directly | No |
| agenticapps-workflow | `null` | `#10b981` (FALLBACK_PALETTE[0] after sort) | Yes |
| Factiv | `#f2994a` | Use directly | No |
| cPARX | `#5e6ad2` | Use directly | No |
| fx-signals | `#f2c94c` | Use directly | No |

The null-color initiatives sorted lexicographically: only `agenticapps-workflow` has null color → index 0 → `#10b981` (emerald).

---

## Common Pitfalls

### Pitfall 1: Making `url` Non-Nullable in the Schema

**What goes wrong:** If `url: z.string()` (required, non-nullable) is added to `ProjectSchema`, the existing `public/roadmap.json` (which was generated before D-13) fails `RoadmapJsonSchema.parse()`. The app won't load at all until the snapshot is re-run with `LINEAR_API_KEY` set.

**Why it happens:** The schema gate in `roadmapLoader` uses `RoadmapJsonSchema.safeParse(json)` and falls back to the snapshot on failure. A schema mismatch on the snapshot itself throws a `Response` to the error boundary.

**How to avoid:** Use `url: z.string().nullish()` in `ProjectSchema`. This allows the field to be absent or null — backward compatible with the current snapshot. The UI-SPEC explicitly accounts for this: "If `project.url` is null/absent: omit the footer link."

**Warning signs:** `roadmapLoader` throws a Response with status 500 on the snapshot path; `RoadmapLoading` spins indefinitely; error boundary shows "Roadmap snapshot is malformed."

### Pitfall 2: Breaking Existing Tests When Adding `url` to Schema

**What goes wrong:** `transform.test.ts` has inline fixture data with `buildSnapshot(raw)` calls where `raw.projects[*]` doesn't have a `url` field. If `url: string` is non-nullable in `RawProject`, TypeScript will fail the build. The `loader.test.ts` `validSnapshot` fixture also lacks `url`.

**How to avoid:**
1. Use `url: z.string().nullish()` in `ProjectSchema` (Zod schema).
2. Use `url?: string | null` (optional) in `RawProject` in `transform.ts` initially, resolving to `url: proj.url ?? null` in `buildSnapshot`.
3. Update test fixtures to include `url: "https://linear.app/agenticapps/project/test"` where required.

### Pitfall 3: `mapWorkspace` Spread Assumption

**What goes wrong:** A developer assumes `url` "just passes through" because `fetchAssembledWorkspace` uses `...proj` spread. But `mapWorkspace` in `map.ts` does NOT use spread — it is an explicit allow-list. Without an explicit `url: proj.url` in the `mapWorkspace` return, `url` is silently dropped.

**Why it happens:** The explicit allow-list is intentional security design (stated in the comment header of `map.ts`). The `fetch-workspace.ts` spread is for assembling the raw API response only.

**How to avoid:** Always add new fields explicitly to `mapWorkspace`'s return object. Verify by checking that `url` appears in the `mapWorkspace` return, not just in `GqlProject`.

### Pitfall 4: D-07 Short Bar Width — Percentage vs Fixed

**What goes wrong:** The D-07 short bar (has `targetDate`, no `startDate`) has a fixed 64px width, NOT a percentage width. If treated like a normal bar (percentage), it becomes invisible for very short durations or overflows for long ones.

**How to avoid:** In `ScheduledBar`, when `startDate` is null but `targetDate` is not: use `style={{ right: `${100 - rightPct}%`, width: '64px', position: 'absolute' }}` (right-aligned to `targetDate` position with fixed 64px width).

**Warning signs:** A bar with no `startDate` appears very thin or invisible in the grid.

### Pitfall 5: `window.matchMedia` Called During SSR

**What goes wrong:** `window.matchMedia('(pointer: coarse)')` throws `ReferenceError: window is not defined` if called at the module level or during SSR.

**How to avoid:** Call it inside `React.useEffect(() => { ... }, [])` and initialize `isTouch` state to `false` (HoverCard as default). This is safe: on initial render desktop gets HoverCard, then the effect runs and may switch to Popover — but only on touch devices. There is no SSR in this project (Vite SPA), but the pattern is still correct.

### Pitfall 6: Factiv Lane — 0 Projects

**What goes wrong:** Factiv has 0 projects in the current snapshot. A naive implementation that tries to render lanes only for initiatives WITH projects would silently drop Factiv.

**How to avoid:** The UI-SPEC says "render the lane with only the lane header; lane height collapses to auto (just the header row, 32px). Do not hide the initiative." Render all 5 initiative lanes; show empty body for initiatives with 0 projects.

---

## Code Examples

### `assertNoLeak` behavior for a Linear URL

```typescript
// Source: scripts/linear/transform.ts (read from file)
// TOKEN_RE = /lin_api_[A-Za-z0-9_-]+/
// EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/

const testUrl = "https://linear.app/agenticapps/project/ABC-123-xyz";
// TOKEN_RE.test(testUrl) → false (no "lin_api_" prefix)
// EMAIL_RE.test(testUrl) → false (no @ symbol)
// Result: passes assertNoLeak ✓
```

### Month axis generation (7 columns)

```typescript
// Source: derived from UI-SPEC § Time Axis Contract
function getMonthColumns(windowStart: Date): Array<{ label: string; date: Date }> {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(windowStart.getFullYear(), windowStart.getMonth() + i, 1);
    return {
      label: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      date,
    };
  });
}
// For July 2026: ["Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026", "Jan 2027"]
```

### Today marker position

```typescript
// Source: UI-SPEC § Today Marker
function todayLeftPercent(now: Date, windowStart: Date, windowDays: number): number {
  return (daysBetween(windowStart, now) / windowDays) * 100;
}
// July 1, 2026 (today per currentDate) → daysBetween(Jul 1, Jul 1) = 0 → left: 0% (column 0 start)
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Radix UI popover/hover-card in shadcn | base-ui `@base-ui/react/preview-card` + `@base-ui/react/popover` in shadcn base-nova style | base-ui is already installed; zero new deps; consistent with `button.tsx` design |
| Zod v3 `.optional().nullable()` chaining | Zod v4 `.nullish()` (equivalent shorthand) | Simpler; project uses Zod v4.4.3 |

**Deprecated/outdated:**
- Radix UI: Not installed in this project. The `base-nova` shadcn style replaced Radix primitives with base-ui for all three components (hover-card, popover, badge).

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4.1.9 |
| Config file | `vitest.config.ts` (check if present; otherwise picks up from `vite.config.ts`) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TL-01 | Month axis generates 7 correct month labels | unit | `pnpm test src/lib/timeline/dateUtils.test.ts` | ❌ Wave 0 |
| TL-01 | Bar position calculation (left %, width %) | unit | `pnpm test src/lib/timeline/dateUtils.test.ts` | ❌ Wave 0 |
| TL-01 | D-03 clamping: entirely-before-window → stub | unit | `pnpm test src/lib/timeline/dateUtils.test.ts` | ❌ Wave 0 |
| TL-01 | D-03 clamping: starts-before → clamp left | unit | `pnpm test src/lib/timeline/dateUtils.test.ts` | ❌ Wave 0 |
| TL-02 | undated pills / scheduled bars split | unit | `pnpm test src/lib/timeline/dateUtils.test.ts` | ❌ Wave 0 |
| TL-03 | `url` present in snapshot after D-13 pipeline | unit | `pnpm test scripts/linear/transform.test.ts` | partial (needs url cases) |
| TL-03 | `assertNoLeak` accepts a Linear URL string | unit | `pnpm test scripts/linear/transform.test.ts` | ❌ Wave 0 case |
| TL-04 | `resolveInitiativeColor` returns correct fallback | unit | `pnpm test src/lib/timeline/colorUtils.test.ts` | ❌ Wave 0 |
| TL-04 | Render (visual): dark mode, responsive layout | manual | dev server + visual inspection | manual only |

### Sampling Rate

- **Per task commit:** `pnpm test` (full Vitest suite — fast, <5s)
- **Per wave merge:** `pnpm test && pnpm typecheck`
- **Phase gate:** `pnpm test && pnpm typecheck && pnpm build` green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/timeline/dateUtils.test.ts` — covers bar position, clamping, today marker, month columns
- [ ] `src/lib/timeline/colorUtils.test.ts` — covers `resolveInitiativeColor` fallback algorithm
- [ ] `scripts/linear/transform.test.ts` — add url passthrough + assertNoLeak URL test cases
- [ ] Update fixture `validSnapshot` in `src/lib/roadmap/loader.test.ts` to include `url` field (or verify `nullish` schema tolerates its absence)

---

## Security Domain

> `security_enforcement` not explicitly set to false in config — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth in this phase |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | Cloudflare Access unchanged (Phase 8 concern) |
| V5 Input Validation | Yes | Zod `ProjectSchema` validates snapshot; `url` field validated as `z.string().nullish()` |
| V6 Cryptography | No | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via `project.url` | Spoofing | `<a href={project.url} target="_blank" rel="noopener noreferrer">` — `noopener noreferrer` prevents new window from accessing opener; confirm URL is from the trusted API (it is — comes from `assertNoLeak`-cleared pipeline) |
| XSS via `project.url` in href | Tampering | `assertNoLeak` strips email patterns; `url` is from Linear's own GraphQL field. For defense in depth: add `if (url.startsWith("https://linear.app/"))` guard before rendering the link |
| PII leak via `url` in snapshot | Information Disclosure | Analyzed above — no token or email in a Linear project URL; passes assertNoLeak |

**Security recommendation:** Add a URL prefix guard in the popover footer: only render the link if `url.startsWith("https://linear.app/")`. This is defense-in-depth against any future data anomaly.

---

## Open Questions (RESOLVED)

1. **`openDelay` / `closeDelay` prop names on base-ui PreviewCard**
   - What we know: UI-SPEC requires 300ms open delay, 200ms close delay on HoverCard
   - What's unclear: base-ui `PreviewCard.Root` prop names at v1.6.0 (may be `delay` or `openDelay`/`closeDelay`)
   - Recommendation: Check [base-ui.com/react/components/hover-card](https://base-ui.com/react/components/hover-card.md) or `@base-ui/react/preview-card` TypeScript types at implementation time. [ASSUMED: prop names match the UI-SPEC]
   - **RESOLVED:** Verified at implementation time per the 04-05 acceptance criterion (delay props must compile without a TS "Property does not exist" error); any divergence is documented in 04-05-SUMMARY.md. TypeScript is the enforcing gate.

2. **Snapshot re-run requires `LINEAR_API_KEY`**
   - What we know: `pnpm sync:snapshot` throws without the key (reads `process.env.LINEAR_API_KEY`); the key is unset per STATE.md
   - What's unclear: When will the key be configured? If the D-13 plan runs in CI, the snapshot stays without `url`. If it runs locally, the user must export the key.
   - Recommendation: The D-13 plan should include a task that runs `pnpm sync:snapshot` locally (not in CI) and commits the updated `roadmap.json`. Alternatively, the planner can stage D-13 as a Wave 0 plan with a `checkpoint:human-verify` for the snapshot re-run. The `url` field in the popover is gracefully omitted if null.
   - **RESOLVED:** Addressed by plan 04-07 (`checkpoint:human-verify`, `autonomous: false`, wave 4) — snapshot re-run is gated on `LINEAR_API_KEY` with graceful deferral (link omitted when `url` is null), so the UI ships regardless.

3. **fx-signals Web App V2 milestone `M8` has `targetDate: "2026-06-12"`**
   - What we know: The project itself has `targetDate: null` (→ pill), but milestone M8 has a real past targetDate
   - What's unclear: Should milestone dates be rendered on pills? (Per D-10: "Milestone markers appear on the bar" — pills are NOT bars)
   - Recommendation: Milestones only appear on bars (D-10). Undated pills have no milestone markers. The UI-SPEC does not specify pill milestone markers.
   - **RESOLVED:** D-10 decision — milestone markers render only on bars, never on pills (enforced by 04-04: `MilestoneMarker` returns null when `targetDate` is null, and 04-05 renders markers only inside `ScheduledBar`).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | `pnpm sync:snapshot` (D-13) | ✓ | (system node) | — |
| `pnpm` | all commands | ✓ | (system pnpm) | — |
| `LINEAR_API_KEY` | `pnpm sync:snapshot` | ✗ (unset per STATE.md) | — | Commit roadmap.json without url; popover link gracefully omitted |
| `npx shadcn` | Wave 0 component install | ✓ (shadcn@4.11.0 in devDeps) | 4.12.0 available; 4.11.0 installed | — |
| Cloudflare Pages dev | Not needed for this phase | — | — | N/A |

**Missing dependencies with no fallback:** None that block UI implementation.

**Missing dependencies with fallback:** `LINEAR_API_KEY` — the snapshot can be committed without `url` populated; the popover footer link is gracefully omitted when `url` is null. The D-13 tasks can be staged before the UI popover task with a `checkpoint:human-verify`.

---

## Sources

### Primary (HIGH confidence)

- `@linear/sdk@87.0.0` dist/index.d.mts — `Project` class definition with `url: string` field; fetched via `npm pack` and inspected locally. [VERIFIED]
- `scripts/linear/query.ts` — confirmed `MAIN_QUERY` structure and absence of `url` field [VERIFIED: file read]
- `scripts/linear/map.ts` — confirmed explicit allow-list mapping in `mapWorkspace` [VERIFIED: file read]
- `scripts/linear/transform.ts` — confirmed `assertNoLeak` regex patterns and `buildSnapshot` output shape [VERIFIED: file read]
- `src/lib/roadmap/schema.ts` — confirmed `ProjectSchema` shape without `url` [VERIFIED: file read]
- `public/roadmap.json` — confirmed 16 projects, 2 scheduled, 14 undated, initiative colors [VERIFIED: file read]
- `src/index.css` — confirmed CSS custom properties, dark mode tokens [VERIFIED: file read]
- `components.json` — confirmed `base-nova` style and `registries: {}` (no third-party) [VERIFIED: file read]
- `package.json` — confirmed all dependency versions [VERIFIED: file read]
- `functions/api/linear/[[path]].ts` — confirmed two-part fetch worker import path [VERIFIED: file read]
- `scripts/linear/fetch-workspace.ts` — confirmed spread in `assembledProjects` [VERIFIED: file read]
- shadcn registry `ui.shadcn.com/r/styles/base-nova/hover-card.json` — confirmed `@base-ui/react/preview-card` backing [VERIFIED: WebFetch]
- shadcn registry `ui.shadcn.com/r/styles/base-nova/popover.json` — confirmed `@base-ui/react/popover` backing [VERIFIED: WebFetch]
- shadcn registry `ui.shadcn.com/r/styles/base-nova/badge.json` — confirmed `@base-ui/react` backing [VERIFIED: WebFetch]
- `.planning/phases/04/04-CONTEXT.md` — locked decisions D-01..D-13 [VERIFIED: file read]
- `.planning/phases/04/04-UI-SPEC.md` — design contract, layout tree, token specs [VERIFIED: file read]

### Secondary (MEDIUM confidence)

- Linear developer docs (linear.app/developers/graphql) — API structure overview; `Project.url` not directly listed on landing page but confirmed via SDK type inspection

### Tertiary (LOW — not relied upon)

- WebSearch results for Linear GraphQL `Project.url` — inconclusive from search; resolved definitively via SDK type inspection

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `openDelay`/`closeDelay` are valid prop names on `@base-ui/react/preview-card` PreviewCard.Root at v1.6.0 | Pattern 3 | HoverCard timing not configurable; may need `delay` prop instead — check base-ui docs at implementation |
| A2 | `npx shadcn add hover-card popover badge` with shadcn@4.11.0 fetches the `base-nova` registry (not default) and produces base-ui-backed components | Standard Stack | If it falls back to default (Radix) style, Radix packages would be installed — verify by inspecting generated file imports after `shadcn add` |
| A3 | All packages tagged [ASSUMED] — slopcheck was unavailable | Package Legitimacy | Low risk: all packages are existing project deps + official shadcn scaffold (no new npm package installs) |

**Verified claims significantly outnumber assumed claims for this phase.**

---

## Metadata

**Confidence breakdown:**
- D-13 pipeline trace: HIGH — all files read; Linear SDK types inspected directly
- Standard stack / shadcn component backing: HIGH — shadcn registry JSON fetched and confirmed
- Current data counts: HIGH — read directly from roadmap.json
- Validation architecture: HIGH — test files and vitest config present
- HoverCard delay prop names: LOW (A1) — needs verification at implementation against base-ui docs

**Research date:** 2026-07-01
**Valid until:** 2026-07-31 (stable stack; Linear SDK version pinned at time of npm pack)
