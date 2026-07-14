# Phase 03 Design — Server-side Linear proxy + Cloudflare Access

**Date:** 2026-06-28
**Phase:** 03 (`.planning/phases/03/PLAN.md`)
**Status:** Approved (brainstorming gate)

## Goal

Add a **live data path** alongside the default snapshot: a Cloudflare Pages
Function proxies Linear's GraphQL API using a server-side `LINEAR_API_KEY`, so
the token never reaches the client bundle. A client toggle switches between the
committed snapshot and live data, falling back to the snapshot on any failure.
Cloudflare Access gates the Pages project and `/api/*` to an email allow-list.

**Done when:**
- Live mode fetches through `/api/linear` with no token in the bundle.
- Unauthenticated requests are blocked by Access.

## Key decision: named allow-list, not open passthrough

Brainstorming surfaced a contradiction. An *open* GraphQL passthrough (any read
query) was initially requested, but it would:

1. Contradict PLAN task #1 ("allow-list operations").
2. Reintroduce the PII leak Phase 02 closed — raw Linear responses bypass
   `buildSnapshot`/`assertNoLeak`, streaming emails/first names to any
   Access-authed user.
3. Expose the entire Linear workspace (all issues, comments, user emails)
   through the server token, far beyond the roadmap this app renders.

**Resolved:** the proxy permits **named operations only**. Each named operation
maps to a server-held query string **and** a server-side transform that runs
`assertNoLeak` before returning. The client can name a registered operation; it
can never send raw GraphQL. This satisfies PLAN task #1 and preserves the
leak-proofing.

This phase ships exactly one operation — `snapshot` (a live refresh of the
workspace snapshot). Future operations are added as one registry entry each, as
real features need them. No speculative client GraphQL layer is built.

## Architecture

### A. Proxy Function — `functions/api/linear/[[path]].ts`

A single Pages Function. Request flow:

```
GET /api/linear/snapshot
  → look up "snapshot" in the OPERATIONS registry   (404 if unknown op)
  → fetch Linear with env.LINEAR_API_KEY            (binding; never logged/echoed)
  → run the operation's transform (buildSnapshot)   → assertNoLeak
  → return RoadmapJson                              (identical shape to /roadmap.json)
```

- **Allow-list = server-side registry.** `OPERATIONS = { snapshot: { query:
  WORKSPACE_QUERY, transform: buildSnapshot } }`. The path segment selects the
  operation. Unknown op → 404.
- **Errors.** Map failures to clean status codes with generic bodies:
  - `404` — unknown operation.
  - `500` — missing/misconfigured `LINEAR_API_KEY` binding.
  - `502` — Linear upstream error (non-OK response or GraphQL `errors`).
  - The token never appears in any response body, error message, or log line.
- **Rate-limit (minimal).** Cloudflare Access is the primary control (a small
  email allow-list). Defense-in-depth: a best-effort per-isolate fixed-window
  counter in the Function, plus an *optional* Cloudflare dashboard rate-limit
  rule documented in `docs/access-setup.md`. No KV / Durable Object — overkill
  for an internal viewer.
- **Cache.** `Cache-Control: private, max-age=60` so toggling does not hammer
  Linear. Short enough that "live" stays meaningfully fresh.

### B. Shared code extraction (surgical)

`WORKSPACE_QUERY` currently lives in `scripts/linear/client.ts`;
`buildSnapshot`/`assertNoLeak` in `scripts/linear/transform.ts`. Both the Node
sync script and the Worker Function need them.

- Extract the query string into `scripts/linear/query.ts`. `client.ts` and the
  Function both import it.
- The Function imports `buildSnapshot`/`assertNoLeak` from
  `scripts/linear/transform.ts` unchanged.
- One guard: `assertNoLeak` reads `process.env["LINEAR_API_KEY"]` for the
  live-key check. Make that access `typeof process` safe so it runs in the
  Worker runtime (where `process` is absent). No behavior change to the
  existing Node path.

### C. Client live mode + toggle

- The data-router loader reads mode from a **`?source=live` search param**
  (default = snapshot, per "snapshot is the default data path").
- `live` → fetch `/api/linear/snapshot`, validate with the **same
  `RoadmapJsonSchema`**. **Any failure** (Function absent, Access block, Linear
  error, schema mismatch) → fall back to `/roadmap.json` and surface a small
  "live unavailable — showing snapshot" notice.
- A header **toggle** (Snapshot / Live) flips the search param and triggers
  revalidation.
- Because plain `vite dev` has no Functions, the fallback path *is* the local
  default-dev path; live mode is exercised via `wrangler pages dev` or a
  preview deploy.
- Chosen: search-param-driven (shareable, React-Router-native) over
  localStorage.

### D. Cloudflare Access + docs

`docs/access-setup.md` documents the console-only setup (the user performs
these; code/tests do not block on them):

- Set the `LINEAR_API_KEY` Pages **secret binding**.
- Create the Cloudflare **Access** policy: email allow-list over the Pages
  project **and** `/api/*`.
- (Optional) the Cloudflare dashboard rate-limit rule for `/api/*`.

`wrangler.toml` gains whatever non-secret config is needed for Functions; the
secret itself is set in the dashboard/CI, never committed.

## Testing (TDD)

This phase touches auth / API / the token, so request and token handling is
test-first.

- Function handler unit tests with a mocked Linear `fetch`:
  - unknown op → `404`.
  - success → transformed `RoadmapJson` (matches `RoadmapJsonSchema`).
  - **regression guard:** a Linear response containing an email →
    `assertNoLeak` throws → request rejected, no PII in output.
  - token never present in any response/error.
- Reuse existing `scripts/linear/__fixtures__` and `transform.test.ts` patterns.

## Components & boundaries

| Unit | Purpose | Depends on |
|---|---|---|
| `scripts/linear/query.ts` | The `WorkspaceSnapshot` query string (shared) | — |
| `scripts/linear/transform.ts` | `buildSnapshot` + `assertNoLeak` (runtime-agnostic) | `src/lib/roadmap/schema.ts` |
| `functions/api/linear/[[path]].ts` | Proxy: op registry, token fetch, transform, errors, cache, rate-limit | `query.ts`, `transform.ts`, `env.LINEAR_API_KEY` |
| `src/lib/roadmap/loader.ts` | Source selection (snapshot vs live) + fallback | `schema.ts`, `/api/linear/snapshot`, `/roadmap.json` |
| header toggle component | Flip `?source` + revalidate, show fallback notice | loader, router |
| `docs/access-setup.md` | Console setup runbook | — |

## Out of scope (YAGNI)

- Any operation beyond `snapshot`.
- A general client GraphQL layer.
- KV/Durable-Object-backed rate limiting.
- Mutations through the proxy (read-only by construction — only named read ops
  are registered).

## Security posture

- Token lives only in the Pages secret binding / CI; never in the bundle,
  `roadmap.json`, responses, or logs.
- Every live response passes through `assertNoLeak` (token pattern + live-key +
  email detection) before reaching the client.
- Access restricts reachability to an email allow-list at the edge.
- `/cso` is a required gate for this phase → `SECURITY.md`.
