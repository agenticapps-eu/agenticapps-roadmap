# Phase 4: Roadmap Timeline UI — Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 20 (13 new, 7 surgical edits)
**Analogs found:** 20 / 20 (all have at least a role-match or self-match)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/pages/TimelinePage.tsx` | page | request-response | `src/pages/OverviewPage.tsx` | exact |
| `src/components/timeline/AxisRow.tsx` | component | request-response | `src/components/AppHeader.tsx` | role-match |
| `src/components/timeline/InitiativeLane.tsx` | component | request-response | `src/pages/TimelinePage.tsx` | role-match |
| `src/components/timeline/UndatedPill.tsx` | component | request-response | `src/components/ui/button.tsx` | role-match |
| `src/components/timeline/ScheduledBar.tsx` | component | request-response | `src/components/ui/button.tsx` | role-match |
| `src/components/timeline/MilestoneMarker.tsx` | component | request-response | `src/components/ui/button.tsx` | role-match |
| `src/components/timeline/ProjectPopoverContent.tsx` | component | request-response | `src/pages/OverviewPage.tsx` | role-match |
| `src/components/ui/hover-card.tsx` | component | request-response | `src/components/ui/button.tsx` | exact |
| `src/components/ui/popover.tsx` | component | request-response | `src/components/ui/button.tsx` | exact |
| `src/components/ui/badge.tsx` | component | request-response | `src/components/ui/button.tsx` | exact |
| `src/lib/timeline/dateUtils.ts` | utility | transform | `src/lib/utils.ts` | role-match |
| `src/lib/timeline/colorUtils.ts` | utility | transform | `src/lib/utils.ts` | role-match |
| `src/lib/timeline/dateUtils.test.ts` | test | transform | `scripts/linear/transform.test.ts` | exact |
| `src/lib/timeline/colorUtils.test.ts` | test | transform | `scripts/linear/transform.test.ts` | exact |
| `scripts/linear/query.ts` (edit) | config | batch | self | self |
| `scripts/linear/map.ts` (edit) | utility | transform | self | self |
| `scripts/linear/transform.ts` (edit) | utility | transform | self | self |
| `src/lib/roadmap/schema.ts` (edit) | model | CRUD | self | self |
| `src/lib/roadmap/loader.test.ts` (edit) | test | CRUD | self | self |
| `scripts/linear/__fixtures__/raw-clean.ts` (edit) | test fixture | transform | self | self |

---

## Pattern Assignments

### `src/pages/TimelinePage.tsx` (page, request-response — full replacement)

**Analogs:** `src/pages/OverviewPage.tsx` (exact role match) + current `src/pages/TimelinePage.tsx` (data access + scheduled/undated split)

**Imports pattern** — copy from `src/pages/OverviewPage.tsx` lines 1–2 and `src/pages/TimelinePage.tsx` lines 1–2:
```typescript
import { useRouteLoaderData } from "react-router-dom";
import type { RoadmapLoaderData } from "@/lib/roadmap/loader";
// Add timeline component and util imports here
```

**Data access + null guard** — copy from `src/pages/TimelinePage.tsx` lines 4–7 (identical in OverviewPage lines 4–7):
```typescript
export function TimelinePage() {
  const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;
  if (!loaderData) return null;
  const { data } = loaderData;
```

**Scheduled / undated split** — copy from `src/pages/TimelinePage.tsx` lines 9–13 (D-06 convention already established here):
```typescript
  const withDate = data.projects
    .filter((p) => p.targetDate !== null)
    .sort((a, b) => (a.targetDate! < b.targetDate! ? -1 : 1));

  const withoutDate = data.projects.filter((p) => p.targetDate === null);
```

**Empty-state pattern** — copy from `src/pages/TimelinePage.tsx` lines 18–20 (Tailwind v4 CSS custom-prop token style):
```typescript
  {withDate.length === 0 && withoutDate.length === 0 && (
    <p className="mt-2 text-(--color-muted-foreground)">No projects found.</p>
  )}
```
UI-SPEC empty state: replace with `flex flex-col items-center gap-4 py-24 text-center` block.

**Tailwind v4 CSS custom-property token style** — use `text-(--color-muted-foreground)`, `bg-(--color-background)`, `border-(--color-border)` throughout. Never `text-muted-foreground` (Tailwind v3 style).

**Layout shell** — `src/layouts/RootLayout.tsx` shows `main` has `px-6 py-8` already applied. TimelinePage adds `overflow-x-auto` on its own `section` wrapper per UI-SPEC.

---

### `src/components/timeline/AxisRow.tsx` (component, request-response)

**Analog:** `src/components/AppHeader.tsx`

**Imports pattern** (AppHeader lines 1–2 — NavLink/search omitted, keep the Tailwind v4 approach):
```typescript
// No router imports needed — AxisRow is pure props-in → render-out
import type { Initiative } from "@/lib/roadmap/schema";
import { cn } from "@/lib/utils";
```

**Flex-row layout pattern with fixed left column** — copy from `AppHeader.tsx` lines 32–33 (flex + h-14 idiom → adapt to h-8):
```typescript
// AppHeader analog:
<header className="sticky top-0 z-50 border-b bg-(--color-background)/95 backdrop-blur">
  <div className="flex h-14 items-center px-6">

// AxisRow adaptation (h-8 per UI-SPEC, no sticky):
<div className="flex h-8 items-center">
  <div className="w-40 shrink-0 px-4">  {/* RailHeader */}
  <div className="relative flex-1 grid grid-cols-7">  {/* MonthColumns */}
```

**`aria-label` on interactive elements** — AppHeader lines 71–72 shows the pattern:
```typescript
aria-label={live ? "Switch to snapshot data" : "Switch to live data"}
```
TodayMarker: `aria-label="Today"`. Clamp arrows: `aria-label="Continues before window start"`.

**No analog for TodayMarker absolute positioning** — use RESEARCH.md Pattern 1 (`todayLeftPercent`) with `style={{ left: `${pct}%` }}` on an absolutely-positioned child of MonthColumns.

---

### `src/components/timeline/InitiativeLane.tsx` (component, request-response)

**Analog:** `src/pages/OverviewPage.tsx` + `src/pages/TimelinePage.tsx`

**Props + data iteration** — OverviewPage lines 12–14 shows `data.initiatives.length` and `data.projects.map(...)`:
```typescript
// OverviewPage pattern (lines 4–7 + 12–14):
export function OverviewPage() {
  const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;
  if (!loaderData) return null;
  const { data } = loaderData;
  // ...
  {data.projects.map((project) => (
    <li key={project.id} className="text-sm">
```

InitiativeLane receives `initiative` + `projects` as props (not loader data directly) — the `key={project.id}` pattern still applies.

**LaneHeader color swatch** — no analog exists in the codebase. Use inline `style={{ backgroundColor: color }}` on an 8×8px circle `div` per UI-SPEC.

**Flex body with fixed + flex-1 columns** — AppHeader lines 63–64 (`ml-auto flex items-center gap-3`) demonstrates the flex-push-right pattern. Adapt for `shrink-0 w-40` (ParkingRail) + `flex-1` (ScheduledGrid).

---

### `src/components/timeline/UndatedPill.tsx` (component, request-response)

**Analog:** `src/components/ui/button.tsx`

**Standalone component with inline style for color** — button.tsx lines 43–56 show the props → className → render pattern:
```typescript
// button.tsx lines 43–48 (adapted — no CVA needed for pill, color is dynamic):
function UndatedPill({
  project,
  color,
  className,
  ...props
}: { project: Project; color: string; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
```

**`cn()` import** — button.tsx line 3:
```typescript
import { cn } from "@/lib/utils"
```

**Inline color style for initiative tinting** — no CVA variant can encode runtime hex colors. Use inline style:
```typescript
style={{
  borderColor: color,
  backgroundColor: `${color}14`,  // 8% opacity ≈ hex 14
  color: color,
}}
className={cn("h-7 truncate rounded-[0.875rem] border border-dashed px-2 text-xs", className)}
```

**D-08 hover/tap trigger wrapping** — UndatedPill wraps itself in HoverCard or Popover depending on `isTouch`. The `React.useState(false)` + `React.useEffect` mount pattern comes from RESEARCH.md Pattern 3 (no codebase analog for this — use as specified).

---

### `src/components/timeline/ScheduledBar.tsx` (component, request-response)

**Analog:** `src/components/ui/button.tsx` (component props pattern) + RESEARCH.md Pattern 1 (positioning math)

**Absolute positioning pattern** — no existing positioned element in the codebase. Use:
```typescript
style={{
  left: `${position.left}%`,
  width: position.noStartDate ? "64px" : `${position.width}%`,
  // D-07: when startDate is null, use right-aligned 64px bar:
  // right: `${100 - position.rightPct}%`, width: "64px"
}}
className="absolute h-7 rounded overflow-hidden"
```

**ChevronLeft / ChevronRight import** — lucide-react (installed at v1.21.0 per package.json, consistent with RESEARCH.md):
```typescript
import { ChevronLeft, ChevronRight } from "lucide-react";
```
No existing icon usage in the codebase to reference — this is a first use of lucide-react.

**D-03 clamped-bar stub** — 32px minimum `style={{ width: "32px" }}` when entirely outside window, plus arrow indicator with `aria-label="Continues before window start"`.

**Color + text contrast** — use `colorUtils.luminanceFor(color)` to choose white vs `#1a1a1a` text. Apply bar fill as `style={{ backgroundColor: `${color}cc` }}` (80% opacity ≈ hex CC in light mode; `${color}b3` ≈ 70% for dark mode via CSS custom variant).

---

### `src/components/timeline/MilestoneMarker.tsx` (component, request-response)

**Analog:** `src/components/ui/button.tsx` (minimal standalone element pattern)

**Diamond shape** — CSS only, no analog in codebase:
```typescript
// 10×10px diamond via rotate(45deg) on an 8×8px square:
<div
  title={`${milestone.name} — ${milestone.targetDate}`}
  style={{ backgroundColor: color, left: `${position}%` }}
  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2 w-2 rotate-45 ring-2 ring-white"
/>
```

**Cluster collapse badge** — when two or more milestones within 12px, render a count badge `text-xs/semibold`. Use `badge.tsx` (scaffolded) for the count indicator.

**`title` attribute for accessibility** — established by the UI-SPEC; no codebase analog. Use native HTML `title` as specified.

---

### `src/components/timeline/ProjectPopoverContent.tsx` (component, request-response)

**Analog:** `src/pages/OverviewPage.tsx` (renders project fields) + `src/pages/TimelinePage.tsx` (scheduled/undated field access)

**Project field access pattern** — OverviewPage lines 16–23:
```typescript
{data.projects.map((project) => (
  <li key={project.id} className="text-sm">
    <span className="font-medium">{project.name}</span>
    {" — "}
    <span className="text-(--color-muted-foreground)">{project.status}</span>
  </li>
))}
```

**Field types to access** (`Project` from `src/lib/roadmap/schema.ts`):
- `project.name` — string
- `project.summary` — string | null
- `project.url` — string | null | undefined (added by D-13)
- `project.status` — string
- `project.priority` — number (0=Urgent, 1=High, 2=Medium, 3=Low)
- `project.startDate` — string | null
- `project.targetDate` — string | null
- `project.milestones` — `{ id, name, targetDate: string | null }[]`
- `project.issueCounts` — `{ backlog, started, done: number }`

**Security: Linear link** — always `target="_blank" rel="noopener noreferrer"`. Conditional render:
```typescript
{project.url?.startsWith("https://linear.app/") && (
  <a href={project.url} target="_blank" rel="noopener noreferrer"
     className="text-xs font-semibold text-(--color-primary)">
    Open in Linear ↗
  </a>
)}
```
The `startsWith("https://linear.app/")` guard is defense-in-depth per RESEARCH.md security domain.

**`badge.tsx` usage** — for status + priority chips (scaffolded `Badge` component, `outline` variant):
```typescript
import { Badge } from "@/components/ui/badge";
<Badge variant="outline">{priorityLabel(project.priority)}</Badge>
```

---

### `src/components/ui/hover-card.tsx` (component — shadcn scaffold)

**Analog:** `src/components/ui/button.tsx` (the only existing shadcn component)

This file is produced by `npx shadcn add hover-card`. Do NOT write it by hand. The scaffolded file will match the button.tsx style exactly:

**Import style from `button.tsx` lines 1–4:**
```typescript
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
```
Expect: `import { PreviewCard } from "@base-ui/react/preview-card"` + `cn` + possible CVA. Verify after scaffold.

**`cn()` wrapper pattern from `button.tsx` lines 50–55:**
```typescript
<ButtonPrimitive
  data-slot="button"
  className={cn(buttonVariants({ variant, size, className }))}
  {...props}
/>
```
HoverCard will follow the same `data-slot` + `cn(...)` + `{...props}` pattern.

**After scaffolding:** Verify imports do NOT reference `@radix-ui/*`. If they do, the wrong style was fetched — re-run with `--style base-nova`.

---

### `src/components/ui/popover.tsx` (component — shadcn scaffold)

**Analog:** `src/components/ui/button.tsx`

Same scaffolding approach as hover-card.tsx above. Will use `@base-ui/react/popover`. Verify after `npx shadcn add popover`.

---

### `src/components/ui/badge.tsx` (component — shadcn scaffold)

**Analog:** `src/components/ui/button.tsx`

**CVA variants pattern from `button.tsx` lines 6–41** — Badge will have `variant` (default / secondary / destructive / outline) and possibly `size`. Expect the same `cva(...)` structure:
```typescript
const badgeVariants = cva(
  "...", // base classes
  {
    variants: {
      variant: {
        default: "...",
        secondary: "...",
        destructive: "...",
        outline: "border border-(--color-border) text-(--color-foreground)",
      },
    },
    defaultVariants: { variant: "default" },
  }
)
```
ProjectPopoverContent uses `variant="outline"` for status/priority badges.

---

### `src/lib/timeline/dateUtils.ts` (utility, transform)

**Analog:** `src/lib/utils.ts` (pure utility module with named exports)

**Module structure from `src/lib/utils.ts` lines 1–6:**
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
dateUtils.ts has no imports (pure date math, no external deps per RESEARCH.md anti-patterns). Same named-export pattern.

**Full implementations** — copy from RESEARCH.md Pattern 1 and Code Examples sections:
```typescript
// All 5 functions to export:
export function getWindow(now?: Date): { windowStart: Date; windowEnd: Date; windowDays: number }
export function daysBetween(a: Date, b: Date): number
export function barPosition(startDate: string | null, targetDate: string, window: {...}): {...}
export function getMonthColumns(windowStart: Date): Array<{ label: string; date: Date }>
export function todayLeftPercent(now: Date, windowStart: Date, windowDays: number): number
```
See RESEARCH.md §"Pattern 1: Date Math" and §"Code Examples" for the complete bodies.

**No external date library** — per RESEARCH.md anti-patterns section. Use only `Date` constructor and arithmetic.

---

### `src/lib/timeline/colorUtils.ts` (utility, transform)

**Analog:** `src/lib/utils.ts`

**Module structure** — same named-export pattern, no imports needed (pure).

**Full implementations** — copy from RESEARCH.md Pattern 2 and UI-SPEC §"Initiative Color Ramp":
```typescript
const FALLBACK_PALETTE = ["#10b981", "#6366f1", "#14b8a6", "#ec4899", "#f97316"];

export function resolveInitiativeColor(
  initiative: { id: string; color: string | null },
  allInitiatives: Array<{ id: string; color: string | null }>
): string {
  if (initiative.color) return initiative.color;
  const sortedNullIds = allInitiatives
    .filter((i) => !i.color)
    .map((i) => i.id)
    .sort();
  const idx = sortedNullIds.indexOf(initiative.id);
  return FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

// Bar text contrast (UI-SPEC §"Bar and Pill Surface Colors"):
export function luminanceFor(hex: string): number {
  // Parse hex → relative luminance (simplified — sufficient for the 5 known initiative colors)
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // sRGB approximation
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Usage: luminanceFor(color) < 0.4 ? "#ffffff" : "#1a1a1a"
```

---

### `src/lib/timeline/dateUtils.test.ts` (test, transform)

**Analog:** `scripts/linear/transform.test.ts`

**Test file structure from `transform.test.ts` lines 1–6:**
```typescript
import { describe, it, expect } from "vitest";
import { buildSnapshot, assertNoLeak, type RawWorkspace } from "./transform.ts";
import { RoadmapJsonSchema } from "../../src/lib/roadmap/schema.ts";
```
Adaptation for dateUtils:
```typescript
import { describe, it, expect } from "vitest";
import { getWindow, daysBetween, barPosition, getMonthColumns, todayLeftPercent } from "./dateUtils.ts";
```

**`describe` / `it` / `expect` pattern from `transform.test.ts` lines 7–21:**
```typescript
describe("assertNoLeak", () => {
  it("throws on lin_api_ token pattern", () => {
    expect(() =>
      assertNoLeak('{"name":"lin_api_DEADBEEF1234567890abcdef"}')
    ).toThrow();
  });
  it("does not throw on clean text", () => {
    expect(() => assertNoLeak('{"name":"AgenticApps Roadmap"}')).not.toThrow();
  });
});
```

**Tests to cover per RESEARCH.md §"Wave 0 Gaps":**
- `getMonthColumns` → 7 columns from July 2026 → `["Jul 2026", ..., "Jan 2027"]`
- `barPosition` → normal bar (left %, width %)
- `barPosition` → D-03 clamp left (starts-before → clampedLeft: true)
- `barPosition` → D-03 clamp both (entirely-before-window → 32px stub case)
- `barPosition` → D-07 no startDate → `width: 0` returned (caller handles 64px)
- `todayLeftPercent` → July 1 → 0%

**Inline fixture approach** — `transform.test.ts` lines 82–106 shows inline `RawWorkspace` literals directly in `it()` bodies. Use same approach (no separate fixture file needed for pure date functions).

---

### `src/lib/timeline/colorUtils.test.ts` (test, transform)

**Analog:** `scripts/linear/transform.test.ts` (same structure as dateUtils.test.ts)

**Imports:**
```typescript
import { describe, it, expect } from "vitest";
import { resolveInitiativeColor, luminanceFor } from "./colorUtils.ts";
```

**Tests to cover per RESEARCH.md §"Wave 0 Gaps":**
- `resolveInitiativeColor` — returns `initiative.color` when non-null
- `resolveInitiativeColor` — returns `FALLBACK_PALETTE[0]` for first lexicographic null-color initiative
- `resolveInitiativeColor` — returns `FALLBACK_PALETTE[1]` for second null-color initiative
- `resolveInitiativeColor` — stable across renders (same input → same output)
- `luminanceFor("#f2c94c")` — yellow → high luminance → `"#1a1a1a"` text
- `luminanceFor("#5e6ad2")` — purple → low luminance → `"#ffffff"` text

**Inline fixture data** — no external fixtures needed (all inputs are small hex strings and id arrays).

---

## Surgical Edits — Self-Analog Files

### `scripts/linear/query.ts` (edit — add `url` to MAIN_QUERY)

**Current structure** (lines 22–58) — add `url` after `description` in the projects node:
```graphql
# Current (lines 37–40):
        projects(first: 50) {
          nodes {
            id
            name
            description
            # ← ADD HERE:
            url
            initiatives(first: 3) {
```

**No other change.** One-line addition. The file's comment header explains the two-query strategy — do not alter that.

---

### `scripts/linear/map.ts` (edit — add `url` to GqlProject + mapWorkspace)

**Current `GqlProject` interface** (lines 32–45) — add `url: string` after `description`:
```typescript
// Current (lines 33–35):
interface GqlProject {
  id: string;
  name: string;
  description: string | null;
  // ← ADD: url: string;
  initiatives: { nodes: { id: string }[] };
```

**Current `mapWorkspace` return** (lines 81–92) — add `url: proj.url` after `description`:
```typescript
// Current (lines 81–92):
    projects: projects.nodes.map((proj) => ({
      id: proj.id,
      name: proj.name,
      description: proj.description,
      // ← ADD: url: proj.url,
      initiativeId: proj.initiatives.nodes[0]?.id ?? null,
```

**Critical invariant** (enforced by map.ts comment header line 1–5): The mapping is an **explicit allow-list** — no spreading. Add `url: proj.url` explicitly; never use `...proj`.

---

### `scripts/linear/transform.ts` (edit — add `url` to RawProject + buildSnapshot)

**Current `RawProject` interface** (lines 18–29) — add `url` after `description`:
```typescript
// Current (lines 18–23):
interface RawProject {
  id: string;
  name: string;
  description: string | null;
  // ← ADD: url?: string | null;   (optional to avoid breaking existing fixture data)
  initiativeId: string | null;
```

**Use `url?: string | null`** (optional) so existing `rawClean` and inline fixtures in transform.test.ts remain TypeScript-valid without modification (Pitfall 2 from RESEARCH.md).

**Current `buildSnapshot` return** (lines 135–146) — add `url: proj.url ?? null`:
```typescript
// Current (lines 135–146):
    return {
      id: proj.id,
      name: proj.name,
      summary: proj.description,
      // ← ADD: url: proj.url ?? null,
      initiativeId: proj.initiativeId,
      status: proj.state.name,
```

---

### `src/lib/roadmap/schema.ts` (edit — add `url` to ProjectSchema)

**Current `ProjectSchema`** (lines 15–26) — add `url` after `summary`:
```typescript
// Current (lines 15–26):
const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string().nullable(),
  // ← ADD: url: z.string().nullish(),
  initiativeId: z.string().nullable(),
```

**Use `.nullish()`** (not `.nullable()` or `.string()`) — Zod v4 shorthand for `z.string().optional().nullable()`. This is backward-compatible with the current `public/roadmap.json` that has no `url` field (Pitfall 1 from RESEARCH.md). The project uses Zod v4.4.3 where `.nullish()` is available.

**`Project` type** (line 43) is auto-derived via `z.infer<typeof ProjectSchema>` — no change needed there.

---

### `src/lib/roadmap/loader.test.ts` (edit — add `url` to validSnapshot fixture)

**Current `validSnapshot` fixture** (lines 16–35) — add `url` to the project object:
```typescript
// Current (lines 22–33):
    {
      id: "proj-001",
      name: "AgenticApps Roadmap",
      summary: "The roadmap app",
      initiativeId: "ini-001",
      status: "started",
      priority: 1,
      startDate: "2026-06-22",
      targetDate: "2026-08-17",
      milestones: [{ id: "ms-001", name: "Phase 1", targetDate: "2026-06-30" }],
      issueCounts: { backlog: 1, started: 1, done: 1 },
      // ← ADD: url: "https://linear.app/agenticapps/project/test-proj-001",
    },
```

**Why:** If `url: z.string().nullish()` tolerates absence, this edit may be optional — but adding it keeps the fixture representative of the post-D-13 shape and prevents future type errors if `url` is later tightened to non-nullable.

---

### `scripts/linear/__fixtures__/raw-clean.ts` (edit — add `url` to projects)

**Current projects** (lines 28–83) — add `url` to each project object:
```typescript
// proj-001 (line 28):
    {
      id: "proj-001",
      name: "AgenticApps Roadmap",
      description: "The roadmap web app",
      // ← ADD: url: "https://linear.app/agenticapps/project/agentic-apps-roadmap",
      initiativeId: "ini-age-001",
```
Repeat for proj-002 and proj-003 with realistic-looking URLs. These are test-only; the exact slug doesn't matter, only that the string matches `https://linear.app/...`.

---

## Shared Patterns

### Data Access (all timeline components)

**Source:** `src/pages/TimelinePage.tsx` lines 1–7 / `src/pages/OverviewPage.tsx` lines 1–7

Apply to: `TimelinePage.tsx` (page-level), all sub-components receive data as **props** (not via `useRouteLoaderData`). Only the top-level page calls the loader hook.

```typescript
// Top-level page only:
import { useRouteLoaderData } from "react-router-dom";
import type { RoadmapLoaderData } from "@/lib/roadmap/loader";

const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;
if (!loaderData) return null;
const { data } = loaderData;
```

### Tailwind v4 CSS Custom Property Token Style

**Source:** `src/components/AppHeader.tsx` throughout / `src/index.css` lines 8–64

Apply to: all new components.

```typescript
// Correct (Tailwind v4):
className="text-(--color-muted-foreground) bg-(--color-background) border-(--color-border)"

// Wrong (Tailwind v3 — do not use):
className="text-muted-foreground bg-background border-border"
```
Exception: `button.tsx` uses bare token names (e.g., `bg-primary`) because shadcn scaffolds do so — this is acceptable within scaffolded UI files only.

### `cn()` Import

**Source:** `src/components/ui/button.tsx` line 3 / `src/lib/utils.ts`

Apply to: all new component files that conditionally merge classes.

```typescript
import { cn } from "@/lib/utils"
```

### `key` Prop on Lists

**Source:** `src/pages/OverviewPage.tsx` line 15 / `src/pages/TimelinePage.tsx` lines 24, 37

Apply to: all `.map()` calls in timeline components.

```typescript
// Always use project.id or initiative.id as key:
{data.projects.map((project) => (
  <li key={project.id} ...>
```

### Error State (D-12)

**Source:** `src/components/RoadmapBoundaries.tsx` lines 1–13 + `src/components/AppHeader.tsx` lines 64–66

The loader already handles fallback to snapshot on live failure. The header shows `"live unavailable — showing snapshot"` banner (AppHeader lines 64–66). TimelinePage body error state:

```typescript
// If loaderData is unexpectedly null after the null guard:
<p className="mt-8 text-sm text-(--color-muted-foreground)">
  Could not load timeline data. Switch to Snapshot mode above.
</p>
```
Copy the `text-(--color-muted-foreground)` token from RoadmapBoundaries line 7.

### TypeScript: No `any`

**Source:** CLAUDE.md §"Always do" + all existing source files

Apply everywhere. Model types from `src/lib/roadmap/schema.ts` exports: `Initiative`, `Project`, `Milestone`, `IssueCounts`, `RoadmapJson`.

---

## No Analog Found

These patterns have no equivalent in the existing codebase. Executors must use the RESEARCH.md implementations directly.

| File / Pattern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| D-08 hover/tap trigger switching (`isTouch` state + `window.matchMedia`) | component | request-response | No interactive popover components exist yet |
| `ScheduledBar` absolute CSS positioning (left %, width %) | component | request-response | No existing absolutely-positioned UI elements |
| `MilestoneMarker` CSS diamond shape (`rotate-45`) | component | request-response | No existing shape/icon components beyond button |
| `AxisRow` month grid (`grid-cols-7`) | component | request-response | No existing CSS Grid usage in the codebase |
| `barPosition` D-07 short bar (64px fixed width, right-aligned to targetDate) | utility | transform | New; use RESEARCH.md Pitfall 4 for the `style` value |
| Cluster collapse logic in `MilestoneMarker` | component | request-response | New; count milestones within 12px using the same `barPosition` math |

For these, RESEARCH.md Patterns 1–4 are the canonical reference. Where RESEARCH.md says `[ASSUMED]` (specifically: `openDelay`/`closeDelay` prop names on `PreviewCard.Root`), verify against `@base-ui/react` TypeScript types at implementation time before committing.

---

## Metadata

**Analog search scope:** `src/` (all), `scripts/linear/` (all)
**Files read:** 18 source files
**Pattern extraction date:** 2026-07-01
