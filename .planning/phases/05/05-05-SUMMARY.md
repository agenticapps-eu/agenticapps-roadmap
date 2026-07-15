---
phase: 05-overview-dashboard
plan: 05
subsystem: ui
tags: [react-router, url-state, base-ui, dialog, filters]

# Dependency graph
requires:
  - phase: 05-overview-dashboard (05-01/05-02/05-03)
    provides: "RoadmapJson.planAhead optional field (05-01), selectors.ts Filters/decodeFilters/encodeFilters/PRIORITY_LABELS (05-02), src/components/ui/dialog.tsx scaffold (05-03)"
provides:
  - "FilterBar: URL-encoded filter controls (initiative, status, priority, time range) delegating serialization to selectors.ts"
  - "ProjectDrillDownDialog: ?project-controlled base-ui Dialog showing issueCounts + milestones + guarded Linear link + header SyncBadge"
  - "SyncBadge: reusable OV-04 graceful-nullish badge, mounted in the dialog header here and reused by 05-06's OverviewPage project list"
affects: [05-06-overview-page-assembly]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "URL IS the state: components derive Filters via decodeFilters(searchParams) every render, no useState mirror"
    - "setSearchParams((prev) => {...; return encodeFilters(next, prev)}) mutate-and-return idiom (matches AppHeader.tsx) so co-resident params (?project, ?source) survive filter edits"
    - "?project=<id>-controlled base-ui Dialog with no Trigger; unknown/absent id resolves to null -> no dialog"

key-files:
  created:
    - src/components/overview/FilterBar.tsx
    - src/components/overview/SyncBadge.tsx
    - src/components/overview/ProjectDrillDownDialog.tsx
  modified: []

key-decisions:
  - "Quarter presets computed from current date as current + next 3 quarters (YYYY-Qn), Claude's discretion per plan"
  - "Quarter and custom from/to writes never clear each other (coexistence, 05-REVIEWS finding 3); resolveRange (05-02) already gives from/to precedence at read time"
  - "DialogContent's existing default showCloseButton (sr-only 'Close' accessible name) satisfies the visible/keyboard-accessible DialogClose requirement; no custom close button added"

patterns-established:
  - "SyncBadge as the single OV-04 render primitive: project.planAhead ? <Badge variant=\"destructive\"> : null, reused across two render surfaces (drill-down header, 05-06 project list)"

requirements-completed: [OV-02, OV-03, OV-04]

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 05 Plan 05: FilterBar, ProjectDrillDownDialog & SyncBadge Summary

**URL-driven filter controls and a ?project-controlled drill-down dialog, both delegating all searchParams encode/decode to selectors.ts, plus a reusable graceful-nullish SyncBadge mounted in the dialog header.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-15T09:58:00+02:00 (approx)
- **Completed:** 2026-07-15T10:00:11+02:00
- **Tasks:** 2
- **Files modified:** 3 (all new)

## Accomplishments
- FilterBar drives initiative/status/priority/time-range filters entirely through selectors.ts encode/decode, with quarter presets and custom from/to coexisting (no write-side mutual clearing)
- ProjectDrillDownDialog opens only for a known `?project` id, renders issueCounts + milestones + guarded Linear deep-link (no individual issues), and closes via `{ replace: true }` param deletion
- SyncBadge ships as the single reusable OV-04 render primitive, already mounted on one real surface (dialog header) ahead of 05-06's second surface

## Task Commits

Each task was committed atomically:

1. **Task 1: FilterBar — URL-encoded filter controls** - `32f884a` (feat)
2. **Task 2: SyncBadge (OV-04) + ProjectDrillDownDialog mounting it in the header** - `213c2ee` (feat)

**Plan metadata:** committed separately by the orchestrator after wave completion (worktree agent; STATE.md/ROADMAP.md not touched here per parallel-execution contract).

## Files Created/Modified
- `src/components/overview/FilterBar.tsx` - initiative/status/priority multi-selects + quarter-preset buttons + custom from/to date inputs + Clear-filters affordance, all URL-encoded via selectors.ts
- `src/components/overview/SyncBadge.tsx` - `project.planAhead ? <Badge variant="destructive">Out of sync with plan</Badge> : null`
- `src/components/overview/ProjectDrillDownDialog.tsx` - `?project`-controlled base-ui Dialog; guarded lookup, issueCounts bar, milestones list, guarded `linear.app` deep-link, header-mounted SyncBadge

## Decisions Made
- Quarter preset set chosen as current quarter + next 3 (Claude's discretion, per plan `<action>`)
- Reused DialogContent's built-in close button (sr-only "Close" label) rather than adding a second explicit DialogClose, since it already satisfies the "visible, keyboard-accessible DialogClose with accessible name" acceptance criterion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `node_modules` was missing in the worktree (expected per orchestrator note); symlinked from the main repo checkout to run `npx tsc -b --noEmit` / `npx eslint`, then removed the symlink before finishing (confirmed untracked and absent from final `git status`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `FilterBar`, `ProjectDrillDownDialog`, and `SyncBadge` are ready for 05-06's `OverviewPage` assembly to import and compose alongside KPI cards/health strip (05-04)
- No blockers. `SyncBadge` will visibly activate once Phase 6's `.planning/` walker starts populating `planAhead: true` on real projects

---
*Phase: 05-overview-dashboard*
*Completed: 2026-07-15*
