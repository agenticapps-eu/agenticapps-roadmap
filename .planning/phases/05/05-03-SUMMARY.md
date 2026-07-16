---
phase: 05-overview-dashboard
plan: 03
subsystem: ui
tags: [shadcn, base-ui, scaffold, dialog, card, base-nova]

# Dependency graph
requires:
  - phase: 04-roadmap-timeline-ui
    provides: "shadcn base-nova scaffold precedent (04-03) — hover-card/popover/badge, same tsconfig-references quirk"
provides:
  - "src/components/ui/dialog.tsx — base-ui Dialog primitive (Root/Trigger/Portal/Backdrop/Popup/Title/Description/Close/Header/Footer) for the OV-03/D-05-04 drill-down container"
  - "src/components/ui/card.tsx — plain token-styled Card/CardHeader/CardTitle/CardDescription/CardAction/CardContent/CardFooter for the OV-01 KPI cards"
affects: ["05-04", "05-05"]

# Tech tracking
tech-stack:
  added: []          # zero new npm dependencies — source-only scaffold, package.json/pnpm-lock.yaml unchanged
  patterns:
    - "shadcn base-nova style -> @base-ui/react primitives (no @radix-ui), matching popover.tsx/hover-card.tsx"
    - "cn() + data-slot conventions carried into dialog.tsx/card.tsx"

key-files:
  created:
    - src/components/ui/dialog.tsx
    - src/components/ui/card.tsx
  modified: []

key-decisions:
  - "Invoked the shadcn binary directly (./node_modules/.bin/shadcn) instead of via `pnpm exec`, because `pnpm exec` triggers pnpm's deps-status-check which re-runs `pnpm install` and fails under this environment's ignored-build-scripts supply-chain policy (esbuild postinstall). Direct binary invocation is still the project-local devDep CLI the plan specifies — no different CLI version, no network bypass."
  - "Relocated CLI output from a literal @/ dir to src/components/ui/ — identical known quirk to 04-03 (shadcn resolves the root tsconfig.json, which is references-only; the @/* -> ./src/* mapping lives in referenced tsconfig.app.json). Content is verbatim CLI output, not hand-written."
  - "The scaffold also regenerated button.tsx as a dialog dependency (Close button); diffed byte-for-byte identical to the existing src/components/ui/button.tsx (owned by 04-03), so it was discarded rather than staged — out of this plan's files_modified scope."

patterns-established: []

requirements-completed: [OV-01, OV-03]

# Metrics
duration: ~12min
completed: 2026-07-15
---

# Phase 5 Plan 03: Scaffold dialog + card shadcn primitives Summary

**dialog.tsx (base-ui Dialog, URL-controlled drill-down container) and card.tsx (plain token-styled KPI card) scaffolded via the project-local shadcn CLI, zero new npm dependencies.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-15T07:38:00Z (approx)
- **Completed:** 2026-07-15T07:50:21Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `src/components/ui/dialog.tsx` scaffolded from the base-nova registry, backed by `@base-ui/react/dialog` (Root/Trigger/Portal/Backdrop/Popup/Title/Description/Close), matching the `popover.tsx`/`hover-card.tsx` style — unblocks OV-03/D-05-04's URL-controlled (`?project=<id>`) drill-down dialog.
- `src/components/ui/card.tsx` scaffolded alongside — a plain token-styled container (`Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardAction`/`CardContent`/`CardFooter`) using `bg-card`/`ring-foreground/10` tokens, no third-party primitive — unblocks OV-01's KPI card grid.
- Verified zero dependency drift: `package.json`/`pnpm-lock.yaml` unchanged, no `@radix-ui` import in either file, no `@radix-ui` string anywhere in `package.json`.
- `npx tsc -b --noEmit` and `npx eslint` both clean on the new files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold dialog + card via the local CLI, verify base-ui backing + zero manifest drift** - `813d917` (feat)

## Files Created/Modified
- `src/components/ui/dialog.tsx` - base-ui Dialog primitive wired to Button (close icon) and lucide-react's XIcon (both pre-existing deps)
- `src/components/ui/card.tsx` - plain div-based Card family, CVA-free, token-styled

## Decisions Made
- Direct binary invocation (`./node_modules/.bin/shadcn`) chosen over `pnpm exec shadcn` — see key-decisions above.
- Stray `@/` output directory relocated verbatim to `src/components/ui/`, same as 04-03's precedent.
- Regenerated `button.tsx` (a dialog registry dependency) discarded after a byte-identical diff against the existing file — not part of this plan's scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `node_modules` absent in the worktree**
- **Found during:** Task 1 (pre-scaffold setup)
- **Issue:** This git worktree had no `node_modules` (gitignored, not created by worktree checkout), so neither the shadcn CLI nor `tsc`/`eslint` were runnable.
- **Fix:** Symlinked `node_modules` to the main repo's already-installed `node_modules` (same pnpm content-addressable store; no new install, no manifest change). The symlink itself is untracked/gitignored and was never staged.
- **Verification:** `test -f node_modules/.bin/shadcn` succeeded; `npx tsc -b --noEmit` and `npx eslint` ran cleanly afterward.
- **Committed in:** N/A (node_modules is gitignored, not committed)

**2. [Rule 3 - Blocking issue] `pnpm exec shadcn` failed under the supply-chain ignored-builds policy**
- **Found during:** Task 1 (CLI invocation)
- **Issue:** `pnpm exec` runs a deps-status-check that re-invokes `pnpm install`, which exits 1 in this environment because `esbuild`'s postinstall build script is not on the approved-builds list (`ERR_PNPM_IGNORED_BUILDS`). This blocked running the CLI at all.
- **Fix:** Invoked the pinned devDep binary directly — `./node_modules/.bin/shadcn add dialog card --yes` — bypassing `pnpm exec`'s install-check without changing which CLI binary/version runs (still the project-local `shadcn@4.11.0` per `package.json`).
- **Verification:** CLI reported `Created 3 files` (card.tsx, dialog.tsx, button.tsx — see deviation 3) fetched from the base-nova registry.
- **Committed in:** N/A (CLI invocation, not a file change)

**3. [Rule 3 - Blocking issue] CLI wrote output into a literal `@/` directory (matches 04-03 precedent)**
- **Found during:** Task 1 (post-scaffold verification)
- **Issue:** shadcn resolved the `@/*` alias by reading the root `tsconfig.json`, which is references-only (no `compilerOptions.paths`) — the `@/* -> ./src/*` mapping lives in the referenced `tsconfig.app.json`. Same mechanical quirk documented in `.planning/phases/04/04-03-SUMMARY.md`.
- **Fix:** Moved the CLI-generated `dialog.tsx` and `card.tsx` verbatim from `@/components/ui/` to `src/components/ui/`; removed the stray `@/` directory. The CLI also regenerated `button.tsx` as a dialog dependency — diffed byte-identical to the existing `src/components/ui/button.tsx` (owned by 04-03, not in this plan's `files_modified`), so it was discarded rather than moved/staged.
- **Files:** src/components/ui/dialog.tsx, src/components/ui/card.tsx
- **Verification:** `test -f` on both target paths; `npx tsc -b --noEmit` clean afterward.
- **Committed in:** 813d917 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking issues preventing task completion in this specific execution environment)
**Impact on plan:** All three are environment/tooling workarounds, not scope changes. No plan content, acceptance criteria, or file targets were altered. The `@/`-relocation is an exact repeat of an already-documented, already-accepted 04-03 pattern.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None — dialog.tsx and card.tsx are complete, self-contained UI primitives with no data wiring (data wiring for KPI cards and the drill-down dialog itself is 05-04/05-05, per `depends_on`/wave sequencing).

## Threat Flags

None beyond what threat register T-05-SC already covers. Per T-05-SC (Tampering, disposition: mitigate): the project-local `shadcn` CLI (pinned devDep 4.11.0) was run against the official base-nova registry (`components.json` `registries: {}`); generated imports resolve to the already-vetted `@base-ui/react`; no `@radix-ui/*` or any other new package was added; `git diff --quiet -- package.json pnpm-lock.yaml` confirmed zero manifest drift. Source-only scaffold, zero new npm installs, as designed.

## Next Phase Readiness
- `dialog.tsx` and `card.tsx` are present, base-ui-backed, typecheck-clean, and dependency-drift-free — Wave 2 plans (05-04 drill-down dialog, 05-05 KPI cards) are unblocked.
- No blockers or concerns for downstream plans in this wave.

---
*Phase: 05-overview-dashboard*
*Completed: 2026-07-15*
