# Phase 03: Server-side Linear proxy + Cloudflare Access - Research

**Researched:** 2026-06-28
**Domain:** Cloudflare Pages Functions (catch-all route), runtime-agnostic TS code sharing (Node script ↔ Worker), React Router 7 data-router source selection + revalidation
**Confidence:** HIGH

## Summary

This phase adds a single Cloudflare Pages Function (`functions/api/linear/[[path]].ts`) that proxies one named operation — `snapshot` — to Linear using a server-side `LINEAR_API_KEY` binding, runs the existing `buildSnapshot` + `assertNoLeak` transform, and returns the same `RoadmapJson` shape the static snapshot uses. The client gains a `?source=live` data path with snapshot fallback, and a header toggle. Cloudflare Access (console-only) gates reachability to an email allow-list.

The codebase is already well-factored for this: `buildSnapshot`/`assertNoLeak` are pure (modulo one `process.env` read in `assertNoLeak`), `RoadmapJsonSchema` is the single shape contract used by both the Node loader and (now) the live path, and `transform.ts` already imports the schema via a relative path that works in both runners. The only genuinely new surface is the Function handler, a one-line `process` guard in `assertNoLeak`, a small surgical refactor of `client.ts` to share the GraphQL mapping, and the loader/toggle changes. Everything else is config (`@cloudflare/workers-types` devDep, vitest include glob, a `functions/` tsconfig) and a docs runbook.

**Primary recommendation:** Extract `WORKSPACE_QUERY` to `scripts/linear/query.ts` and a pure `mapWorkspace(gql): RawWorkspace` out of `fetchWorkspace`; have the Worker import `query.ts` + `mapWorkspace` + `buildSnapshot` and do its own `fetch` with `env.LINEAR_API_KEY` (no `process.env` in shared core). Type the handler with `@cloudflare/workers-types` (devDep) + a 1-field inline `interface Env`. Drive live/snapshot from `?source=live`; React Router 7 revalidates loaders on search-param change by default, so the toggle is just `useSearchParams`. Ship exactly one OPERATIONS entry. Rate-limit = a tiny per-isolate fixed-window counter; document the optional dashboard rule only.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Holding the Linear token | API / Backend (Pages Function binding) | — | Spec + CLAUDE.md: token only in secret binding / CI. Never client, never `roadmap.json`. |
| Linear GraphQL fetch | API / Backend (Function) | Node script (CI snapshot) | Both call Linear; both must reuse ONE query + ONE mapping. |
| PII / token leak gate (`assertNoLeak`) | API / Backend (Function) + Node script | — | Runtime-agnostic transform; must run in Worker isolate before any byte reaches client. |
| Operation allow-list (registry) | API / Backend (Function) | — | Named ops only; the client can never send raw GraphQL. |
| Rate limiting (best-effort) | API / Backend (Function) | CDN / edge (optional dashboard rule, docs only) | Defense-in-depth; Access is the primary control. |
| Source selection (snapshot vs live) | Browser / Client (RR7 loader) | — | Reads `?source` from request URL; chooses endpoint; falls back. |
| Auth / reachability gate | CDN / edge (Cloudflare Access) | — | Console-only email allow-list over project + `/api/*`. Code does not implement auth. |
| Static snapshot fallback | CDN / Static (`/roadmap.json`) | Browser (loader) | Default data path; the local-dev default because `vite dev` has no Functions. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@cloudflare/workers-types` | `^4.20260628.1` | Provides `PagesFunction`, `EventContext`, `Request`/`Response` Worker types for `functions/` | [VERIFIED: npm registry] Official Cloudflare package (maintainers @cloudflare.com), 7.0M weekly downloads, no postinstall. The lightest way to type the handler without `any`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `wrangler` (already invocable via `npx`/binding; not a dep) | `4.105.0` | `wrangler pages dev` to exercise Functions locally; optional `wrangler types` codegen | Local live-mode testing only. Not required as a project dep for this phase. [VERIFIED: npm registry] |
| `vitest` | `^4.1.9` (installed) | Unit-test the Function handler with a mocked `fetch` | Already the test runner; reuse it. |
| `zod` / `RoadmapJsonSchema` | installed | Validate the live response with the SAME schema | Already present; do not add a second validator. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@cloudflare/workers-types` devDep | `wrangler types` → generated `worker-configuration.d.ts` + `compilerOptions.types` | [CITED: developers.cloudflare.com/pages/functions/typescript] Cloudflare's current "blessed" path is generated runtime types. But it adds a codegen step and a generated file to manage. For a one-handler phase, the static devDep is simpler and equally type-safe. **Recommend the devDep.** Note both ultimately surface the same `PagesFunction` symbol. |
| `@cloudflare/workers-types` devDep | Fully inline minimal types (hand-rolled `PagesFunction`/`EventContext`) | Violates Simplicity-but-also-correctness: you'd hand-maintain Worker type stubs. Use the official package; keep only `interface Env { LINEAR_API_KEY: string }` inline. |
| `@cloudflare/vitest-pool-workers` | Plain vitest + mocked `fetch` | The pool runs tests inside workerd (high fidelity) but is heavyweight and changes the vitest config/environment. The handler is a plain async function over a constructed `EventContext`; a Node-env unit test with `vi.fn()`/`vi.stubGlobal("fetch", …)` covers all four spec tests. **Recommend plain vitest** (matches existing `transform.test.ts` patterns). |

**Installation:**
```bash
pnpm add -D @cloudflare/workers-types
```

**Version verification (performed this session):**
- `@cloudflare/workers-types` latest = `4.20260628.1` (npm `latest` dist-tag) [VERIFIED: npm registry]
- `wrangler` latest = `4.105.0` [VERIFIED: npm registry]

## Package Legitimacy Audit

> slopcheck was **not available** in this environment (`command -v slopcheck` → not found; pip install not attempted to avoid environment mutation). Per protocol, the single new package was verified manually via the npm registry (official maintainers + download volume + no postinstall). The planner should still gate the install behind awareness that automated slopcheck did not run, though the manual signals are strong.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@cloudflare/workers-types` | npm | mature (`@cloudflare` scope, daily-versioned releases) | 7.0M/week | cloudflare/workerd (official) | unavailable — manual: OK | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Manual verification detail: maintainer list is entirely `@cloudflare.com` / Cloudflare-staff accounts; `scripts.postinstall` empty; `last-week` downloads = 7,034,893. This is the canonical first-party Cloudflare types package, not a typosquat. The scoped name `@cloudflare/*` is owned by the Cloudflare org and cannot be squatted. Treat as `[VERIFIED: npm registry]`.

## Architecture Patterns

### System Architecture Diagram

```
                            ┌───────────────────────────── Cloudflare edge ─────────────────────────────┐
                            │                                                                            │
 Browser                    │  Cloudflare Access (email allow-list)  ──blocks unauth──> 403               │
   │                        │        │ (gates project + /api/*)                                          │
   │  GET / (?source=…)     │        ▼                                                                    │
   ├───────────────────────►│   Pages static assets ──> index.html + bundle + /roadmap.json (snapshot)   │
   │                        │                                                                            │
   │  loader decides:       │                                                                            │
   │   source=snapshot ─────┼──► fetch /roadmap.json ──────────────► RoadmapJsonSchema.parse ─► render    │
   │                        │                                                                            │
   │   source=live ─────────┼──► fetch /api/linear/snapshot                                              │
   │                        │        │                                                                    │
   │                        │        ▼  functions/api/linear/[[path]].ts                                  │
   │                        │   params.path = ["snapshot"]                                                │
   │                        │   ├─ unknown op ──────────────────────────────► 404                         │
   │                        │   ├─ rate-limit exceeded (per-isolate window) ─► 429                         │
   │                        │   ├─ env.LINEAR_API_KEY missing ──────────────► 500                         │
   │                        │   ├─ fetch Linear (Authorization: <key>) ─────► 502 on !ok / GraphQL errors │
   │                        │   ├─ mapWorkspace(gql) ─► buildSnapshot ─► assertNoLeak (throws ► 502)       │
   │                        │   └─ 200 RoadmapJson (Cache-Control: private, max-age=60)                    │
   │                        │                                                                            │
   │  ANY live failure ◄────┼── loader catches ─► fetch /roadmap.json + "live unavailable" notice         │
   └────────────────────────┘                                                                            │
                            └────────────────────────────────────────────────────────────────────────────┘

 Out-of-band (CI, unchanged): GitHub Action ─► tsx sync-snapshot.ts ─► fetchWorkspace() [process.env] ─► buildSnapshot ─► public/roadmap.json
```

The Node CI path and the Worker path share `query.ts` (WORKSPACE_QUERY), `mapWorkspace`, `buildSnapshot`, and `assertNoLeak`. The token enters at exactly two points (CI env var; Function binding) and is consumed only by a `fetch` Authorization header — never serialized, logged, or returned.

### Recommended Project Structure
```
functions/
└── api/
    └── linear/
        ├── [[path]].ts            # the proxy handler (onRequestGet)
        └── handler.test.ts        # vitest unit tests (mocked fetch + constructed EventContext)
scripts/linear/
├── query.ts                       # NEW: WORKSPACE_QUERY (extracted from client.ts)
├── client.ts                      # MODIFIED: imports query.ts; mapWorkspace extracted+exported
├── transform.ts                   # MODIFIED: one typeof-process guard in assertNoLeak
└── __fixtures__/                  # reuse raw-clean.ts / raw-malicious.ts
src/lib/roadmap/
└── loader.ts                      # MODIFIED: reads ?source=live, fetches /api/linear/snapshot, falls back
src/components/
└── AppHeader.tsx                  # MODIFIED: enable the (currently disabled) Connect/toggle slot
docs/
└── access-setup.md                # NEW: console runbook (binding, Access policy, optional rate rule)
```

### Pattern 1: Catch-all Pages Function handler with typed Env
**What:** Single `onRequestGet` over `[[path]]`; `context.params.path` is an **array** of segments.
**When to use:** This handler.
**Example:**
```typescript
// Source: developers.cloudflare.com/pages/functions/api-reference & /routing
//   - PagesFunction<Env> handler shape; onRequestGet runs only for GET
//   - For [[path]].ts, params.path is an ARRAY, e.g. /api/linear/snapshot -> ["snapshot"]
interface Env {
  LINEAR_API_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const segments = context.params.path;            // string | string[]; for [[path]] -> string[]
  const op = Array.isArray(segments) ? segments[0] : segments;
  // ... registry lookup, fetch with context.env.LINEAR_API_KEY, transform, respond
};
```
> CRITICAL: For the catch-all `[[path]].ts`, `context.params.path` is `["snapshot"]` (array), NOT `"snapshot"`. A single-bracket `[path].ts` would give a string. [VERIFIED: developers.cloudflare.com/pages/functions/routing] Handle both shapes defensively (`Array.isArray`), but the array branch is the live one.

### Pattern 2: Surgical shared-code extraction (client.ts refactor)
**What:** Pull the query string and the GQL→RawWorkspace mapping out of `fetchWorkspace` so both runtimes reuse one copy, with zero `process.env` in the shared core.
**When to use:** Required by the spec ("extract `WORKSPACE_QUERY` into `query.ts`").
**Exact refactor of `scripts/linear/client.ts`:**
1. Create `scripts/linear/query.ts`:
   ```typescript
   export const WORKSPACE_QUERY = `query WorkspaceSnapshot { … }`;  // verbatim move of lines 7–49
   ```
2. In `client.ts`: delete the local `const WORKSPACE_QUERY`; `import { WORKSPACE_QUERY } from "./query.ts"`.
3. Keep the `Gql*` interfaces in `client.ts` (or move to `query.ts` if the Worker needs the response type — recommend keeping them with the mapper). Extract a **pure exported** function:
   ```typescript
   export function mapWorkspace(json: GqlResponse): RawWorkspace {
     // lines 145–167 verbatim — the existing { initiatives.nodes.map(...), projects.nodes.map(...) }
   }
   ```
4. `fetchWorkspace()` keeps its current Node behavior unchanged — it still reads `process.env["LINEAR_API_KEY"]`, still does the same `fetch`, the same `!response.ok` and `json.errors` throws, and now ends with `return mapWorkspace(json)`. No observable change to `sync:snapshot`.
5. The **Worker** does NOT call `fetchWorkspace` (it can't — `process.env`). Instead it imports `WORKSPACE_QUERY` + `mapWorkspace` + the `GqlResponse` type and runs its own `fetch` against `LINEAR_API_URL` with `context.env.LINEAR_API_KEY`. This is the spec's "one mapping, no duplication" with no Node coupling.

> Note: the spec floated an optional `fetchWorkspaceWith(apiKey, fetchImpl?)`. **YAGNI** — there are exactly two callers (Node, Worker) and the Worker's fetch+error mapping has Worker-specific status-code semantics (502 vs throw). A shared `mapWorkspace` is the right shared unit; a shared fetch wrapper would couple error-handling strategies that legitimately differ. Recommend NOT building `fetchWorkspaceWith`. (Flag for the planner: this is a place the spec could be over-built.)

### Pattern 3: `assertNoLeak` runtime guard
**What:** One-line guard so the live-key check is skipped where `process` is absent (Worker isolate) without changing Node behavior.
**Example:**
```typescript
// transform.ts — replace line 60
const liveKey =
  typeof process !== "undefined" ? process.env["LINEAR_API_KEY"] : undefined;
if (liveKey && serialized.includes(liveKey)) { … }
```
- In Node, `typeof process !== "undefined"` is true → identical behavior. **No change to `transform.test.ts` required**; existing tests assert on the TOKEN_RE and EMAIL_RE branches, not the liveKey branch, and they run under Node. (Verified: the only liveKey-dependent assertion would need the env var set, which the tests don't do.)
- In the Worker, `process` is undefined → `liveKey` is `undefined` → that branch is skipped; the TOKEN_RE and EMAIL_RE branches (the actual PII guard for live responses) still run. The regression-guard test (email in response → throw) relies on EMAIL_RE, which is unaffected.

### Pattern 4: Loader source selection + fallback
**What:** Read `?source` from the loader's `request`, pick endpoint, validate with the SAME schema, fall back on ANY failure.
**Example:**
```typescript
// Source: reactrouter.com — LoaderFunctionArgs has { request: Request, params }
//   read search params via new URL(request.url).searchParams
export async function roadmapLoader({ request }: LoaderFunctionArgs) {
  const wantLive = new URL(request.url).searchParams.get("source") === "live";
  if (wantLive) {
    try {
      const res = await fetch("/api/linear/snapshot");
      if (!res.ok) throw new Error("live not ok");
      const parsed = RoadmapJsonSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("live malformed");
      return { data: parsed.data, live: true };
    } catch {
      // fall through to snapshot
    }
  }
  // snapshot path (existing logic) + a flag for the notice
  const res = await fetch("/roadmap.json");
  if (!res.ok) throw new Response("Failed to load roadmap snapshot", { status: res.status });
  const parsed = RoadmapJsonSchema.safeParse(await res.json());
  if (!parsed.success) throw new Response("Roadmap snapshot is malformed", { status: 500 });
  return { data: parsed.data, live: false, liveUnavailable: wantLive };
}
```
> **Return-shape change:** today the loader returns a bare `RoadmapJson`; `OverviewPage`/`TimelinePage` read it via `useRouteLoaderData("root") as RoadmapJson`. To surface the "live unavailable" notice WITHOUT breaking the error boundary, wrap the payload: return `{ data, live, liveUnavailable }`. This is a **breaking change to two consumers** — `OverviewPage.tsx:5` and `TimelinePage.tsx` must read `data` off the wrapper. Keep the error boundary intact: still `throw new Response(...)` only when even the snapshot fails (so genuine outages hit `RoadmapError`); live failure is a soft fallback, not a thrown error. The planner must include the consumer updates as in-scope surgical edits.

### Pattern 5: Header toggle via search params (no manual revalidation)
**What:** Flip `?source` with `useSearchParams`; the data router revalidates the loader automatically.
**Why it's minimal:** [VERIFIED: reactrouter.com docs + RR7 behavior] In React Router 7 data mode, a navigation that changes search params triggers loader revalidation **by default** (RR reloads all matched loaders because it can't know which depend on the query). `useNavigation().state === "loading"` during that revalidation. So the toggle is just:
```typescript
const [params, setParams] = useSearchParams();
const live = params.get("source") === "live";
// onClick: setParams(prev => { prev.set("source", live ? "snapshot" : "live"); return prev; });
```
No `useRevalidator()`, no `revalidate()` call needed. Mounts in `AppHeader.tsx` — the right-side slot already exists (the disabled "Connect" button at lines 36–44), so this is enabling/replacing that placeholder, not adding new layout. Use `useNavigation().state` to show a pending state on the toggle if desired (optional polish, not required by spec).

### Anti-Patterns to Avoid
- **Open GraphQL passthrough:** Explicitly rejected by the spec — reintroduces the Phase 02 PII leak and over-exposes the workspace. Registry of named ops only.
- **Returning raw Linear JSON:** Every live byte must pass `buildSnapshot`→`assertNoLeak`. Never `return new Response(await linearRes.text())`.
- **`process.env` in shared core:** The Worker has no `process`. Keep env access at the edges (Node `fetchWorkspace`, Worker `context.env`).
- **Logging/echoing the key:** No `console.log(env.LINEAR_API_KEY)`, no including upstream error bodies that might contain the Authorization header. 502 bodies must be generic.
- **A speculative OPERATIONS abstraction:** One entry. A `Record<string, {query, transform}>` is fine; a plugin loader / dynamic registration system is not.
- **Building `fetchWorkspaceWith` or a client GraphQL layer:** YAGNI per spec "Out of scope".

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Live-response shape validation | A second/looser validator for the live path | `RoadmapJsonSchema.safeParse` (existing) | Spec mandates the SAME schema; one source of truth. |
| PII/token redaction in the Function | New leak checks in the handler | `assertNoLeak` (existing, now process-guarded) | Already audited in Phase 02 SECURITY.md; reuse verbatim. |
| Worker request/response/env types | Hand-rolled `PagesFunction`/`EventContext` stubs | `@cloudflare/workers-types` | Official, maintained, no `any`. |
| GQL→RawWorkspace mapping | A copy of the mapping in the handler | Extracted `mapWorkspace` | Duplication is the exact leak vector the spec warns about. |
| Loader URL parsing | Custom query-string parser | `new URL(request.url).searchParams` | Standard Web API; RR7 passes a real `Request`. |
| Toggle revalidation | `useRevalidator()` / manual refetch | `useSearchParams` (RR7 revalidates on param change) | Less code; RR7 default behavior already does it. |

**Key insight:** This phase's correctness comes almost entirely from *reusing* the Phase 02 transform/schema/leak-gate across a new runtime, not from writing new logic. The shared core must stay runtime-agnostic (no `process`), and the Function must never bypass the gate.

## Runtime State Inventory

> This is an additive feature phase, not a rename/refactor. Runtime-state categories assessed for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore; data is `public/roadmap.json` (static) + live Linear (read-only). | None. |
| Live service config | Cloudflare Access policy + `LINEAR_API_KEY` Pages secret binding live in the Cloudflare dashboard, NOT in git. The optional rate-limit rule is also dashboard-only. | Console steps documented in `docs/access-setup.md`; user performs them. Code/tests do not block on them. |
| OS-registered state | None. | None. |
| Secrets/env vars | `LINEAR_API_KEY` exists today as a GitHub Actions secret (CI snapshot) and an env var for local `sync:snapshot`. Phase 03 adds the SAME name as a **Pages secret binding**. Name unchanged; the Worker reads it via `context.env.LINEAR_API_KEY` (binding), not `process.env`. | Set the Pages binding in dashboard/CI. No code rename. |
| Build artifacts | `functions/` already exists with a `.gitkeep`; `.wrangler/` already gitignored. No stale artifacts. | None. |

## Common Pitfalls

### Pitfall 1: Treating `params.path` as a string for a catch-all route
**What goes wrong:** `op === "snapshot"` always false; every request 404s.
**Why it happens:** `[path].ts` (single bracket) gives a string; `[[path]].ts` (double) gives an **array**. The spec's filename is double-bracket.
**How to avoid:** `const op = Array.isArray(params.path) ? params.path[0] : params.path;` Test the live array shape explicitly.
**Warning signs:** Unknown-op 404 test passes for the wrong reason; success test fails.

### Pitfall 2: `assertNoLeak` crashing in the Worker (ReferenceError: process)
**What goes wrong:** Without the `typeof process` guard, the live path throws `ReferenceError` before the real leak checks run.
**How to avoid:** Apply Pattern 3 exactly. The Node path is unchanged.
**Warning signs:** Function returns 500 with a process-related stack in `wrangler pages dev`.

### Pitfall 3: Leaking the upstream error body (which can echo auth)
**What goes wrong:** On a Linear non-OK response, returning `await linearRes.text()` to the client can surface request metadata.
**How to avoid:** Map to a generic `502` body (`"upstream error"`); never include the upstream body or the Authorization header. (Matches spec error table.)
**Warning signs:** The "token never in any response/error" test fails.

### Pitfall 4: Loader return-shape change silently breaks pages
**What goes wrong:** Wrapping the payload as `{ data, live, … }` but leaving `OverviewPage`/`TimelinePage` reading the old bare shape → `data.projects` is undefined at runtime (TS `as` cast hides it).
**How to avoid:** Update both consumers and the `useRouteLoaderData` cast in the same change. Drop the unsafe `as RoadmapJson` in favor of the wrapper type.
**Warning signs:** Blank page / `Cannot read properties of undefined (reading 'length')` after the loader change.

### Pitfall 5: Expecting live mode to work under plain `vite dev`
**What goes wrong:** `/api/linear/snapshot` 404s under `vite dev` (no Functions runtime) — looks like a bug.
**Why it happens:** Functions only run under `wrangler pages dev` or a deploy. Per spec this is intended: the fallback path IS the local default.
**How to avoid:** Document that live testing uses `wrangler pages dev`; the loader's fallback makes `vite dev` render the snapshot cleanly. Add an npm script (e.g. `pnpm preview:functions` → `wrangler pages dev dist` after build), or document the raw command.
**Warning signs:** None if fallback works; the "live unavailable" notice appearing under `vite dev` is correct behavior.

### Pitfall 6: ESLint config doesn't cover `functions/` cleanly
**What goes wrong:** `eslint.config.js` sets `languageOptions.globals = globals.browser` and `ecmaVersion: 2020` for all `**/*.{ts,tsx}`. Worker globals (`Response`, `URL`, `fetch`) overlap with browser globals so most code lints fine, but `PagesFunction`/`EventContext` are types (erased), and there's no Worker globals set.
**How to avoid:** Likely no change needed (types are erased; runtime globals used are in the browser set). If lint complains, add a small flat-config block scoping `functions/**` with appropriate globals. Flag as a low-risk verify step, not a guaranteed task.
**Warning signs:** `pnpm lint` errors on `functions/` files.

## Code Examples

### Reading the binding and selecting an operation (handler core)
```typescript
// Source: developers.cloudflare.com/pages/functions/api-reference (context.env, onRequestGet)
//         + scripts/linear/query.ts, map.ts (mapWorkspace), transform.ts (existing, reused)
// NOTE (post-review): mapWorkspace + GqlResponse import from the process-free map.ts,
// NOT client.ts — the Worker must never pull in client.ts's process.env reference.
import { WORKSPACE_QUERY } from "../../../scripts/linear/query.ts";
import { mapWorkspace, type GqlResponse } from "../../../scripts/linear/map.ts";
import { buildSnapshot } from "../../../scripts/linear/transform.ts";

interface Env { LINEAR_API_KEY: string }

const OPERATIONS = {
  snapshot: { query: WORKSPACE_QUERY, transform: buildSnapshot },
} as const;

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const op = Array.isArray(params.path) ? params.path[0] : params.path;
  const entry = op && op in OPERATIONS ? OPERATIONS[op as keyof typeof OPERATIONS] : undefined;
  if (!entry) return new Response("unknown operation", { status: 404 });
  if (!env.LINEAR_API_KEY) return new Response("misconfigured", { status: 500 });

  const upstream = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: env.LINEAR_API_KEY },
    body: JSON.stringify({ query: entry.query }),
  });
  if (!upstream.ok) return new Response("upstream error", { status: 502 });

  // NOTE (post-review): upstream.json() is INSIDE the try so malformed JSON (SyntaxError)
  // ⇒ generic 502, same as a transform/assertNoLeak failure. Do not hoist json/errors out.
  try {
    const json = (await upstream.json()) as GqlResponse;
    if (json.errors?.length) return new Response("upstream error", { status: 502 });
    const result = entry.transform(mapWorkspace(json)); // buildSnapshot → assertNoLeak inside
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return new Response("upstream error", { status: 502 }); // json/assertNoLeak/parse failure ⇒ no PII out
  }
};
```
> The import path crosses from `functions/` into `scripts/linear/`. Confirm wrangler's Pages build bundles cross-directory relative TS imports (it uses esbuild and does, but the planner should verify in `wrangler pages dev`). If problematic, the alternative is moving the shared core under a neutral `src/lib/linear/` — but that's a larger move; **try the relative import first.**

### Minimal per-isolate fixed-window rate limit
```typescript
// Best-effort, in-memory, per-isolate. NOT global — acceptable per spec (Access is primary control).
let windowStart = 0;
let count = 0;
const LIMIT = 30, WINDOW_MS = 60_000;
function rateLimited(now: number): boolean {
  if (now - windowStart > WINDOW_MS) { windowStart = now; count = 0; }
  count += 1;
  return count > LIMIT;
}
// in handler, before upstream fetch:
if (rateLimited(Date.now())) return new Response("rate limited", { status: 429 });
```
> Module-scope state persists across requests within one isolate and resets on cold start / per isolate — exactly the "best-effort, no KV/DO" the spec asks for. Keep it this small.

### Vitest unit test of the handler (mocked fetch + constructed context)
```typescript
// Source: existing transform.test.ts patterns + vitest stubGlobal
import { describe, it, expect, vi, afterEach } from "vitest";
import { onRequestGet } from "./[[path]].ts";
import { rawClean } from "../../../scripts/linear/__fixtures__/raw-clean.ts";

function ctx(path: string[], env = { LINEAR_API_KEY: "lin_api_TESTKEY000" }) {
  return { params: { path }, env } as unknown as Parameters<typeof onRequestGet>[0];
}
afterEach(() => vi.unstubAllGlobals());

it("unknown op → 404", async () => {
  const res = await onRequestGet(ctx(["nope"]));
  expect(res.status).toBe(404);
});

it("success → valid RoadmapJson", async () => {
  // mock the Linear GraphQL response in GqlResponse shape (data.initiatives.nodes / data.projects.nodes)
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({ data: gqlFromRawClean }), { status: 200 })));
  const res = await onRequestGet(ctx(["snapshot"]));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(RoadmapJsonSchema.safeParse(body).success).toBe(true);
});

it("email in upstream → assertNoLeak throws → 502, no PII", async () => {
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({ data: gqlWithEmail }), { status: 200 })));
  const res = await onRequestGet(ctx(["snapshot"]));
  expect(res.status).toBe(502);
  expect(await res.text()).not.toContain("@");
});

it("token never present in any response/error", async () => {
  // assert across 200 and error paths that the body never contains env.LINEAR_API_KEY or /lin_api_/
});
```
> The success/email tests need a fixture in **GqlResponse** shape (the raw Linear `data.initiatives.nodes`/`data.projects.nodes` envelope), not the already-mapped `RawWorkspace`. Either add a tiny `gql-clean.ts`/`gql-with-email.ts` fixture under `__fixtures__/`, or wrap `rawClean` into the GQL envelope in the test. Reuse `raw-malicious.ts`'s email pattern (`secret@example.com`) for the leak test. The handler test file lives **alongside the function** (`functions/api/linear/handler.test.ts` or `[[path]].test.ts`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@cloudflare/workers-types` as the only typing path | `wrangler types` codegen (`worker-configuration.d.ts`) is Cloudflare's promoted default | ~2024 | Both still work; this phase chooses the devDep for simplicity. No deprecation of the package. |
| RR6 `useLoaderData` bare returns | RR7 same loader API; search-param navigations revalidate by default; opt-out via `shouldRevalidate`/`unstable_defaultShouldRevalidate` | RR7 | The toggle needs no manual revalidation call. |

**Deprecated/outdated:** none blocking this phase. `@cloudflare/workers-types` is current (`4.20260628.1`), not deprecated.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | wrangler's Pages build (esbuild) bundles relative TS imports from `functions/` into `scripts/linear/` without extra config | Code Examples note | If wrong: build fails; fallback = move shared core to `src/lib/linear/`. Verify early with `wrangler pages dev`. |
| A2 | `transform.test.ts` needs no change after the `typeof process` guard (no existing test sets `LINEAR_API_KEY` to exercise the liveKey branch) | Pattern 3 | Low — verified by reading the test file; the liveKey branch is untested today. If a test does set the env, that test still passes (guard is a no-op in Node). |
| A3 | ESLint flat config tolerates `functions/` without a new globals block (Worker runtime globals are a subset of browser globals used here) | Pitfall 6 | Low — at worst add a small scoped config block; types are erased so no `no-undef` on `PagesFunction`. |
| A4 | The optional Cloudflare dashboard rate-limit rule is docs-only and not required for "Done when" | Spec §A / Out of scope | None — spec marks it optional. |

**Note:** No package names in this research were sourced from training data alone for the *implementation* — `@cloudflare/workers-types` and `wrangler` were verified against the live npm registry this session, and the API shapes were verified against official Cloudflare/React Router docs via WebFetch. slopcheck automated verification was unavailable; manual registry signals substitute.

## Open Questions

1. **Cross-directory import from `functions/` into `scripts/linear/` under the Pages build.**
   - What we know: esbuild (wrangler's bundler) resolves relative TS imports; `allowImportingTsExtensions` is on in the project's tsconfigs.
   - What's unclear: whether the Pages Functions build picks up `.ts` extensions in import specifiers the same way tsx/vitest do, and whether a `functions/tsconfig.json` is needed for type resolution.
   - Recommendation: First task should scaffold a trivial `[[path]].ts` that imports `WORKSPACE_QUERY` and run `wrangler pages dev` to confirm bundling before building the full handler. If it fails, relocate shared core to `src/lib/linear/` (single move, update 2–3 importers).

2. **Whether to add a `functions/tsconfig.json` with `types: ["@cloudflare/workers-types"]` vs. global include.**
   - What we know: Cloudflare docs show a `/functions`-scoped tsconfig adding the types. The root `tsconfig.json` references app/node/scripts projects but not `functions/`.
   - Recommendation: Add `tsconfig.functions.json` (mirror `tsconfig.scripts.json`, swap `types: ["node"]` → `types: ["@cloudflare/workers-types"]`, include `functions/**`) and reference it from root `tsconfig.json` so `pnpm typecheck` covers the handler. Low risk; keeps the "no any" + strict guarantee over the new code.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/pnpm + vitest | handler unit tests | ✓ | vitest ^4.1.9 installed | — |
| `@cloudflare/workers-types` | typing the handler | ✗ (not installed) | latest `4.20260628.1` on npm | install as devDep (verified) |
| `wrangler` | local live-mode (`wrangler pages dev`) | not a project dep | `4.105.0` on npm | `npx wrangler pages dev dist` (no install needed) or deploy preview |
| Cloudflare Access / dashboard | runtime gating, secret binding | ✗ (console, out-of-band) | — | user performs per `docs/access-setup.md`; code/tests don't block |
| slopcheck | package-legitimacy automation | ✗ | — | manual npm registry verification (done this session) |

**Missing dependencies with no fallback:** none block code/test work. Live end-to-end requires the Cloudflare Access + binding setup, which is explicitly user-performed and out of the code's critical path (fallback renders snapshot).
**Missing dependencies with fallback:** `@cloudflare/workers-types` (install), `wrangler` (npx), slopcheck (manual verify).

## Validation Architecture

> nyquist_validation: no `.planning/config.json` found in repo; treating as enabled (key absent ⇒ on). Validation maps cleanly onto existing vitest infra.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest `^4.1.9` (installed) |
| Config file | `vitest.config.ts` (env `node`, `include: ["scripts/**/*.test.ts"]`) |
| Quick run command | `pnpm test` (`vitest run`) |
| Full suite command | `pnpm test && pnpm typecheck && pnpm lint && pnpm build` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| Spec test 1 | unknown op → 404 | unit | `pnpm test` (handler test) | ❌ Wave 0 |
| Spec test 2 | success → valid RoadmapJson (schema-valid) | unit (mocked fetch) | `pnpm test` | ❌ Wave 0 |
| Spec test 3 | email in upstream → assertNoLeak throws → rejected, no PII | unit (regression guard) | `pnpm test` | ❌ Wave 0 |
| Spec test 4 | token never in any response/error body | unit | `pnpm test` | ❌ Wave 0 |
| Shared refactor | `sync:snapshot` behavior unchanged after `query.ts`/`mapWorkspace` extraction | unit (existing) | `pnpm test` (transform.test.ts stays green) | ✅ exists |
| `process` guard | `assertNoLeak` runs under Node unchanged | unit (existing) | `pnpm test` | ✅ exists |
| Typing | handler typechecks with no `any` | static | `pnpm typecheck` | needs `tsconfig.functions.json` |
| Loader fallback | live failure → snapshot + notice; snapshot failure → error boundary | manual / optional unit | `wrangler pages dev` smoke + `vite dev` (fallback default) | manual |

### Sampling Rate
- **Per task commit:** `pnpm test` (quick; handler + transform suites).
- **Per wave merge:** `pnpm test && pnpm typecheck && pnpm lint`.
- **Phase gate:** full suite green + `wrangler pages dev` live smoke (200 from `/api/linear/snapshot`, 404 from `/api/linear/nope`) before `/gsd:verify-work`. Plus `/cso` (spec mandates it → SECURITY.md) and a grep that no response/log contains `lin_api_` or the key.

### Wave 0 Gaps
- [ ] `functions/api/linear/[[path]].test.ts` — covers spec tests 1–4 (TDD red first; this phase touches auth/API/token ⇒ test-first per CLAUDE.md).
- [ ] `scripts/linear/__fixtures__/gql-clean.ts` (+ optional `gql-with-email.ts`) — GqlResponse-shaped fixtures for handler tests (existing fixtures are `RawWorkspace`-shaped, post-mapping).
- [ ] `vitest.config.ts` include glob update: add `"functions/**/*.test.ts"` to `include` (currently `scripts/**` only — handler tests would be silently skipped otherwise). **Load-bearing config change.**
- [ ] `tsconfig.functions.json` + root reference — so `pnpm typecheck` covers the handler.

## Security Domain

> security_enforcement: enabled (no config disabling it; spec explicitly requires `/cso` → SECURITY.md). This phase crosses a real trust boundary (new authenticated API endpoint holding the Linear token).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Cloudflare Access email allow-list (edge, console-configured) over project + `/api/*`. Code does not implement auth. |
| V3 Session Management | no | No app sessions; Access manages identity at the edge. |
| V4 Access Control | yes | Server-side OPERATIONS allow-list (named ops only); unknown op → 404. No raw GraphQL accepted. |
| V5 Input Validation | yes | `RoadmapJsonSchema.safeParse` on the live response (client) + the Function only accepts a fixed op name (no user-supplied query). |
| V6 Cryptography | no (consumed, not implemented) | Token is a bearer credential in a binding; never hand-roll crypto. TLS to Linear is platform-provided. |
| V7 Errors & Logging | yes | Generic error bodies (404/500/502/429); never log/echo the key or upstream auth-bearing bodies. |
| V9 Communications | yes | All traffic over HTTPS (Pages + Linear API). |

### Known Threat Patterns for Pages Function + Linear proxy
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token exfiltration via response/error body | Information Disclosure | `assertNoLeak` on every live byte; generic 502 bodies; no upstream-body passthrough; token only in `Authorization` header. |
| PII (emails/names) leaking through live path | Information Disclosure | Live response goes through `buildSnapshot` (allow-list projection) → `assertNoLeak` (EMAIL_RE), identical to snapshot path. |
| Open-passthrough / SSRF-style arbitrary query | Tampering / Elevation | Named-operation registry; client cannot supply a query; only `snapshot` registered. |
| Unauthenticated access to `/api/*` | Spoofing | Cloudflare Access allow-list over `/api/*` (must explicitly cover the path, not just the root). |
| Token in client bundle / `roadmap.json` | Information Disclosure | Binding-only (`context.env`), no `process.env` in shared core; reuse Phase 02 bundle-grep gate. |
| Linear API abuse / cost | Denial of Service | `Cache-Control: private, max-age=60` + per-isolate rate-limit + optional dashboard rule + Access (small allow-list). |
| Misconfigured/absent binding leaking a stack trace | Information Disclosure | Explicit 500 with generic body when `env.LINEAR_API_KEY` missing; no key value in message. |

> `/cso` gate is REQUIRED for this phase (spec §Security posture). Preserve every Phase 02 invariant in SECURITY.md and extend the bundle/log grep to the live path and Function logs.

## Sources

### Primary (HIGH confidence)
- developers.cloudflare.com/pages/functions/api-reference — `onRequest`/`onRequestGet`, `EventContext` (request, env, params, next, waitUntil, data), `PagesFunction` handler shape.
- developers.cloudflare.com/pages/functions/routing — `[[path]]` catch-all returns `params.path` as an **array**; single-bracket returns a string; route specificity.
- developers.cloudflare.com/pages/functions/typescript — `PagesFunction<Env>` example, `interface Env { … }`, `wrangler types` codegen, `compilerOptions.types`.
- reactrouter.com (route-object / data-loading / useSearchParams) — `LoaderFunctionArgs` has `request: Request` + `params`; read query via `new URL(request.url).searchParams`.
- npm registry (live this session) — `@cloudflare/workers-types@4.20260628.1` (maintainers, 7.0M dl/wk, no postinstall); `wrangler@4.105.0`.
- Local codebase (read this session) — `client.ts`, `transform.ts`, `transform.test.ts`, `schema.ts`, `loader.ts`, `router.tsx`, `RootLayout.tsx`, `AppHeader.tsx`, `RoadmapBoundaries.tsx`, `OverviewPage.tsx`, `sync-snapshot.ts`, `wrangler.toml`, `vitest.config.ts`, `tsconfig*.json`, `eslint.config.js`, Phase 02 SUMMARY + SECURITY.

### Secondary (MEDIUM confidence)
- WebSearch (verified against RR docs) — RR7 revalidates loaders on search-param navigation by default; `useNavigation().state === "loading"`; opt-out via `shouldRevalidate` / `unstable_defaultShouldRevalidate`.
- WebSearch (verified against CF docs) — `wrangler types` is the promoted modern typing path; `@cloudflare/workers-types` still valid/current.

### Tertiary (LOW confidence)
- A1 (esbuild bundling of cross-dir `.ts` imports under Pages build) — inferred from esbuild behavior; flagged Open Question, verify in first task with `wrangler pages dev`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified on npm; types package is first-party Cloudflare.
- Architecture / handler shape: HIGH — catch-all array param and handler signature verified against official CF docs.
- Code-sharing refactor: HIGH — derived directly from reading the existing source; surgical and reversible.
- Loader/toggle (RR7 revalidation): MEDIUM-HIGH — official docs confirm request/searchParams; revalidation-on-param-change confirmed via search cross-referenced with docs.
- Pitfalls: HIGH — grounded in the actual files and verified API behavior.
- Bundling cross-dir imports (A1): MEDIUM — verify in first task.

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (stable; Cloudflare Pages Functions API and RR7 loader API are mature). Re-verify `@cloudflare/workers-types` version at install time (daily-versioned package).
