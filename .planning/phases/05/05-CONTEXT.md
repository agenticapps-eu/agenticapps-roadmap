# Phase 05: Overview dashboard, filters & drill-down - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The Overview route (`/`, the index): KPI cards + per-initiative health strip,
URL-shareable filters (initiative, time range, status, priority), and a
project drill-down that deep-links to Linear. Everything renders from the
existing `public/roadmap.json` snapshot via the root loader — snapshot-first,
zero network.

Delivers requirements **OV-01..OV-04**. This replaces the current placeholder
`OverviewPage`. The Timeline view (Phase 4) is unchanged. Live refresh is
**Phase 7** and the `.planning/`→Linear sync engine is **Phase 6** — out of
scope here except for the deliberate seam in D-01.

</domain>

<decisions>
## Implementation Decisions

### Data source & KPIs

- **D-05-01 (OV-01):** KPI cards render from the root loader snapshot:
  initiatives count, projects count, **scheduled vs undated** (scheduled =
  has `targetDate`, per Phase-4 D-06), **by-priority**, and **by-status**
  distributions. Plus a **per-initiative health strip** — one row per
  initiative summarizing its projects (scheduled/undated split + rolled-up
  issue-counts backlog/started/done). All derived from `RoadmapJson`; no new
  data fetch. Reuse `resolveInitiativeColor` (Phase-4 `colorUtils`) for
  initiative color chips.

### OV-04 "out of sync with plan" badge

- **D-05-02 (OV-04):** Build the badge **UI in Phase 5**, driven by an
  **optional** per-project field on the snapshot (e.g. `planAhead?: boolean`)
  that is **absent/false until Phase 6's `.planning/` walker populates it**.
  The badge renders only when the field is truthy — exact graceful-nullish
  pattern as Phase-4 D-13 (`project.url`). **No `.planning/` scanning logic in
  Phase 5.** Add the field to `RoadmapJsonSchema` as optional/nullish so the
  current urlless/flagless snapshot stays valid. This keeps the walker (which
  belongs to the sync CLI) out of the UI phase while letting the badge ship.

### OV-03 drill-down depth

- **D-05-03 (OV-03):** Drill-down shows the project's **issue-counts breakdown
  (backlog/started/done), its milestones list, and a guarded Linear deep-link**
  — reusing the Phase-4 04-04 guarded-link pattern (prefix-checked
  `https://linear.app/`, omit when `url` null). It does **NOT** list individual
  issues: the snapshot stores only aggregate `issueCounts`, and individual
  issues live in Linear one click away. Stays fully snapshot-first, zero
  network. (No new proxy operation; no snapshot schema growth for issues.)

### Drill-down UX & deep-linking

- **D-05-04:** Drill-down opens as a **dialog/drawer whose open state is driven
  by a `?project=<id>` URL param** — shareable, survives reload, and composes in
  the same URL as the filter params. **No new route.** Reuse the base-ui/shadcn
  dialog primitive (scaffold `dialog` via the shadcn CLI if not already
  present, following Phase-4 04-03's base-nova approach). An unknown/absent
  `?project` id renders no dialog (guarded).

### Filters

- **D-05-05 (OV-02):** Filters live on the **Overview route only**, encoded as
  **URL searchParams** so they are shareable and survive reload. Controls:
  **initiative** (multi-select), **time range** (quarter presets + custom
  range), **status**, **priority**. Filters compose (AND across dimensions).
  The **Timeline keeps its own fixed 7-month window** — no shared cross-route
  filter state (avoids coupling the two routes; that's out of scope). Use
  React Router 7 `useSearchParams` (same mechanism as Phase-4's live toggle).
  `?project=<id>` (D-05-04) and the filter params coexist in one URL.

### Rendering

- **D-05-06:** Snapshot-first, zero network — all views derive from the root
  loader's `RoadmapLoaderData.data`. Responsive + dark mode + empty/loading/
  error states required (reuse `RoadmapBoundaries`). Build KPI/health/filter/
  drill-down as testable pure selectors (filter + aggregation functions) plus
  thin presentational components, mirroring Phase-4's `src/lib/timeline` +
  `src/components/timeline` split (pure logic is unit-tested; the repo has no
  React-render harness, so component visual fidelity is human-UAT per Phase-4
  Path B).

</decisions>

<specifics>
## Particular References

- `src/lib/roadmap/schema.ts` — `RoadmapJson`/`Project`/`Initiative` shapes;
  add optional `planAhead` here (D-05-02). `issueCounts` is aggregate-only.
- `src/pages/OverviewPage.tsx` — current placeholder to replace.
- `src/router.tsx` — Overview is the index route under `id: "root"` loader.
- `src/lib/timeline/colorUtils.ts` — `resolveInitiativeColor` for color chips.
- `src/components/timeline/ProjectPopoverContent.tsx` — guarded-link + counts +
  milestones pattern to mirror in the drill-down dialog.
- `src/components/ui/badge.tsx` — status/priority chips.
- Phase-4 D-06 (scheduled = has `targetDate`) and D-13 (`project.url`) carry in.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 5 goal + success criteria.
- `.planning/REQUIREMENTS.md` — OV-01..OV-04.
- `docs/architecture.md` — snapshot-first data path, filter/URL rationale.

</canonical_refs>

<deferred>
## Noted for Later

- **Actual `planAhead` computation** (walk sibling `.planning/`, compare to
  Linear) — **Phase 6** (sync-gsd-linear CLI owns the `.planning/` walker).
- **Individual issue lists / live issue fetch** — not needed; Linear deep-link
  covers it. Revisit only if a real need appears.
- **Shared Overview↔Timeline filter state** — deferred; would couple routes.

</deferred>

## Success Criteria (from ROADMAP)

1. KPI cards + per-initiative health strip render from the data.
2. Filters compose and survive reload via URL; drill-down links resolve to Linear.
3. "Out of sync with plan" badge shows when a repo's `.planning/` is ahead of
   Linear — **UI in Phase 5, data wired in Phase 6** (D-05-02).

## Risk Summary

- **OV-04 data seam:** the badge has no live data source until Phase 6; it must
  degrade to invisible, not error. Mitigated by the optional-field pattern.
- **Filter/URL correctness:** shareable-and-survives-reload is the crux of
  OV-02 — cover the encode/decode round-trip with unit tests on pure selectors.
</context>
