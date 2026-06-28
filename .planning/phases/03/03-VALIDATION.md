---
phase: 03
slug: linear-proxy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `03-RESEARCH.md` → "Validation Architecture". Phase has no REQUIREMENTS.md;
> the brainstorming spec (`docs/superpowers/specs/2026-06-28-linear-proxy-access-design.md`)
> is the requirement source. Requirement labels below map to the spec's four TDD tests
> plus the "Done when" criteria.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.1.9` (installed) |
| **Config file** | `vitest.config.ts` — env `node`; **include glob must add `functions/**/*.test.ts`** (currently `scripts/**` only — load-bearing change) |
| **Quick run command** | `pnpm test` (`vitest run`) |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm lint && pnpm build` |
| **Estimated runtime** | ~5–15 seconds (unit tests + tsc + eslint + vite build) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm typecheck && pnpm lint`
- **Before `/gsd:verify-work`:** Full suite green **+** `wrangler pages dev dist` live smoke (200 from `/api/linear/snapshot`, 404 from `/api/linear/nope`) **+** `/cso` (spec-mandated → SECURITY.md) **+** grep that no response/log contains `lin_api_` or the key value
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Req | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists |
|-----|----------|------------|-----------------|-----------|-------------------|-------------|
| REQ-PROXY-1 | unknown op → 404 | T-AC (access control) | only registered ops served; no raw GraphQL accepted | unit | `pnpm test` | ❌ Wave 0 |
| REQ-PROXY-2 | success → valid `RoadmapJson` (schema-valid) | — | live response validated by the SAME `RoadmapJsonSchema` | unit (mocked `fetch`) | `pnpm test` | ❌ Wave 0 |
| REQ-PROXY-3 | email in upstream → `assertNoLeak` throws → 502, no PII | T-PII (info disclosure) | every live byte passes `buildSnapshot`→`assertNoLeak` | unit (regression guard) | `pnpm test` | ❌ Wave 0 |
| REQ-PROXY-4 | token never present in any response/error body | T-TOKEN (info disclosure) | token only in `Authorization` header; generic error bodies | unit | `pnpm test` | ❌ Wave 0 |
| REQ-SHARE | `sync:snapshot` unchanged after `query.ts` + `mapWorkspace` extraction | — | shared core has no `process.env` | unit (existing) | `pnpm test` (`transform.test.ts` stays green) | ✅ exists |
| REQ-GUARD | `assertNoLeak` runs under Node unchanged after `typeof process` guard | T-PII | Node behavior identical; Worker no longer ReferenceErrors | unit (existing) | `pnpm test` | ✅ exists |
| REQ-TYPE | handler typechecks, no `any`, strict | — | typed `Env` binding; no untyped surfaces | static | `pnpm typecheck` | needs `tsconfig.functions.json` |
| REQ-LOADER | live failure → snapshot + "live unavailable" notice; snapshot failure → error boundary | — | soft fallback never throws; genuine outage hits `RoadmapError` | manual / optional unit | `wrangler pages dev` smoke + `vite dev` (fallback is local default) | manual |

*Status legend: ✅ green · ❌ red · ⚠️ flaky · ⬜ pending*

---

## Wave 0 Requirements

- [ ] `functions/api/linear/[[path]].test.ts` — covers REQ-PROXY-1..4 (TDD red first; phase touches auth/API/token ⇒ test-first per CLAUDE.md)
- [ ] `scripts/linear/__fixtures__/gql-clean.ts` (+ `gql-with-email.ts`) — **GqlResponse**-shaped fixtures (existing `__fixtures__` are `RawWorkspace`-shaped, post-mapping)
- [ ] `vitest.config.ts` include glob: add `"functions/**/*.test.ts"` — **load-bearing**; handler tests are silently skipped otherwise
- [ ] `tsconfig.functions.json` + root `tsconfig.json` reference — so `pnpm typecheck` covers the handler with `@cloudflare/workers-types`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live mode end-to-end through Functions | REQ-LOADER | Pages Functions only run under `wrangler pages dev` / deploy; not under `vite dev` | `pnpm build && npx wrangler pages dev dist`, then load `/?source=live`, confirm 200 from `/api/linear/snapshot`; stop Functions and confirm fallback notice |
| Cloudflare Access email allow-list blocks unauth | "Done when" #2 | Console-only Zero-Trust config; out-of-band, user-performed | Per `docs/access-setup.md`: hit `/api/*` without an allowed identity → 403 |
| `LINEAR_API_KEY` Pages secret binding | "Done when" #1 | Dashboard/CI secret; never in code | Set binding; confirm live fetch works and the key appears in no bundle/log/response (grep `lin_api_`) |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (handler test, GQL fixtures, vitest glob, functions tsconfig)
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
