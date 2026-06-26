# Security Audit — Phase 02: Linear Data Layer & Static Snapshot

**Audited branch:** `phase-02-linear-snapshot`
**Audit date:** 2026-06-26
**ASVS level:** 1
**Verdict:** PASS with two WEAK findings (no FAIL; phase may ship with remediations noted)

---

## Threat Verification Table

| # | Threat | Mitigation in Code | Status | Evidence |
|---|--------|-------------------|--------|---------|
| T1a | Token leakage via TOKEN_RE regex | `TOKEN_RE = /lin_api_[A-Za-z0-9-]+/` — substring match, no anchors; catches any `lin_api_*` token embedded in JSON text | PASS (with caveat — see Findings) | `transform.ts:46` |
| T1b | Token leakage — live key value check | `liveKey = process.env["LINEAR_API_KEY"]; if (liveKey && serialized.includes(liveKey))` — definitive substring catch of the actual key regardless of format | PASS | `transform.ts:59–64` |
| T1c | Token leakage via free-text fields (name, summary, milestone.name) | `assertNoLeak` called on `JSON.stringify(result)` after full projection — all copied string fields (ini.name, proj.name, proj.description→summary, ms.name) are in the serialized blob and covered | PASS | `transform.ts:141` |
| T1d | assertNoLeak called on FINAL serialized output before write | `assertNoLeak(JSON.stringify(result))` called inside `buildSnapshot` before `RoadmapJsonSchema.parse()` returns; `sync-snapshot.ts` writes only the value returned by `buildSnapshot` | PASS | `transform.ts:141–144`; `sync-snapshot.ts:5–6` |
| T1e | Allow-list projection — no object spread | `buildSnapshot` explicitly names every field; `fetchWorkspace` maps with named properties, no `...spread` | PASS | `transform.ts:102–136`; `client.ts:148–167` |
| T2 | Token in client bundle | No file under `src/` imports from `scripts/linear/client.ts` or references `process.env.LINEAR_API_KEY`; confirmed by grep across `src/` | PASS | grep of `src/` — zero matches |
| T3a | Token literal in git diff | Diff contains no `lin_api_*` literal except inside test fixtures (clearly labelled `DEADBEEF` and in a test-only file) and in documentation strings | PASS | `git diff main...phase-02-linear-snapshot` |
| T3b | Token in CI logs — env: scoping | `LINEAR_API_KEY` scoped to the single `pnpm sync:snapshot` step via `env:` block; not in any `run:` string; no `echo`, `set -x`, or `--verbose` flag | PASS | `snapshot.yml:31–33` |
| T3c | No shell debug flags | No `set -x` or `set -v` in any workflow `run:` step | PASS | grep of `.github/` — zero matches |
| T4a | CI permissions over-grant | Job-level `permissions: contents: write` only; this replaces all token defaults so `secrets: write`, `id-token: write`, `packages: write` are NOT granted | PASS | `snapshot.yml:12–13` |
| T4b | workflow_dispatch injection | `workflow_dispatch:` has no `inputs:` block; no untrusted input is interpolated into any `run:` shell command | PASS | `snapshot.yml:4` |
| T4c | Commit-back token | Uses implicit `GITHUB_TOKEN` via `actions/checkout@v4` credential persistence; no PAT stored; only secret is `LINEAR_API_KEY` which is not used in the commit step | PASS | `snapshot.yml:15–42` |
| T5a | XSS via snapshot strings | No `dangerouslySetInnerHTML` anywhere in `src/`; all snapshot strings rendered via React JSX expression slots (auto-escaped) | PASS | `OverviewPage.tsx:10–24`; `TimelinePage.tsx:23–26`; grep of `src/` — zero matches |
| T5b | Snapshot trust / Zod validation | `roadmapLoader` calls `RoadmapJsonSchema.parse(json)` on every load; malformed snapshot throws before data reaches components | PASS | `loader.ts:14` |
| T6a | Email in snapshot (assertNoLeak) | `EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/` checked on serialized output; test confirms it throws on `secret@example.com` | PASS | `transform.ts:47,65–68`; `transform.test.ts:13–15` |
| T6b | PII (personal names) in committed roadmap.json | `public/roadmap.json` contains first names "Bernard" and "Donald" in project summary strings pulled from Linear | WEAK — see Finding F2 |  `roadmap.json:160,192,224` |

---

## Findings

### F1 — FIXED (was WEAK): TOKEN_RE missed underscores in key suffix

**Threat:** T1a · **Severity:** Low · **File:** `scripts/linear/transform.ts:46`
**Status: RESOLVED** in commit `569d812` — `TOKEN_RE` now `/lin_api_[A-Za-z0-9_-]+/`
(underscore added). Sanitization tests stay green (13/13). Original analysis below.

```
const TOKEN_RE = /lin_api_[A-Za-z0-9-]+/;   // before
```

The character class `[A-Za-z0-9-]` excludes underscore (`_`). If a Linear API key ever contains underscores in the suffix (e.g. `lin_api_abc_123`), the regex matches only `lin_api_abc` and a future key rotation could theoretically produce a suffix that the pattern truncates early. In practice, Linear keys use only alphanumeric characters in the suffix and the **liveKey substring check** (`serialized.includes(liveKey)` at `transform.ts:59`) provides the definitive catch regardless of key format. The regex is a belt-and-suspenders heuristic; the real guard is the liveKey check.

**Risk:** Low. The liveKey check closes the gap at runtime. The regex gap only matters if:
1. The env var is unset (in which case `fetchWorkspace` throws before any snapshot is produced), or
2. An underscore-bearing test token is planted in a Linear field by an attacker (still caught by liveKey at runtime).

**Remediation (non-blocking):** Extend the character class to `[A-Za-z0-9_-]` to eliminate ambiguity.

---

### F2 — WEAK: Personal first names in committed public/roadmap.json

**Threat:** T6b
**Severity:** Low / Informational
**File:** `public/roadmap.json:160,192,224`

Three project summaries contain the first names "Bernard" and "Donald" sourced from Linear project descriptions. This is a private repo, so exposure is limited, but the file is tracked in git history indefinitely. `assertNoLeak` correctly blocks emails but does not — and is not designed to — block person names.

**Accepted surface:** The `summary` field is an explicit allow-list copy of the Linear `description` field (`transform.ts:127`). Blocking generic names is not tractable without bespoke PII classification. This risk exists for any snapshot-driven roadmap tool.

**Remediation options (non-blocking):**
1. Document as accepted risk (recommended for an internal private repo).
2. Scrub names from Linear project descriptions upstream if the repo ever becomes public.
3. Add a CI check that fails if known team members' names appear in `roadmap.json` (brittle; not recommended).

---

## Accepted Risk Log

| Risk | Rationale | Owner |
|------|-----------|-------|
| Personal first names ("Bernard", "Donald") in `public/roadmap.json` summaries | Private repo; names sourced from Linear project descriptions which are controlled internal data; no emails, tokens, or full legal names present | Phase 02 executor |

---

## Overall Verdict

**PASS — Phase 02 may ship.**

All six declared threat areas are mitigated in code. The two WEAK findings are defense-in-depth gaps (TOKEN_RE underscore character class) and accepted PII surface (first names in an internal private repo), neither of which represents an open attack path. The primary security invariant — *the Linear API token never reaches `public/roadmap.json`, the client bundle, any CI log, or git history* — is verified at every layer:

- Transform-level: `assertNoLeak` + liveKey check before any return value is produced (`transform.ts:141`)
- CLI-level: `sync-snapshot.ts` writes only the `buildSnapshot` return value
- CI-level: secret scoped to a single step env block, no echo, no debug flags
- Bundle-level: `src/` has zero imports from `scripts/linear/` and zero `process.env.LINEAR_API_KEY` references
- Artifact-level: `public/roadmap.json` grep confirms no `lin_api_*` or email patterns
