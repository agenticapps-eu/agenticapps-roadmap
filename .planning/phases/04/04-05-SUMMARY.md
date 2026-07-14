---
phase: 04-roadmap-timeline-ui
plan: 05
subsystem: timeline-in-lane-elements
tags: [react, base-ui, popover, hover-card, positioning, a11y]
requires:
  - "src/lib/timeline/dateUtils.ts (barPosition kind discriminator — 04-02)"
  - "src/lib/timeline/colorUtils.ts (luminanceFor — 04-02)"
  - "src/components/timeline/ProjectPopoverContent.tsx (04-04)"
  - "src/components/timeline/MilestoneMarker.tsx (count prop — 04-04)"
  - "src/components/ui/hover-card.tsx, popover.tsx (04-03)"
provides:
  - "src/components/timeline/UndatedPill.tsx (UndatedPill)"
  - "src/components/timeline/ScheduledBar.tsx (ScheduledBar)"
affects: []
tech-stack:
  added: []
  patterns:
    - base-ui-render-prop-composition
    - pointer-type-trigger-switch
    - css-var-plus-tailwind-opacity-for-dark-mode
    - resize-observer-pixel-clustering
key-files:
  created:
    - src/components/timeline/UndatedPill.tsx
    - src/components/timeline/ScheduledBar.tsx
  modified: []
decisions:
  - "base-ui delay props live on the Trigger as `delay`/`closeDelay` (defaults 600/300), NOT `openDelay`/`closeDelay` on Root — resolves RESEARCH A1 [ASSUMED]."
  - "base-ui composes via the `render` prop, not Radix `asChild`; the HoverCard trigger defaults to an <a>, so it is rendered as a focusable <button> to satisfy keyboard-focus + aria-label."
  - "Dark-mode bar fill (70%) is delivered via a `--bar-fill` CSS var + Tailwind `bg-(--bar-fill)/80 dark:bg-(--bar-fill)/70`, since an inline hex-alpha style cannot respond to dark mode."
  - "Text suppression <48px is applied deterministically only to the 32px stub; span/fixedEnd bars show text (per-bar px measurement of span bars deferred to the 04-06 render + human check)."
metrics:
  duration: ~20m
  completed: 2026-07-14
requirements: [TL-01, TL-02, TL-03]
---

# Phase 04 Plan 05: In-Lane Project Elements Summary

The two interactive timeline primitives: `UndatedPill` (D-04 dashed needs-backfill
pill) and `ScheduledBar` (D-05/D-06/D-07 positioned bar with D-03 clamping and D-10
milestone markers). Each wraps the shared `ProjectPopoverContent` in a pointer-typed
trigger — HoverCard on desktop, Popover on touch (D-08).

## What Was Built

- **`UndatedPill({ project, color })`** — an `h-7` dashed, initiative-colored pill
  (`borderColor: color`, `backgroundColor: ${color}14` ≈ 8%, `color`) that truncates
  the project name and opens the shared popover. On mount it reads
  `matchMedia("(pointer: coarse)")` inside `useEffect` (initialized `false` so desktop
  gets HoverCard by default — Pitfall 5) and switches trigger: desktop HoverCard
  (`delay={300}` / `closeDelay={200}`) vs touch Popover. The trigger renders a
  focusable `<button>` carrying the project name as `aria-label`; base-ui
  Escape-to-dismiss is left intact.
- **`ScheduledBar({ project, color, window })`** — computes
  `barPosition(project.startDate, project.targetDate, window)` and **branches on
  `pos.kind`** (never `width <= 0`): `span` → absolutely positioned `left%`/`width%`
  bar; `fixedEnd` (D-07 startDate-null) → 64px bar right-aligned to the targetDate
  (`right: ${100 - pos.left}%`); `stub` (D-03 entirely off-window) → 32px stub pinned to
  column 0 (clampedLeft) or the right edge (clampedRight). Renders `ChevronLeft` /
  `ChevronRight` (lucide-react, 10px, `--muted-foreground`) clamp cues with the
  contract aria-labels; bar fill via `--bar-fill` var + Tailwind opacity (80% light /
  70% dark); text color from `luminanceFor(color) < 0.4 ? white : #1a1a1a`, suppressed
  on the 32px stub. Dated milestones map to `MilestoneMarker`s positioned as a percent
  of the bar span, with 12px pixel-proximity clustering driven by a `ResizeObserver`
  callback-ref measurement. Same HoverCard/Popover trigger + `aria-label` as the pill.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | UndatedPill (dashed pill + hover/tap trigger) | c0a0814 | src/components/timeline/UndatedPill.tsx |
| 2 | ScheduledBar (positioned, clamped, markers, trigger) | 51edeee | src/components/timeline/ScheduledBar.tsx |

## Verification Evidence

**Typecheck** — `npx tsc -b --noEmit` → exit 0 after each task. The base-ui delay
(`delay`/`closeDelay`) and `render` props compile without a "Property does not exist"
error (see divergence below).

**Full test suite** — `CI=true npx vitest run`:
```
 Test Files  5 passed (5)
      Tests  63 passed (63)
```
No test files added (interactive components; visual/interaction fidelity is verified
end-to-end in 04-06 per the plan). Pre-existing 63 tests remain green.

**Lint** — `npx eslint` on both touched files → exit 0 (clean).

**Acceptance greps** — UndatedPill: `border-dashed`=1, `matchMedia("(pointer:
coarse)")`=1, `useEffect`=1. ScheduledBar: `barPosition`=3, `.kind`=5,
`fixedEnd|stub|span`=13, `ChevronLeft|ChevronRight`=3, `from "lucide-react"`=1,
`64px`=2, `Continues before window start`=1, `MilestoneMarker`=2,
`ProjectPopoverContent`=2.

## Deviations from Plan

### Documented Divergence (required by Task 1 acceptance — RESEARCH A1)

**base-ui delay prop names differ from the RESEARCH `[ASSUMED]` `openDelay`/`closeDelay` on Root.**
Verified against `@base-ui/react/preview-card/root/PreviewCardRoot.d.ts` and
`.../trigger/PreviewCardTrigger.d.ts`: `PreviewCardRoot.Props` exposes **no** delay
props. The open/close delays live on the **Trigger** as `delay` (default 600) and
`closeDelay` (default 300). Both files therefore pass `delay={300}` / `closeDelay={200}`
to `HoverCardTrigger` (which spreads to `PreviewCardPrimitive.Trigger`). This compiles
cleanly and satisfies the D-08 300ms/200ms contract.

### Auto-fixed Issues

**1. [Rule 1 - Bug] `window` prop shadowed the global `window` in the touch-detection effect**
- **Found during:** Task 2 authoring. `ScheduledBar` takes a `window: TimelineWindow`
  prop (plan interface), which shadows the global `window`, so
  `window.matchMedia(...)` would reference the timeline window, not the browser API.
- **Fix:** Reach the browser API via `globalThis.matchMedia("(pointer: coarse)")`.
  Caught and corrected before the Task 2 commit; final code typechecks and lints clean.
- **Files modified:** src/components/timeline/ScheduledBar.tsx
- **Commit:** 51edeee

### Implementation Notes (within plan intent)

- **base-ui composes via `render`, not Radix `asChild`.** The plan text used Radix
  `asChild` terminology; base-ui's equivalent is the `render` prop. The HoverCard
  trigger defaults to an `<a>` (not tab-focusable without `href`), so it is rendered as
  `render={<button type="button" />}` to guarantee keyboard focus. The Popover trigger
  already defaults to a `<button>`. Refs use a single `HTMLElement` callback ref
  (assignable to both the button and anchor trigger element types) which also owns the
  clustering `ResizeObserver`.
- **Dark-mode bar fill** is delivered via a `--bar-fill` CSS var + Tailwind
  `bg-(--bar-fill)/80 dark:bg-(--bar-fill)/70` (the `bg-(--var)/opacity` form is already
  used in `AppHeader.tsx`), because an inline hex-alpha `backgroundColor` cannot switch
  on dark mode. This honors the UI-SPEC 80% light / 70% dark contract in one class.
- **Popover/HoverCard content sizing** — both branches pass `className="w-auto p-0"` so
  the scaffolded wrapper padding/width yields to `ProjectPopoverContent`'s own
  `w-[260px]/sm:w-[280px]` + `p-4` (D-09 width contract).

No architectural changes; no authentication gates encountered.

## Known Stubs

None. Both components are complete interactive primitives. They are unrendered until
`InitiativeLane` (04-06) places them — the planned interface-first sequencing, not a
stub. Milestone-cluster px measurement returns 0 on first paint (pre-ResizeObserver),
during which markers render individually; this self-corrects on the first measured
frame and is not a stub.

## Self-Check: PASSED

- FOUND: src/components/timeline/UndatedPill.tsx
- FOUND: src/components/timeline/ScheduledBar.tsx
- FOUND commit: c0a0814
- FOUND commit: 51edeee
