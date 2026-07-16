---
phase: 07-live-refresh-write-back
plan: 04
subsystem: ui
tags: [react, backfill, optimistic-ui, linear, vitest]

# Dependency graph
requires:
  - phase: 07-live-refresh-write-back
    provides: "07-03's useBackfill(setBackfillState) hook contract (startPreview/applyBackfill/diffFor/statusFor/errorFor/clearError) and BackfillStateMap type"
provides:
  - "src/lib/backfill/projects.ts — BACKFILL_PROJECTS Linear-id -> sync.config-key eligibility map"
  - "OverviewPage as the ephemeral optimistic backfill-state Map owner, threaded to SyncBadge and ProjectDrillDownDialog"
  - "ProjectDrillDownDialog's eligibility-gated two-phase Backfill control (preview typed diff -> apply) with optimistic flip + dismissible-error rollback"
affects: [07-05-phase-8-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-only prop extension on shared render primitives (SyncBadge) to preserve existing call sites' behavior"
    - "Two-key resolution (backfillKey pre-apply, projectId post-apply) read at the UI call site per useBackfill.ts's documented key-space, rather than re-deriving it inside the hook"

key-files:
  created:
    - src/lib/backfill/projects.ts
  modified:
    - src/components/overview/SyncBadge.tsx
    - src/components/overview/ProjectDrillDownDialog.tsx
    - src/pages/OverviewPage.tsx

key-decisions:
  - "Implemented the UI against the useBackfill.ts header-comment key-space contract (query diffFor/statusFor/errorFor with backfillKey right after startPreview, with project.id after applyBackfill), not the plan action text's literal 'diffFor(project.id)' gate for Apply — the latter is circular (project.id-keyed diff can never exist before Apply is first clicked) and the plan's own 07-03 handoff explicitly flags this key-space nuance for 07-04 to resolve this way."
  - "Apply-button gating uses previewDiff (backfillKey-keyed) exclusively, since that is the only diff that can exist before Apply is clicked; post-apply diff display prefers the project.id-keyed value when present, falling back to the preview value."
  - "Error surface: reused Badge variant='destructive' + a small dismiss (X icon) button, no toast library, per 07-PATTERNS 'No Analog Found' guidance."
  - "SyncBadge extended additively with planAheadOverride?/pending? — outOfSync = planAheadOverride ?? project.planAhead; existing { project }-only call sites are functionally unchanged (Fragment wrapping two conditionally-null badges instead of a single conditional, but no visual/behavioral change when both new props are absent)."

patterns-established:
  - "Pattern: an id-keyed allow-map (BACKFILL_PROJECTS) bridges display-name snapshot data to config-key CLI dispatch identity, gating UI control rendering on map membership rather than trusting the display name."

requirements-completed: [LIVE-02]

# Metrics
duration: ~20min
completed: 2026-07-16
---

# Phase 07 Plan 04: Live refresh & write-back — Backfill UI wiring Summary

**Wired the LIVE-02 optimistic write-back UI: an id-based Linear-project-to-sync.config-key eligibility map, OverviewPage as the backfill-state Map owner, and a two-phase Preview/Apply Backfill control in the project drill-down dialog rendering typed diff counts with optimistic badge flip and dismissible-error rollback.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-16T06:47Z
- **Tasks:** 2
- **Files modified:** 4 (1 new, 3 modified)

## Accomplishments
- `src/lib/backfill/projects.ts` exports `BACKFILL_PROJECTS`, an id -> sync.config-key allow-map seeded from `linear-map.json`, resolving today only `claude-workflow`.
- `SyncBadge` gained additive `planAheadOverride`/`pending` props (`outOfSync = planAheadOverride ?? project.planAhead`, distinct "backfilling…" pill) without changing any existing call site's rendered output.
- `OverviewPage` owns `const [backfillState, setBackfillState] = useState<BackfillStateMap>(new Map())`, declared unconditionally before the `if (!loaderData)` guard, and threads the Map entry into the project-list-row `SyncBadge` plus the Map/setter into `ProjectDrillDownDialog`.
- `ProjectDrillDownDialog` calls `useBackfill(setBackfillState)`, resolves `backfillKey = BACKFILL_PROJECTS[project.id]` as the eligibility gate, threads its Map entry into its own header `SyncBadge`, and renders a `Backfill: {project.name}` footer control (sibling of the existing Linear-link footer) with Preview (dry-run, typed-diff render `+ N milestones, + M issues, + L labels, ~ D dates`) and Apply (`applyBackfill(project.id, backfillKey)`, disabled until a successful preview exists) plus a dismissible inline error (`Badge variant="destructive"` + X-icon dismiss wired to `clearError`).

## Task Commits

1. **Task 1: BACKFILL_PROJECTS eligibility map + additive optimistic props on SyncBadge** - `f50bf41` (feat)
2. **Task 2: OverviewPage owns backfill-state Map; dialog gains eligibility-gated Backfill control** - `6a753b3` (feat)

**Plan metadata:** (this commit, following SUMMARY)

## Files Created/Modified
- `src/lib/backfill/projects.ts` - `BACKFILL_PROJECTS: Record<string, string>` Linear-project-id -> sync.config-key allow-map
- `src/components/overview/SyncBadge.tsx` - Additive `planAheadOverride`/`pending` props over the existing graceful-nullish `{ project }` render
- `src/components/overview/ProjectDrillDownDialog.tsx` - `useBackfill(setBackfillState)`, eligibility-gated Backfill footer control (Preview/Apply), typed-diff render, dismissible inline error
- `src/pages/OverviewPage.tsx` - Owns `backfillState` `useState` (unconditional, pre-guard), threads it into `SyncBadge` and `ProjectDrillDownDialog`

## Decisions Made
- Resolved the projectKey/projectId key-space per the explicit handoff from 07-03 and `useBackfill.ts`'s header comment rather than the plan action text's literal `diffFor(project.id)` Apply-gate wording — see `key-decisions` above for the full rationale (the literal reading is circular and the 07-03 summary explicitly flagged this for 07-04 to resolve using the hook's documented contract).
- Diff/error display merges the two key-spaces (post-apply `project.id`-keyed value preferred, falling back to the pre-apply `backfillKey`-keyed preview) so the UI shows something sensible whether the user is mid-preview or mid-apply.
- Used the existing `Button`/`Badge` UI primitives and `lucide-react`'s `X` icon (already a project dependency) for the dismiss control — no new UI library.

## Deviations from Plan

None (Rule 1-4 sense) - all four `must_haves.truths` and both tasks' `acceptance_criteria` were implemented as specified. The one interpretive resolution (Apply-gate key-space) is documented above as a `key-decision`, not a deviation, since it was explicitly anticipated and flagged by the 07-03 handoff and this executor's own instructions for how to resolve it.

## Issues Encountered
None - `npx tsc -b --noEmit`, `npx eslint` on the touched files, and `CI=true npx vitest run src/lib/backfill` (27/27) were all clean on the first pass.

## User Setup Required

None - no external service configuration required by this plan.

## Human Verification Required (deferred to Phase-8 UAT, per this session's instructions)

The following real-browser visual/interaction proof cannot be captured by unit tests and is deferred as a HUMAN-UAT item, consistent with 07-05's phase design (does NOT block this plan's commits):
- In `pnpm dev` with `?source=live`, open the claude-workflow-mapped project's drill-down: confirm Preview renders a typed diff, Apply (enabled only after a successful preview) flips the badge to in-sync + shows "backfilling…", a simulated failure reverts the badge and shows the dismissible inline error, and an ineligible project (any project.id not in `BACKFILL_PROJECTS`) shows NO Backfill control.
- Live end-to-end dispatch/poll against a real GitHub Actions boundary remains Phase-8 UAT scope (07-05), same as 07-03's deferred live-wire verification.

## Next Phase Readiness
- LIVE-02's UI is functionally complete and typechecks/lints/tests clean; 07-05 (Phase-8 UAT) can proceed to capture the live end-to-end proof (real dispatch, real poll, real badge flip) once a deployed environment with `GH_BACKFILL_TOKEN` is available.
- `cparx`/`fx-signal-agent` will need their Linear project ids added to `BACKFILL_PROJECTS` (mirroring `linear-map.json`) before their Backfill controls become visible in the UI — currently only `claude-workflow` is eligible.

---
*Phase: 07-live-refresh-write-back*
*Completed: 2026-07-16*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commit hashes (`f50bf41`, `6a753b3`) verified in `git log --oneline`.
