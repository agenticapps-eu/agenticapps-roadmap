---
status: complete
phase: 06-sync-gsd-linear
source: [06-VERIFICATION.md, 06-VALIDATION.md]
started: 2026-07-15T16:35:00Z
updated: 2026-07-15T19:05:00Z
---

## Current Test

[complete — both live checks performed against real Linear with LINEAR_API_KEY]

## Tests

### 1. Live dry-run diff accuracy
expected: `pnpm sync:gsd -- --project claude-workflow` prints a diff matching the repo's `.planning/` phases/plans, no garbage titles.
result: passed — after fixing the `.planning` path resolution (commit b268a4f), the dry-run reported `+ 34 milestones, + 40 issues, + 2 labels` with correct titles (real H1s + filename fallbacks; the previously-garbage 28-03/04-07 cases clean). Token loaded from .dev.vars, never printed/committed.

### 2. Live apply-twice idempotency (no duplicates on re-run)
expected: apply creates records; re-run yields an empty diff and no duplicates.
result: passed — apply #1 created 1 project + 34 milestones + 40 issues + 2 labels; apply #2 and #3 each reported `+ 0 milestones, + 0 issues, + 0 labels`. Paginated Linear count confirms exactly 34 milestones + 40 issues (zero duplicates). Required two fixes surfaced live: PROJECT_ISSUES_QUERY `String!`→`ID!` and a paginated per-project `readProjectMilestones` (commit 7377a87).

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
