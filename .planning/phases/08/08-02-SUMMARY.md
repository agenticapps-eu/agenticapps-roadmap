---
phase: 08-deploy-gate-document
plan: 02
subsystem: infra
tags: [cloudflare-pages, cloudflare-access, cloudflare-kv, github-actions, adr, documentation]

# Dependency graph
requires:
  - phase: 08-01
    provides: BACKFILL_NONCE KV binding in wrangler.toml + consume-once nonce in dispatch.ts (D-08-06)
provides:
  - "docs/decisions/0001-hosting-and-sync-architecture.md — first ADR, recording the Cloudflare Pages/Access/KV hosting decision and the CI-dispatch sync architecture, with the Production-only-secrets boundary in v1"
  - "docs/runbook.md — deploy, token rotation, snapshot refresh, and backfill operational runbook"
  - "docs/access-setup.md reconciled to D-08-01 (single whole-domain Access application)"
  - "docs/architecture.md reconciled to the settled CI snapshot cron (no longer 'optional')"
  - "README.md environment table + Deploy section pointing at the runbook"
affects: [08-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ADR header/section skeleton (Status/Date/Linear/Phase; Context/Decision/Alternatives Rejected/Consequences/References) mirrored from claude-workflow's docs/decisions/0010-*.md convention, now established in this repo's docs/decisions/"
    - "Runbook idiom: numbered dashboard steps + blockquote invariant callouts + curl -sS -o /dev/null -w \"%{http_code}\\n\" verification blocks, extended from docs/access-setup.md to cover deploy/rotation/snapshot/backfill"

key-files:
  created:
    - docs/decisions/0001-hosting-and-sync-architecture.md
    - docs/runbook.md
  modified:
    - docs/access-setup.md
    - docs/architecture.md
    - README.md

key-decisions:
  - "Production-only-secrets boundary documented in the ADR's FIRST version (not a post-hoc patch): LINEAR_API_KEY and GH_BACKFILL_TOKEN bind to the Cloudflare Pages Production environment only, never Preview, because D-08-02 leaves *.pages.dev preview URLs ungated by Access and a single top-level [[kv_namespaces]] binding applies to both environments (Assumption A1)."
  - "docs/access-setup.md's separate /api/* Access application requirement removed — reconciled to D-08-01's single whole-domain application (empty path) covering the app root and every route beneath it."
  - "docs/architecture.md's scheduled snapshot refresh is now stated as the settled CI cron (snapshot.yml, 0 6 * * * UTC), not an open/optional choice; the corresponding 'cron in CI vs Pages cron trigger' open follow-up line was removed."

requirements-completed: [DEPLOY-03, DEPLOY-04]

# Metrics
duration: ~20min
completed: 2026-07-16
---

# Phase 8 Plan 02: Deploy, gate & document — Runbook + ADR Summary

**Hosting/sync ADR-0001, docs/runbook.md covering deploy/rotation/snapshot/backfill, and reconciliation of access-setup.md + architecture.md to the locked Phase-8 decisions.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-16T12:12:22Z
- **Tasks:** 3 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Authored `docs/decisions/0001-hosting-and-sync-architecture.md`: the repo's first ADR, recording the Cloudflare Pages + Pages Functions hosting choice and the full sync architecture (CI-dispatch write path, two-phase preview/apply, Access-only write auth, single fine-grained PAT, KV consume-once nonce), with rejected alternatives and the three accepted-risk/boundary facts (best-effort KV nonce, uniform 4-repo PAT scope, Production-only live secrets) all present in v1.
- Wrote `docs/runbook.md` covering the four DEPLOY-03 areas: deploy (Pages project creation, wrangler.toml-as-KV-source-of-truth, Production-only secret binding), token rotation (two-secret-name PAT pattern with a strict create-before-revoke order, dual LINEAR_API_KEY rotation), snapshot refresh (cron cadence + the 15-60min recognition-delay caveat), and backfill (preview→apply flow, retry/failure recovery, curl-based Access verification extended to `/api/backfill/*`).
- Reconciled `docs/access-setup.md` to D-08-01: removed the mandatory separate `/api/*` Access application language, replaced with a single whole-domain application (empty path) that covers every route.
- Reconciled `docs/architecture.md`: the scheduled snapshot is now described as the settled CI cron, not an open/optional choice; removed the corresponding stale "Open follow-ups" line.
- Extended `README.md`'s Environment table with `GH_BACKFILL_TOKEN`, `GH_CROSS_REPO_TOKEN`, and `BACKFILL_NONCE`, and added a `## Deploy` section pointing to the runbook.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the hosting/sync ADR** - `82c7d1e` (docs)
2. **Task 2: Write docs/runbook.md + reconcile docs/access-setup.md and docs/architecture.md** - `10e424b` (docs)
3. **Task 3: Extend README with the secrets summary and a Deploy pointer** - `f88a849` (docs)

_No TDD tasks in this plan (docs-only)._

## Files Created/Modified
- `docs/decisions/0001-hosting-and-sync-architecture.md` - New ADR: hosting + sync architecture decision record
- `docs/runbook.md` - New operational runbook: deploy, rotation, snapshot refresh, backfill
- `docs/access-setup.md` - Section 2 rewritten to a single whole-domain Access application (D-08-01)
- `docs/architecture.md` - Snapshot cron described as settled, not optional; stale open-follow-up line removed
- `README.md` - Environment table extended (3 new rows) + new `## Deploy` section

## Decisions Made
- Followed the plan's explicit instruction to state the Production-only-secrets boundary as a *consequence* of already-locked D-08-02 + D-08-04 + the single-`[[kv_namespaces]]`-binding platform fact, not as a new numbered decision — both the ADR's Consequences section and the runbook's Deploy section phrase it this way.
- Kept the KV-nonce strength claim aligned with the corrected 08-01/CONTEXT annotation: "best-effort sequential replay suppression," not "exactly once," in both the ADR and the runbook.
- Left `docs/architecture.md`'s "GitHub Pages optional public mirror" line untouched (a separate deferred idea, not part of this reconciliation's scope) per the plan's explicit instruction.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required by this plan. (Actual Cloudflare Pages project creation, KV namespace creation, Access application setup, and secret binding are live infrastructure actions covered by plan 08-03, not this documentation plan.)

## Next Phase Readiness

- `docs/decisions/0001-hosting-and-sync-architecture.md` exists, unblocking plan 08-03's DEPLOY-04 tag gate.
- `docs/runbook.md` gives plan 08-03 (and any future operator) a complete deploy/rotation/refresh/backfill procedure to execute and verify against.
- No contradictions remain between `docs/access-setup.md`/`docs/architecture.md` and the locked Phase-8 decisions — plan 08-03 can reference these docs as accurate without a follow-up patch.
- Plan 08-03 still owns: the actual Cloudflare Pages project creation, Access application creation, secret bindings, running `07-HUMAN-UAT.md` for real, and the `v0.1.0` tag + README `## Status` update.

---
*Phase: 08-deploy-gate-document*
*Completed: 2026-07-16*
