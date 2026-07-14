---
phase: 04-roadmap-timeline-ui
plan: 04
subsystem: timeline-popover-leaves
tags: [react, presentational, popover, milestone, security-guard]
requires:
  - "src/lib/roadmap/schema.ts (Project type; url added by 04-01)"
  - "src/components/ui/badge.tsx (04-03)"
provides:
  - "src/components/timeline/ProjectPopoverContent.tsx (ProjectPopoverContent)"
  - "src/components/timeline/MilestoneMarker.tsx (MilestoneMarker)"
affects: []
tech-stack:
  added: []
  patterns: [presentational-props-in-render-out, tailwind-v4-css-var-tokens, guarded-external-anchor]
key-files:
  created:
    - src/components/timeline/ProjectPopoverContent.tsx
    - src/components/timeline/MilestoneMarker.tsx
  modified: []
decisions:
  - "Linear footer anchor is prefix-guarded on https://linear.app/ AND carries rel=noopener noreferrer — defense-in-depth even though the pipeline is assertNoLeak-cleared."
  - "MilestoneMarker takes an optional count prop (caller-driven clustering) rather than owning cluster detection, keeping it a pure leaf and leaving 12px proximity math to 04-05."
metrics:
  duration: ~8m
  completed: 2026-07-14
requirements: [TL-03]
---

# Phase 04 Plan 04: Popover Leaf Components Summary

Two presentational leaves for the timeline: `ProjectPopoverContent` (the shared D-09
popover body) and `MilestoneMarker` (the D-10 on-bar diamond). Both are props-in →
render-out with no data fetching, ready for 04-05 to wrap in HoverCard/Popover triggers.

## What Was Built

- **`ProjectPopoverContent({ project, color })`** — renders the full D-09 tree: header
  (truncated name + status/priority outline Badges, priority mapped 0=Urgent/1=High/
  2=Medium/3=Low/other="—"); date row (`Start`/`Target`, `—` fallback); a segmented
  issue-counts bar (backlog `bg-(--color-muted)`, started `bg-sky-500`, done
  `bg-emerald-500`) that is divide-by-zero-safe (renders a single full-width muted bar
  when `total === 0`, never `count/0`); the "N backlog · N started · N done" count row;
  a milestones list (max 5, `◆` in initiative color); a 3-line-clamped muted summary
  when present; and a footer Linear anchor rendered **only** when
  `project.url?.startsWith("https://linear.app/")`, with `target="_blank"
  rel="noopener noreferrer"`. Width `260px` mobile / `280px` desktop,
  `max-h-[420px] overflow-y-auto`. Tailwind v4 CSS custom-property tokens throughout
  (no v3 bare token classes).
- **`MilestoneMarker({ milestone, color, leftPercent, count? })`** — a 10×10 diamond
  (8×8 `rotate-45` square, fill = initiative color, 2px white ring), absolutely
  positioned at `leftPercent` and vertically centered. Native `title` tooltip
  `{name} — {targetDate}`. Returns `null` when `targetDate` is null (D-10 omit). Optional
  `count` prop: when `>= 2`, collapses to a single stacked indicator with an outline
  count Badge (`text-xs` semibold) — the caller (04-05) supplies the cluster count from
  its 12px proximity check.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ProjectPopoverContent (D-09 body + guarded Linear link) | 46c2d20 | src/components/timeline/ProjectPopoverContent.tsx |
| 2 | MilestoneMarker (diamond + cluster badge) | 512a465 | src/components/timeline/MilestoneMarker.tsx |

## Verification Evidence

**Typecheck** — `npx tsc -b --noEmit` → exit 0 (no output) after each task.

**Full test suite** — `CI=true npx vitest run`:
```
 Test Files  5 passed (5)
      Tests  63 passed (63)
```
No test files added this plan (presentational leaves; visual fidelity is verified
end-to-end in 04-06). Pre-existing 63 tests remain green.

**Lint** — `npx eslint` on both touched files → exit 0 (clean).

**Acceptance greps** — ProjectPopoverContent: `noopener noreferrer` = 1,
`startsWith("https://linear.app/")` = 1, `target="_blank"` = 1, bare v3
`text-muted-foreground\b` = 0, imports `Badge` and renders status + priority chips,
all-zero issue-counts guarded on `total === 0` before any division. MilestoneMarker:
`rotate-45` = 1, `title=` = 2, returns `null` when `milestone.targetDate` is null.

## Deviations from Plan

None — plan executed as written. The `Badge` import path resolves via the `@/`
alias; `variant="outline"` matches the scaffolded badge.tsx variant set.

## Known Stubs

None. Both components are complete presentational leaves. They are unrendered until
04-05 wires them into bar/pill triggers — that is the planned interface-first
sequencing, not a stub. The snapshot's current `url: null` values are the reason the
footer link is guarded; 04-07 will regenerate the snapshot with real URLs and the
guard will then admit the anchor.

## Self-Check: PASSED

- FOUND: src/components/timeline/ProjectPopoverContent.tsx
- FOUND: src/components/timeline/MilestoneMarker.tsx
- FOUND commit: 46c2d20
- FOUND commit: 512a465
