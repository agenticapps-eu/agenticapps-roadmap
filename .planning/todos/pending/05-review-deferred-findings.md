---
id: 05-review-deferred-findings
created: 2026-07-15
status: pending
priority: low
tags: [phase-05, code-review, overview, polish]
source: .planning/phases/05/05-REVIEW.md
---

# Phase 5 code-review: deferred findings

Deferred from the Phase 5 code review (0 critical, 3 warning, 3 info). WR-01 and
WR-02 were fixed in commit 8bdb50a. The rest are logged here for a later polish pass.

## WR-03 (design call) — HealthStrip renders every initiative regardless of filter
`OverviewPage.tsx` passes the full `data.initiatives` to `rollupInitiativeHealth`,
so filtering to one initiative still renders all-zero rows for the others,
contradicting the filtered "initiatives" KPI. The 05-06 plan deliberately passes
the full initiatives list, so changing this is a design decision (hide rows whose
initiative isn't in the filtered set, or keep showing all for stable layout).

## IN-01 — schema `priority` not bounded to 0..4
`ProjectSchema.priority` accepts any number; the canonical Linear domain is 0..4.
Consider `z.number().int().min(0).max(4)` (or a nullable refinement) if upstream
guarantees hold.

## IN-02 — asymmetric defensive parsing in selectors
`priority`/dates are strictly parsed while `initiatives`/`statuses`/`quarter` pass
through unvalidated. Consider symmetric validation for attacker-controllable
searchParams (defense-in-depth; current behavior is safe but inconsistent).

## IN-03 — duplicated source-mode logic
`shouldRevalidateRoadmap` mirrors `roadmapLoader`'s `source === "live"` rule
verbatim. Consider extracting a shared helper to prevent drift.
