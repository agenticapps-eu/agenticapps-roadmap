# Phase 7 — PLAN: Live refresh & write-back

## Tasks
1. "Refresh from Linear" in live mode via Pages Functions; reconcile into the snapshot view.
2. Write-back surface: trigger `sync-gsd-linear` apply for one project from the UI (behind Access).
3. Optimistic UI + error rollback for writes.
4. Scheduled snapshot refresh (CI cron or Pages cron) — cadence from `docs/architecture.md` follow-up.

## Done when
- A backfill applied via the UI appears in Linear and in the next snapshot.

## Gates
- verification; security check on the write path.
