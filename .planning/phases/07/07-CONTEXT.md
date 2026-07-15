# Phase 7: Live refresh & write-back - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the two "live" capabilities on top of the snapshot-first app: (1) an
**on-demand "Refresh from Linear"** control that re-pulls live data into the
rendered view, and (2) a **UI-triggered per-project backfill** (behind Access)
that runs the Phase-6 `sync-gsd-linear` CLI in CI, with **optimistic UI +
rollback** while the async job runs. Plus (3) verify/reuse the **scheduled
snapshot refresh**.

Delivers requirements **LIVE-01..LIVE-03**. Live remains an *enhancement* over
the snapshot-first, zero-network default (D-05-06) — the app must still render
fully from `public/roadmap.json` with no network.

**Out of scope:** production Pages deploy, Access policy application, and
`LINEAR_API_KEY`/GitHub-token binding are **Phase 8** (this phase builds the
code paths; Phase 8 wires the secrets and verifies end-to-end). Two-way sync
(Linear → `.planning/` pull-down) remains out of scope (REQUIREMENTS "Out of
Scope").

</domain>

<decisions>
## Implementation Decisions

### Write-back mechanism (LIVE-02)

- **D-07-01 (write path = CI dispatch):** A UI backfill button behind Access
  triggers the write via **GitHub `workflow_dispatch`**, not a direct Worker
  write. Flow: UI → a Pages Function (holding a **GitHub token binding**) →
  `workflow_dispatch` → an Actions runner checks out this repo **and the sibling
  repos**, runs the existing `pnpm sync:gsd --project <X> --apply --yes`, which
  mutates Linear and commits the refreshed `public/roadmap.json`. The app polls
  the run to completion. **Rationale:** the Phase-6 CLI is Node-only and walks
  the sibling repos' *local* `.planning/` filesystem — a deployed Pages Function
  has neither a Node runtime nor that filesystem, so it **cannot** run the
  walker/parser itself. CI is the only place the sibling filesystem exists
  naturally. This **reuses the entire Phase-6 CLI unchanged** and keeps the
  proxy Worker **read-only** (no write/mutation capability added to it).
  **Rejected:** Worker-replays-precomputed-ops (ops go stale; Worker gains write
  surface) and surface-diff-only (fails success criterion 2).

- **D-07-02 (two-phase approval — see the fresh diff, then yes):** The
  architecture's hard rule — *no write without a printed diff and an explicit
  yes for that specific project* — is honored via **two dispatches**:
  1. **Preview** dispatches a **dry-run** job → CI computes the *fresh* diff →
     UI renders it (`+ N milestones, + M issues, ~ D dates`).
  2. On the user clicking **Apply**, dispatch the **apply** job (`--apply
     --yes`, no terminal prompt in CI).
  The diff is **always fresh** (computed at preview time from live `.planning/`
  + live Linear), not cached. **Rejected:** diff-from-scheduled-artifact (can be
  up to one interval stale) and confirm-only-diff-in-logs (user approves without
  seeing changes).

- **D-07-03 (write authorization = Access only):** Triggering a backfill is
  gated by **Cloudflare Access alone** — any allow-list identity may preview +
  apply. **Rationale:** the allow-list is small/trusted (family), and Phase-6
  writes are **create-only + idempotent** (no deletes/updates that remove data),
  so the blast radius is limited. **No** additional write-email allow-list and
  **no** typed-confirm guard. (Revisit only if the audience widens.)

### "Refresh from Linear" UX (LIVE-01)

- **D-07-04 (ephemeral view refresh):** "Refresh from Linear" is a **client-side
  re-fetch of `/api/linear/snapshot`** via React Router 7 **`useRevalidator()`**,
  swapping the rendered view to the fresh live projection. It is **in-memory
  only** — it does **not** write `roadmap.json` (the client can't, and durable
  refresh is the CI job's role). The existing single try/catch + fallback-to-
  snapshot behavior in `roadmapLoader` is preserved (refresh never leaves the
  view broken). **"Reconcile into the snapshot view"** = **full replace** of the
  rendered `RoadmapJson` dataset (exactly what the loader already does on a live
  fetch), **not** a field-level merge.

- **D-07-05 (Refresh control = Live-mode only):** Add a **Refresh button in
  `AppHeader`, enabled only when in Live mode** (`?source=live`). The existing
  Snapshot/Live toggle picks the *source*; Refresh *re-pulls* live while staying
  live. Snapshot mode has **no** Refresh button (static file). Add a small
  **"last refreshed" freshness hint** derived from the snapshot's `generatedAt`
  (Claude's discretion on exact styling/placement). **Rejected:** one always-
  fetches button that subsumes the toggle; always-visible Refresh (near-no-op in
  snapshot mode).

### Optimistic UI + rollback (LIVE-02)

- **D-07-06 (optimism attaches to the `planAhead` badge):** On **Apply**,
  optimistically flip the target project's **OV-04 "out of sync with plan"
  badge** (`planAhead`) from out-of-sync → **in-sync**, and show a
  **"backfilling…" pending indicator** on that project. On a polled CI
  **success**, keep in-sync and clear the pending state; on **failure/cancelled**,
  **revert** `planAhead` to out-of-sync and show an **error toast**.
  **Rationale:** the backfill's real effect (new milestones/issues) isn't
  fetchable until the next snapshot rebuild, so `planAhead` is the one *real*
  snapshot signal we can move — this makes "optimistic + rollback" concrete and
  grounded. **Rejected:** pending/confirm-only (not literally optimistic) and
  inject-expected-records (snapshot has aggregate `issueCounts` only, no
  per-issue records — fragile).

- **D-07-07 (outcome tracking = Worker-proxied polling):** The client learns the
  CI job outcome by **polling a Pages Function** (e.g.
  `/api/backfill/status?run=<id>`) that reads the **GitHub Actions run status
  using the server-side GitHub token** and returns `{ status, conclusion, diff? }`.
  Success → confirm; failure/cancelled → rollback + toast. **The same status
  endpoint returns the dry-run diff** (artifact/job output) for the D-07-02
  preview phase. The GitHub token **never** reaches the client (mirrors the
  read-proxy's token-server-side invariant). **Tab-close mid-job:** the
  optimistic state is client-only and lost on reload, but the CI job completes
  server-side and the **next snapshot reflects the true state** — acceptable.
  **Rejected:** fire-and-forget + next-snapshot reconciliation (no immediate
  rollback; no diff readback path).

### Scheduled snapshot refresh (LIVE-03)

- **D-07-08 (reuse existing `snapshot.yml` — do not rebuild):** LIVE-03's
  mechanism **already exists**: `.github/workflows/snapshot.yml` runs
  `workflow_dispatch` + a **daily `schedule: cron "0 6 * * *"`**, runs
  `pnpm sync:snapshot`, and **commits `public/roadmap.json` when it changes**
  (with a `concurrency` guard). LIVE-03 is therefore **verify + reuse**, not a
  new build. **Cadence stays daily.** CI cron is the correct home because a
  Cloudflare Pages/Worker cron **cannot commit** the static `roadmap.json` to
  git. **Cross-phase dependency:** the cron can only *succeed* once
  `LINEAR_API_KEY` is bound as a repo secret — that binding is **Phase 8**
  (already tracked as a deferred item since Phase 2). **Rejected:** Pages Cron
  Trigger (adds a hop, can't commit the file). The on-demand "rebuild snapshot"
  (if built later) may reuse `snapshot.yml`'s `workflow_dispatch`.

### Claude's Discretion

- The **new backfill workflow file** (e.g. `.github/workflows/backfill.yml`)
  and its inputs (`project`, and a `mode` = dry-run|apply) — shape, checkout
  strategy, and a `concurrency` group (mirror `snapshot.yml`) are Claude's
  discretion, within D-07-01/02's contract.
- The **GitHub token model** (fine-grained PAT vs GitHub App) and the
  **credential used to clone the sibling private repos** in CI — implementation
  choice, subject to the risk note below; the token must live only in a Pages
  Functions binding / CI secret, never in the client bundle or `roadmap.json`.
- Exact **Pages Function route shapes** for dispatch + status
  (`/api/backfill*`), diff artifact format, poll interval/backoff, and the
  freshness-hint styling.
- Whether the apply job passes `--write-snapshot` explicitly or relies on the
  apply-path's snapshot patch — as long as the refreshed `roadmap.json` is
  committed so the `planAhead` flip becomes durable (see risk R-3).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 7: Live refresh & write-back" — goal + success
  criteria (refresh reconciles into the view; UI backfill appears in Linear and
  the next snapshot; optimistic + rollback; scheduled refresh runs).
- `.planning/REQUIREMENTS.md` — **LIVE-01, LIVE-02, LIVE-03** (authoritative req
  text) + "Out of Scope" (two-way sync deferred).
- `.planning/phases/07/PLAN.md` — original one-line stub brief (superseded by
  this context; keep for the "Done when" framing).

### Architecture & data path
- `docs/architecture.md` §"Data paths" (snapshot default + live enhancement),
  §"Decisions" (Pattern C hybrid), and §"Open follow-ups" (scheduled refresh
  cadence — now decided in D-07-08). "Write-back from the sync tool" via Pages
  Functions is refined by D-07-01 (Worker dispatches CI; the CLI runs in CI).
- `CLAUDE.md` §"Always do" / §"Never do" — snapshot is the default data path;
  token stays server-side; **no bulk-write** (per-project only); no token/PII in
  `roadmap.json`. Hard constraints for the write path.

### Prior-phase decisions this phase builds on
- `.planning/phases/06/06-CONTEXT.md` — the `sync-gsd-linear` CLI contract:
  Node-only, raw GraphQL mutations (D-06-08), per-project + `--yes` (D-06-07),
  create-only idempotent (D-06-03), `planAhead` emission (D-06-09).
- `.planning/phases/05/05-CONTEXT.md` — D-05-02: the `planAhead?` optional-field
  OV-04 badge this phase's optimistic flip (D-07-06) toggles.
- `.planning/phases/03/03-CONTEXT.md` (and 03-04) — the live-data path + source
  toggle + fallback contract that Refresh (D-07-04) reuses.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/roadmap/loader.ts` — `roadmapLoader` (the `?source=live` fetch +
  single try/catch + fallback) and `shouldRevalidateRoadmap` (revalidates only
  when source mode flips). **Refresh (D-07-04) uses `useRevalidator()`**, which
  re-runs this loader **without** a source-mode flip — so `shouldRevalidateRoadmap`
  must NOT block an explicit revalidate. Verify the interaction (an explicit
  `revalidator.revalidate()` bypasses `shouldRevalidate`, but confirm).
- `src/components/AppHeader.tsx` — the Snapshot/Live toggle + `liveUnavailable`
  notice; the Refresh button (D-07-05) and freshness hint slot in here.
- `scripts/sync-gsd-linear/*` (esp. `cli.ts`) — the entire backfill engine run
  **unchanged** in CI by the new `backfill.yml`. Invocation truth table in
  `cli.ts` header: `--project X --apply --yes` = write, no prompt.
- `scripts/sync-snapshot.ts` + `.github/workflows/snapshot.yml` — the existing
  CI-cron snapshot job (D-07-08 reuses it) and the `tsx scripts/*.ts` pattern to
  mirror for the backfill workflow.
- `functions/api/linear/[[path]].ts` — the read-proxy Pages Function: the
  named-operation registry, generic-502 single try/catch, and
  token-only-in-header discipline are the **pattern to mirror** for the new
  `/api/backfill*` dispatch + status functions (which add a GitHub token
  binding, kept out of every response body).

### Established Patterns
- **Snapshot-first, zero-network** default (D-05-06): the app renders from
  `roadmap.json`; live is opt-in via `?source=live`. Refresh must not weaken
  this (snapshot mode stays network-free).
- **Token-server-side invariant**: the read proxy holds `LINEAR_API_KEY` only in
  a binding, never in a body. The new GitHub token follows the same rule.
- **Single try/catch → generic error** in Pages Functions (leak-safe). Apply the
  same to the dispatch/status functions.

### Integration Points
- New **Pages Functions** under `functions/api/backfill*` — dispatch (POST,
  returns run id) + status (GET `?run=<id>`, returns `{status, conclusion,
  diff?}`). Both behind Access; both hold the GitHub token binding.
- New **`.github/workflows/backfill.yml`** — `workflow_dispatch` with `project`
  + `mode` inputs; checks out roadmap + sibling repos; runs `sync:gsd`.
- `AppHeader` (Refresh) + the project drill-down / KPI components (optimistic
  `planAhead` flip + pending state) — client wiring points.

</code_context>

<specifics>
## Specific Ideas

- Two-phase backfill UX shape:
  ```
  [Backfill: claude-workflow]  →  dispatch dry-run job → poll
    claude-workflow → Linear
    + 3 milestones, + 11 issues, ~ 4 dates
    [Apply]  →  dispatch apply job (--yes) → poll → done → revalidate
  ```
- Initial target repos for UI backfill mirror Phase 6: `../claude-workflow`,
  `../../factiv/cparx`, `../../factiv/fx-signal-agent` (from `sync.config.json`).
- Refresh affordance: `[ Snapshot | Live ] [↻ Refresh]  · updated 2h ago`.

</specifics>

<deferred>
## Deferred Ideas

- **Persistent on-demand snapshot rebuild from the UI** (dispatch `snapshot.yml`)
  — not needed for LIVE-01 (ephemeral refresh chosen, D-07-04); easy to add later
  by reusing the dispatch plumbing.
- **Access + write-email allow-list / typed-confirm** on the write path — deferred
  (D-07-03 chose Access-only); revisit if the audience widens.
- **Two-way sync (Linear → `.planning/` pull-down)** — out of scope (architecture
  follow-up).
- **Real-time job progress (SSE/websocket)** instead of polling — polling chosen
  (D-07-07); revisit only if poll latency proves annoying.

</deferred>

## Risks / Constraints (carry into planning)

- **R-1 (Phase 8 dependency):** Both the scheduled cron (D-07-08) and the CI
  backfill require secrets bound in Phase 8 (`LINEAR_API_KEY`) plus a **GitHub
  token** for the Worker→dispatch call. This phase builds the paths; they can't
  be *end-to-end verified live* until Phase 8 — plan for a mock/unit-tested
  boundary + a HUMAN-UAT item, mirroring Phase 3's Access-proof handling.
- **R-2 (CI sibling-repo access):** The backfill runner must **clone the sibling
  *private* repos** (`claude-workflow`, `cparx`, `fx-signal-agent`). The runner
  needs credentials (PAT/deploy token/GitHub App with read on the family repos).
  This is a real prerequisite that could block LIVE-02 — surface it early.
- **R-3 (durable `planAhead`):** For success criterion 2 ("appears in the next
  snapshot"), the **apply job must commit the refreshed `roadmap.json`** (so the
  optimistic `planAhead` flip becomes durable truth, not just an ephemeral
  client flip). Ensure the apply invocation persists the snapshot patch.
- **R-4 (`useRevalidator` vs `shouldRevalidateRoadmap`):** confirm an explicit
  revalidate re-runs the loader in Live mode without being suppressed by the
  same-source-mode gate.

---

*Phase: 07-live-refresh-and-write-back*
*Context gathered: 2026-07-15*
