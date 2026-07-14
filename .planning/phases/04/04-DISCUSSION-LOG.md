# Phase 04: Roadmap timeline UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 04-Roadmap timeline UI
**Areas discussed:** Time axis window, Undated pills home, Bar semantics, Interaction & popover, Linear link sourcing

---

## Time axis window

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed: today → +6 months | Anchor at current month, ~6 month columns; predictable, doesn't collapse when little is dated | ✓ |
| Data-driven min→max | Span earliest start → latest target; nearly empty with only 2 dated projects | |
| Scrollable / zoomable | Wide canvas with scroll/zoom; overkill for current data | |

**User's choice:** Fixed: today → +6 months.

### Follow-up: out-of-window scheduled projects

| Option | Description | Selected |
|--------|-------------|----------|
| Clamp to edge + cue | Pin bar at window edge with a "continues" arrow; never silently hides a dated project | ✓ |
| Drop to pill tray | Render off-window projects as pills; conflates undated with out-of-window | |
| Auto-extend window | Grow window to fit outliers; unpredictable axis width | |

**User's choice:** Clamp to edge + cue.

---

## Undated pills home

| Option | Description | Selected |
|--------|-------------|----------|
| Parking rail (left of axis) | Fixed column left of month grid, pills per initiative lane, always visible | ✓ |
| Separate section below | Dated bars up top, "Needs backfill" block underneath; sparse top | |
| Collapsible tray per lane | Count chip that expands; hides the majority of projects by default | |

**User's choice:** Parking rail (left of axis).
**Notes:** 14 of 16 projects are undated — the backfill need is the main signal, so it stays visible.

---

## Bar semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Span startDate→targetDate | Bar covers full duration, milestone markers along it | ✓ |
| Point at targetDate | Fixed-width chip at target month, ignores startDate | |

**User's choice:** Span startDate→targetDate.

### Follow-up: partial dates

| Option | Description | Selected |
|--------|-------------|----------|
| targetDate drives it; missing start = short bar | Scheduled = has targetDate; null start → short fixed-width bar ending at target; no target → pill | ✓ |
| Require both dates for a bar | Only start+target projects get bars; target-only → pill | |

**User's choice:** targetDate drives it; missing start = short bar. Matches current loader/TimelinePage convention.

---

## Interaction & popover

| Option | Description | Selected |
|--------|-------------|----------|
| Hover desktop, tap touch | HoverCard + Popover per device | ✓ |
| Click/tap everywhere | One model all devices; loses desktop quick-peek | |

**User's choice:** Hover desktop, tap touch.

### Follow-up: popover contents (multi-select, beyond required summary + Linear link)

| Option | Description | Selected |
|--------|-------------|----------|
| Issue counts bar | Progress bar from issueCounts | ✓ |
| Milestones list | Milestone names + targetDates | ✓ |
| Status + priority | Orienting metadata | ✓ |
| Start / target dates | Explicit schedule text | ✓ |

**User's choice:** All four enhancements included.

---

## Linear link sourcing

| Option | Description | Selected |
|--------|-------------|----------|
| Add project.url to the snapshot | Fetch Linear Project.url through query→map→schema→snapshot; authoritative | ✓ |
| Construct from workspace slug | Build URL from workspace key + project data; fragile, needs slug-id we don't store | |
| Defer link, ship popover now | UI-only this phase, add url later; misses TL-03 | |

**User's choice:** Add project.url to the snapshot.
**Notes:** Linear project URLs use a slug-id, not the raw UUID, so client-side reconstruction is unreliable. `url` is not PII and must still pass the existing leak gate. This is the one decision that reaches back into the Phase-2 data pipeline.

---

## Claude's Discretion

- Lane ordering (by initiative name vs. scheduled-project count).
- Fallback color palette + within-initiative ramp for the 2 null-color initiatives.
- Pill ordering within the rail.
- Reuse of the existing "live unavailable" loader pattern for the error state.
- Whether to add shadcn Card/Popover primitives vs. hand-rolled (only button.tsx exists today).

## Deferred Ideas

- Filters / time-range / status / priority controls — Phase 5 (OV-02).
- KPI cards + per-initiative health strip — Phase 5 (OV-01).
- Drill-down: project → milestones + issues — Phase 5 (OV-03).
- Live "Refresh from Linear" — Phase 7.
- Researcher item: confirm Linear GraphQL exposes `Project.url` and it survives the two-part fetch + leak gate (AGE workspace).
