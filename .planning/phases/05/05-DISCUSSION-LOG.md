# Phase 05 Discussion Log

**Date:** 2026-07-14 · Mode: discuss (default)

Human-reference audit trail. Not consumed by downstream agents (see CONTEXT.md
for the canonical decisions).

## Areas discussed (all 4 selected)

### OV-04 "out of sync with plan" badge
- **Options:** (a) build UI now, data in Phase 6 via optional field; (b) compute
  in CI snapshot build now; (c) defer OV-04 entirely to Phase 6.
- **Chosen:** (a) — build the badge UI, drive it from an optional `planAhead`
  field absent until Phase 6's `.planning/` walker populates it. Mirrors the
  Phase-4 D-13 graceful-nullish pattern; keeps the walker out of the UI phase.
- **Why:** the static snapshot app has no runtime FS access to sibling repos;
  the walker rightfully belongs to the Phase-6 sync CLI.

### OV-03 drill-down depth
- **Options:** (a) counts + milestones + Linear link; (b) live-fetch issues via
  proxy; (c) extend snapshot to carry issues.
- **Chosen:** (a). The snapshot stores only aggregate `issueCounts`; individual
  issues stay in Linear one deep-link away. Zero network, no schema growth.

### Drill-down UX + URL
- **Options:** (a) dialog via `?project=<id>`; (b) dedicated `/project/:id`
  route; (c) inline expand.
- **Chosen:** (a) — dialog/drawer whose open state is a `?project=<id>` URL
  param. Shareable, reload-safe, composes with filter params, no new route,
  reuses base-ui primitives.

### Filter scope & encoding
- **Options:** (a) Overview only, URL searchParams; (b) shared Overview+Timeline.
- **Chosen:** (a). Filters (initiative, time range, status, priority) on Overview
  as URL searchParams. Timeline keeps its fixed window — no cross-route coupling.
