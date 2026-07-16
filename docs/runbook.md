# Operational Runbook — agenticapps-roadmap

Console-and-CLI runbook for deploying, rotating secrets, refreshing the
snapshot, and running a backfill. This is an **operations** document — for the
architecture rationale behind these choices, see
[`docs/decisions/0001-hosting-and-sync-architecture.md`](decisions/0001-hosting-and-sync-architecture.md).
For the Cloudflare Access allow-list mechanics specifically, see
[`docs/access-setup.md`](access-setup.md).

---

## 1. Deploy

### Prerequisite: merge to `main`

`dispatch.ts` hardcodes `ref: "main"` on every `workflow_dispatch` call, and
GitHub's `schedule:` cron trigger only evaluates workflow files present on
the repository's **default branch**. Nothing in this runbook's backfill or
snapshot-cron sections can work until this repo's feature work is merged to
`main`. Confirm before proceeding:

```bash
git rev-list --count origin/main..HEAD
# expect: 0 once the release PR has merged
```

### Create the Cloudflare Pages project

1. Open **Cloudflare Dashboard → Workers & Pages → Create application → Pages
   → Connect to Git**.
2. Select the `agenticapps-eu/agenticapps-roadmap` repository.
3. Set **Production branch** to `main`.
4. Set **Build command** to `pnpm build` and **Build output directory** to
   `dist` — matching `wrangler.toml`'s `pages_build_output_dir = "dist"`.
5. Save and deploy.

### KV binding — `wrangler.toml` is the sole source of truth

`wrangler.toml` already declares the `BACKFILL_NONCE` KV binding:

```toml
[[kv_namespaces]]
binding = "BACKFILL_NONCE"
id = "<real namespace id>"
```

**Do not attach this KV binding in the Cloudflare dashboard.** When a Pages
project has a Wrangler configuration file, that file is authoritative for
bindings it declares — matching dashboard fields become non-editable. If the
dashboard shows the `BACKFILL_NONCE` binding as read-only or absent from the
editable list, that is expected: it is being sourced from `wrangler.toml`,
not dashboard state.

### Secrets — dashboard only, Production environment only

The dashboard is used **only** for encrypted secrets and Access, never for
the KV binding. Bind these as **Pages Function secrets on the Production
environment only** — do **not** bind them on Preview:

| Secret name | Value | Scope |
|---|---|---|
| `LINEAR_API_KEY` | the Linear API key | Production only |
| `GH_BACKFILL_TOKEN` | the fine-grained GitHub PAT (§2) | Production only |

**Why Production-only:** the preview `*.pages.dev` URLs are left
**ungated** by Cloudflare Access (a deliberate, documented choice — see
§2 of `docs/access-setup.md` and ADR-0001's Consequences). A single
top-level `[[kv_namespaces]]` binding in `wrangler.toml` applies to both
Production and Preview, so nothing about KV forces these secrets onto
Preview. Binding live, write-capable secrets to an unauthenticated preview
URL would expose them outside the Access gate. The app renders fully from
`public/roadmap.json` with zero network, so a Preview build needs no live
secrets to build or render correctly.

1. Open **Cloudflare Dashboard → Pages → agenticapps-roadmap → Settings →
   Environment Variables**.
2. Under **Production only**, add each variable above, paste its value, and
   check **Encrypt**.
3. Save, then **redeploy** the Pages project — secret changes only take
   effect on the next build/deploy, not retroactively on the running deploy.

> **Never-commit rule:** never put a secret value in `wrangler.toml`, any
> `*.json` file, the client bundle, or any git-tracked file. The CI grep gate
> (`grep -rE 'lin_api_|ghp_|github_pat_'`) blocks a build if one leaks in.

---

## 2. Token rotation

### The GitHub PAT — one value, two secret names

A single fine-grained GitHub PAT serves both the dispatch role (Cloudflare
Pages Function calling the GitHub API) and the checkout role (CI cloning
sibling repos). It is stored under **two secret names, same value**:

| Secret name | Where | Role |
|---|---|---|
| `GH_BACKFILL_TOKEN` | Cloudflare Pages, Production | `dispatch.ts`/`status.ts` call the GitHub Actions REST API |
| `GH_CROSS_REPO_TOKEN` | GitHub → `agenticapps-roadmap` → Settings → Secrets → Actions | `backfill.yml` checks out the sibling repos |

**Scope:** `Contents: Read` + `Actions: Read and write`, uniform across
**all 4** `agenticapps-eu` repos (`agenticapps-roadmap`, `claude-workflow`,
`cparx`, `fx-signal-agent`). A GitHub fine-grained PAT applies one
permission set to every repository selected in its "Repository access"
list — it cannot restrict `Actions: write` to `agenticapps-roadmap` alone
while granting only `Contents: read` to the other 3. The application-level
mitigation is that `dispatch.ts`/`status.ts` hardcode the target `REPO`
constant, so the app itself never exercises the token's broader raw
capability — only whoever holds the raw value could.

### Rotation order (do not skip the smoke test)

1. Create the replacement fine-grained PAT (same repo selection, same
   permission set: `Contents: Read`, `Actions: Read and write`). Approve it
   if your GitHub org requires PAT approval.
2. Update **both** secret stores with the new value:
   - Cloudflare Pages → Settings → Environment Variables → `GH_BACKFILL_TOKEN` (Production) → edit → paste new value → Encrypt → Save → redeploy.
   - GitHub → Settings → Secrets → Actions → `GH_CROSS_REPO_TOKEN` → Update.
3. Run a smoke check with the new token before revoking the old one — a
   preview (dry-run) dispatch and a `status` poll (§4) is sufficient; both
   must succeed.
4. Only **after** the smoke check passes, revoke the old PAT in GitHub →
   Settings → Developer settings → Fine-grained tokens.

### `LINEAR_API_KEY` rotation (dual-binding, D-08-04)

`LINEAR_API_KEY` binds in two independent places — rotate both:

1. Cloudflare Pages → Settings → Environment Variables → `LINEAR_API_KEY`
   (Production only) → edit → paste new value → Encrypt → Save → redeploy.
2. GitHub → `agenticapps-roadmap` → Settings → Secrets → Actions →
   `LINEAR_API_KEY` → Update (used by the CI `sync:gsd`/`sync:snapshot` runs).

> Never paste a real key value into this runbook, a commit message, or any
> tracked file. Use a placeholder pattern (`lin_api_…`, `ghp_…`) in any
> example.

---

## 3. Snapshot refresh

The scheduled snapshot refresh is `.github/workflows/snapshot.yml`'s daily
cron (`0 6 * * *` UTC) plus a manual `workflow_dispatch` trigger. It runs
`pnpm sync:snapshot` and commits `public/roadmap.json` to `main` **only when
the projection actually changed** — a run that observes no Linear delta
makes no commit; that is expected, not a failure.

**Cron recognition delay:** GitHub can take 15 minutes to over an hour to
recognize a new or changed `schedule:` cron after a workflow file lands on
the default branch. Do not treat "no cron fire observed within the same
session" as a failure — either wait for the next natural 06:00 UTC window
and record the observed run's timestamp, or use `workflow_dispatch` to prove
the mechanism works today and treat the next natural cron firing as the
durable proof.

Manual trigger (equivalent to what the cron does):

```bash
gh workflow run snapshot.yml
gh run list --workflow=snapshot.yml --limit 1
```

---

## 4. Backfill

The backfill UI runs the two-phase preview → apply flow (dispatch → poll →
apply → poll) described in ADR-0001. This section covers the operational
steps and failure recovery; for the full pre-tag live-verification
checklist, see `.planning/phases/07/07-HUMAN-UAT.md` (not duplicated here).

### Flow

1. **Preview.** Click **Backfill: `<project>`** in the UI. This dispatches a
   `mode=dry-run` `backfill.yml` run. The UI polls `/api/backfill/status` and
   renders the fresh diff (e.g. "+3 milestones, +11 issues, ~4 dates") once
   the run completes.
2. **Apply.** Click **Apply**. This dispatches a `mode=apply` run using the
   `previewRunId` from step 1. The consume-once KV nonce (`BACKFILL_NONCE`,
   ADR-0001 §Consequences) means that exact `previewRunId` can authorize
   only one apply.
3. **Confirm.** On success, the UI clears the pending state and the next
   snapshot refresh reflects the applied changes (new milestones/issues in
   Linear, a refreshed `roadmap.json` commit on `main`).

### Retry / failure recovery

- **Upstream dispatch failure after preview succeeded:** the `previewRunId`
  from that preview is already consumed (or was never validly created) —
  re-run **Preview** to get a fresh `previewRunId` before attempting Apply
  again. A stale or already-consumed `previewRunId` returns 403.
- **Apply reports failure/cancelled:** the UI reverts its optimistic state;
  re-run Preview → Apply from scratch. No partial Linear state is left by a
  failed apply — Phase-6 writes are create-only and idempotent.

### Access verification (extends `docs/access-setup.md` to `/api/backfill/*`)

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://<deployed-domain>/api/backfill/dispatch
# expect: 302 or 403 (Access redirect/block) — never 200/400/500 from the Function itself
curl -sS -o /dev/null -w "%{http_code}\n" https://<deployed-domain>/api/backfill/status
# expect: 302 or 403
curl -sS -o /dev/null -w "%{http_code}\n" https://<deployed-domain>/
# expect: 302 or 403 (unauthenticated app root is also gated, D-08-01)
```
