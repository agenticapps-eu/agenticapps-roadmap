# ADR-0001: Hosting and sync architecture

**Status:** Accepted
**Date:** 2026-07-16
**Linear:** —
**Phase:** Phase 8 of agenticapps-roadmap

## Context

`agenticapps-roadmap` is a private, filterable roadmap that reads Linear and
stays in sync with the GSD `.planning/` plans that live in each family repo. It
needs a host that can serve a static app **and** hold a server-side Linear
token for live refresh and write-back, without exposing that token to the
client or baking it into `roadmap.json` (CLAUDE.md invariant). It also needs a
write path back into Linear that reuses the Phase-6 `sync-gsd-linear` CLI
(Node-only, walks sibling repos' local `.planning/` filesystem) without
duplicating that logic in an edge Worker.

Hosting decided 2026-06-22 (Concept C, hybrid): a static snapshot is the
default, zero-network render path; a live mode is an opt-in enhancement.
Sync/write-back architecture decided across Phase 7 (D-07-01..08) and Phase 8
(D-08-01..06): CI dispatch, two-phase preview→apply, Access-only write
authorization, a single fine-grained PAT, and a consume-once KV nonce.

## Decision

**Hosting:** Cloudflare Pages, with the Worker riding along as Pages
Functions in the same project and origin. The app renders entirely from
`public/roadmap.json` (a sanitized, token-free projection) by default —
instant load, works with no network. Live mode calls `/api/linear/*` Pages
Functions, which hold `LINEAR_API_KEY` in a binding and proxy Linear GraphQL
for on-demand refresh. Cloudflare Access (Zero Trust email allow-list) gates
the deployed app at the edge, before any Function or static asset is served —
no in-app session/JWT code is needed or added.

**Sync / write-back architecture:**
- **D-07-01 (CI-dispatch write path):** A UI backfill control (behind Access)
  triggers a GitHub `workflow_dispatch` via a Pages Function holding a GitHub
  PAT binding, not a direct Worker write. An Actions runner checks out this
  repo and the sibling repos and runs the existing `pnpm sync:gsd --project
  <X> --apply --yes`, mutating Linear and committing the refreshed
  `public/roadmap.json`. This reuses the Phase-6 CLI unchanged and keeps the
  proxy Worker read-only.
- **D-07-02 (two-phase preview → apply):** No write happens without a fresh
  diff and an explicit yes for that specific project. A **preview** dispatch
  runs `mode=dry-run`, computes a fresh diff from live `.planning/` + live
  Linear, and the UI renders it; only on the user clicking **Apply** does a
  second dispatch run `mode=apply --yes`.
- **D-07-03 (Access-only write authorization):** Any Access allow-list
  identity may preview and apply a backfill. The allow-list is small and
  trusted (family), and Phase-6 writes are create-only and idempotent (no
  deletes/updates that remove data), so the blast radius is bounded. No
  additional write-email allow-list or typed-confirm guard is layered on top.
- **D-08-01 (gate the whole domain):** A single Cloudflare Access application
  covers the entire Pages project — the app root **and** all of `/api/*`
  (`/api/backfill/*` and the read-only `/api/linear/*` proxy) — rather than a
  separate application scoped to `/api/*`.
- **D-08-03 (single fine-grained PAT, both roles):** One fine-grained GitHub
  PAT scoped to the 4 `agenticapps-eu` repos serves both the Pages Function
  dispatch secret and the CI cross-repo-checkout secret. One secret to
  rotate, under two secret names (`GH_BACKFILL_TOKEN` on Cloudflare Pages,
  `GH_CROSS_REPO_TOKEN` in GitHub Actions), same value.
- **D-08-04 (`LINEAR_API_KEY` dual-binding):** `LINEAR_API_KEY` binds in two
  places — a Cloudflare Pages secret (for the `/api/linear/*` proxy) and a
  GitHub Actions secret (for CI `sync:gsd`/`sync:snapshot` runs). Never in the
  client bundle or `roadmap.json`.
- **D-08-06 (KV consume-once nonce, CR-01 hardening):** A Cloudflare KV
  binding (`BACKFILL_NONCE`, declared solely in `wrangler.toml`) plus a
  check-then-set nonce in `functions/api/backfill/dispatch.ts` mark a
  `previewRunId` "consumed" after it authorizes one apply, closing the
  Phase-7 code-review CR-01 replay gap. This supersedes the prior
  recency-only mitigation as the primary control; the existing 15-minute
  recency bound stays as defense-in-depth.

## Alternatives Rejected

- **Public `/api/linear/*` (leave the read proxy ungated):** Rejected — even
  though the app renders fully from the static snapshot with no network, an
  unauthenticated live read proxy plus its rate limiter would be the only
  guard on a token-backed endpoint (D-08-01's rationale).
- **Split least-privilege GitHub PATs (dispatch-only vs checkout-only):**
  Rejected in favor of one fine-grained PAT (D-08-03) — two secrets to manage
  for marginal benefit in a small trusted setup; revisit only if the Access
  audience widens.
- **Worker-direct write to Linear (no CI dispatch):** Rejected (D-07-01) — the
  Phase-6 CLI is Node-only and walks the sibling repos' local `.planning/`
  filesystem; a deployed Pages Function has neither a Node runtime nor that
  filesystem, so it cannot run the walker/parser itself. CI is the only tier
  where the sibling filesystem exists naturally.
- **Diff computed from the last scheduled snapshot artifact (not fresh):**
  Rejected (D-07-02) — a scheduled-artifact diff can be up to one refresh
  interval stale; the two-phase design always computes the diff fresh at
  preview time.
- **Recency-bound-only replay mitigation (no KV nonce):** Rejected (D-08-06)
  — a recent-but-reused `previewRunId` could still authorize multiple applies
  within the 15-minute window; the consume-once nonce closes that gap before
  the write path first goes live.
- **A separate Cloudflare Access application scoped only to `/api/*`:**
  Rejected (D-08-01) — a single whole-domain application covering the app
  root and all paths is simpler to operate and equally effective, since the
  entire app (not just the API) is intended to sit behind Access.

## Consequences

**Positive:**
- One deploy, one origin: static app, live proxy, and write-dispatch all ship
  from the same Cloudflare Pages project, with the token(s) held only in
  Pages Function bindings.
- The snapshot-first default means the app is fully usable with zero live
  secrets and zero network calls — Access, PAT, and `LINEAR_API_KEY` failures
  never break the base experience.
- The Phase-6 CLI, Phase-7 write path, and Phase-8 hardening compose without
  any of them re-implementing Linear-write or `.planning/`-walking logic in
  the edge tier.

**Negative — three accepted-risk / boundary facts:**

1. **KV nonce is best-effort, not exactly-once.** Workers KV is eventually
   consistent and has no compare-and-swap primitive, so the `BACKFILL_NONCE`
   check-then-set nonce is **best-effort sequential replay suppression**, not
   a literal "exactly once" guarantee — a duplicate apply remains possible
   within KV's consistency window. The existing 15-minute recency bound
   co-mitigates by bounding how old a reused `previewRunId` can be. This is
   an accepted, scoped risk appropriate to a small, single-trusted-user
   allow-list threat model, not a sophisticated concurrent-attacker model; a
   stronger primitive (D1 transaction, Durable Object) would be the correct
   escalation if the audience or threat model ever widens, and is explicitly
   out of scope for this phase.
2. **The single fine-grained PAT grants a uniform scope across all 4
   repos, not just this one.** GitHub's fine-grained PAT model applies one
   permission set to every repository selected in its "Repository access"
   list — it cannot grant `Actions: write` to `agenticapps-roadmap` alone
   while granting only `Contents: read` to the other 3 `agenticapps-eu`
   repos. The PAT therefore carries `Contents: Read` + `Actions: Read and
   write` on **all 4** repos (`agenticapps-roadmap`, `claude-workflow`,
   `cparx`, `fx-signal-agent`). This is a direct, accepted consequence of
   D-08-03's single-PAT decision. The application-level mitigation is that
   `dispatch.ts`/`status.ts` hardcode the target `REPO` constant, so the
   token's broader raw capability is never exercised by the app itself —
   only by whoever holds the raw token value.
3. **Live write-capable secrets bind to Production only, never to
   Preview.** `LINEAR_API_KEY` and the GitHub PAT (`GH_BACKFILL_TOKEN`) are
   bound as Cloudflare Pages secrets on the **Production** environment
   only — never on Preview. This is a security consequence of two
   already-locked decisions plus one platform fact, not a new numbered
   decision: D-08-02 leaves preview `*.pages.dev` URLs **ungated** by
   Access, and a single top-level `[[kv_namespaces]]` binding in
   `wrangler.toml` (no `[env.*]` split) applies to **both** Production and
   Preview Pages deployments. Binding live write-capable secrets to Preview
   would place them behind an unauthenticated URL. This costs nothing
   functionally: the app renders fully from `public/roadmap.json` with zero
   network, so a preview build needs no live secrets to build or render
   correctly — only Production carries the credentials that make `/api/*`
   do anything live.

**Follow-ups:**
- Revisit split least-privilege PATs if the Access allow-list audience
  widens beyond the current small trusted family set.
- Revisit preview-deployment Access gating (deferred per D-08-02) if ungated
  `*.pages.dev` preview URLs become a practical concern.
- Escalate the KV nonce to a transactional primitive (D1) or a Durable
  Object if the write-path threat model ever moves beyond a small trusted
  allow-list.

## References

- `docs/architecture.md` — hosting pattern, data paths, `sync-gsd-linear` pipeline.
- `docs/runbook.md` — deploy, token rotation, snapshot refresh, and backfill operations.
- `docs/access-setup.md` — Cloudflare Access setup and verification steps.
- `.planning/phases/07/07-CONTEXT.md` — D-07-01..08 (write path, two-phase approval, Access-only auth).
- `.planning/phases/08/08-CONTEXT.md` — D-08-01..06 (Access scope, allow-list, PAT topology, `LINEAR_API_KEY` binding, tag gate, KV nonce).
