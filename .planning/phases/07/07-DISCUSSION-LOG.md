# Phase 7: Live refresh & write-back - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 07-live-refresh-and-write-back
**Areas discussed:** Write-back mechanism, "Refresh from Linear" UX, Optimistic UI + rollback, Scheduled snapshot refresh

---

## Write-back mechanism

### Q1 — How does a UI backfill button apply a per-project backfill to Linear?

| Option | Description | Selected |
|--------|-------------|----------|
| Dispatch a CI job | UI → Worker → GitHub workflow_dispatch; CI checks out repos, runs `sync:gsd --project X --yes`, mutates Linear, commits roadmap.json; app polls. Reuses all Phase 6; Worker stays read-only. | ✓ |
| Worker replays precomputed ops | CI commits token-free `pending-ops.json`; Worker replays as mutations. Ops go stale; Worker gains write surface. | |
| Surface diff, run locally | UI shows diff + "run locally" instruction; no UI write. Fails success criterion 2. | |

**User's choice:** Dispatch a CI job
**Notes:** Grounded by the hard constraint — the Phase-6 CLI is Node-only and needs the sibling repos' local `.planning/` filesystem, which a deployed Pages Function lacks. CI is the only place that filesystem exists.

### Q2 — How does the user see the diff before approving (async model)?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-phase dispatch | Dry-run job computes fresh diff → UI renders → Apply → apply job (--yes). Always-fresh; two dispatches + two polls. | ✓ |
| Diff from scheduled artifact | Scheduled run commits a diff artifact; UI reads it. One dispatch, but diff up to one interval stale. | |
| Confirm-only, diff in logs | UI confirms only; diff only in CI logs. Weakest on the approval rule. | |

**User's choice:** Two-phase dispatch
**Notes:** Honors the architecture's "printed diff + explicit yes for that project" rule with an always-fresh diff.

### Q3 — How tightly should triggering a backfill be gated?

| Option | Description | Selected |
|--------|-------------|----------|
| Access is enough | Any Access allow-list identity can preview + apply. Small trusted allow-list + create-only idempotent writes = limited blast radius. | ✓ |
| Access + write allow-list | Writes restricted to a subset of emails via Cf-Access header. | |
| Access + typed confirm | Type the project name to confirm before apply. | |

**User's choice:** Access is enough

---

## "Refresh from Linear" UX

### Q1 — What should "Refresh from Linear" do?

| Option | Description | Selected |
|--------|-------------|----------|
| Ephemeral view refresh | Refresh button re-fetches /api/linear/snapshot via useRevalidator(); swaps rendered view; in-memory only, roadmap.json untouched. | ✓ |
| Persistent snapshot refresh | Refresh dispatches the sync:snapshot CI job → fresh committed roadmap.json. Durable but async; overlaps LIVE-03. | |
| Both | Ephemeral Refresh + on-demand rebuild. Most UI surface. | |

**User's choice:** Ephemeral view refresh
**Notes:** Matches "reconciles into the snapshot VIEW". "Reconcile" = full replace of rendered dataset (loader already does this), not a field-merge. Persisting stays the CI job's role.

### Q2 — How does Refresh relate to the Snapshot/Live toggle?

| Option | Description | Selected |
|--------|-------------|----------|
| Refresh only in Live mode | Refresh button enabled only in Live mode; toggle picks source, Refresh re-pulls live. Snapshot mode has no Refresh. | ✓ |
| One "Refresh from Linear" button | Single button always fetches live + switches to live; toggle returns to snapshot. | |
| Refresh always visible | Shown in both modes; near-no-op in snapshot mode. | |

**User's choice:** Refresh only in Live mode
**Notes:** Add a small "last refreshed" hint from `generatedAt` (Claude's discretion).

---

## Optimistic UI + rollback

### Q1 — What updates optimistically on Apply and rolls back on failure?

| Option | Description | Selected |
|--------|-------------|----------|
| Flip planAhead + pending | Flip planAhead out-of-sync → in-sync + "backfilling…" pending; revert on polled CI failure + error toast. Tied to the real OV-04 signal. | ✓ |
| Pending / confirm only | Spinner + confirm/error; no optimistic state change. Not literally "optimistic + rollback". | |
| Inject expected records | Inject would-be milestones/issues into the view; roll back on failure. Snapshot has only aggregate issueCounts — fragile. | |

**User's choice:** Flip planAhead + pending

### Q2 — How does the app learn the CI job outcome?

| Option | Description | Selected |
|--------|-------------|----------|
| Worker-proxied polling | Client polls /api/backfill/status?run=id; Worker reads GitHub Actions status with server-side token; returns {status, conclusion, diff?}. Token stays server-side; same channel serves the dry-run diff. | ✓ |
| Fire-and-forget + reconcile | No polling; assume success, let next snapshot correct. No immediate rollback; no diff readback. | |

**User's choice:** Worker-proxied polling
**Notes:** Tab-close mid-job: optimistic state lost on reload, but CI completes server-side and the next snapshot reflects truth — acceptable.

---

## Scheduled snapshot refresh

### Q1 — snapshot.yml already runs daily CI cron; what should change?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is (daily CI cron) | LIVE-03 already satisfied by snapshot.yml (workflow_dispatch + daily cron, commits roadmap.json). Verify + reuse; needs LINEAR_API_KEY (Phase 8). | ✓ |
| Change cadence | Keep CI cron but adjust frequency. | |
| Pages Cron Trigger | Move scheduling to a CF Worker cron. Can't commit the static file; adds a hop. | |

**User's choice:** Keep as-is (daily CI cron)
**Notes:** Nice Simplicity-First win — LIVE-03 reduces to verify + reuse, not a new build. CI cron is the correct home because Pages/Worker cron can't commit roadmap.json to git.

---

## Claude's Discretion

- New `.github/workflows/backfill.yml` shape + inputs (`project`, `mode`) + concurrency guard.
- GitHub token model (fine-grained PAT vs GitHub App) and the credential to clone sibling private repos in CI (token stays in binding/secret, never client).
- `/api/backfill*` route shapes, diff artifact format, poll interval/backoff, freshness-hint styling.
- Whether the apply job uses `--write-snapshot` explicitly, as long as roadmap.json is committed (R-3).

## Deferred Ideas

- Persistent on-demand snapshot rebuild from the UI (reuse snapshot.yml dispatch).
- Access + write-email allow-list / typed-confirm on the write path (revisit if audience widens).
- Two-way sync (Linear → `.planning/` pull-down) — out of scope.
- Real-time job progress (SSE/websocket) instead of polling.
