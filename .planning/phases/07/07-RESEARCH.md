# Phase 7: Live refresh & write-back - Research

**Researched:** 2026-07-15
**Domain:** Cloudflare Pages Functions ↔ GitHub Actions (`workflow_dispatch` trigger + status polling), React Router 7 revalidation internals, CI cross-repo checkout for a private-org monorepo-of-repos
**Confidence:** MEDIUM-HIGH (the React Router revalidation question is HIGH — verified directly against installed source; the GitHub Actions dispatch/readback mechanics are MEDIUM — verified against official docs but cannot be live-tested until Phase 8 secrets exist, per R-1)

## Summary

This phase's 8 decisions (D-07-01..08) are locked; the open work is wiring three new
surfaces — a GitHub `workflow_dispatch` trigger, a status-polling readback, and a
client-side optimistic-UI seam — onto existing, well-established patterns in this
codebase. Three findings materially change what the planner should write into tasks:

1. **R-4 is a real, confirmed bug-in-waiting, not a hypothetical.** Inspecting the
   installed `react-router-dom@7.18.0` source directly (not docs, which are silent on
   this) shows that `shouldRevalidateRoadmap`, as currently written, WILL suppress an
   explicit `useRevalidator().revalidate()` call in Live mode. The fix is a one-line,
   precisely-scoped change (see Pitfall 1 + Code Examples) — but it must be a task in
   this phase's plan, not an afterthought discovered during Refresh-button wiring.
2. **The GitHub `workflow_dispatch` API returns 204 No Content with no run id** in the
   general case, forcing a poll-and-correlate pattern. GitHub shipped an opt-in
   `return_run_details` parameter (per the Feb 2026 changelog) that returns the run id
   directly in a 200 response — if available on this repo's plan/API version, this
   eliminates the entire correlation-polling problem and should be tried first, with
   the list-and-correlate fallback as a documented Plan B in case it 404s or the field
   is absent.
3. **R-2 (sibling private-repo checkout) is smaller than it looks, but has one sharp
   edge.** All four repos (`agenticapps-roadmap`, `claude-workflow`, `cparx`,
   `fx-signal-agent`) live under the single GitHub org `agenticapps-eu` — confirmed via
   `git remote -v` on all four local clones — so ONE fine-grained PAT scoped to that
   org's repos covers checkout + dispatch + status-read. The sharp edge:
   `actions/checkout`'s `path:` parameter **cannot escape `$GITHUB_WORKSPACE`**
   (`actions/checkout#1812`/`#197`) — the CLI's `../claude-workflow` /
   `../../factiv/cparx` relative paths (designed for local dev) will NOT resolve
   as-is in a naive CI checkout. The fix is a specific checkout layout (below), not a
   config or CLI code change.

**Primary recommendation:** Build the two new Pages Functions
(`functions/api/backfill/dispatch.ts`, `functions/api/backfill/status.ts`) as raw
`fetch()` calls to the GitHub REST API — mirroring the existing Linear proxy's
no-SDK, single-try/catch, generic-error pattern exactly — and build the new
`.github/workflows/backfill.yml` around a checkout layout that reproduces
`sync.config.json`'s relative-path assumptions inside `$GITHUB_WORKSPACE`, so the
Phase-6 CLI runs completely unmodified.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ephemeral live refresh (LIVE-01) | Frontend (SSR-less SPA, client loader) | API/Backend (existing `/api/linear/snapshot` proxy) | Pure re-fetch through the already-existing read proxy; no new backend surface |
| Backfill dispatch (LIVE-02, D-07-01) | API/Backend (new Pages Function) | CI (GitHub Actions) | Function is a thin, stateless trigger; CI owns the actual Node execution (D-07-01 rationale: Pages Function has no Node runtime / sibling filesystem) |
| Backfill status/diff readback (LIVE-02, D-07-07) | API/Backend (new Pages Function) | CI (GitHub Actions, as data source) | Function proxies GitHub's run/artifact API exactly as it proxies Linear's GraphQL API today — same tier, same trust boundary |
| Optimistic `planAhead` flip + rollback (D-07-06) | Browser/Client | — | Purely client-local state (no server round-trip needed to flip a badge before confirmation) |
| Scheduled snapshot refresh (LIVE-03, D-07-08) | CI (GitHub Actions cron) | — | Already built (`snapshot.yml`); Pages/Workers cron cannot commit to git, ruled out by D-07-08 |
| Write to Linear (mutation) | CI (GitHub Actions, running the Phase-6 CLI) | — | The Worker/Function tier is explicitly kept read-only (D-07-01); no write capability is added to it |

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-07-01 (write path = CI dispatch):** UI backfill button → Pages Function (GitHub
  token binding) → `workflow_dispatch` → Actions runner checks out this repo + siblings
  → runs `pnpm sync:gsd --project <X> --apply --yes` → mutates Linear + commits
  refreshed `public/roadmap.json`. Proxy Worker stays read-only.
- **D-07-02 (two-phase approval):** Two dispatches — (1) Preview = dry-run job, fresh
  diff rendered in UI; (2) Apply = user clicks Apply → apply job (`--apply --yes`).
  Diff always fresh (never cached/from-scheduled-artifact).
- **D-07-03 (write authorization = Access only):** Cloudflare Access alone gates
  triggering a backfill. No additional write-email allow-list, no typed-confirm guard.
- **D-07-04 (ephemeral view refresh):** "Refresh from Linear" = client-side re-fetch of
  `/api/linear/snapshot` via `useRevalidator()`. In-memory only, never writes
  `roadmap.json`. Existing single try/catch + fallback-to-snapshot preserved.
  "Reconcile" = full replace of the rendered `RoadmapJson`, not a field merge.
- **D-07-05 (Refresh control = Live-mode only):** Refresh button in `AppHeader`,
  enabled only when `?source=live`. Snapshot mode has no Refresh button. Add a small
  "last refreshed" freshness hint from `generatedAt` (styling = Claude's discretion).
- **D-07-06 (optimism attaches to `planAhead` badge):** On Apply, optimistically flip
  the target project's OV-04 badge out-of-sync → in-sync + show "backfilling…"
  pending indicator. On polled success: keep in-sync, clear pending. On
  failure/cancelled: revert to out-of-sync + error toast.
- **D-07-07 (outcome tracking = Worker-proxied polling):** Client polls a Pages
  Function (e.g. `/api/backfill/status?run=<id>`) reading GitHub Actions run status via
  the server-side GitHub token, returns `{ status, conclusion, diff? }`. Same endpoint
  returns the dry-run diff for the D-07-02 preview phase. GitHub token never reaches
  the client. Tab-close mid-job is acceptable (next snapshot reflects true state).
- **D-07-08 (reuse `snapshot.yml`):** LIVE-03's mechanism already exists
  (`workflow_dispatch` + daily cron + commit-on-change + concurrency guard). Verify +
  reuse, not rebuild. Cadence stays daily. Cross-phase dependency: cron can only
  *succeed* once `LINEAR_API_KEY` is bound (Phase 8).

### Claude's Discretion

- New backfill workflow file (`.github/workflows/backfill.yml`) shape, inputs
  (`project`, `mode` = dry-run|apply), checkout strategy, `concurrency` group.
- GitHub token model (fine-grained PAT vs GitHub App) and the credential used to clone
  sibling private repos in CI — must live only in a Pages Functions binding / CI
  secret, never client bundle or `roadmap.json`.
- Exact Pages Function route shapes for dispatch + status (`/api/backfill*`), diff
  artifact format, poll interval/backoff, freshness-hint styling.
- Whether the apply job passes `--write-snapshot` explicitly or relies on the
  apply-path's snapshot patch — as long as the refreshed `roadmap.json` is committed
  (R-3).

### Deferred Ideas (OUT OF SCOPE)

- Persistent on-demand snapshot rebuild from the UI (dispatch `snapshot.yml`) — not
  needed for LIVE-01; easy to add later by reusing the dispatch plumbing.
- Access + write-email allow-list / typed-confirm on the write path — deferred
  (D-07-03 chose Access-only); revisit if the audience widens.
- Two-way sync (Linear → `.planning/` pull-down) — out of scope (architecture
  follow-up).
- Real-time job progress (SSE/websocket) instead of polling — polling chosen
  (D-07-07); revisit only if poll latency proves annoying.

### Risks / Constraints carried into planning

- **R-1 (Phase 8 dependency):** Both the scheduled cron and CI backfill require
  secrets bound in Phase 8 (`LINEAR_API_KEY` + new GitHub token). This phase builds
  the paths; end-to-end live verification is a Phase-8 HUMAN-UAT item.
- **R-2 (CI sibling-repo access):** Runner must clone `claude-workflow`, `cparx`,
  `fx-signal-agent` (private). Needs credentials with read on all three. Real
  prerequisite — surfaced early below.
- **R-3 (durable `planAhead`):** Apply job must commit the refreshed `roadmap.json` so
  the optimistic flip becomes durable, not just an ephemeral client flip.
- **R-4 (`useRevalidator` vs `shouldRevalidateRoadmap`):** Confirm an explicit
  revalidate re-runs the loader in Live mode without being suppressed by the
  same-source-mode gate. **Answered definitively below (Pitfall 1) — it currently
  would be suppressed; a fix is required.**
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIVE-01 | "Refresh from Linear" in live mode reconciles live data into the snapshot view | R-4 finding (verified `shouldRevalidateRoadmap` fix) + `useRevalidator()` wiring pattern in Code Examples |
| LIVE-02 | UI-triggered per-project backfill (behind Access) with optimistic UI + error rollback | GitHub `workflow_dispatch`/status API mechanics, CI checkout layout fix (R-2), optimistic-state seam in `OverviewPage`/`ProjectDrillDownDialog` |
| LIVE-03 | Scheduled snapshot refresh (CI cron or Pages cron) | Verified `snapshot.yml` already satisfies this (D-07-08) — task is verification + a short note, not new code |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- TypeScript everywhere; no `any` in committed code — new Pages Functions and CI
  glue code must be fully typed (extend the `Env` interface pattern already used in
  `functions/api/linear/[[path]].ts`).
- Linear token stays server-side (bindings/CI secrets only) — the **new GitHub token**
  is held to the identical rule: Pages Functions binding + GitHub Actions secret only,
  never in `roadmap.json`, client bundle, or any response body.
- Snapshot is the default, zero-network data path — Refresh/backfill are additive; must
  not weaken snapshot-mode's no-network guarantee (Refresh button is Live-mode-only
  per D-07-05, already enforces this).
- GSD sync stays dry-run-first and per-project — D-07-02's two-dispatch design is the
  UI-level embodiment of this; no code path may skip straight to apply.
- Never duplicate Linear records — untouched by this phase; the Phase-6 CLI's
  resolve-by-map/label/hash logic runs unmodified in CI.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none new — raw `fetch`) | — | GitHub REST API calls (dispatch + status) from the Pages Function | Mirrors `functions/api/linear/[[path]].ts`'s existing no-SDK pattern exactly (`fetchAssembledWorkspace` calls raw GraphQL via `fetch`); adding `@octokit/rest` (~50kB, Node-oriented) would be inconsistent with the codebase's established style and Simplicity-First discipline for 2 simple REST calls |
| `react-router-dom` | 7.18.0 (already installed) | `useRevalidator()` for LIVE-01 | Already the app's router; no new dependency |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fflate` | 0.8.3 `[ASSUMED — see Package Legitimacy Audit]` | Unzip a GitHub Actions artifact download in the Worker (only needed IF the artifact-based diff readback is chosen over the job-logs-grep readback — see Code Examples §3) | Only if D-07-07's "diff (artifact)" path is implemented; not needed if the job-logs-grep alternative is used instead |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` to GitHub REST API | `@octokit/rest` / `octokit` SDK | SDK adds ~50-100kB and Node-flavored ergonomics (retry/pagination helpers) the phase doesn't need for 3-4 simple calls; raw fetch matches the codebase's existing Linear-proxy style and keeps the Worker bundle small |
| Artifact download + unzip (`fflate`) for diff readback | Job-logs-grep (fetch plain-text job logs, extract a delimited JSON line) | Job-logs-grep needs zero new dependencies and the "Download job logs" endpoint is confirmed plain text (not zip) by official docs — **recommended primary**, artifact is the documented-but-heavier fallback |
| Fine-grained PAT for the GitHub token | GitHub App installation token | GitHub App avoids PAT expiry/rotation maintenance and is the more "correct" long-term answer, but adds installation-setup complexity (private key, JWT exchange, installation token minting) disproportionate to this phase's single-org, small-audience scope (D-07-03: Access-gated, trusted family). PAT is simpler and sufficient; note as a Phase-8/later hardening candidate |
| `workflow_dispatch` + list-and-correlate polling | `return_run_details=true` on the dispatch call | Try `return_run_details` first (per Feb 2026 GitHub changelog) — if it works, it eliminates the whole correlation problem in one call. Keep the correlation-id fallback path coded but untested-until-live (R-1), since this repo's exact API/plan support for the new parameter cannot be confirmed without a live call |

**Installation:**
```bash
# Only if the artifact-unzip readback path is chosen (see Code Examples §3):
pnpm add fflate
```

**Version verification:** `npm view fflate version` confirmed `0.8.3` published under MIT,
repo `github.com/101arrowz/fflate`, created 2020 (54 published versions — long-lived,
actively maintained). `npm view fflate scripts.postinstall` returned empty (no
postinstall script — reduces supply-chain risk). This package name was recalled from
training knowledge and cross-checked against the npm registry in this session, so per
the provenance rule it is tagged `[ASSUMED]`, not `[VERIFIED]`, until a human confirms
it (or `slopcheck` runs — unavailable this session, see audit below).

## Package Legitimacy Audit

> `slopcheck` could not be installed in this sandboxed research session (installation of
> unrequested packages is blocked by the environment's permission policy). Per the
> graceful-degradation protocol, **every** recommended package below is tagged
> `[ASSUMED]` and the planner MUST gate its install behind a `checkpoint:human-verify`
> task — even though it also passed a manual `npm view` registry check in this session.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `fflate` | npm | ~6 yrs (created 2020-09-20) | not queried (rate-limited registry call avoided) | `github.com/101arrowz/fflate` | not run — unavailable | `[ASSUMED]` — Approved pending human-verify checkpoint, only if the artifact-unzip readback path is chosen over job-logs-grep |

**Packages removed due to slopcheck `[SLOP]` verdict:** none (slopcheck did not run)
**Packages flagged as suspicious `[SUS]`:** none (slopcheck did not run)

*All packages above are `[ASSUMED]`; the planner must gate the `fflate` install (if
that code path is chosen) behind a `checkpoint:human-verify` task.* Note also: the
**recommended primary** diff-readback approach (job-logs-grep, see Code Examples §3)
needs **zero new npm packages** — prefer it specifically to avoid this gate entirely,
per Simplicity-First.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐
│  Browser (Live mode only)   │
│  AppHeader "Refresh" button │──useRevalidator().revalidate()──┐
│  ProjectDrillDownDialog     │                                  │
│  "Backfill: <project>"      │──POST /api/backfill/dispatch────┼──┐
│  button (optimistic flip)   │──poll GET /api/backfill/status──┼──┼──┐
└─────────────────────────────┘                                  │  │  │
                                                                   ▼  │  │
                                            (existing, unchanged)     │  │
                                   ┌──────────────────────────┐      │  │
                                   │ GET /api/linear/snapshot  │◄─────┘  │
                                   │ (root loader re-fetch)    │         │
                                   └──────────────────────────┘         │
                                                                          ▼
                              ┌───────────────────────────────────────────────┐
                              │ Pages Functions (new, mirrors existing style)  │
                              │  functions/api/backfill/dispatch.ts            │
                              │   - Access-gated (edge, before Function runs)  │
                              │   - POST GitHub .../dispatches (GITHUB token)  │
                              │   - returns { runId } (via return_run_details  │
                              │     OR list-and-correlate fallback)            │
                              │  functions/api/backfill/status.ts              │
                              │   - GET GitHub .../runs/{id} (status/conclusion)│
                              │   - on completion, GET job logs, extract diff  │
                              │   - returns { status, conclusion, diff? }      │
                              │   - GitHub token NEVER in response body        │
                              └───────────────────────────────────────────────┘
                                                     │ dispatches
                                                     ▼
                              ┌───────────────────────────────────────────────┐
                              │ GitHub Actions: .github/workflows/backfill.yml │
                              │  1. checkout agenticapps-roadmap → path:       │
                              │     agenticapps-roadmap                        │
                              │  2. checkout claude-workflow → path:           │
                              │     claude-workflow  (uses cross-repo PAT)     │
                              │  3. checkout cparx → path: factiv/cparx        │
                              │  4. checkout fx-signal-agent → path:           │
                              │     factiv/fx-signal-agent                     │
                              │  5. cd agenticapps-roadmap; pnpm sync:gsd \    │
                              │     --project <X> [--apply --yes]              │
                              │     (relative ../, ../../factiv/* paths now    │
                              │      resolve exactly as in local dev)          │
                              │  6. dry-run: echo delimited diff JSON to stdout│
                              │     apply: commit refreshed roadmap.json (R-3) │
                              └───────────────────────────────────────────────┘
                                                     │ mutates
                                                     ▼
                                              Linear (GraphQL API)
```

### Recommended Project Structure

```
functions/
├── api/
│   ├── linear/[[path]].ts        # existing, unchanged
│   └── backfill/
│       ├── dispatch.ts            # POST — triggers workflow_dispatch, returns { runId }
│       ├── dispatch.test.ts
│       ├── status.ts              # GET ?run=<id> — polls run + reads diff
│       └── status.test.ts
.github/workflows/
├── snapshot.yml                   # existing, unchanged (D-07-08 verify+reuse)
└── backfill.yml                   # new — dry-run|apply modes, project input
src/
├── components/
│   ├── AppHeader.tsx               # + Refresh button, freshness hint (D-07-05)
│   └── overview/
│       ├── ProjectDrillDownDialog.tsx  # + Backfill button, preview/apply flow
│       └── SyncBadge.tsx               # unchanged — consumes an overridden planAhead
├── lib/
│   ├── roadmap/loader.ts           # shouldRevalidateRoadmap fix (Pitfall 1)
│   └── backfill/                   # new — client-side dispatch/poll/optimistic-state hook
│       ├── useBackfill.ts
│       └── useBackfill.test.ts
```

### Pattern 1: Mirror the existing Linear-proxy Function shape exactly

**What:** Both new Functions (`dispatch.ts`, `status.ts`) should structurally copy
`functions/api/linear/[[path]].ts`: a typed `Env` interface, a single try/catch around
the entire upstream-call stretch collapsing every failure mode to one generic error
status, and the token read only from `env.<BINDING_NAME>` — never logged, never echoed.

**When to use:** Both new backfill Functions, no exceptions (this is a locked
project-level pattern, not a per-function choice).

**Example:**
```typescript
// Source: functions/api/linear/[[path]].ts (existing file in this repo), adapted
interface Env {
  LINEAR_API_KEY: string;
  GH_BACKFILL_TOKEN: string; // new binding — distinct name, avoids colliding with
                              // GitHub Actions' own reserved GITHUB_TOKEN context var
}

const GITHUB_API = "https://api.github.com";
const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "agenticapps-roadmap-backfill", // REQUIRED — GitHub REST API 403s
                                                  // requests with no User-Agent header;
                                                  // Workers' fetch does not set one by
                                                  // default the way browsers do.
});
```

### Pattern 2: Checkout layout that reproduces `sync.config.json`'s relative paths

**What:** `sync.config.json` encodes `repoPath` as `../claude-workflow`,
`../../factiv/cparx`, `../../factiv/fx-signal-agent` — resolved via
`join(entry.repoPath, ".planning")` relative to the CLI's process CWD (confirmed in
`scripts/sync-gsd-linear/cli.ts` `buildModel()`). Locally this works because the repos
sit at `~/Sourcecode/agenticapps/{agenticapps-roadmap,claude-workflow}` and
`~/Sourcecode/factiv/{cparx,fx-signal-agent}` (verified via `git remote -v` — all four
share the org `agenticapps-eu`, confirming the family/topology described in the
project's parent `CLAUDE.md`). `actions/checkout`'s `path:` cannot escape
`$GITHUB_WORKSPACE` (confirmed via `actions/checkout` issues #1812 and #197 — "Repository
path '...' is not under '$GITHUB_WORKSPACE'"), so the workflow must check out the
**roadmap repo itself into a subdirectory**, not the workspace root, so the siblings can
sit alongside it inside the workspace boundary.

**When to use:** `.github/workflows/backfill.yml`, every job.

**Example:**
```yaml
# Source: actions/checkout docs (github.com/actions/checkout) + this repo's
# sync.config.json layout — synthesized for this phase, not copied verbatim from
# an existing file (this workflow doesn't exist yet)
steps:
  - name: Checkout agenticapps-roadmap
    uses: actions/checkout@v4
    with:
      path: agenticapps-roadmap

  - name: Checkout claude-workflow (sibling, ../claude-workflow)
    uses: actions/checkout@v4
    with:
      repository: agenticapps-eu/claude-workflow
      token: ${{ secrets.GH_CROSS_REPO_TOKEN }}
      path: claude-workflow

  - name: Checkout cparx (sibling, ../../factiv/cparx)
    uses: actions/checkout@v4
    with:
      repository: agenticapps-eu/cparx
      token: ${{ secrets.GH_CROSS_REPO_TOKEN }}
      path: factiv/cparx

  - name: Checkout fx-signal-agent (sibling, ../../factiv/fx-signal-agent)
    uses: actions/checkout@v4
    with:
      repository: agenticapps-eu/fx-signal-agent
      token: ${{ secrets.GH_CROSS_REPO_TOKEN }}
      path: factiv/fx-signal-agent

  # ... setup-node/pnpm as in snapshot.yml ...

  - name: Run sync-gsd-linear
    working-directory: agenticapps-roadmap   # CWD here makes ../claude-workflow and
                                              # ../../factiv/cparx resolve EXACTLY as
                                              # sync.config.json expects — zero CLI or
                                              # config changes required.
    env:
      LINEAR_API_KEY: ${{ secrets.LINEAR_API_KEY }}
    run: pnpm sync:gsd -- --project "${{ inputs.project }}" ${{ inputs.mode == 'apply' && '--apply --yes' || '' }}
```

This is a **workflow-file-only** fix — it requires no change to `sync.config.json`,
`cli.ts`, or `walker.ts`. Flag this clearly to the planner: do NOT "fix" the relative
paths in the CLI to be CI-friendly; fix the checkout layout instead (Surgical Changes
discipline — the CLI's paths are correct for their actual contract, which is
"relative to CWD," and CI must satisfy that contract, not rewrite it).

### Pattern 3: Explicit revalidate wiring for LIVE-01

**What:** The Refresh button calls `useRevalidator().revalidate()`. Per Pitfall 1
below, `shouldRevalidateRoadmap` must be updated (not replaced) to let this through
while still blocking filter/drill-down navigations.

**When to use:** `AppHeader.tsx` Refresh button + `src/lib/roadmap/loader.ts`.

**Example:**
```typescript
// Source: verified against installed react-router-dom@7.18.0 source
// (node_modules/.pnpm/react-router@7.18.0.../chunk-4ZMWKKQ3.mjs, shouldRevalidateLoader
// + getMatchesToLoad) — this is the corrected version of the existing function.
export function shouldRevalidateRoadmap({
  currentUrl,
  nextUrl,
}: ShouldRevalidateFunctionArgs): boolean {
  const sourceMode = (u: URL) =>
    u.searchParams.get("source") === "live" ? "live" : "snapshot";
  if (sourceMode(currentUrl) !== sourceMode(nextUrl)) {
    return true; // existing behavior: toggle flips source — unchanged
  }
  // An explicit revalidator.revalidate() call re-navigates to the CURRENT
  // location unchanged (react-router internals: startNavigation(historyAction,
  // state.location, ...) when idle) — so pathname+search are IDENTICAL between
  // currentUrl and nextUrl. A filter or ?project= navigation always changes
  // search, so this branch is false for those and revalidation stays
  // suppressed (05-REVIEWS zero-network intent preserved).
  const asString = (u: URL) => u.pathname + u.search;
  return asString(currentUrl) === asString(nextUrl);
}
```

```typescript
// AppHeader.tsx — Refresh button, Live-mode-only (D-07-05)
import { useRevalidator } from "react-router-dom";

const revalidator = useRevalidator();
const refreshing = revalidator.state === "loading";

{live && (
  <button
    onClick={() => revalidator.revalidate()}
    disabled={refreshing}
    aria-label="Refresh from Linear"
  >
    {refreshing ? "Refreshing…" : "↻ Refresh"}
  </button>
)}
```

### Anti-Patterns to Avoid

- **Modifying `sync.config.json` repoPath values for CI:** Breaks local dev (the
  values are correct for the developer's actual `~/Sourcecode` layout). Fix the
  checkout layout instead (Pattern 2).
- **Adding a GitHub SDK dependency for 3-4 REST calls:** Inconsistent with the
  codebase's established raw-fetch style and adds unnecessary bundle weight to a
  Pages Function; use `fetch` directly, matching `fetchAssembledWorkspace`'s pattern.
- **Replacing `shouldRevalidateRoadmap` wholesale with `defaultShouldRevalidate`:**
  Regresses Phase-5's zero-network filter fix (defaultShouldRevalidate is also `true`
  on every search-param change, not just explicit revalidation — see Pitfall 1's full
  analysis). The fix must be additive (Pattern 3), not a reversion.
- **Reusing `LINEAR_API_KEY`'s binding name for the GitHub token:** Use a distinct
  name (e.g. `GH_BACKFILL_TOKEN`) — reusing a name invites a copy-paste binding
  mistake in the Cloudflare dashboard that silently breaks the Linear proxy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Correlating a dispatched run back to its run id | A custom webhook receiver / GitHub App event listener | `return_run_details=true` on the dispatch call (try first) → fallback: `GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs?event=workflow_dispatch&created=>=<ISO timestamp>` filtered by a client-generated correlation string embedded in `inputs` | GitHub's own documented mechanisms cover this; a webhook receiver needs a public callback URL + its own auth model — disproportionate for a same-org, Access-gated trigger |
| Reading structured output from a completed CI job | A custom artifact-hosting service or S3 bucket | GitHub's own artifact API (`actions/upload-artifact` + `GET .../artifacts/{id}/zip`) OR job-logs-grep (`GET .../jobs/{job_id}/logs`, confirmed plain text) | Both are native to GitHub Actions; no reason to build a second storage hop for a few KB of JSON |
| Zip parsing (if the artifact path is chosen) | A hand-rolled DEFLATE/zip reader | `fflate` (8kB, pure JS, Workers-compatible) `[ASSUMED — gate behind checkpoint]` | Zip format parsing has many edge cases (central directory, data descriptors); not worth hand-rolling for one read path — but prefer the job-logs-grep alternative to avoid this dependency entirely |
| Optimistic-state + rollback bookkeeping | A new global state library (Zustand/Redux/Context) | Local `useState` in `OverviewPage`/`ProjectDrillDownDialog` holding a `Map<projectId, { pendingBackfill: boolean; planAheadOverride?: boolean }>`, merged into `data.projects` before render | The app has **no existing global state library** (confirmed by codebase grep — only `useState`/`useSearchParams`/router loader data); this phase's optimistic state is one project at a time, ephemeral, and component-scoped — Simplicity First rules out introducing a new state layer for it |

**Key insight:** Every new capability in this phase has a native GitHub Actions or
React Router mechanism that covers it; the main risk is reaching for a heavier
abstraction (SDK, state library, custom backend service) where the existing toolchain
already has a documented, narrower answer.

## Common Pitfalls

### Pitfall 1: `shouldRevalidateRoadmap` silently suppresses explicit `revalidate()` calls (R-4 — CONFIRMED, not hypothetical)

**What goes wrong:** The Refresh button calls `useRevalidator().revalidate()`, but
nothing happens — no network request, no UI update, no error. The button appears
broken with zero console signal.

**Why it happens:** Verified directly against the installed
`react-router-dom@7.18.0` source (`chunk-4ZMWKKQ3.mjs`):
`shouldRevalidateLoader(match, args)` calls the route's own `shouldRevalidate`
function IF DEFINED, and uses its boolean return value unconditionally —
`defaultShouldRevalidate` (which React Router internally sets to `true` for an
explicit same-URL revalidate call) is used **only as a fallback** when the route
doesn't define `shouldRevalidate` or it returns non-boolean. Root's route DOES define
`shouldRevalidateRoadmap`, and it always returns a boolean based purely on
`sourceMode(currentUrl) !== sourceMode(nextUrl)`. On an explicit
`revalidator.revalidate()` call while idle, React Router's `revalidate()`
implementation calls `startNavigation(state.historyAction, state.location, ...)` —
i.e. it re-navigates to the **exact current location**, so `currentUrl === nextUrl`
byte-for-byte (same pathname, same search, same source mode). `sourceMode(currentUrl)
!== sourceMode(nextUrl)` is therefore always `false` in this exact scenario, so the
function returns `false` and the loader does not re-run.

**How to avoid:** Apply the Pattern 3 fix above — add a second condition that detects
"identical URL, no navigation occurred" (`currentUrl` and `nextUrl` stringify equal)
and returns `true` for that case specifically, while leaving the filter/drill-down
case (search differs, same source mode) returning `false`. This is verifiable without
a live backend: a unit test can call `shouldRevalidateRoadmap` with
`currentUrl === nextUrl` (both `?source=live`) and assert `true`, and with
`currentUrl` `?source=live` vs `nextUrl` `?source=live&status=active` and assert
`false`.

**Warning signs:** Clicking Refresh shows a loading state (if `AppHeader` derives one
from `navigation.state`) but the rendered data never changes; `revalidator.state`
transitions `idle → loading → idle` with no fetch in the Network tab.

### Pitfall 2: `actions/checkout` cannot place a repo outside `$GITHUB_WORKSPACE`

**What goes wrong:** A naive backfill workflow that checks out `agenticapps-roadmap`
at the workspace root (the default) and then tries `path: ../claude-workflow` for the
sibling repo fails the job outright with `Repository path '...' is not under
'<$GITHUB_WORKSPACE>'`.

**Why it happens:** This is a documented, intentional security restriction in
`actions/checkout` (confirmed via `actions/checkout` GitHub issues #1812 and #197) —
`path:` is sandboxed to `$GITHUB_WORKSPACE` and its descendants.

**How to avoid:** Check out the roadmap repo itself into a **subdirectory** of the
workspace (e.g. `path: agenticapps-roadmap`), then check out the three siblings into
sibling subdirectories that reproduce `sync.config.json`'s relative-path expectations
(`claude-workflow`, `factiv/cparx`, `factiv/fx-signal-agent`), then run
`pnpm sync:gsd` with `working-directory: agenticapps-roadmap` (Pattern 2, full YAML
above).

**Warning signs:** Job fails at the second/third `actions/checkout` step with a path
error, before `pnpm sync:gsd` ever runs.

### Pitfall 3: GitHub REST API requests missing a `User-Agent` header get rejected

**What goes wrong:** The dispatch/status Pages Functions' `fetch()` calls to
`api.github.com` return `403 Forbidden` even with a valid, correctly-scoped token.

**Why it happens:** GitHub's REST API documentation states "All API requests must
include a valid `User-Agent` header" — unlike browser `fetch`, Cloudflare Workers'
`fetch` does not inject a default `User-Agent`.

**How to avoid:** Always set `User-Agent` explicitly alongside `Authorization`,
`Accept: application/vnd.github+json`, and `X-GitHub-Api-Version: 2022-11-28` on
every GitHub API call (see Pattern 1's `GH_HEADERS` helper).

**Warning signs:** 403 responses from GitHub API calls that pass a valid token and
correct scopes when tested via `curl` (curl sets a default `User-Agent`, masking this
until the exact same request is made from a Worker).

### Pitfall 4: Job step summaries are NOT retrievable via the official REST API

**What goes wrong:** A plan that assumes the dry-run diff can be read back via
`GET .../jobs/{job_id}/summary` (or similar "step summary" endpoint) will find no
such documented endpoint exists.

**Why it happens:** GitHub's `$GITHUB_STEP_SUMMARY` markdown output has no supported
REST API readback path (confirmed via WebSearch of GitHub's own community discussion
#27649 — "no current way to fetch job summaries from the REST API"; an undocumented
`/summary_raw` URL exists but is explicitly unofficial and unsuitable to depend on).

**How to avoid:** Use one of the two *documented* readback mechanisms instead: (a)
`actions/upload-artifact` + the Artifacts REST API (zip, needs unzip), or (b) print
the diff as a single delimited JSON line to stdout and read it back via
`GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs` (confirmed plain text, not
zip, by official docs) — **recommended**, since it needs no new dependency. Note: job
logs may prefix each line with a timestamp when downloaded via this endpoint in some
configurations — emit the diff as a single line and strip a leading
`^\S+\s` timestamp token defensively before `JSON.parse`, and treat this specific
behavior as **unverified until live-tested in Phase 8** (flagged in Open Questions).

### Pitfall 5: `GITHUB_TOKEN` (the Actions-provided default token) cannot check out other private repos

**What goes wrong:** A workflow that omits the `token:` parameter on the sibling
`actions/checkout` steps (relying on the default `GITHUB_TOKEN`) fails to clone
`claude-workflow`/`cparx`/`fx-signal-agent` with a 404/permission error, even though
all four repos share an org and even though a human with access to all four can clone
them locally without issue.

**Why it happens:** The default `GITHUB_TOKEN` GitHub auto-generates per workflow run
is scoped **only to the repository the workflow lives in** — it has no access to
sibling repos even within the same org, confirmed by multiple `actions/checkout`
community threads on this exact cross-repo-checkout scenario.

**How to avoid:** Provide an explicit `token:` (the same cross-repo PAT used for
dispatch/status, or a separate one scoped identically) on every `actions/checkout`
step that targets a sibling repo (Pattern 2's YAML already does this).

**Warning signs:** The first `actions/checkout` step (this repo) succeeds; the second
(sibling repo) step fails immediately with an authentication/404 error.

## Code Examples

### GitHub `workflow_dispatch` trigger, with `return_run_details` and correlation fallback

```typescript
// Source: docs.github.com/en/rest/actions/workflows (Create a workflow dispatch
// event) + github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids
// Synthesized for this phase — no equivalent file exists yet in this repo.
async function dispatchBackfill(
  token: string,
  project: string,
  mode: "dry-run" | "apply"
): Promise<{ runId: number } | { runId: null; correlationId: string }> {
  const correlationId = crypto.randomUUID();
  const res = await fetch(
    `${GITHUB_API}/repos/agenticapps-eu/agenticapps-roadmap/actions/workflows/backfill.yml/dispatches`,
    {
      method: "POST",
      headers: { ...GH_HEADERS(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: "main",
        inputs: { project, mode, correlation_id: correlationId },
        return_run_details: true, // opt-in, per Feb 2026 GitHub changelog — if the
                                   // API/plan doesn't support it, expect a 204 with
                                   // no body (same as omitting it) rather than an error
      }),
    }
  );
  if (res.status === 200) {
    const body = (await res.json()) as { workflow_run_id: number };
    return { runId: body.workflow_run_id };
  }
  // 204 (parameter unsupported or ignored) — caller must fall back to
  // list-and-correlate using correlationId against the run's inputs/name.
  return { runId: null, correlationId };
}
```

### Status polling

```typescript
// Source: docs.github.com/en/rest/actions/workflow-runs (Get a workflow run)
async function getRunStatus(token: string, runId: number) {
  const res = await fetch(
    `${GITHUB_API}/repos/agenticapps-eu/agenticapps-roadmap/actions/runs/${runId}`,
    { headers: GH_HEADERS(token) }
  );
  if (!res.ok) throw new Error("status fetch failed");
  const run = (await res.json()) as { status: string; conclusion: string | null };
  return run; // status: "queued"|"in_progress"|"completed"; conclusion set once completed
}
```

### Diff readback via job-logs-grep (recommended — no new dependency)

```yaml
# backfill.yml dry-run step — emit a single delimited JSON line
- name: Run dry-run and emit diff marker
  if: inputs.mode == 'dry-run'
  working-directory: agenticapps-roadmap
  run: |
    pnpm sync:gsd -- --project "${{ inputs.project }}" > /tmp/out.txt
    cat /tmp/out.txt
    echo "___DIFF_JSON___$(node -e "console.log(JSON.stringify(require('fs').readFileSync('/tmp/out.txt','utf8')))")___END_DIFF___"
```

```typescript
// status.ts — after run completes, fetch job logs and extract the marker line
async function readDiffFromLogs(token: string, jobId: number): Promise<string | undefined> {
  const res = await fetch(`${GITHUB_API}/repos/.../actions/jobs/${jobId}/logs`, {
    headers: GH_HEADERS(token),
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.includes("___DIFF_JSON___"));
  if (!line) return undefined;
  // Strip a possible leading ISO-timestamp token GitHub sometimes prefixes per line
  // (unverified until live-tested — Open Question) before extracting the payload.
  const match = line.match(/___DIFF_JSON___(.*)___END_DIFF___/);
  return match?.[1];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Poll `list runs` filtered by `created>=` + correlation id to find a dispatched run's id | Pass `return_run_details: true` on the dispatch call and read `workflow_run_id` directly from the 200 response | GitHub changelog, 2026-02-19 | Eliminates the race-condition-prone polling step entirely if supported on this repo's plan — try it first, keep the fallback coded but treat it as the primary path only after a live confirmation in Phase 8 |

**Deprecated/outdated:** None specific to this phase's stack — React Router 7,
Cloudflare Pages Functions, and the GitHub Actions REST API are all current, actively
maintained platforms with no relevant deprecations affecting this phase's design.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fflate` (npm, MIT, `github.com/101arrowz/fflate`) is the correct package for Workers-compatible unzip, IF the artifact-based diff readback is chosen | Standard Stack / Don't Hand-Roll | Low — only needed if the (non-recommended) artifact path is chosen instead of job-logs-grep; `checkpoint:human-verify` gates it regardless |
| A2 | `GET .../actions/jobs/{job_id}/logs` returns plain, non-zipped text (per official docs) AND does not prefix every line with a timestamp in a way that breaks the marker-line extraction | Code Examples §3, Pitfall 4 | Medium — if logs ARE timestamp-prefixed per line in this account's config, the naive regex in the example still works (it matches a substring, not full-line), but this should be confirmed with a real dispatched run before relying on it in Phase 8 UAT |
| A3 | `return_run_details: true` on the dispatch call is supported for this repo's GitHub plan/API version as of today | Don't Hand-Roll, Code Examples §1 | Low — the code degrades to 204 (identical to omitting the parameter) and the correlation-id fallback path handles it; worth a quick live smoke-test early in Phase 8 rather than discovering it then |
| A4 | A single fine-grained PAT scoped to the `agenticapps-eu` org with `Actions: write` (agenticapps-roadmap) + `Contents: read` (all 4 repos) is sufficient for both dispatch/status AND cross-repo checkout | Architecture Patterns, R-2 | Medium — fine-grained PATs are scoped per resource-owner; since all four repos share one org this should work, but PAT-vs-org-repo-selection UI specifics were not live-tested this session |
| A5 | `project.name` in the rendered `RoadmapJson` (Linear's project display name) is usable as-is as the `project` dispatch input, matching a `sync.config.json` entry's `name`/`projectName` | Open Questions | Medium — if Linear's stored project name ever diverges from the config entry name (e.g. renamed in Linear UI), the client-sent value won't resolve in `backfill.yml`; the CI job should hard-fail clearly rather than silently no-op if `--project` doesn't match |

**If this table is empty:** N/A — assumptions listed above.

## Open Questions

1. **Does `return_run_details` actually work on this org/repo's current GitHub plan?**
   - What we know: Documented in the Feb 2026 GitHub changelog and REST API docs.
   - What's unclear: Whether it's gated behind a specific plan tier or API version
     header not otherwise used by this app.
   - Recommendation: Code the dispatch Function to try it and gracefully fall back to
     204 + correlation-id, so this is a non-blocking discovery at Phase-8 live-test
     time, not a Phase-7 blocker.

2. **What does the client use to know which projects are backfill-eligible, and how
   does it map a `RoadmapJson.Project` row to a `sync.config.json` entry name?**
   - What we know: `sync.config.json` lives server-side (CI-only, not shipped to the
     client). The client only has `RoadmapJson.projects[].name` (Linear's project
     display name).
   - What's unclear: Whether `project.name` reliably equals the `sync.config.json`
     entry's `name`/`projectName` in all cases (A5 above), and whether the Backfill
     button should render unconditionally (letting CI 404/error if the name doesn't
     match) or be gated to a known-eligible allow-list.
   - Recommendation: Render the Backfill button unconditionally in the drill-down
     dialog (simplest — D-07-03 already scopes writes to the trusted Access
     allow-list, so an accidental mismatch is a clear CI error, not a security issue),
     and have `backfill.yml` fail fast with a readable error if `--project` matches
     zero config entries (the CLI already does this per `cli.ts`'s
     `BULK_WRITE_ERROR`/zero-match guard).

3. **Exact timestamp-prefix behavior of the job-logs endpoint (A2).**
   - What we know: The endpoint is confirmed plain text by official docs.
   - What's unclear: Whether GitHub prefixes every line with an ISO timestamp when
     served through this specific API endpoint (varies by report across community
     sources; not independently confirmed this session).
   - Recommendation: Treat as a Phase-8 live-UAT verification item (R-1) — the
     extraction regex in Code Examples §3 is written defensively (substring match, not
     full-line) specifically to tolerate this either way, but should be exercised
     against one real dispatched run before being trusted in production.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| GitHub REST API reachability from Cloudflare Workers | dispatch/status Functions | ✓ (public API, no local dependency) | — | — |
| `GH_BACKFILL_TOKEN` (new Pages secret binding) | dispatch/status Functions | ✗ (not yet created — this phase builds the code path; binding value itself is a Phase-8/manual step, mirrors `LINEAR_API_KEY`'s existing pattern in `docs/access-setup.md`) | — | Functions must fail generically (500, matching existing `!env.LINEAR_API_KEY` pattern) when the binding is absent, so local/preview builds without the secret don't crash |
| `GH_CROSS_REPO_TOKEN` (new GitHub Actions repo secret) | `backfill.yml` sibling checkouts | ✗ (Phase 8 / manual) | — | Workflow will fail clearly at the first sibling checkout step until set — acceptable per R-1 |
| `node`/`pnpm`/`tsx` (CI toolchain) | `backfill.yml` (mirrors `snapshot.yml`) | ✓ (already used identically in `snapshot.yml`, node-version 24, pnpm/action-setup@v4) | node 24, pnpm 9 | — |

**Missing dependencies with no fallback:**
- `GH_BACKFILL_TOKEN` and `GH_CROSS_REPO_TOKEN` — both secret values must be created
  out-of-band (Cloudflare dashboard + GitHub repo secrets) before backfill can run
  live. This phase's tasks build and unit-test the code paths against these bindings;
  binding the actual secret values is explicitly Phase 8 scope (mirrors
  `LINEAR_API_KEY`'s existing split between "code path built" in earlier phases and
  "secret bound" in Phase 8).

**Missing dependencies with fallback:**
- None beyond the above — every other dependency (GitHub API reachability, CI
  toolchain) is already available/proven via the existing `snapshot.yml` and Linear
  proxy.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (already configured) |
| Config file | `vitest.config.ts` — `include: ["scripts/**/*.test.ts", "functions/**/*.test.ts", "src/**/*.test.ts"]` (new files under these globs are auto-discovered, no config change needed) |
| Quick run command | `CI=true npx vitest run functions/api/backfill` (per this project's documented pnpm-non-TTY workaround) |
| Full suite command | `CI=true npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIVE-01 | `shouldRevalidateRoadmap` allows an explicit same-URL revalidate through while still blocking filter/drill-down navigations | unit | `npx vitest run src/lib/roadmap/loader.test.ts` | ❌ Wave 0 (extend existing `loader.ts`'s test file if one exists, else create) |
| LIVE-01 | Refresh button only renders/enabled in Live mode; disabled while `navigation.state === "loading"` | unit (component) | `npx vitest run src/components/AppHeader.test.tsx` | ❌ Wave 0 (check if `AppHeader.test.tsx` already exists from Phase 3; extend if so) |
| LIVE-02 | Dispatch Function: 200 with `{ runId }` shape on GitHub success; GitHub token never appears in response body (mirrors REQ-PROXY-1's token-absence assertion) | unit | `npx vitest run functions/api/backfill/dispatch.test.ts` | ❌ Wave 0 |
| LIVE-02 | Dispatch Function: generic error (not raw GitHub error body) on any upstream failure — single try/catch pattern | unit | `npx vitest run functions/api/backfill/dispatch.test.ts` | ❌ Wave 0 |
| LIVE-02 | Status Function: `{ status, conclusion, diff? }` shape; diff present only when a dry-run job is queried and its marker line is found in logs | unit | `npx vitest run functions/api/backfill/status.test.ts` | ❌ Wave 0 |
| LIVE-02 | Optimistic `planAhead` flip on Apply-click; reverts on polled failure/cancelled; error toast shown | unit (component/hook) | `npx vitest run src/lib/backfill/useBackfill.test.ts` | ❌ Wave 0 |
| LIVE-03 | `snapshot.yml` already satisfies daily-cron + commit-on-change + concurrency — verification, not new test | manual verification (read the file, confirm against D-07-08's claims) | N/A — file-inspection task, not an automated test | ✅ (file exists, already read in this research) |
| R-2/CI checkout | `backfill.yml`'s checkout layout resolves `sync.config.json`'s relative paths correctly | manual-only (CI-only concern; no local unit test can exercise `actions/checkout`'s workspace sandboxing) | N/A — justification: this is infrastructure-as-config, not application code; the correctness is structural (verified in this research against `actions/checkout` docs) and the true test is a live dispatch, deferred to Phase-8 R-1 HUMAN-UAT | N/A |

### Sampling Rate

- **Per task commit:** targeted `npx vitest run <changed-file-glob>`
- **Per wave merge:** `CI=true npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`; the live end-to-end
  backfill/dispatch path is explicitly OUT of this phase's automated gate (R-1) and
  becomes a Phase-8 HUMAN-UAT item, mirroring Phase 3's Access-proof deferral pattern
  (`.planning/phases/03/03-HUMAN-UAT.md`) and Phase 6's live-verify deferral
  (`06-07-SUMMARY.md` § "Human verification required").

### Wave 0 Gaps

- [ ] `src/lib/roadmap/loader.test.ts` — new/extended test file for the
      `shouldRevalidateRoadmap` fix (LIVE-01's core correctness claim; must exist
      BEFORE the fix is implemented, TDD-style, since this is the exact bug this
      research uncovered)
- [ ] `functions/api/backfill/dispatch.test.ts` — mirrors
      `functions/api/linear/[[path]].test.ts`'s context-helper + `vi.stubGlobal("fetch")`
      pattern
- [ ] `functions/api/backfill/status.test.ts` — same pattern, plus a fixture for a
      job-logs plain-text response containing the diff marker
- [ ] `src/lib/backfill/useBackfill.test.ts` — optimistic-state + rollback hook,
      new file, new test target

*(No existing test infrastructure gaps beyond the above — Vitest, the fixture-based
`vi.stubGlobal("fetch")` pattern, and the `functions/**` glob are all already proven
in Phase 3.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Indirect (delegated) | Cloudflare Access (Zero Trust) — already the sole auth control per D-07-03/existing `docs/access-setup.md`; this phase adds no new auth logic, relies entirely on the existing Access policy covering `/api/*` |
| V3 Session Management | Indirect (delegated) | Cloudflare Access session cookies — unchanged, outside this phase's code |
| V4 Access Control | Yes | Access-only gate (D-07-03, explicit user decision — no additional per-write allow-list); the write blast-radius is bounded by the Phase-6 CLI being create-only/idempotent (D-06-03), not this phase's own control |
| V5 Input Validation | Yes | The `project` dispatch input must be validated/sanitized before being embedded in `workflow_dispatch` `inputs` (GitHub's own API validates input keys against the workflow's declared `inputs:` schema, providing a first layer; the Function should still reject empty/non-string values before calling GitHub, mirroring `functions/api/linear/[[path]].ts`'s registry-lookup-before-fetch ordering) |
| V6 Cryptography | No new surface | No new crypto primitives introduced; token storage relies entirely on Cloudflare's existing encrypted-binding mechanism (same as `LINEAR_API_KEY`) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| GitHub token leak via response body/error message | Information Disclosure | Single try/catch collapsing every GitHub-API failure mode to a generic error (mirrors the Linear proxy's REQ-PROXY-1..3 pattern exactly) — never echo the upstream response body or the `Authorization` header value |
| Arbitrary/injected `project` value triggering unintended CI behavior | Tampering | GitHub's `workflow_dispatch` `inputs` schema already constrains accepted keys; `backfill.yml` should treat an unmatched `--project` as a hard CI failure (already the CLI's behavior per `cli.ts`'s zero/multiple-match guard), never a silent no-op or a shell-interpolation risk (use `inputs.project` as a quoted CLI arg, not raw shell interpolation, in the workflow YAML) |
| Cross-repo PAT over-scoped beyond the 4 needed repos | Elevation of Privilege | Fine-grained PAT scoped explicitly to `agenticapps-eu`'s 4 named repos (not "all repos" or an org-wide classic PAT) — a deliberate, minimal-scope choice for the planner to carry into the token-creation step |
| Access-gated dispatch endpoint reachable pre-Access-deploy (Phase 3's known gap: `03-ACCESS-PROOF.md` still open) | Spoofing | This phase's new `/api/backfill/*` routes inherit the SAME `/api/*` Access policy path rule already documented in `docs/access-setup.md` — no new Access configuration needed, but the planner should note the new routes are covered by the existing (not-yet-proven-live) `/api/*` policy, not a separate one |

## Sources

### Primary (HIGH confidence)

- Direct inspection of installed `react-router-dom@7.18.0` source
  (`node_modules/.pnpm/react-router@7.18.0.../dist/development/chunk-4ZMWKKQ3.mjs`,
  functions `shouldRevalidateLoader`, `getMatchesToLoad`, `revalidate`) — the
  definitive answer to R-4.
- This repo's own source: `src/lib/roadmap/loader.ts`, `src/components/AppHeader.tsx`,
  `functions/api/linear/[[path]].ts`, `functions/api/linear/[[path]].test.ts`,
  `scripts/sync-gsd-linear/cli.ts`, `scripts/sync-gsd-linear/apply.ts`,
  `.github/workflows/snapshot.yml`, `scripts/sync-snapshot.ts`, `sync.config.json`,
  `wrangler.toml`, `src/pages/OverviewPage.tsx`,
  `src/components/overview/ProjectDrillDownDialog.tsx`,
  `src/components/overview/SyncBadge.tsx`, `docs/access-setup.md`, `docs/architecture.md`.
- `git remote -v` on all four local sibling repos — confirmed all share GitHub org
  `agenticapps-eu`.
- docs.github.com/en/rest/actions/workflows — "Create a workflow dispatch event"
  endpoint contract.
- docs.github.com/en/rest/actions/workflow-runs — "Get a workflow run" endpoint.
- docs.github.com/en/rest/actions/workflow-jobs — "Download job logs for a workflow
  run" (confirmed plain text, not zip).
- docs.github.com/en/rest/actions/artifacts — "Download an artifact" (confirmed zip
  only).
- docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens.
- docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api —
  required headers (`Accept`, `User-Agent`, `X-GitHub-Api-Version`).

### Secondary (MEDIUM confidence)

- github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids —
  `return_run_details` parameter (cannot be live-verified against this specific repo
  until Phase 8).
- `actions/checkout` GitHub issues #1812, #197 — workspace-sandboxing restriction on
  `path:`.
- Community discussion (github.com/orgs/community/discussions/27649) — no REST API
  for job step summaries.
- `npm view fflate` — registry metadata (package legitimacy, not authoritative docs).

### Tertiary (LOW confidence)

- Community blog posts on job-logs timestamp-prefix formatting — contradictory/
  unconfirmed; flagged as Open Question 3 and Assumption A2, not asserted as fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new runtime dependency is strictly required (raw fetch);
  the one optional dependency (`fflate`) is clearly scoped and gated.
- Architecture: HIGH — checkout-layout fix and Function-mirroring pattern are both
  verified against this repo's actual files + official GitHub docs, not speculation.
- Pitfalls: HIGH for Pitfalls 1, 2, 5 (directly verified against source/docs); MEDIUM
  for Pitfalls 3, 4 (documented but not live-executed against this repo's exact
  Cloudflare/GitHub account configuration).

**Research date:** 2026-07-15
**Valid until:** 30 days for the React Router / codebase-internal findings (stable
until the app's own code changes); 7 days for the GitHub REST API specifics given the
recent (Feb 2026) `return_run_details` change signals an actively evolving surface —
re-verify `return_run_details` support with a real API call before relying on it in
Phase 8.
