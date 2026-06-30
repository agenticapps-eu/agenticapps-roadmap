---
phase: 03-linear-proxy
audit: cso (focused — token boundary, proxy leak surface, Access)
date: 2026-06-30
mode: daily (8/10 confidence gate)
scope: phase-03 diff (functions/, scripts/, src/)
threats_open: 0
verdict: PASS (with one DEFERRED blocking enforcement gate — Access proof)
---

# Phase 03 — Security Posture Report (CSO, focused)

/ cso run scoped to the phase-03 changes: the Linear GraphQL proxy Pages
Function, the shared fetch layer, and the token boundary. This phase is a
token-holding proxy gated by Cloudflare Access, so the audit centered on
secret leakage, the proxy's error/log surface, and the gating control.

## Architecture mental model

- **Client (`src/`)** renders from a sanitized, token-free `public/roadmap.json`
  by default (zero network). Optional `?source=live` calls same-origin
  `/api/linear/snapshot`.
- **Proxy (`functions/api/linear/[[path]].ts`)** holds the Linear token in a
  Pages Functions binding (`env.LINEAR_API_KEY`), resolves a named operation,
  fetches Linear (main query + paginated issues via `fetch-workspace.ts`), runs
  `mapWorkspace → buildSnapshot → assertNoLeak`, and returns schema-valid JSON.
- **CI path (`scripts/`)** uses the same query/transform with a Node token to
  regenerate the snapshot.
- **Trust boundary:** the token lives only server-side (binding + CI secret +
  local gitignored `.dev.vars`). The primary auth control is **Cloudflare
  Access** over the app AND `/api/*`; the per-isolate rate limit is
  defense-in-depth.

## Verified invariants (all PASS)

| # | Invariant | Result |
|---|-----------|--------|
| 1 | Token never in the client bundle (`dist/`) | ✓ no `lin_api_`/keyname in built assets |
| 2 | Token / PII never in committed `roadmap.json` | ✓ no token pattern, no email pattern |
| 3 | Token read server-side only — `functions/` + `scripts/`, never `src/` | ✓ `src/` has zero references to `LINEAR_API_KEY` |
| 4 | `.dev.vars` gitignored and never tracked | ✓ ignored + not in `git ls-files` |
| 5 | No real secret added in the phase-03 diff | ✓ only a fake fixture `lin_api_TESTKEY000` in `*.test.ts` (FP-excluded) |
| 6 | Every proxy error body is a static generic string | ✓ `unknown operation`/`rate limited`/`internal error`/`upstream error` — no interpolation of upstream/token |
| 7 | No logging in the proxy/fetch path | ✓ zero `console.*`/logger calls — nothing can echo token, headers, or upstream body to logs |
| 8 | Auth header value flows only into the outbound fetch | ✓ `env.LINEAR_API_KEY` → `authHeader` → `Authorization` header only; never a body or throw |

These invariants are also continuously enforced by the 03-03/03-04 test suite
(token-never-in-any-body across all six response paths) and were confirmed live
during the 03-04 smoke (token absent from body, headers, and the `wrangler` log).

## Findings

**No CRITICAL, HIGH, or MEDIUM findings.** The single Critical from the code
review (pagination infinite-loop, CR-01) was a robustness bug, not a secret-leak
vector, and is already fixed (`02f45c1`).

### Informational / accepted

- **assertNoLeak's live-key check is a no-op in the Worker** (no `process`
  global) — only the `lin_api_` regex + email regex fire in production. This is
  acceptable: the regex covers the token format, and the token is never placed
  into the serialized snapshot in the first place. (Matches code-review IN-02.)
- **No server-side error logging** — by design here (guarantees no token/PII in
  logs). A future `console.error(err.message)` for diagnosability would need to
  stay message-only; deferred as code-review IN-01.

## DEFERRED — blocking enforcement gate (not a code finding)

The architecture's privacy control is **Cloudflare Access**. The code path is
clean, but the *enforcement* of Access over `/api/*` is proven only by a captured
runtime check, which is **deferred** (see `03-HUMAN-UAT.md`). Until
`03-ACCESS-PROOF.md` records an unauthenticated `/api/linear/snapshot` returning
302/403, the proxy's privacy depends on an unverified dashboard policy. This is
the Phase-03 completion gate and is tracked as blocking.

- Runbook: `docs/access-setup.md` (covers the email allow-list over the app AND
  `/api/*`, with an explicit warning that omitting `/api/*` leaves the proxy open).

## Verdict

**PASS** — the token boundary holds on every audited path; no secret or PII can
reach a client, a response body, a log, or the committed snapshot. The only open
security-relevant item is the deferred Access enforcement proof, already tracked
as a blocking gate.

---

*This tool is not a substitute for a professional security audit. /cso is an
AI-assisted scan that catches common vulnerability patterns; for a production
system handling sensitive data, engage a qualified security firm.*
