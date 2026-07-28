---
status: partial
phase: 08-deploy-gate-document
source: [07-HUMAN-UAT.md, 08-03-PLAN.md]
started: 2026-07-17
updated: 2026-07-17
---

# 08 Live Proof

Live-deploy verification for Phase 8, Task 3. Mirrors `03-ACCESS-PROOF.md`.
One row per `07-HUMAN-UAT.md` item (1..13) plus the preview build/leak-check rows.
RELEASE GATE (D-08-05): v0.1.0 is tagged ONLY after ALL 13 rows are PASS.

## Infrastructure (Tasks 1–2)

- **origin/main**: `5f5a2d0` (release PR #7 merged) — backfill runtime + real KV id + 08-02 docs.
- **KV**: `BACKFILL_NONCE` = `4b1725a56abd4340adaaabaa40814584` (wrangler.toml sole source; bound prod+preview).
- **Pages project**: `agenticapps-roadmap` (account `94c4304039eb7892d6f2ca2bff3579d4`, production branch `main`, **direct-upload** — see Deviations).
- **Production secrets (Production env ONLY)**: `LINEAR_API_KEY`, `GH_BACKFILL_TOKEN` (`secret_text`). Preview env: **zero** secrets.
- **GitHub Actions secrets**: `GH_CROSS_REPO_TOKEN`, `LINEAR_API_KEY`.
- **Cloudflare Access** (team `vlahovic2.cloudflareaccess.com`), allow-list `donald@agenticapps.eu`, `donald@factiv.eu`:
  - app `agenticapps-roadmap.pages.dev` (apex)
  - app `*.agenticapps-roadmap.pages.dev` (all deployment aliases)

## Gated hostnames (item 2 / 8 — Access gate)

| Hostname / path | Unauth code | Location |
|---|---|---|
| `agenticapps-roadmap.pages.dev/` | 302 | → Access login (`vlahovic2.cloudflareaccess.com`, auth_status NONE) |
| `agenticapps-roadmap.pages.dev/api/linear/snapshot` | 302 | → Access login |
| `agenticapps-roadmap.pages.dev/api/backfill/dispatch` | 302 | → Access login |
| `agenticapps-roadmap.pages.dev/api/backfill/status` | 302 | → Access login |
| `f6985960.agenticapps-roadmap.pages.dev/api/linear/snapshot` (prod hash alias) | 302 | → Access login (was 200+data before wildcard app; now closed) |

## Per-item results

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Bind GH_BACKFILL_TOKEN + GH_CROSS_REPO_TOKEN + LINEAR_API_KEY | **PASS** | Pages prod env_vars = {LINEAR_API_KEY, GH_BACKFILL_TOKEN} secret_text; `gh secret list` = GH_CROSS_REPO_TOKEN + LINEAR_API_KEY |
| 2 | Unauth /api/backfill/dispatch + /status → 302/403 | **PASS** | both 302 → Access login (table above) |
| 3 | Direct apply w/ missing→400, invalid→403 previewRunId | PENDING | needs authenticated session (Access service token) to reach dispatch.ts past the gate |
| 4 | Dry-run via UI renders typed diff | PENDING | needs browser + Access login + real dispatch |
| 5 | Sibling checkout resolves 3 repos' .planning/ | PENDING | needs a real backfill run (CI logs) |
| 6 | Apply end-to-end → Linear write + roadmap.json+linear-map.json commit | PENDING | real Linear mutation — user-driven |
| 7 | Cancelled/failed run → badge reverts + inline error | PENDING | UI, user-driven |
| 8 | Token never in /api/backfill/* body across status codes | PENDING | needs authenticated real responses |
| 9 | dispatch return_run_details → 200 vs 204 (WR-05 / OQ A3) | PENDING | needs a real dispatch |
| 10 | Concurrency: backfill apply + snapshot serialize (roadmap-git-writer) | PENDING | needs two real runs |
| 11 | REAL scheduled snapshot.yml cron fire (06:00 UTC) + commit | PENDING | time-gated — next 06:00 UTC window; tag WAITS |
| 12 | status.ts marker extraction tolerates real log prefixing | PENDING | needs a real dispatched run's logs |
| 13 | Nonce consume-once: reused previewRunId → 403 live | PENDING | needs authenticated real preview run |
| P-a | Preview build renders (200 + bundle + roadmap.json) | PARTIAL | preview `989b5291…` root returned 200 pre-gate; dist/index.html references built bundle + dist/roadmap.json present. Now gated by wildcard (see Deviations) |
| P-b | Preview /api/* errors leak-free (no ghp_/github_pat_/lin_api_) | **PASS** | pre-gate `989b5291…/api/linear/snapshot` → `internal error`, no token pattern; preview env has zero secrets |

## Deviations / notes

- **D-08-02 deviation (wildcard gate over preview):** production per-deployment hash aliases share the `*.agenticapps-roadmap.pages.dev` namespace with preview deployments and were serving live Linear data ungated (threat T-08-06). Closing that required a wildcard Access app, which also gates preview deployments — stricter than D-08-02 (preview left ungated). Security prioritized; the D-08-02 leak-free property was captured BEFORE gating (row P-b) and preview has zero secrets bound. Alternative to restore ungated preview = move production to a custom domain.
- **Pages↔GitHub git-connect NOT done (browser OAuth):** the project is direct-upload (`wrangler pages deploy`). Consequence: a `main` push (e.g. the snapshot cron committing roadmap.json) will NOT auto-rebuild the live site until a redeploy. Affects the "live site refreshes" expectation behind items 6/11.

## Release gate

NOT tagged. 2/13 items PASS; item 11 is time-gated on the 06:00 UTC cron. Per D-08-05, v0.1.0 waits until all 13 PASS.
