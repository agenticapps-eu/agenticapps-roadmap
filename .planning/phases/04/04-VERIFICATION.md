---
phase: 04-roadmap-timeline-ui
verified: 2026-07-14T12:52:00Z
status: human_needed
score: 13/13 decisions verified (D-01..D-13); 04-07 deferred (accepted)
overrides_applied: 0
human_verification:
  - test: "Load /timeline in a desktop browser against public/roadmap.json"
    expected: "7-month axis (Jul 2026..Jan 2027), today marker line, 5 initiative lanes ordered agenticapps-workflow, cPARX, then Callbot/Factiv/fx-signals; 2 scheduled bars, 14 dashed needs-backfill pills"
    why_human: "Visual layout fidelity and lane ordering cannot be confirmed by grep/build alone"
  - test: "Hover a bar/pill on desktop; tap on a touch device"
    expected: "Desktop opens HoverCard after ~300ms; touch opens Popover on tap; popover shows name, status/priority badges, dates, issue-counts bar, milestones, summary; Linear link omitted (url null)"
    why_human: "Pointer-type runtime switch and popover rendering require live interaction"
  - test: "Resize below 840px and toggle dark mode"
    expected: "Horizontal scroll appears (no column collapse); bar fill 70% opacity in dark; tokens swap correctly"
    why_human: "Responsive scroll and dark-mode appearance are visual"
  - test: "Confirm Overview route still renders unchanged and skeleton loading shows during hydration"
    expected: "OverviewPage unaffected; RoadmapLoading skeleton swimlanes pulse during initial load"
    why_human: "Regression and transient loading state are visual"
deferred:
  - truth: "Linear popover link resolves to real Project.url; public/roadmap.json carries url values"
    addressed_in: "Plan 04-07 (gated)"
    evidence: "04-07 requires LINEAR_API_KEY (unset in this environment). D-13 pipeline plumbing is complete and PII-safe; snapshot regeneration is the only remaining step. Popover degrades gracefully — link omitted when url is null."
---

# Phase 4: Roadmap Timeline UI — Verification Report

**Phase Goal:** A hero Timeline view — initiative swimlanes across a fixed month axis, scheduled projects as bars, undated projects as dashed needs-backfill pills, milestones as markers with a popover, colored by initiative, responsive + dark mode, with empty/loading/error states — rendering fully from `public/roadmap.json` with no network.
**Verified:** 2026-07-14
**Status:** human_needed (all code-verifiable truths PASS; visual/interaction UAT pending)
**Re-verification:** No — initial verification

## Goal Achievement

The `/timeline` route (`src/router.tsx:22-24`) renders `TimelinePage`, which reads the
shared root loader (`useRouteLoaderData("root")` → validated `public/roadmap.json`) and
builds one lane per initiative with zero network calls. Snapshot analysis confirms the
contract data: 5 initiatives, 16 projects, 2 scheduled (AgenticApps Roadmap, cPARX
Prototype), 14 undated — exactly the CONTEXT.md facts. The goal is achieved in code and
compiles/builds/tests clean; only visual fidelity remains for human UAT.

### Per-Decision Coverage (D-01..D-13)

| # | Decision | Status | Evidence |
|---|----------|--------|----------|
| D-01 | Fixed current-month→+6 window, 1 col/month | ✓ VERIFIED | `getWindow` (first-of-month .. day-0-of-month+7 = last-of-+6), `getMonthColumns` returns 7; `AxisRow` `grid-cols-7`; unit-tested |
| D-02 | Today marker line | ✓ VERIFIED | `todayLeftPercent`; `AxisRow` 1.5px `--foreground` vertical line `aria-label="Today"`, `pointer-events-none` |
| D-03 | Off-window clamp + continues cue | ✓ VERIFIED | `barPosition` `kind:"stub"` + `clampedLeft/Right`; `ScheduledBar` 32px stub + `ChevronLeft/Right` with contract aria-labels. cPARX (Apr–May 2026) is the entirely-before case |
| D-04 | Undated pills in left parking rail | ✓ VERIFIED | `InitiativeLane` `w-40 shrink-0 bg-(--color-muted)` rail; `UndatedPill` per undated project sorted priority-asc then name-asc |
| D-05 | Bar spans startDate→targetDate | ✓ VERIFIED | `barPosition` span `left`/`width` %; `ScheduledBar` span branch |
| D-06 | Scheduled = has targetDate | ✓ VERIFIED | `InitiativeLane` split on `targetDate !== null` / `=== null`; matches existing convention |
| D-07 | targetDate, no startDate → 64px bar | ✓ VERIFIED | `barPosition` `kind:"fixedEnd"`; `ScheduledBar` renders 64px right-aligned to targetDate (code path present; no current data exercises it — logic + tests cover it) |
| D-08 | Hover desktop / tap touch | ✓ VERIFIED (code) | `UndatedPill` + `ScheduledBar` read `matchMedia("(pointer: coarse)")` in `useEffect` (init false = SSR-safe desktop default), switch HoverCard vs Popover; runtime behavior is a human item |
| D-09 | Popover: summary + Linear link + issue counts + milestones + status/priority + dates | ✓ VERIFIED | `ProjectPopoverContent` renders all six; issue-counts bar divide-by-zero-safe; Linear footer guarded on `url?.startsWith("https://linear.app/")` |
| D-10 | Milestone markers on bar + popover list | ✓ VERIFIED | `MilestoneMarker` diamond (rotate-45, white ring), null when targetDate null; 12px `ResizeObserver` clustering with count badge; popover milestone list (max 5) |
| D-11 | Color-by-initiative + deterministic fallback | ✓ VERIFIED | `resolveInitiativeColor` + `FALLBACK_PALETTE`; null-color initiative (agenticapps-workflow) gets stable palette entry by lexicographic null-id order; unit-tested |
| D-12 | Responsive + dark mode + empty/loading/error | ✓ VERIFIED (code) | `min-w-[840px]` + `overflow-x-auto`; `dark:bg-(--bar-fill)/70`; empty state (📅 + copy); `RoadmapLoading` skeleton; null-loader error copy. Visual fidelity is a human item |
| D-13 | project.url through pipeline | ✓ VERIFIED (plumbing) | `query.ts` selects `url`; `map.ts` `url: proj.url` (no `...proj` spread); `transform.ts` `url: proj.url ?? null`; `fetch-workspace.ts` `url: string`; `schema.ts` `url: z.string().nullish()`. Snapshot regeneration = 04-07 (deferred) |

**Score:** 13/13 decisions verified (D-13 = pipeline complete; data population deferred to 04-07).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Real `project.url` values in `public/roadmap.json` + live Linear popover link | Plan 04-07 (gated) | Requires `LINEAR_API_KEY` (unset). `grep -c '"url"' public/roadmap.json` = 0; schema `.nullish()` keeps the urlless snapshot valid; `ProjectPopoverContent` omits the footer link when url is null. Accepted, graceful degradation — NOT a gap. |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/timeline/dateUtils.ts` | ✓ VERIFIED | Pure window/bar/today math; kind discriminator; unit-tested; wired into AxisRow/ScheduledBar/TimelinePage |
| `src/lib/timeline/colorUtils.ts` | ✓ VERIFIED | Fallback palette + WCAG luminance; unit-tested; wired into TimelinePage/ScheduledBar |
| `src/components/ui/{hover-card,popover,badge}.tsx` | ✓ VERIFIED | base-ui (`@base-ui/react`) scaffolds, no `@radix-ui`, zero new deps; imported by pill/bar/popover |
| `src/components/timeline/ProjectPopoverContent.tsx` | ✓ VERIFIED | Full D-09 body; guarded external anchor |
| `src/components/timeline/MilestoneMarker.tsx` | ✓ VERIFIED | Diamond + cluster badge; consumed by ScheduledBar |
| `src/components/timeline/UndatedPill.tsx` | ✓ VERIFIED | Dashed pill + trigger; used by InitiativeLane |
| `src/components/timeline/ScheduledBar.tsx` | ✓ VERIFIED | Positioned/clamped bar + markers + trigger; used by InitiativeLane |
| `src/components/timeline/AxisRow.tsx` | ✓ VERIFIED | Month header + today marker; used by TimelinePage |
| `src/components/timeline/InitiativeLane.tsx` | ✓ VERIFIED | Header + rail + grid; used by TimelinePage |
| `src/pages/TimelinePage.tsx` | ✓ VERIFIED | Full assembly; wired at `/timeline` route |
| `src/components/RoadmapBoundaries.tsx` | ✓ VERIFIED | `RoadmapLoading` upgraded to skeleton swimlanes; wired as HydrateFallback |
| `scripts/linear/*` + `src/lib/roadmap/schema.ts` | ✓ VERIFIED | D-13 url plumbing complete |

### Key Link Verification

| From | To | Status | Details |
|------|----|--------|---------|
| `router.tsx` | `TimelinePage` | ✓ WIRED | `element: <TimelinePage />` at `/timeline` |
| `TimelinePage` | root loader / `roadmap.json` | ✓ WIRED | `useRouteLoaderData("root")`; renders `data.projects`/`data.initiatives` |
| `TimelinePage` | `AxisRow` + `InitiativeLane` | ✓ WIRED | mapped per lane with color/window |
| `InitiativeLane` | `UndatedPill` + `ScheduledBar` | ✓ WIRED | split on targetDate |
| `ScheduledBar`/`UndatedPill` | `ProjectPopoverContent` | ✓ WIRED | passed as popover body |
| `ScheduledBar` | `MilestoneMarker` | ✓ WIRED | positioned + clustered |
| pipeline `query→map→transform→schema` | `url` field | ✓ WIRED | threaded end-to-end |
| `ProjectPopoverContent` | `project.url` | ⚠️ GUARDED | link omitted while url null (04-07 deferral, by design) |

### Data-Flow Trace (Level 4)

| Artifact | Data Source | Produces Real Data | Status |
|----------|-------------|--------------------|--------|
| `TimelinePage` | root loader → `public/roadmap.json` (16 projects, 5 initiatives, 2 scheduled) | Yes | ✓ FLOWING |
| `ProjectPopoverContent` Linear link | `project.url` (null in current snapshot) | No (by design, deferred) | ⚠️ Guarded omit — accepted |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck | `npx tsc -b --noEmit` | exit 0 | ✓ PASS |
| Unit tests | `CI=true npx vitest run` | 5 files / 63 tests passed | ✓ PASS |
| Production build | `CI=true npx vite build` | exit 0, built in 1.85s | ✓ PASS |
| Lint | `npx eslint .` | 0 errors, 2 warnings (react-refresh on badge.tsx/button.tsx — accepted idiom) | ✓ PASS |
| Snapshot renders offline | `node` parse of `public/roadmap.json` | 5 initiatives, 16 projects, 2 scheduled, colors match D-11 | ✓ PASS |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| (none) | TODO/FIXME/XXX/HACK/PLACEHOLDER scan across all phase-04 files | — | No debt markers; no stub returns; no hardcoded empty render data |

The `url: null` in `public/roadmap.json` is not a stub — it is the accepted 04-07 deferral
state, made valid by `schema.ts` `.nullish()` and handled by the popover's guard.

### Human Verification Required

1. **Timeline visual layout** — load `/timeline`; confirm 7-month axis, today marker, 5 lanes in scheduled-count-desc order, 2 bars + 14 dashed pills.
2. **Hover/tap popover** — desktop hover (HoverCard ~300ms) and touch tap (Popover); popover content correct; Linear link absent (url null).
3. **Responsive + dark mode** — <840px horizontal scroll (no collapse); dark-mode bar opacity/token swap.
4. **Loading + no-regression** — skeleton swimlanes during hydration; Overview route unchanged.

### Gaps Summary

No blocking gaps. All 13 design decisions are implemented and wired; the full toolchain
(tsc/vitest/vite build/eslint) is green; the page renders all 16 projects from the offline
snapshot. The single deferred item — populating real `project.url` values and enabling the
live Linear popover link — is Plan 04-07, intentionally gated on `LINEAR_API_KEY` (unset in
this environment). The D-13 pipeline plumbing is complete and PII-safe, and the UI degrades
gracefully by omitting the link. Status is `human_needed` solely because a UI phase's visual
and interaction fidelity (layout, hover/tap, responsive, dark mode) is only confirmable by a
human — no code-level truth failed.

---

_Verified: 2026-07-14T12:52:00Z_
_Verifier: Claude (gsd-verifier)_
