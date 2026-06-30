---
status: blocked
phase: 03-linear-proxy
source: [03-05-PLAN.md, 03-05-SUMMARY.md]
severity: blocking
started: 2026-06-30
updated: 2026-06-30
---

## Current Test

Access enforcement proof — awaiting deployed Pages env + Cloudflare Access config.

## Tests

### 1. Unauthenticated request to /api/linear/snapshot is BLOCKED by Access
expected: From a shell/private browser with no Access session,
`curl -sS -o /dev/null -w "%{http_code}\n" https://<deployed-domain>/api/linear/snapshot`
returns **302** (redirect to Access login) or **403** — NOT 200. No Linear data,
no token in the response.
result: [pending]

### 2. Allowed identity to /api/linear/snapshot SUCCEEDS
expected: Authenticated as an allow-listed email (or via a Cloudflare Access
service token with `CF-Access-Client-Id` / `CF-Access-Client-Secret` headers),
the same endpoint returns **200** with schema-valid RoadmapJson, and
`LINEAR_API_KEY` appears nowhere in the body, headers, or Worker logs.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 2

## Gaps

- **BLOCKING — Phase 03 completion gate.** Phase 03 cannot be marked complete
  until both checks above pass and the results are captured in
  `.planning/phases/03/03-ACCESS-PROOF.md`.
- Requires out-of-band work: deploy a Cloudflare Pages preview/production
  environment and configure the Access email allow-list over the domain AND
  `/api/*`. This overlaps Phase 08 (Deploy, gate & document) and is expected to
  be captured then.
- Setup steps: `docs/access-setup.md`. Proof-file template: see the 03-05
  checkpoint instructions / `03-05-SUMMARY.md`.
