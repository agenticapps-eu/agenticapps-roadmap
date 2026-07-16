# Roadmap: AgenticApps Roadmap

> Reconstructed 2026-06-28 from per-phase `PLAN.md` briefs, `docs/architecture.md`,
> completed-phase VERIFICATION.md files, and the phase-03 plan frontmatter. Earlier
> phases (01–02) were executed before top-level tracking existed; their status here
> reflects their committed VERIFICATION verdicts.

## Overview

A private roadmap web app for the AgenticApps family that reads Linear and stays in
sync with the repos' GSD `.planning/` plans. It renders by default from a sanitized,
token-free `public/roadmap.json` snapshot (instant, offline-capable), with an optional
live path through Cloudflare Pages Functions that hold the Linear token server-side. A
`sync-gsd-linear` CLI backfills Linear from the repos' GSD plans — per-project,
dry-run-first, every write user-approved. Hosted on Cloudflare Pages, gated privately by
Cloudflare Access (email allow-list).

## Phases

**Phase Numbering:** Integer phases are planned milestone work; decimal phases (e.g. 2.1)
are urgent insertions.

- [x] **Phase 1: Project & tooling scaffold** — App skeleton + Cloudflare Pages wiring
- [x] **Phase 2: Linear data layer & static snapshot** — Sanitized token-free `roadmap.json`
- [ ] **Phase 3: Linear proxy & Access** — Server-side GraphQL proxy + private gating (IN PROGRESS)
- [ ] **Phase 4: Roadmap timeline UI** — Initiative swimlanes across a month axis
- [x] **Phase 5: Overview dashboard, filters & drill-down** — KPIs, shareable filters, Linear deep-links (completed 2026-07-15)
- [x] **Phase 6: sync-gsd-linear CLI** — Per-project, dry-run-first backfill engine (completed 2026-07-15)
- [ ] **Phase 7: Live refresh & write-back** — On-demand refresh + UI-triggered backfill
- [ ] **Phase 8: Deploy, gate & document** — Production Pages + Access + runbook + v0.1.0

## Phase Details

### Phase 1: Project & tooling scaffold

**Goal**: Stand up the app skeleton and Cloudflare Pages wiring so `pnpm dev` serves the shell and `pnpm build` produces a deployable `dist/`, lint + typecheck clean.
**Depends on**: Nothing (first phase)
**Requirements**: SCAF-01, SCAF-02, SCAF-03, SCAF-04
**Success Criteria** (what must be TRUE):

  1. `pnpm dev` serves the app shell (header + Overview/Timeline routes).
  2. `pnpm build` produces a deployable `dist/` with SPA fallback.
  3. Lint + typecheck pass clean; strict TypeScript, no `any`.

**Plans**: 1 plan · **Status**: Complete (VERIFICATION PASS 2026-06-24)

Plans:

- [x] 01-01: Scaffold Vite + React 19 + Router 7 + Tailwind/shadcn + Pages config

### Phase 2: Linear data layer & static snapshot

**Goal**: Read Linear into a sanitized, token-free `roadmap.json` the app renders from with zero network calls.
**Depends on**: Phase 1
**Requirements**: SNAP-01, SNAP-02, SNAP-03, SNAP-04, SNAP-05
**Success Criteria** (what must be TRUE):

  1. `pnpm sync:snapshot` produces a valid `roadmap.json` from the live AGE workspace.
  2. The app renders the snapshot with zero external network calls.
  3. No tokens or PII leak into `roadmap.json` (sanitization gate enforced).

**Plans**: 1 plan · **Status**: Complete (VERIFICATION PASS 2026-06-26; live token run deferred to CI pending `LINEAR_API_KEY` secret)

Plans:

- [x] 02-01: Typed client + snapshot script + Zod schema/loader + sanitization + CI Action

### Phase 3: Linear proxy & Access

**Goal**: Add a server-side Linear GraphQL proxy (token in a Pages Functions binding) with a live-data client path, and turn private gating into captured, blocking proof — without ever leaking the token or PII.
**Depends on**: Phase 2
**Requirements**: REQ-SHARE, REQ-GUARD, REQ-TYPE, REQ-PROXY-1, REQ-PROXY-2, REQ-PROXY-3, REQ-PROXY-4, REQ-LOADER
**Success Criteria** (what must be TRUE):

  1. `/api/linear/snapshot` serves only registered named operations, authenticated by the binding token, with the token absent from every response body.
  2. Upstream PII (emails) and malformed/error responses produce generic 5xx with no token/PII; success sets `Cache-Control: private, max-age=60`.
  3. The client defaults to the snapshot (zero `/api/*` calls) and only fetches live with `?source=live`, with a total-failure-safe fallback + "live unavailable" notice.
  4. Captured evidence proves an unauthenticated request to `/api/linear/snapshot` is blocked by Access and an allowed identity succeeds.

**Plans**: 5 plans · 4 waves · **Status**: BLOCKED (4/5 plans; success criterion 4 — Access proof — deferred as a blocking HUMAN-UAT item)

Plans:

- [x] 03-01: Make query + GQL→RawWorkspace map runtime-agnostic and Worker-importable (Wave 1)
- [x] 03-02: Config foundation — Worker types, vitest glob, functions tsconfig, live-preview script, gitignore secret (Wave 1, checkpoint)
- [x] 03-03: Build the Linear proxy Pages Function test-first (Wave 2, TDD)
- [x] 03-04: Client live-data path + source toggle with snapshot fallback (Wave 3, checkpoint)
- [~] 03-05: Access setup runbook ✅ done; **captured Access-enforcement proof BLOCKED/deferred** → `.planning/phases/03/03-HUMAN-UAT.md` (Wave 4, blocking)

### Phase 4: Roadmap timeline UI

**Goal**: The hero view — initiative swimlanes across a month axis with scheduled bars and undated backfill pills.
**Depends on**: Phase 3
**Requirements**: TL-01, TL-02, TL-03, TL-04
**Success Criteria** (what must be TRUE):

  1. All projects appear; scheduled ones as bars, undated ones as dashed needs-backfill pills.
  2. Milestone markers + hover popover with project summary and Linear link.
  3. Color-by-initiative, responsive, dark mode, and empty/loading/error states.

**Plans**: 7 plans · 4 waves · **Status**: Planned

Plans:
**Wave 1**

- [ ] 04-01-PLAN.md — D-13: thread project.url through query→map→transform→schema + pipeline tests (Wave 1)
- [ ] 04-02-PLAN.md — Pure timeline utils: dateUtils + colorUtils with unit tests, TDD (Wave 1)
- [ ] 04-03-PLAN.md — Scaffold shadcn hover-card/popover/badge (base-ui, zero new deps) (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 04-04-PLAN.md — ProjectPopoverContent + MilestoneMarker leaves (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 04-05-PLAN.md — UndatedPill + ScheduledBar interactive primitives (Wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 04-06-PLAN.md — AxisRow + InitiativeLane + TimelinePage assembly + states (Wave 4)
- [ ] 04-07-PLAN.md — Gated snapshot re-run to populate url (needs LINEAR_API_KEY) (Wave 4, checkpoint)

### Phase 5: Overview dashboard, filters & drill-down

**Goal**: An overview dashboard with KPI cards, per-initiative health, shareable URL-encoded filters, and drill-down to Linear.
**Depends on**: Phase 4
**Requirements**: OV-01, OV-02, OV-03, OV-04
**Success Criteria** (what must be TRUE):

  1. KPI cards + per-initiative health strip render from the data.
  2. Filters compose and survive reload via URL; drill-down links resolve to Linear.
  3. "Out of sync with plan" badge shows when a repo's `.planning/` is ahead of Linear.

**Plans**: TBD · **Status**: Pending

### Phase 6: sync-gsd-linear CLI (backfill engine)

**Goal**: Make Linear reflect the repos' GSD plans — per-project, dry-run-first, idempotent, every write approved.
**Depends on**: Phase 5
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04
**Success Criteria** (what must be TRUE):

  1. Dry-run prints an accurate per-project diff for the target repos.
  2. Applying one project creates milestones/issues with no duplicates on re-run (idempotent).
  3. Dates are proposed from phase order and confirmed before any write.

**Plans**: 7 plans · 5 waves · **Status**: Planned (hardened 2026-07-15 per cross-AI review — REVIEWS.md)

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Config/map/normalized-model schemas (plan identity key + taskLines, config name, ResolvedIssue, SyncOperation) + Wave-0 fixtures + seed data files (Wave 1)

**Wave 2** *(depend on 06-01 contracts)*

- [x] 06-02-PLAN.md — .planning/ walker + PLAN.md parser -> normalized model (key + taskLines) (Wave 2)
- [x] 06-03-PLAN.md — Stable identity-hash + typed GraphQL read/write document set (incl. paginated issue read) (Wave 2)

**Wave 3** *(depend on 06-03)*

- [x] 06-04-PLAN.md — Date proposer (cadence-from-anchor) + diff engine (full enumerated write set) (Wave 3)
- [x] 06-05-PLAN.md — Linear resolver: map->label->title-hash, two label pools, team, issue-identity read (Wave 3)

**Wave 4** *(depend on resolver + diff)*

- [x] 06-06-PLAN.md — Apply engine: create-only idempotent upsert + atomic per-create map write-back + gated planAhead patch (Wave 4)

**Wave 5** *(depend on apply + walker/parser)*

- [x] 06-07-PLAN.md — prompt + cli (apply-mode truth table) + entrypoint + sync:gsd script + live E2E human-verify (Wave 5, checkpoint)

### Phase 7: Live refresh & write-back

**Goal**: On-demand refresh from Linear and UI-triggered per-project backfill, both behind Access, with optimistic UI + rollback.
**Depends on**: Phase 6
**Requirements**: LIVE-01, LIVE-02, LIVE-03
**Success Criteria** (what must be TRUE):

  1. "Refresh from Linear" reconciles live data into the snapshot view.
  2. A backfill applied via the UI appears in Linear and in the next snapshot.
  3. Writes are optimistic with error rollback; scheduled snapshot refresh runs.

**Plans**: 6 plans · 4 waves · **Status**: Planned (revised per 07-REVIEWS cross-AI review)

Plans:
**Wave 1**

- [x] 07-01-PLAN.md — LIVE-01 Refresh: R-4 shouldRevalidate fix (TDD) + AppHeader Refresh button + null-safe freshness hint (Wave 1)
- [x] 07-02-PLAN.md — LIVE-02 write-path backend: dispatch (allow-list + server-side preview-before-apply) + status (run→jobs→logs, identity verify, typed diff, correlation) Pages Functions (TDD) (Wave 1)
- [x] 07-06-PLAN.md — LIVE-02 CI workflows: backfill.yml (sibling checkout, env-var project, typed diff emit, sync:snapshot rebuild + commit both files) + snapshot.yml shared concurrency (Wave 1)

**Wave 2** *(depend on 07-02 route contract)*

- [ ] 07-03-PLAN.md — LIVE-02 client core: pure dispatch/poll/optimistic-rollback with 204 correlation + transient-retry + all terminal conclusions (TDD) + explicit useBackfill hook (Wave 2)

**Wave 3** *(depend on 07-03 hook)*

- [ ] 07-04-PLAN.md — LIVE-02 optimistic UI: BACKFILL_PROJECTS id→key eligibility map + SyncBadge override + ProjectDrillDownDialog typed-diff two-phase Backfill control + OverviewPage state owner (Wave 3, human-check)

**Wave 4** *(depend on 07-01..07-04 + 07-06 finalized contracts)*

- [ ] 07-05-PLAN.md — LIVE-03 verify+reuse snapshot.yml (structural, beyond substring) + LIVE-02/03 operationally-pending record + consolidated Phase-8 HUMAN-UAT checklist (Wave 4)

### Phase 8: Deploy, gate & document

**Goal**: Ship the private URL behind Access with an auto-refreshing snapshot and a documented runbook; tag v0.1.0.
**Depends on**: Phase 7
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):

  1. Private URL live behind Cloudflare Access; `LINEAR_API_KEY` bound; gating verified end-to-end.
  2. Snapshot auto-refreshes (CI or Pages cron).
  3. README + `docs/runbook.md` cover deploy, token rotation, snapshot refresh, and backfill; `v0.1.0` tagged with a hosting/sync ADR.

**Plans**: TBD · **Status**: Pending
