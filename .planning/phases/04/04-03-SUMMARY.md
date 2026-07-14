---
phase: 04-roadmap-timeline-ui
plan: 03
subsystem: ui-primitives
tags: [shadcn, base-ui, scaffold, hover-card, popover, badge]
requires:
  - "@base-ui/react@1.6.0 (pre-installed)"
provides:
  - "src/components/ui/hover-card.tsx — base-ui PreviewCard-backed HoverCard (desktop hover trigger, TL-03)"
  - "src/components/ui/popover.tsx — base-ui Popover (touch tap trigger, TL-03)"
  - "src/components/ui/badge.tsx — CVA Badge (status/priority chips, TL-04)"
affects:
  - "04-04 (popover plan) — unblocked; consumes these three primitives"
tech-stack:
  added: []          # zero new npm dependencies (source-only scaffold)
  patterns:
    - "shadcn base-nova style → @base-ui/react primitives (no @radix-ui)"
    - "cn() + data-slot + CVA variants matching existing button.tsx"
key-files:
  created:
    - src/components/ui/hover-card.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/badge.tsx
  modified: []
decisions:
  - "Relocated CLI output from a literal @/ dir to src/components/ui/ — shadcn's alias resolver read root tsconfig.json (references-only, no paths); the @/* → ./src/* mapping lives in the referenced tsconfig.app.json. Content is the authentic CLI output, not hand-written."
metrics:
  duration: ~2m
  completed: 2026-07-14
  tasks: 1
  files: 3
requirements: [TL-03, TL-04]
---

# Phase 4 Plan 03: Scaffold shadcn UI Primitives Summary

Scaffolded the three shadcn base-nova primitives the timeline popover needs — `hover-card`, `popover`, and `badge` — via `npx shadcn add`, all resolving to the already-installed `@base-ui/react` with zero new npm dependencies and no `@radix-ui` packages.

## What Was Built

| File | Backing primitive | Purpose |
|------|-------------------|---------|
| `src/components/ui/hover-card.tsx` | `@base-ui/react/preview-card` (PreviewCard.Root/Trigger/Popup/Positioner/Portal) | Desktop hover trigger (D-08, TL-03) |
| `src/components/ui/popover.tsx` | `@base-ui/react/popover` (Popover.Root/Trigger/Popup/Positioner/Portal + Header/Title/Description) | Touch tap trigger (D-08, TL-03) |
| `src/components/ui/badge.tsx` | `@base-ui/react` (mergeProps + useRender) + CVA variants `default/secondary/destructive/outline/ghost/link` | Status/priority chips (D-09, TL-04) |

All three match the existing `button.tsx` idiom: `cn` from `@/lib/utils`, `data-slot` attributes, `{...props}` spread, and CVA for the badge.

## shadcn CLI Outcome

**The registry WAS reachable — the CLI succeeded.** `npx shadcn@4.11.0 add hover-card popover badge` fetched the base-nova style from the official shadcn registry and generated all three files. The network fallback branch (flag-not-silent-pass) was NOT triggered.

One mechanical wrinkle: the CLI wrote the files into a literal `@/components/ui/` directory instead of resolving the `@/` alias to `src/`. Root cause: shadcn reads the root `tsconfig.json`, which contains only project `references` and no `paths`; the `@/* → ./src/*` mapping lives in the referenced `tsconfig.app.json`. The authentic CLI-generated files were relocated to `src/components/ui/` and the stray `@/` directory removed. No content was hand-authored or modified — the scaffold output is verbatim.

## Verification Evidence

| Check (acceptance criteria) | Result |
|------|--------|
| Three files exist (hover-card/popover/badge) | PASS — all present in `src/components/ui/` |
| `grep -rl '@radix-ui' src/components/ui/` returns nothing | PASS — no matches |
| `grep -l '@base-ui/react' hover-card.tsx popover.tsx` lists both | PASS — both listed |
| `grep -c '@radix-ui' package.json` == 0 | PASS — 0 |
| package.json / lockfile unchanged (zero new deps) | PASS — no diff |
| `npx tsc -b --noEmit` (typecheck) | PASS — exit 0 |
| `CI=true npx vitest run` | PASS — 5 files, 63 tests passed |
| `npx eslint` on the three files | PASS — 0 errors, 1 warning |

**ESLint note:** one `react-refresh/only-export-components` warning on `badge.tsx` (exporting `badgeVariants` alongside the `Badge` component). This is the identical accepted idiom already present in the pre-existing `button.tsx` (same warning, same line role). The plan directs "do not modify the scaffold," so it is left verbatim. Zero errors.

## Deviations from Plan

**1. [Rule 3 - Blocking issue] Relocated CLI output from `@/` to `src/`**
- **Found during:** Task 1 (post-scaffold verification)
- **Issue:** shadcn CLI wrote to a literal `@/components/ui/` directory because the `@/*` path alias is defined in `tsconfig.app.json` (a referenced project), not the root `tsconfig.json` that shadcn inspects. Files at that path would not compile or be importable.
- **Fix:** Moved the three CLI-generated files verbatim to `src/components/ui/` and removed the stray `@/` directory. No content changes.
- **Files:** src/components/ui/{hover-card,popover,badge}.tsx
- **Commit:** 78a3810

## Known Stubs

None — these are complete, self-contained UI primitives with no data wiring.

## Threat Flags

None. Per threat register T-04-SC (Tampering): scaffold came from the official shadcn registry (`components.json` `registries: {}`), all imports resolve to the already-vetted `@base-ui/react`, and no new package (Radix or otherwise) was added to `package.json`. Zero new npm installs — source-only scaffold, as designed.

## Commits

- `78a3810` feat(04-03): scaffold hover-card, popover, badge shadcn primitives

## Self-Check: PASSED

- FOUND: src/components/ui/hover-card.tsx
- FOUND: src/components/ui/popover.tsx
- FOUND: src/components/ui/badge.tsx
- FOUND: commit 78a3810
