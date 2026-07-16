# Phase 8: Deploy, gate & document - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the app to production and prove it works end-to-end, then document and tag it.
Concretely: connect the repo to **Cloudflare Pages** (production + preview builds) with
`LINEAR_API_KEY` bound; apply a **Cloudflare Access** policy and verify gating; bind the
**GitHub token(s)** the Phase-7 write path needs and run the **13-item `07-HUMAN-UAT.md`**
live checklist for real (dispatch → git push → Linear write → scheduled cron); write the
**README + `docs/runbook.md`**; and tag **`v0.1.0`** with a hosting/sync **ADR**.

Delivers requirements **DEPLOY-01..DEPLOY-04**. This phase wires the secrets and verifies
the code paths built in Phases 3, 6, and 7 — it does not build new product capability.

**Out of scope:** any new app feature; two-way sync (Linear → `.planning/` pull-down, a
standing "Out of Scope" item); a public GitHub Pages mirror (see Deferred Ideas).
</domain>

<decisions>
## Implementation Decisions

### Access gating (DEPLOY-02)
- **D-08-01 (gate the whole domain):** A single Cloudflare Access application covers the
  **entire Pages project** — the app root **and all of `/api/*`** (`/api/backfill/*` **and**
  the read-only `/api/linear/*` proxy). Rationale: D-07-03 makes Access the *sole* write
  authorization for backfill, so `/api/backfill/*` must be gated; gating the read proxy too
  is free protection since the app renders fully from the static `public/roadmap.json` with
  no network — live mode requiring login is an acceptable enhancement, not a regression.
  **Rejected:** leaving `/api/linear/*` public (would expose the live read proxy + its
  rate limiter as the only guard).
- **D-08-02 (allow-list = existing family list):** Reuse the email allow-list already
  established in Phase 3 (`docs/access-setup.md`). No new members captured this session;
  the runbook documents how to add/rotate members. Preview-deployment gating was offered
  and **not** selected — production Access is the gate; note it as a residual hardening
  option if `*.pages.dev` preview URLs later become a concern.

### Token / secret topology (DEPLOY-01)
- **D-08-03 (single fine-grained PAT, both roles):** One **fine-grained GitHub PAT scoped
  to the 4 `agenticapps-eu` repos** (contents:read for sibling checkout + actions:write to
  dispatch `backfill.yml`) serves **both** roles — bound as the **Pages Function dispatch
  secret** and handed to **CI** for cross-repo checkout. One secret to rotate; fits the
  small trusted setup. **Rejected:** split dispatch-only vs checkout-only tokens
  (least-privilege, but two secrets to manage — revisit only if the audience widens).
- **D-08-04 (LINEAR_API_KEY binding):** `LINEAR_API_KEY` binds in **two** places — a
  **Cloudflare Pages secret** (for the `/api/linear/*` proxy Worker) and a **GitHub Actions
  secret** (for the CI `sync:gsd`/`sync:snapshot` runs). Never in the client bundle or
  `roadmap.json` (CLAUDE.md invariant). The runbook documents rotation in both places.

### v0.1.0 ship gate (DEPLOY-04)
- **D-08-05 (tag on full live end-to-end):** `v0.1.0` is tagged only after the **load-bearing
  `07-HUMAN-UAT.md` items pass for real**: deploy live, Access gating verified end-to-end, a
  real **preview→apply backfill** (git push to `main` + Linear write) succeeds, and a
  **scheduled `snapshot.yml` cron** run fires and commits on `main`. This is what "gating
  verified end-to-end" + "snapshot auto-refreshes" in the success criteria require.
  `package.json` `version` is already `0.1.0`, so tagging is the remaining act.

### CR-01 hardening (carried from Phase 7 code review)
- **D-08-06 (add KV nonce this phase):** Add a **Cloudflare KV binding** to `wrangler.toml`
  and a **consume-once nonce** in `functions/api/backfill/dispatch.ts`, so a `previewRunId`
  can authorize **exactly one** apply — closing CR-01's replay gap **before** the write path
  first goes live. This supersedes the current recency-only mitigation (15-min bound stays as
  defense-in-depth). Resolves `07-HUMAN-UAT.md` item #13. **Rejected:** ship recency-only and
  defer the nonce (a recent-but-reused preview could authorize multiple applies in-window).

### Claude's Discretion
- Runbook/README structure and ADR prose (DEPLOY-03/04) — standard doc craft; the ADR records
  the hosting choice (Cloudflare Pages + Functions) and the sync architecture (CI-dispatch
  write path, D-07-01). ADR lands in a new `docs/decisions/` directory.
- KV namespace/binding naming, nonce TTL, and the exact dispatch.ts nonce mechanism —
  implementation detail for research/planning.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-8 verification & carried-forward work
- `.planning/phases/07/07-HUMAN-UAT.md` — the 13-item live-verification checklist this phase
  executes for real; item #13 is the CR-01 nonce (D-08-06).
- `.planning/phases/07/07-REVIEW.md` — CR-01 detail + resolution note (recency bound applied,
  nonce deferred to here).
- `.planning/phases/07/07-CONTEXT.md` — locked write-path decisions D-07-01 (CI dispatch),
  D-07-02 (two-phase preview→apply), D-07-03 (write auth = Access only).

### Access & deploy
- `docs/access-setup.md` — existing Phase-3 Cloudflare Access setup + allow-list (D-08-01/02).
- `docs/architecture.md` — hosting/sync rationale; source material for the DEPLOY-04 ADR.
- `wrangler.toml` — current Pages config (name `agenticapps-roadmap`, `dist` output); gains
  the KV binding in D-08-06.
- `functions/api/linear/[[path]].ts` — read proxy + its rate-limiter and Access-assumption
  comment (pattern reference for what's now gated).
- `functions/api/backfill/dispatch.ts`, `status.ts` — the write path being wired + hardened.
- `.github/workflows/snapshot.yml` — already has `schedule: cron "0 6 * * *"` + `workflow_dispatch`;
  `backfill.yml` — the dispatch target. Both share the `roadmap-git-writer` concurrency group.

### Project invariants
- `CLAUDE.md` — token stays server-side; snapshot-first zero-network default; TS everywhere.
- `.planning/REQUIREMENTS.md` — DEPLOY-01..04 (lines 67–70).
- `.planning/ROADMAP.md` §"Phase 8" (line 204) — goal + success criteria.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/access-setup.md`: existing Access setup — extend/reference rather than re-author.
- `snapshot.yml`: scheduled cron already present (daily 06:00 UTC) — Phase 8 *verifies* it
  fires on `main` post-merge, no new schedule needed.
- `functions/api/linear/[[path]].ts`: rate-limiter + "Access is primary auth" comment — the
  pattern already mirrored into the backfill routes in Phase 7.

### Established Patterns
- Secrets never in client bundle/roadmap.json (CLAUDE.md) — constrains where PAT + LINEAR_API_KEY bind.
- Pages Functions + `wrangler.toml` with `pages_build_output_dir = "dist"` — the KV binding (D-08-06)
  is added here; Pages KV bindings are declared in wrangler config + created in the CF dashboard.

### Integration Points
- Cloudflare dashboard: Pages project connection, Access application, `LINEAR_API_KEY` + PAT +
  KV namespace bindings (mostly out-of-band config the runbook must capture).
- GitHub: Actions secrets (`LINEAR_API_KEY`, the PAT), repo→Pages connection.
</code_context>

<specifics>
## Specific Ideas

- Cron cadence is already daily 06:00 UTC (`snapshot.yml`) — keep as-is; verification is a
  single real fire on `main`, not a cadence change.
- The `08/PLAN.md` currently present is a 22-Jun placeholder stub with no user context — it
  will be superseded/removed when real plans are created (same treatment as the old Phase-7 stub).
</specifics>

<deferred>
## Deferred Ideas

- **Public GitHub Pages mirror of the static snapshot** — listed as "optional" in the old stub;
  not part of the private-URL-behind-Access v0.1.0 goal. Revisit as its own small phase if a
  public read-only view is ever wanted.
- **Preview-deployment (`*.pages.dev`) Access gating** — offered, not selected; residual
  hardening option if ungated preview URLs become a concern.
- **Split least-privilege tokens** (dispatch-only vs checkout-only PATs) — deferred in favor
  of the single PAT (D-08-03); revisit if the Access audience widens.

</deferred>

---

*Phase: 8-Deploy, gate & document*
*Context gathered: 2026-07-16*
