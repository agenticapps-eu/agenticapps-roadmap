# Phase 04: Roadmap timeline UI - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The hero Timeline view: initiative swimlanes across a month axis. Scheduled
projects render as bars, undated projects as dashed "needs-backfill" pills,
milestones as markers with a popover, colored by initiative, responsive, dark
mode, with empty/loading/error states.

Delivers requirements **TL-01..TL-04**. This is a UI phase over the existing
`public/roadmap.json` snapshot — with one deliberate reach back into the
Phase-2 data pipeline (see D-13). Filters, KPIs, and drill-down are **Phase 5**;
live refresh is **Phase 7** — out of scope here.

</domain>

<decisions>
## Implementation Decisions

### Time axis
- **D-01:** Fixed window — **current month → +6 months**, one column per month.
  Chosen over data-driven (nearly empty with only 2 dated projects) and
  scrollable/zoomable (overkill for current data). Predictable and stable.
- **D-02:** Render a **"today" marker line** on the axis.
- **D-03:** A scheduled project whose dates fall **outside** the window is
  **clamped to the window edge with a "continues" cue** (small arrow/indicator).
  Never silently hidden, never demoted to a pill.

### Undated "needs-backfill" pills
- **D-04:** Undated projects live in a **parking rail on the LEFT of the month
  grid**, grouped per initiative lane. Each lane reads `[undated pills | scheduled bars]`.
  Always visible — the backfill need is the main signal (14 of 16 projects are
  currently undated). Chosen over a separate section below and over a
  collapsible per-lane tray (which would hide the majority of projects).

### Bar semantics
- **D-05:** A scheduled bar **spans startDate → targetDate** (a duration), with
  milestone markers positioned along it. Chosen over a deadline-only point marker.
- **D-06:** "Scheduled" = **has a `targetDate`** (keeps the existing
  `loader.ts` / `TimelinePage.tsx` convention). A project with **no `targetDate`
  is a pill**, regardless of `startDate`.
- **D-07:** If a scheduled project has a `targetDate` but **no `startDate`**, draw
  a **short fixed-width bar ending at the targetDate**.

### Interaction & popover
- **D-08:** Popover trigger is **hover on desktop / tap on touch** (Radix/shadcn
  HoverCard + Popover). Responsive is a hard requirement; hover doesn't exist on touch.
- **D-09:** Popover contents: **project summary + Linear link** (required by
  TL-03) **plus** an **issue-counts bar** (backlog/started/done), a **milestones
  list** (name + targetDate), **status + priority**, and **explicit start/target
  dates**. User asked for all four enhancements.
- **D-10:** Milestone markers appear on the bar (TL-03); the popover milestone
  list reinforces them.

### Color & layout (from TL-04)
- **D-11:** Color-by-initiative ramp. **2 of 5 initiatives have `null` color** —
  assign those a fallback from a deterministic palette (stable per initiative id).
- **D-12:** Responsive + dark mode required; empty/loading/error states required.

### Linear link sourcing (reaches into Phase-2 pipeline)
- **D-13:** Add **`project.url`** to the Linear data pipeline: fetch Linear's
  `Project.url` in `MAIN_QUERY`, carry it through `map.ts` and `schema.ts` into
  `public/roadmap.json`, then re-run the snapshot. Linear project URLs use a
  slug-id (not the raw UUID), so they **cannot be reliably reconstructed
  client-side** — the authoritative URL must come from the API. `url` is **not
  PII** and is sanitization-safe (must still pass the existing leak gate).

### Claude's Discretion
- Lane ordering (by initiative name vs. by scheduled-project count) — pick a
  sensible default; document it.
- Exact fallback color palette and the within-initiative ramp treatment (D-11).
- Pill ordering within the rail (e.g., by priority then name).
- Reuse the existing "live unavailable" loader pattern for the error state (D-12).
- Whether to introduce a shadcn Card/Popover primitive vs. hand-rolled — only
  `button.tsx` exists in `ui/` today.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 4: Roadmap timeline UI" — goal + success criteria.
- `.planning/REQUIREMENTS.md` §"Timeline UI (Phase 4)" — TL-01..TL-04.
- `.planning/phases/04/PLAN.md` — reconstructed one-paragraph brief (superseded
  by the plan `/gsd:plan-phase 04` produces; use for intent only).

### Data shape & pipeline (needed for D-13 and rendering)
- `src/lib/roadmap/schema.ts` — Zod `RoadmapJson`/`Project`/`Initiative`/`Milestone`
  types; where `url` must be added for the Linear link.
- `src/lib/roadmap/loader.ts` — Router loader; snapshot-default + `?source=live`
  fallback + "live unavailable" notice (reuse for error state).
- `src/pages/TimelinePage.tsx` — current placeholder list; establishes the
  `targetDate !== null` = scheduled convention.
- `scripts/linear/query.ts` (`MAIN_QUERY`) — add `Project.url` field here.
- `scripts/linear/map.ts` — GQL→RawWorkspace mapping; thread `url` through.
- `scripts/linear/transform.ts` — sanitization / `assertNoLeak` leak gate; `url`
  must pass it.
- `public/roadmap.json` — the live snapshot the UI renders from.

### Architecture
- `docs/architecture.md` — snapshot-default data path, Cloudflare Pages, hybrid
  pattern C rationale.

**Note:** The brief references a concept doc `Documents/.../roadmap-app-proposals.md`
("matches the approved concept") — **not present in the repo**. If it exists on
the user's machine, it should guide visual direction; otherwise proceed from the
decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/roadmap/loader.ts` — typed loader with snapshot/live handling and a
  "live unavailable" notice; reuse for Timeline's loading/error states.
- `src/components/ui/button.tsx` — the only shadcn primitive present. Popover /
  HoverCard / Card are NOT installed yet — expect to add them.
- `src/components/AppHeader.tsx` — has the Snapshot/Live source toggle; Timeline
  reads the same `RoadmapLoaderData`.

### Established Patterns
- Data is read via `useRouteLoaderData("root")` returning `RoadmapLoaderData`
  (`{ data: RoadmapJson, ... }`). Timeline consumes `data.projects` +
  `data.initiatives`.
- "Scheduled" projects are those with `targetDate !== null` (per current
  `TimelinePage.tsx`) — D-06 keeps this.
- Strict TypeScript, no `any`; Tailwind v4 with CSS custom-property color tokens
  (e.g., `text-(--color-muted-foreground)`); dark mode expected.

### Integration Points
- `project.url` (new) flows `scripts/linear/query.ts` → `map.ts` → `schema.ts`
  → `roadmap.json` → loader → Timeline popover.
- Data facts (current snapshot): 5 initiatives (colors:
  `#0ea5e9, null, #f2994a, #5e6ad2, #f2c94c`), 16 projects, **2 scheduled**
  (both have start+target), **14 undated**. Milestones carry `name` + `targetDate`.

</code_context>

<specifics>
## Specific Ideas

- The timeline should read left-to-right as **unscheduled → scheduled** (parking
  rail on the left, month axis to its right).
- Undated projects are framed as a **"needs-backfill"** call-to-action, not an
  afterthought — they're the majority and the point of the sync workflow.

</specifics>

<deferred>
## Deferred Ideas

- **Filters / time-range / status / priority controls** — Phase 5 (OV-02).
- **KPI cards + per-initiative health strip** — Phase 5 (OV-01).
- **Drill-down: project → milestones + issues** — Phase 5 (OV-03).
- **Live "Refresh from Linear"** interactions — Phase 7.
- **Researcher item (not a user decision):** confirm Linear GraphQL exposes
  `Project.url` and it survives the two-part MAIN/ISSUES fetch + leak gate; note
  the workspace is the AGE workspace.

</deferred>

---

*Phase: 04-Roadmap timeline UI*
*Context gathered: 2026-07-01*
