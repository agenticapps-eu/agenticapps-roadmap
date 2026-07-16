---
phase: 8
slug: deploy-gate-document
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-16
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing, `vitest.config.ts` at repo root) |
| **Config file** | `vitest.config.ts` — `include: ["scripts/**/*.test.ts", "functions/**/*.test.ts", "src/**/*.test.ts"]` |
| **Quick run command** | `CI=true npx vitest run functions/api/backfill/dispatch.test.ts` (per this project's documented non-TTY workaround — `pnpm test`/`typecheck` abort in agent shells) |
| **Full suite command** | `CI=true npx vitest run` |
| **Typecheck command** | `npx tsc -b --noEmit` (non-TTY-safe substitute for `pnpm typecheck`) |
| **Estimated runtime** | ~10 seconds (quick), ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `CI=true npx vitest run functions/api/backfill/dispatch.test.ts` (nonce logic — fast, isolated)
- **After every plan wave:** Run `CI=true npx vitest run` (full suite — confirms no regression in untouched proxy/status/client code)
- **Before `/gsd:verify-work`:** Full suite must be green AND every `07-HUMAN-UAT.md` item recorded PASS
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | D-08-06 (CR-01 nonce) | T-08-07 | A reused previewRunId is suppressed best-effort sequentially (second → 403, one dispatch POST across two applies) | unit | `CI=true npx vitest run functions/api/backfill/dispatch.test.ts -t "previewRunId"` | ✅ | ⬜ pending |
| 08-01-01 | 01 | 1 | DEPLOY-01 (KV binding) | T-08-07 | wrangler.toml declares the BACKFILL_NONCE KV binding the Function reads (detectable PLACEHOLDER id) | unit | `CI=true npx vitest run functions/api/backfill/dispatch.test.ts` | ✅ | ⬜ pending |
| 08-02-* | 02 | 1 | DEPLOY-03, DEPLOY-04 | — | README + runbook.md + ADR cover deploy/rotation/refresh/backfill; access-setup.md + architecture.md reconciled to the locked decisions | manual-only (doc review) + grep | — | ✅ (created by 08-02) | ⬜ pending |
| 08-03-02 | 03 | 2 | DEPLOY-01 (preview build) | T-08-09 | Preview `*.pages.dev` build RENDERS the static app (200 + bundle + roadmap.json) with zero live secrets; `/api/*` bodies leak no token; secrets stay Production-only | manual-only (live curl) | `curl -sS https://<hash>.agenticapps-roadmap.pages.dev/api/backfill/dispatch` body has no ghp_/github_pat_/lin_api_ | N/A — infra state | ⬜ pending |
| 08-03-01 | 03 | 2 | DEPLOY-01 (prod connect + bind) | T-08-09 | Real KV id merged via one PR; Pages project connected; secrets bound Production-only | manual-only (dashboard + curl) | — | N/A — infra state | ⬜ pending |
| 08-03-03 | 03 | 2 | DEPLOY-02 (Access gating) | T-08-06 | Unauth request to app root + all `/api/*` on EVERY production hostname returns 302/403 (302 Location = Access login) | manual-only (live curl) | `curl -sS -o /dev/null -w "%{http_code}\n" https://<domain>/api/backfill/dispatch` | N/A | ⬜ pending |
| 08-03-03 | 03 | 2 | DEPLOY-04 (v0.1.0 tag) | — | Tag applied only after ALL 13 07-HUMAN-UAT rows PASS (incl. a real staged-delta scheduled cron run), at the fetched origin/main SHA | automated (post-tag) | `git tag -l v0.1.0 && git ls-remote --tags origin | grep -q 'refs/tags/v0.1.0'` | ✅ (after tag) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**Existing infrastructure covers all phase requirements.** Vitest is already present
(`vitest.config.ts`) and `functions/api/backfill/dispatch.test.ts` already exists — the
08-01 nonce work extends it with new KV cases (reuse → 403 with one dispatch POST; distinct
ids → both dispatch) using ONE shared Map-backed fake-KV env (no Miniflare needed). No
framework install and no new test-file scaffold are required before execution begins.

- [x] Test framework present (Vitest) — no install needed
- [x] `functions/api/backfill/dispatch.test.ts` exists — 08-01 extends it in place with `BACKFILL_NONCE` cases

---

## Manual-Only Verifications

*This is a live-deploy verification phase by design; human-only validation dominates.
The one automatable slice (the KV nonce, 08-01) has real unit coverage above.*

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real KV id merged via one PR; repo connected to Cloudflare Pages, production build live, `LINEAR_API_KEY` bound Production-only | DEPLOY-01 | Dashboard infra state — no in-repo code path to assert | Create the KV namespace + real wrangler.toml id on the feature branch, merge one release PR; create the Pages project (production branch `main`), bind secrets Production-only; `curl` the production domain root — 302/403 unauth (gated). 08-03 Tasks 1-2; UAT item #1. |
| Preview build RENDERS the static app (200 + bundle + roadmap.json) with zero live secrets; `/api/*` leak-free | DEPLOY-01 | Live Cloudflare preview deployment state | Push a throwaway non-`main` branch; `curl` the resulting `*.pages.dev` preview URL — 200 with real render, and `/api/*` bodies contain no ghp_/github_pat_/lin_api_. 08-03 Task 2; complements UAT items #1/#2. |
| Access policy applied on EVERY production hostname, gating verified end-to-end | DEPLOY-02 | Edge-level auth — verified only against the live deployed domain(s) | Unauth `curl` to app root + `/api/backfill/*` + `/api/linear/*` on the custom domain AND `<project>.pages.dev` → 302/403 (302 Location = Access login); allow-list identity → 200. 08-03 Task 3; UAT items #2, #8. |
| Apply cannot bypass preview (400 vs 403 split) | DEPLOY-02 | Requires live dispatch path | Direct `POST /api/backfill/dispatch {mode:"apply"}` with missing/non-positive previewRunId → 400; positive-but-invalid → 403; valid first use → accepted; reused → 403. 08-03 Task 3; UAT item #3. |
| Typed diff preview + sibling checkout resolve live | DEPLOY-01 | Requires a real GitHub dispatch + CI run | UI Preview on claude-workflow renders typed diff; dry-run leg locates all 3 siblings' `.planning/`. 08-03 Task 3; UAT items #4, #5. |
| Real apply writes Linear + commits roadmap.json + linear-map.json | DEPLOY-01 | Real Linear write + CI commit to `main` | Apply `claude-workflow` end-to-end; verify Linear UI + single commit SHA; SyncBadge in-sync after reload. 08-03 Task 3; UAT items #6, #7. |
| Dispatch returns 200 vs 204 (`return_run_details`) | DEPLOY-01 | Real GitHub API response for this org/repo/PAT | Record observed status of the real `.../dispatches` call. 08-03 Task 3; UAT items #9, #12 (closes RESEARCH Open Question 1). |
| Concurrency serialization (shared writer group) | DEPLOY-01 | Requires two real concurrent runs | Trigger backfill apply + snapshot close together; confirm no non-fast-forward. 08-03 Task 3; UAT item #10. |
| Nonce best-effort suppression enforced live | D-08-06 | Requires real KV + live apply | Second apply reusing the same previewRunId → 403 live (proves the observed sequential case). 08-03 Task 3; UAT item #13. |
| Real staged-delta scheduled `snapshot.yml` cron fires on `main` and commits | DEPLOY-04 | GitHub cron fires only on default branch; unchanged snapshot commits nothing; may need a later day (Pitfall 3) | Stage a Linear delta first, then observe a real 06:00 UTC scheduled run commit a fresh roadmap.json; record run URL + timestamp + commit. 08-03 Task 3; UAT item #11. |
| `v0.1.0` tagged with hosting/sync ADR after ALL 13 UAT rows PASS | DEPLOY-04 | Tag act gated on ALL 13 07-HUMAN-UAT rows PASS (D-08-05, single-valued gate); ADR is a doc artifact | After all 13 rows PASS, `git tag v0.1.0` at the fetched origin/main SHA + push; verify `git ls-remote --tags origin`. 08-03 Task 3. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are documented manual-only with justification (this is a live-deploy phase; the sole automatable slice — the 08-01 KV nonce — has real unit coverage)
- [x] Sampling continuity: the automatable work (08-01 nonce) runs the quick command every commit; no 3 consecutive automatable tasks lack automated verify (only one automatable slice exists)
- [x] Wave 0 covers all MISSING references (none — existing Vitest + dispatch.test.ts cover the automatable work)
- [x] No watch-mode flags (`CI=true npx vitest run` is single-shot)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Release gate is single-valued: v0.1.0 tags only after ALL 13 07-HUMAN-UAT rows PASS (matches 08-03; reconciled 2026-07-16 per cross-AI review R3)

**Approval:** approved 2026-07-16 (release-gate reconciliation 2026-07-16)
