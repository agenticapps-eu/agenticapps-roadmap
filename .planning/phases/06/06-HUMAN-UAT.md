---
status: partial
phase: 06-sync-gsd-linear
source: [06-VERIFICATION.md, 06-VALIDATION.md]
started: 2026-07-15T16:35:00Z
updated: 2026-07-15T16:35:00Z
---

## Current Test

[awaiting human testing — requires a real LINEAR_API_KEY and a live Linear workspace]

## Tests

### 1. Live dry-run diff accuracy
expected: Running `LINEAR_API_KEY=<real key> pnpm sync:gsd -- --project claude-workflow` (dry-run is the default) prints a diff whose summary counts and per-record detail lines match what a human expects from the repo's `.planning/` phases/plans against the current Linear workspace, with no garbage titles.
result: [pending]
why_human: "Accurate" is a human judgment against live Linear state; LINEAR_API_KEY is unset in this environment so the Linear-dependent resolve step cannot be exercised end-to-end here. The parser/title half of this criterion is already fully verified by automated means (270 real plans, zero garbage titles).

### 2. Live apply-twice idempotency (no duplicates on re-run)
expected: With LINEAR_API_KEY set, `pnpm sync:gsd -- --project <name> --apply` then approving the y/N prompt creates the records; re-running the same command yields an empty diff (`operations: []`) and Linear shows no duplicate project/milestones/issues.
result: [pending]
why_human: Writing to production Linear is deliberately approval-gated (D-06-07) and cannot be safely automated/repeated by the verifier. The underlying dedup logic — CR-01 issue-dedup-survives-map-loss (durable `<!--gsd-key:...-->` marker) and WR-05 milestone stored-id-first match — is proven by mocked-GraphQL integration tests; only the live wire against real Linear needs a human with the real token.

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
