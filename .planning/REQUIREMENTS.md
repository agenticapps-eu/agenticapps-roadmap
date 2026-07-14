# Requirements: AgenticApps Roadmap

**Defined:** 2026-06-28 (reconstructed)
**Core Value:** A private, snapshot-default roadmap dashboard that reads Linear and syncs with the repos' GSD `.planning/` plans, keeping the Linear token server-side at all times.

> Reconstructed from per-phase `PLAN.md` "Tasks"/"Done when" criteria, `docs/architecture.md`,
> and the phase-03 plan frontmatter. Phase-03 IDs (`REQ-*`) are the authoritative IDs already
> used in the plan files; all other IDs are derived from each phase's stated success criteria.

## v1 Requirements

### Scaffold (Phase 1)

- [x] **SCAF-01**: `pnpm dev` serves the app shell (top header + Overview/Timeline routes, Router 7 data-router).
- [x] **SCAF-02**: `pnpm build` produces a deployable Cloudflare Pages `dist/` with SPA fallback.
- [x] **SCAF-03**: Lint + typecheck pass clean; strict TypeScript, no `any` in committed code.
- [x] **SCAF-04**: Cloudflare Pages config (`wrangler.toml`/preset) + `functions/` placeholder present.

### Snapshot data layer (Phase 2)

- [x] **SNAP-01**: Typed Linear GraphQL client covering initiatives, projects, milestones, and issue counts.
- [x] **SNAP-02**: `pnpm sync:snapshot` writes a sanitized, token-free `public/roadmap.json` per the architecture shape.
- [x] **SNAP-03**: Zod schema + typed loader; the app renders the snapshot with zero external network calls.
- [x] **SNAP-04**: Sanitization gate asserts no tokens or emails-as-secrets leak into the snapshot.
- [x] **SNAP-05**: GitHub Action `snapshot.yml` (schedule + manual dispatch) drives the sync via the `LINEAR_API_KEY` secret.

### Linear proxy & Access (Phase 3)

- [ ] **REQ-SHARE**: The Phase-02 query string and GQL→RawWorkspace mapping are runtime-agnostic and importable by the Worker (no Node-only boundary).
- [ ] **REQ-GUARD**: The audited leak-gate (`assertNoLeak`) is reused server-side so no token/PII can pass through the proxy.
- [x] **REQ-TYPE**: `@cloudflare/workers-types` installed (verified legitimate), `functions/**` typechecked with no `any`, and vitest discovers tests under `functions/**`.
- [x] **REQ-PROXY-1**: The proxy serves only registered named operations, authenticated by the binding token, with the token absent from every response body (success and all error paths).
- [x] **REQ-PROXY-2**: The proxy runs the transform + leak-gate pipeline so an upstream response containing PII (email) yields a 502 with no PII in the body.
- [x] **REQ-PROXY-3**: The proxy has a complete error table — 500 for missing key, 502 for upstream non-ok / GraphQL errors / malformed body — all with generic bodies.
- [x] **REQ-PROXY-4**: Successful responses set `Cache-Control: private, max-age=60` with a minimal per-isolate rate limit, and the deployment is gated by Cloudflare Access over BOTH the Pages app AND `/api/*`, proven by captured evidence.
- [x] **REQ-LOADER**: The client loader defaults to the snapshot (zero `/api/*` calls); `?source=live` fetches and validates the live snapshot with a total-failure-safe fallback, a "live unavailable" notice, and a header toggle returning to the clean default URL.

### Timeline UI (Phase 4)

- [ ] **TL-01**: Timeline with a month axis, one lane per initiative, and scheduled projects rendered as bars.
- [ ] **TL-02**: Undated projects render as dashed "needs-backfill" pills in-lane.
- [ ] **TL-03**: Milestone markers on bars with a hover popover (project summary + Linear link).
- [ ] **TL-04**: Color-by-initiative ramp, responsive, dark mode, and empty/loading/error states.

### Overview, filters & drill-down (Phase 5)

- [ ] **OV-01**: Overview KPI cards (initiatives, projects, scheduled vs undated, by-priority, by-status) + per-initiative health strip.
- [ ] **OV-02**: Filters (initiative, time range, status, priority) are URL-encoded, shareable, and survive reload.
- [ ] **OV-03**: Drill-down from project → milestones + issues with deep links to Linear.
- [ ] **OV-04**: "Out of sync with plan" badge when a repo's `.planning/` is ahead of Linear.

### sync-gsd-linear CLI (Phase 6)

- [ ] **SYNC-01**: `.planning/` walker + `PLAN.md` parser producing a normalized `{ repo, phases[], tasks[] }` model.
- [ ] **SYNC-02**: Linear resolver — stored `linear-map.json` first, then `roadmap:<repo>` label, then title-hash fallback — with no duplicate records.
- [ ] **SYNC-03**: Per-project diff engine + date proposer (relative dates from phase order, shown for confirmation).
- [ ] **SYNC-04**: `--dry-run` default and `--project <name>` apply path with explicit approval; idempotent upsert (re-run is a no-op).

### Live refresh & write-back (Phase 7)

- [ ] **LIVE-01**: "Refresh from Linear" in live mode reconciles live data into the snapshot view.
- [ ] **LIVE-02**: UI-triggered per-project backfill (behind Access) with optimistic UI + error rollback.
- [ ] **LIVE-03**: Scheduled snapshot refresh (CI cron or Pages cron).

### Deploy, gate & document (Phase 8)

- [ ] **DEPLOY-01**: Repo connected to Cloudflare Pages with production + preview builds and `LINEAR_API_KEY` bound.
- [ ] **DEPLOY-02**: Cloudflare Access policy (email allow-list) applied and gating verified end-to-end.
- [ ] **DEPLOY-03**: README + `docs/runbook.md` cover deploy, token rotation, snapshot refresh, and backfill.
- [ ] **DEPLOY-04**: `v0.1.0` tagged with an ADR recording the hosting/sync decision.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Two-way Linear ↔ `.planning/` sync | v1 is repos→Linear backfill only; pull-down deferred (architecture follow-up). |
| Public unauthenticated dashboard | Private by design (Cloudflare Access); optional static GitHub Pages mirror only. |
| E2E browser automation (Playwright/Cypress) | Explicit future enhancement; out of phase-03 scope. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAF-01..04 | Phase 1 | Validated |
| SNAP-01..05 | Phase 2 | Validated |
| REQ-SHARE | Phase 3 | Pending |
| REQ-GUARD | Phase 3 | Pending |
| REQ-TYPE | Phase 3 | Complete |
| REQ-PROXY-1 | Phase 3 | Complete |
| REQ-PROXY-2 | Phase 3 | Complete |
| REQ-PROXY-3 | Phase 3 | Complete |
| REQ-PROXY-4 | Phase 3 | Complete |
| REQ-LOADER | Phase 3 | Complete |
| TL-01..04 | Phase 4 | Pending |
| OV-01..04 | Phase 5 | Pending |
| SYNC-01..04 | Phase 6 | Pending |
| LIVE-01..03 | Phase 7 | Pending |
| DEPLOY-01..04 | Phase 8 | Pending |
