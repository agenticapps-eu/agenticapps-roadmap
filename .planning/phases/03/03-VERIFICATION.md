---
phase: 03-linear-proxy
verified: 2026-06-30T10:45:00Z
status: human_needed
score: 3/4 success criteria verified (SC-4 requires deployed environment — blocking human verification)
overrides_applied: 0
human_verification:
  - test: "Unauthenticated request to /api/linear/snapshot is BLOCKED by Cloudflare Access"
    expected: "curl -sS -o /dev/null -w \"%{http_code}\\n\" https://<deployed-domain>/api/linear/snapshot returns 302 (redirect to Access login) or 403 — NOT 200. No Linear data, no token in the response."
    why_human: "Requires a deployed Cloudflare Pages environment with an Access policy applied. Cannot be verified from the codebase or locally."
  - test: "Allowed identity to /api/linear/snapshot SUCCEEDS"
    expected: "Authenticated as an allow-listed email or via a CF-Access service token, the endpoint returns 200 with schema-valid RoadmapJson and LINEAR_API_KEY appears nowhere in the body, headers, or Worker logs."
    why_human: "Requires deployed Pages env, Access policy, and a valid Access session or service token. Captured result must be committed as .planning/phases/03/03-ACCESS-PROOF.md to close the gate."
---

# Phase 03: Linear Proxy & Access — Verification Report

**Phase Goal:** Add a server-side Linear GraphQL proxy (token in a Pages Functions binding) with a live-data client path, and turn private gating into captured, blocking proof — without ever leaking the token or PII.
**Verified:** 2026-06-30T10:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Gate Checks (Run)

| Gate | Command | Result | Status |
|------|---------|--------|--------|
| Typecheck | `pnpm typecheck` | 0 errors | PASS |
| Test suite | `pnpm test` | 44 tests, 3 files, all pass | PASS |
| Build | `pnpm build` | 127 modules, clean | PASS |
| Token in dist/ | `grep -r "LINEAR_API_KEY\|lin_api_" dist/` | No matches | PASS |
| Token in src/ | `grep -r "LINEAR_API_KEY" src/` | No matches | PASS |
| Token in public/ | `grep -r "LINEAR_API_KEY" public/` | No matches | PASS |
| .dev.vars gitignored | `git check-ignore .dev.vars` | Confirmed ignored | PASS |

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/api/linear/snapshot` serves only registered named operations, authenticated by the binding token, with the token absent from every response body | VERIFIED | `OPERATIONS` registry (one entry: "snapshot"); unknown op → 404 before any fetch (line 85-87 of `[[path]].ts`); token only ever appears in `Authorization` header inside `fetchAssembledWorkspace`; tests: unknown-op-404 test + all 6 token-never-present tests across every response path pass |
| 2 | Upstream PII (emails) and malformed/error responses produce generic 5xx with no token/PII; success sets `Cache-Control: private, max-age=60` | VERIFIED | `assertNoLeak` called in `buildSnapshot` before returning; entire live block inside one try/catch → any throw returns `new Response("upstream error", { status: 502 })`; success path sets `"Cache-Control": "private, max-age=60"`; test suite confirms: email-leak → 502 no-PII, malformed-JSON → 502 no-PII, upstream-non-ok → 502 no-PII, GraphQL-errors → 502, Cache-Control header test passes |
| 3 | The client defaults to the snapshot (zero `/api/*` calls) and only fetches live with `?source=live`, with a total-failure-safe fallback + "live unavailable" notice | VERIFIED | `roadmapLoader`: `wantLive = searchParams.get("source") === "live"`; snapshot path never calls `/api/*`; entire live attempt wrapped in one try/catch; `AppHeader` renders `{liveUnavailable && <span>live unavailable — showing snapshot</span>}`; toggle sets/deletes `source` param; tests confirm: snapshot default makes no /api/linear/* call, 4 live-failure modes all fall back with `liveUnavailable=true` and no throw, snapshot failure throws a Response |
| 4 | Captured evidence proves an unauthenticated request to `/api/linear/snapshot` is blocked by Access and an allowed identity succeeds | HUMAN NEEDED | `03-ACCESS-PROOF.md` does not exist. `docs/access-setup.md` (185 lines) documents the setup runbook but the enforcement proof requires a deployed Cloudflare Pages environment with a Zero Trust Access policy applied. This is a blocking gate. See `03-HUMAN-UAT.md`. |

**Score:** 3/4 success criteria verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/api/linear/[[path]].ts` | Pages Function proxy handler | VERIFIED | 125 lines; named-op registry, rate limit, env check, two-part fetch, single try/catch, Cache-Control header |
| `functions/api/linear/[[path]].test.ts` | Proxy unit tests | VERIFIED | 517 lines; covers all REQ-PROXY-1..4 + rate-limit + pagination + two-fetch strategy |
| `scripts/linear/query.ts` | MAIN_QUERY + ISSUES_QUERY, runtime-agnostic | VERIFIED | 84 lines; exports both queries; no process/Node references (comment on line 4 is documentation only) |
| `scripts/linear/fetch-workspace.ts` | Two-part fetch + paginator + null-endCursor guard | VERIFIED | 165 lines; injects fetchFn; paginates ISSUES_QUERY; null-endCursor guard at line 143-147; reassembles GqlResponse |
| `scripts/linear/map.ts` | GQL→RawWorkspace, runtime-agnostic | VERIFIED | 94 lines; reads `ini.status` → `state`, `proj.initiatives.nodes[0]?.id`; no process/Node references |
| `scripts/linear/transform.ts` | buildSnapshot + assertNoLeak | VERIFIED | 156 lines; `assertNoLeak` called before return; TOKEN_RE + EMAIL_RE + live-key check |
| `src/lib/roadmap/loader.ts` | React Router loader with snapshot-default + live-fallback | VERIFIED | 65 lines; wantLive gating, one try/catch for entire live branch, throws Response on snapshot failure |
| `src/lib/roadmap/loader.test.ts` | Loader unit tests | VERIFIED | 193 lines; 8 tests covering all fallback modes + error boundary |
| `src/components/AppHeader.tsx` | Live/Snapshot toggle + liveUnavailable notice | VERIFIED | 86 lines; toggle deletes/sets `source` param; conditionally renders "live unavailable — showing snapshot" |
| `docs/access-setup.md` | Cloudflare Access setup runbook | VERIFIED | 185 lines; covers secret binding, email allow-list policy (Pages domain + /api/*), rate-limit option, verify commands |
| `.planning/phases/03/03-ACCESS-PROOF.md` | Captured Access enforcement proof | MISSING | Does not exist — blocking gate; deferred to Phase 08 deploy (see 03-HUMAN-UAT.md) |
| `.dev.vars` | Local dev secret file | VERIFIED (gitignored) | File exists locally with `LINEAR_API_KEY`; confirmed gitignored by `git check-ignore` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `[[path]].ts` | `fetch-workspace.ts` | `fetchAssembledWorkspace` import | WIRED | Line 19: `import { fetchAssembledWorkspace } from "../../../scripts/linear/fetch-workspace.ts"` |
| `[[path]].ts` | `map.ts` | `mapWorkspace` import | WIRED | Line 20-22: `import { mapWorkspace } from "../../../scripts/linear/map.ts"` |
| `[[path]].ts` | `transform.ts` | `buildSnapshot` import | WIRED | Line 23: `import { buildSnapshot } from "../../../scripts/linear/transform.ts"` |
| `fetch-workspace.ts` | `query.ts` | `MAIN_QUERY`, `ISSUES_QUERY` imports | WIRED | Line 17: `import { MAIN_QUERY, ISSUES_QUERY } from "./query.ts"` |
| `transform.ts` | `assertNoLeak` call in `buildSnapshot` | Direct call at line 152 | WIRED | `assertNoLeak(JSON.stringify(result))` before `RoadmapJsonSchema.parse(result)` |
| `router.tsx` | `loader.ts` | `roadmapLoader` assigned to root route | WIRED | Route id="root" has `loader: roadmapLoader`; `AppHeader` reads via `useRouteLoaderData("root")` |
| `AppHeader.tsx` | loader data | `useRouteLoaderData("root")` | WIRED | `liveUnavailable` read from loader result; toggle sets/deletes `source` param |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `[[path]].ts` | `result` (RoadmapJson) | `fetchAssembledWorkspace` → `mapWorkspace` → `buildSnapshot` | Yes — full pipeline from Linear API, validated against schema | FLOWING |
| `loader.ts` | `parsed.data` (RoadmapJson) | `/api/linear/snapshot` (live) or `/roadmap.json` (snapshot) | Yes — validated via `RoadmapJsonSchema.safeParse` | FLOWING |
| `AppHeader.tsx` | `liveUnavailable` | `useRouteLoaderData("root")` from router loader | Yes — driven by actual fetch result in loader | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Result | Status |
|----------|--------|--------|
| `pnpm typecheck` produces no errors | Exit 0, no output | PASS |
| `pnpm test` — 44 tests, 3 test files | `Tests 44 passed (44)` | PASS |
| `pnpm build` — clean Vite + tsc build | 127 modules, clean, no warnings | PASS |
| `dist/` contains no token patterns | `grep -r "LINEAR_API_KEY\|lin_api_" dist/` → no matches | PASS |
| `.dev.vars` gitignored | `git check-ignore .dev.vars` → exit 0 | PASS |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| REQ-SHARE | Phase-02 query string and GQL→RawWorkspace mapping are runtime-agnostic, Worker-importable | VERIFIED | `query.ts` and `map.ts` have no `process`, `node:*`, or Node-only globals. `fetch-workspace.ts` injects `fetchFn` as parameter. Worker imports `fetchAssembledWorkspace` directly, never `client.ts`. The only `process.` occurrence in `query.ts` line 4 is a code comment. |
| REQ-GUARD | `assertNoLeak` reused server-side; no token/PII passes through the proxy | VERIFIED | `buildSnapshot` (in `transform.ts`) calls `assertNoLeak(JSON.stringify(result))` at line 152. The proxy wraps the entire pipeline in one try/catch: `assertNoLeak` throw → `catch` → `return new Response("upstream error", { status: 502 })`. Test "REQ-PROXY-3: email leak gate" confirms 502 with no `@` in body. |
| REQ-TYPE | `@cloudflare/workers-types` installed; `functions/**` typechecked with no `any`; vitest discovers `functions/**` | VERIFIED | `package.json`: `"@cloudflare/workers-types": "^4.20260629.1"`. `tsconfig.functions.json`: `"types": ["@cloudflare/workers-types"]`, `strict: true`, `include: ["functions/**/*"]`. `vitest.config.ts` `include` array contains `"functions/**/*.test.ts"`. `pnpm typecheck` clean. |
| REQ-PROXY-1 | Proxy serves only registered named operations; token absent from every response body | VERIFIED | `OPERATIONS` registry with one key ("snapshot"); unknown op → `404 "unknown operation"` before any `fetch` call; token only in `Authorization` header inside `fetchAssembledWorkspace`. Tests: unknown-op-404 + 6 token-never-present tests all pass. |
| REQ-PROXY-2 | Email in upstream response → 502 with no PII in body | VERIFIED | `assertNoLeak` checks `EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/` on the serialized result; throws on match; caught → 502 generic. Test: "email leak gate" returns 502, body has no `@`, no `secret@example.com`. |
| REQ-PROXY-3 | Complete error table: 500 missing key, 502 upstream non-ok / GraphQL errors / malformed body | VERIFIED | Lines 95-97: `!env.LINEAR_API_KEY → 500 "internal error"`. Lines 91-93 (in `fetchAssembledWorkspace`): `!mainRes.ok → throw`. Lines 97-100: `mainJson.errors.length > 0 → throw`. JSON parse throws: propagates to catch → 502. All paths return generic bodies. Tests confirm all three branches. |
| REQ-PROXY-4 | Success `Cache-Control: private, max-age=60`; per-isolate rate limit; Access gating with captured proof | PARTIAL | Code: `"Cache-Control": "private, max-age=60"` at lines 122-123. Rate limit: `LIMIT=30`, `WINDOW_MS=60_000`, `isRateLimited()` guards before any fetch. Tests: Cache-Control test passes, rate-limit 30th/31st test passes, window-reset test passes. **Access gating clause: BLOCKED** — `03-ACCESS-PROOF.md` does not exist; deployed environment required (see Human Verification below). |
| REQ-LOADER | Client loader: snapshot default (zero `/api/*` calls); `?source=live` fetches live; total-failure-safe fallback; "live unavailable" notice; header toggle | VERIFIED | `loader.ts`: `wantLive = searchParams.get("source") === "live"`; snapshot path never calls `/api/*`; entire live branch in one try/catch (4 failure modes: rejected fetch, SyntaxError, !ok, schema mismatch). `AppHeader.tsx`: `{liveUnavailable && <span>live unavailable — showing snapshot</span>}`; toggle deletes `source` param for clean URL. Tests: 8 tests all pass. |

---

## Latent Bug Fixes (Verified Present)

These were discovered during live smoke (03-04) and fixed before phase completion. Verifying they are in the committed code:

| Fix | File | Evidence |
|-----|------|----------|
| Two-query strategy (MAIN_QUERY + ISSUES_QUERY) replaces single complex WORKSPACE_QUERY | `scripts/linear/query.ts` | Both exports present (lines 22 and 67); comment explains why two queries avoid Linear's complexity limit |
| `map.ts` reads correct field names: `ini.status` → `state`, `proj.initiatives.nodes` for initiative links | `scripts/linear/map.ts` | Line 79: `state: ini.status`; line 85: `initiativeId: proj.initiatives.nodes[0]?.id ?? null` |
| `fetch-workspace.ts` paginates issues + null-endCursor guard prevents infinite loop | `scripts/linear/fetch-workspace.ts` | Lines 110-148: while-loop with `hasNextPage`; guard at lines 143-147: `if (hasNextPage && pageInfo.endCursor === null) throw new Error(...)` |

---

## Anti-Patterns Found

No `TBD`, `FIXME`, `XXX`, `HACK`, `PLACEHOLDER`, or stub-pattern anti-patterns found in any phase-03 modified files (`[[path]].ts`, `[[path]].test.ts`, `query.ts`, `map.ts`, `fetch-workspace.ts`, `transform.ts`, `loader.ts`, `loader.test.ts`, `AppHeader.tsx`).

---

## Human Verification Required

### 1. Unauthenticated Request to /api/linear/snapshot is BLOCKED by Access

**Test:** From a shell or private browser with no Cloudflare Access session:
```
curl -sS -o /dev/null -w "%{http_code}\n" https://<deployed-domain>/api/linear/snapshot
```
**Expected:** `302` (redirect to Access login) or `403` — NOT `200`. No Linear data, no token in the response.
**Why human:** Requires a deployed Cloudflare Pages environment with a Cloudflare Access email allow-list policy applied over both the Pages domain and `/api/*`. Cannot be fabricated from the codebase or reproduced locally via `wrangler pages dev` (Access is a production-only control plane feature).
**Setup:** Follow `docs/access-setup.md`.
**Completion:** Capture result in `.planning/phases/03/03-ACCESS-PROOF.md` (the blocking gate).

### 2. Allowed Identity to /api/linear/snapshot SUCCEEDS

**Test:** Authenticated as an allow-listed email (browser session) or via a Cloudflare Access service token (`CF-Access-Client-Id` / `CF-Access-Client-Secret` headers):
```
curl -H "CF-Access-Client-Id: <id>" -H "CF-Access-Client-Secret: <secret>" \
  https://<deployed-domain>/api/linear/snapshot
```
**Expected:** `200` with schema-valid `RoadmapJson`. `LINEAR_API_KEY` appears nowhere in the body, response headers, or Cloudflare Worker logs.
**Why human:** Same deployment requirement as test 1; also requires a valid Access service token or an active allow-listed email session.
**Completion:** Both tests must pass and be recorded in `.planning/phases/03/03-ACCESS-PROOF.md` before Phase 03 can be marked complete.

---

## Gaps Summary

There are no code-level gaps in this phase. All implementation, tests, and security controls are present and verified by the automated gate suite (typecheck clean, 44 tests pass, build clean, no token in bundle, no debt markers).

The sole outstanding item is **SC-4 / the Access-gating clause of REQ-PROXY-4**: captured evidence that Cloudflare Access enforces authentication on `/api/linear/snapshot`. This requires a deployed Cloudflare Pages environment (expected to be established in Phase 08: Deploy, gate & document). The blocking gate is tracked in `.planning/phases/03/03-HUMAN-UAT.md`. Phase 03 is NOT complete until `03-ACCESS-PROOF.md` is committed.

---

_Verified: 2026-06-30T10:45:00Z_
_Verifier: Claude (gsd-verifier)_
