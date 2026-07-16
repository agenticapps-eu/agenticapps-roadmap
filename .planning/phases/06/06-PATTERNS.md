# Phase 6: sync-gsd-linear CLI (backfill engine) - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 20 (11 new modules + entrypoint + 2 data files + package.json wiring + 5 test files + roadmap.json patch)
**Analogs found:** 14 / 20 (6 have no direct analog — new capability, noted below with the closest stylistic reference)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/sync-gsd-linear/config.ts` | config | file-I/O | `src/lib/roadmap/schema.ts` (+ `src/lib/roadmap/loader.ts` for the load-validate-return shape) | role-match |
| `scripts/sync-gsd-linear/walker.ts` | utility | file-I/O | none in-repo (see "No Analog Found") | no analog |
| `scripts/sync-gsd-linear/parser.ts` | transform/service | transform | `scripts/linear/transform.ts` (`buildSnapshot`, raw→normalized allow-list mapping) | role-match |
| `scripts/sync-gsd-linear/resolve.ts` | service | request-response | `scripts/linear/fetch-workspace.ts` + `scripts/linear/map.ts` | role-match |
| `scripts/sync-gsd-linear/hash.ts` | utility | transform | `scripts/linear/transform.ts` (small pure helper style, e.g. `bucketFor`/`redactEmails`) | partial-match |
| `scripts/sync-gsd-linear/mutations.ts` | service (GraphQL doc module) | request-response | `scripts/linear/query.ts` | exact |
| `scripts/sync-gsd-linear/diff.ts` | transform/service | transform | `scripts/linear/transform.ts` (`buildSnapshot` pure-computation + gate pattern) | partial-match |
| `scripts/sync-gsd-linear/dates.ts` | utility | transform | `scripts/linear/transform.ts` (`bucketFor`-style small pure switch/branch helper) | partial-match |
| `scripts/sync-gsd-linear/apply.ts` | service | CRUD + file-I/O | `scripts/linear/client.ts` (Node-only env pattern) + `scripts/sync-snapshot.ts` (orchestration + write) + `scripts/linear/transform.ts` (leak/schema gate) | role-match (composite) |
| `scripts/sync-gsd-linear/prompt.ts` | utility | request-response (interactive) | none in-repo (see "No Analog Found") | no analog |
| `scripts/sync-gsd-linear/cli.ts` | controller (CLI orchestrator) | event-driven | `scripts/sync-snapshot.ts` | role-match |
| `scripts/sync-gsd-linear.ts` (thin entrypoint) | controller | event-driven | `scripts/sync-snapshot.ts` | exact |
| `sync.config.json` (data) | config | file-I/O | none (new data file; shape governed by `config.ts`'s Zod schema, styled after `src/lib/roadmap/schema.ts`) | no analog |
| `linear-map.json` (data) | config/state | file-I/O | none (new data file; same styling source as above) | no analog |
| `package.json` (`sync:gsd` script) | config | n/a | `package.json`'s existing `"sync:snapshot": "tsx scripts/sync-snapshot.ts"` entry | exact |
| `public/roadmap.json` (`planAhead` patch) | model/data | file-I/O | `scripts/linear/transform.ts` (`assertNoLeak` + `RoadmapJsonSchema.parse` gate) + `src/lib/roadmap/schema.ts` (`planAhead` field already declared) | exact |
| `scripts/sync-gsd-linear/walker.test.ts`, `parser.test.ts`, `hash.test.ts`, `diff.test.ts`, `dates.test.ts` | test | transform | `scripts/linear/transform.test.ts` | exact |
| `scripts/sync-gsd-linear/resolve.test.ts`, `apply.test.ts` | test | request-response (mocked) | `functions/api/linear/[[path]].test.ts` | exact |

## Pattern Assignments

### `scripts/sync-gsd-linear/mutations.ts` (service, request-response)

**Analog:** `scripts/linear/query.ts` (exact — this is a GraphQL-document module, same role, same data flow)

**File-header + rationale-comment pattern** (`scripts/linear/query.ts` lines 1-15):
```typescript
// ---------------------------------------------------------------------------
// GraphQL queries for Linear API.
// Extracted so both the Node sync script and the Worker handler can import
// one copy without transitively pulling in process.env.
//
// WHY TWO QUERIES instead of one WORKSPACE_QUERY with nested issues:
//   Fetching `issues { nodes { state { type } } }` inside every project node
//   exceeds Linear's per-request GraphQL complexity limit, returning HTTP 400
//   ("Query too complex"). The fix is a two-part strategy: ...
// ---------------------------------------------------------------------------
```
Copy this exact convention for `mutations.ts`: a top comment block explaining *why* the mutation set is shaped the way it is (e.g. "why teamIds must be resolved first", "why labels are resolved twice — ProjectLabel vs IssueLabel are different pools").

**Query/mutation-as-const-string with typed params** (`scripts/linear/query.ts` lines 22-60, 68-85):
```typescript
export const MAIN_QUERY = `
  query WorkspaceMain {
    initiatives(first: 50) {
      nodes { id name color status }
    }
    ...
  }
`;

export const ISSUES_QUERY = `
  query WorkspaceIssues($after: String) {
    issues(first: 250, after: $after) {
      nodes { project { id } state { type } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;
```
Every new mutation (`PROJECT_CREATE`, `MILESTONE_CREATE`, `ISSUE_CREATE`, `PROJECT_LABEL_CREATE`, `ISSUE_LABEL_CREATE`, `INITIATIVE_TO_PROJECT_CREATE`, `TEAMS_QUERY`, `PROJECT_LABELS_QUERY`, `ISSUE_LABELS_QUERY`) should follow this exact shape: a `const NAME_SCREAMING = \`...\`` GraphQL document with `$variable: Type!` placeholders — **never** string-interpolate untrusted content (plan headings, slugs) directly into the query body. RESEARCH.md's Code Examples section already gives the verified mutation bodies to drop in here (`PROJECT_CREATE`, `MILESTONE_CREATE`, `ISSUE_CREATE`, etc.) — this analog governs *how* to structure the file, RESEARCH.md governs *what* the strings say.

---

### `scripts/sync-gsd-linear/parser.ts` (transform/service, transform)

**Analog:** `scripts/linear/transform.ts`

**Imports pattern** (lines 1-1):
```typescript
import { RoadmapJsonSchema, type RoadmapJson } from "../../src/lib/roadmap/schema.ts";
```
Mirror: import the Zod-inferred types from `config.ts` (the normalized-model schema), not ad hoc interfaces.

**Explicit allow-list raw→normalized mapping, no spreading** (lines 4-42, 118-169):
```typescript
interface RawProject {
  id: string;
  name: string;
  description: string | null;
  url?: string | null;
  initiativeId: string | null;
  state: { name: string; type: string };
  priority: number;
  startedAt: string | null;
  targetDate: string | null;
  projectMilestones: { nodes: RawMilestone[] };
  issues: { nodes: RawIssue[] };
}
...
export function buildSnapshot(raw: RawWorkspace, opts?: { now?: string }): RoadmapJson {
  ...
  const projects = raw.projects.map((proj) => {
    ...
    return {
      id: proj.id,
      name: redactEmails(proj.name),
      summary: proj.description === null ? null : redactEmails(proj.description),
      ...
    };
  });
  const result = { generatedAt, initiatives, projects };
  assertNoLeak(JSON.stringify(result));      // security gate
  return RoadmapJsonSchema.parse(result);    // schema gate
}
```
`parser.ts` should follow the identical shape: `interface RawPhaseDir { ... }` / `interface RawPlanFile { ... }` typed from what the walker hands it, a `.map()` producing the normalized `{ repo, phases[], plans[] }` model field-by-field (never `...spread`), and a final `NormalizedModelSchema.parse(result)` call (defined in `config.ts`) as the last line before returning — matches this repo's established "validate at the boundary" discipline.

**Pure-helper-per-concern style** (lines 96-112, `bucketFor`):
```typescript
type IssueCountKey = "backlog" | "started" | "done";

function bucketFor(stateType: string): IssueCountKey | null {
  switch (stateType) {
    case "triage":
    case "backlog":
    case "unstarted":
      return "backlog";
    case "started":
      return "started";
    case "completed":
      return "done";
    default:
      return null;
  }
}
```
Use this exact shape for the parser's own classification helpers, e.g. a `completionStatusFor(phaseDir): "completed" | "in-progress"` implementing RESEARCH.md's Pitfall-3 layered heuristic (ROADMAP checkbox → VERIFICATION.md → SUMMARY.md sibling → else in-progress) as a small, single-purpose, well-commented function — not folded into the main `.map()` body.

---

### `scripts/sync-gsd-linear/resolve.ts` (service, request-response)

**Analog:** `scripts/linear/fetch-workspace.ts` (read/assemble discipline) + `scripts/linear/map.ts` (pure mapping)

**Injected-fetch signature for testability** (`fetch-workspace.ts` lines 75-79):
```typescript
export async function fetchAssembledWorkspace(
  fetchFn: typeof fetch,
  endpoint: string,
  authHeader: string
): Promise<GqlResponse> {
```
`resolve.ts`'s exported functions (e.g. `resolveProject`, `resolveMilestone`, `resolveTeam`, `resolveLabel`) must take `fetchFn: typeof fetch` (or a pre-fetched `workspace` object) as an explicit parameter — never call the global `fetch` directly — so `resolve.test.ts` can stub it exactly like `[[path]].test.ts` does (see Shared Patterns below).

**Pagination-loop shape to copy for any new paginated read** (lines 104-150):
```typescript
let afterCursor: string | null = null;
let hasNextPage = true;
while (hasNextPage) {
  const issuesRes = await fetchFn(endpoint, { method: "POST", headers, body: JSON.stringify({ query: ISSUES_QUERY, variables: { after: afterCursor } }) });
  if (!issuesRes.ok) throw new Error(`Linear issues request failed: ${issuesRes.status}`);
  const issuesJson = (await issuesRes.json()) as RawIssuesPage;
  if (issuesJson.errors?.length) throw new Error(`Linear GraphQL errors (issues): ${issuesJson.errors.map((e) => e.message).join(", ")}`);
  const { nodes, pageInfo } = issuesJson.data.issues;
  ...
  hasNextPage = pageInfo.hasNextPage;
  if (hasNextPage && pageInfo.endCursor === null) throw new Error("Pagination invariant violated: hasNextPage=true but endCursor=null");
  afterCursor = pageInfo.endCursor;
}
```
If `teams`/`projectLabels`/`issueLabels` reads ever need pagination beyond `first: N`, copy this exact cursor-loop + invariant-check shape rather than writing a new one (RESEARCH.md's "Don't Hand-Roll" table calls this out explicitly).

**Variables object, never string interpolation** (query.ts discipline, applied in fetch-workspace.ts line 117):
```typescript
body: JSON.stringify({ query: ISSUES_QUERY, variables: { after: afterCursor } }),
```
`resolve.ts`'s `TEAMS_QUERY`/`PROJECT_LABELS_QUERY`/`ISSUE_LABELS_QUERY` calls must pass `{ key: "..." }` / `{ name: "..." }` through `variables`, never `` `...eq: "${untrustedSlug}"` `` — this is the exact mechanism RESEARCH.md's Security Domain section flags for the GraphQL-injection threat pattern.

**Error-message conventions** (lines 92-94, 121-123, 127-131):
```typescript
if (!mainRes.ok) {
  throw new Error(`Linear main request failed: ${mainRes.status}`);
}
...
if (mainJson.errors && mainJson.errors.length > 0) {
  throw new Error(`Linear GraphQL errors (main): ${mainJson.errors.map((e) => e.message).join(", ")}`);
}
```
Reuse this exact `throw new Error(\`Linear <thing> failed: ${status}\`)` / `\`Linear GraphQL errors (<phase>): ${...}\`` phrasing for every new query/mutation call in `resolve.ts` and `apply.ts` — keeps error messages greppable and consistent with the existing read path.

---

### `scripts/sync-gsd-linear/apply.ts` (service, CRUD + file-I/O)

**Analog (composite):** `scripts/linear/client.ts` (Node-only entrypoint convention) + `scripts/sync-snapshot.ts` (orchestration/write) + `scripts/linear/transform.ts` (leak/schema gate for the `planAhead` patch)

**Node-only env-var + clear-error pattern** (`client.ts` lines 22-36):
```typescript
/**
 * NOTE: This function reads process.env and is intentionally Node-only.
 * The Worker handler calls fetchAssembledWorkspace directly with context.env.
 */
export async function fetchWorkspace(): Promise<RawWorkspace> {
  const apiKey = process.env["LINEAR_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "LINEAR_API_KEY environment variable is not set. " +
        "Export it before running sync:snapshot."
    );
  }
  const assembled = await fetchAssembledWorkspace(fetch, LINEAR_API_URL, apiKey);
  return mapWorkspace(assembled);
}
```
`apply.ts` (and `cli.ts`) must read `process.env["LINEAR_API_KEY"]` exactly once, at the Node-only boundary, with this identical fail-fast message style — mirrors CLAUDE.md's "token stays server-side" constraint and RESEARCH.md's Pattern 1 (process-free vs Node-only boundary).

**Thin top-level orchestration + write** (`scripts/sync-snapshot.ts`, full file, 8 lines):
```typescript
import { writeFileSync } from "node:fs";
import { fetchWorkspace } from "./linear/client.ts";
import { buildSnapshot } from "./linear/transform.ts";

const snap = buildSnapshot(await fetchWorkspace());
writeFileSync("public/roadmap.json", JSON.stringify(snap, null, 2));
console.log(`Snapshot written to public/roadmap.json (${snap.projects.length} projects, ${snap.initiatives.length} initiatives)`);
```
The `linear-map.json` write-back after a successful apply, and the gated `public/roadmap.json` `planAhead` patch, should use this exact `writeFileSync(path, JSON.stringify(data, null, 2))` + one-line console summary shape — do not introduce a new file-writing helper/abstraction for a single call site (matches CLAUDE.md's Simplicity First rule).

**Leak/schema gate — MUST be reused verbatim for the `planAhead` patch** (`scripts/linear/transform.ts` lines 66-90, 164-168):
```typescript
export function assertNoLeak(serialized: string): void {
  if (TOKEN_RE.test(serialized)) {
    throw new Error("SECURITY: snapshot contains a Linear API token pattern (lin_api_…)");
  }
  ...
  if (EMAIL_RE.test(serialized)) {
    throw new Error("SECURITY: snapshot contains an email address");
  }
}
...
// Security gate: throw before returning if any leak pattern detected
assertNoLeak(JSON.stringify(result));
// Schema validation: throw if shape is wrong (returns typed value)
return RoadmapJsonSchema.parse(result);
```
`apply.ts`'s `planAhead` patch function must call the existing `assertNoLeak` (import from `scripts/linear/transform.ts`, do not duplicate) and `RoadmapJsonSchema.parse` on the *patched* `roadmap.json` object before writing — this is D-06-09's explicit requirement ("must keep the file schema-valid") and CLAUDE.md's "Never do" token-leak constraint. The `planAhead?: boolean` field is already declared in `src/lib/roadmap/schema.ts` line 20 — no schema change needed, only a merge-and-validate step in `apply.ts`.

---

### `scripts/sync-gsd-linear.ts` / `scripts/sync-gsd-linear/cli.ts` (controller, event-driven)

**Analog:** `scripts/sync-snapshot.ts` (exact — same role: thin `tsx`-run script entrypoint)

**Exact pattern to mirror** (full file):
```typescript
import { writeFileSync } from "node:fs";
import { fetchWorkspace } from "./linear/client.ts";
import { buildSnapshot } from "./linear/transform.ts";

const snap = buildSnapshot(await fetchWorkspace());
writeFileSync("public/roadmap.json", JSON.stringify(snap, null, 2));
console.log(`Snapshot written to public/roadmap.json (${snap.projects.length} projects, ${snap.initiatives.length} initiatives)`);
```
`scripts/sync-gsd-linear.ts` is the thin entrypoint (mirrors this file's brevity — top-level `await`, no class, no framework) that imports `runCli` (or equivalent) from `scripts/sync-gsd-linear/cli.ts`, which itself does `parseArgs` → walker → parser → resolve → diff → dates → (prompt |issue `--yes`) → apply, matching the pipeline order in RESEARCH.md's architecture diagram. Keep the same "no CLI framework, no class wrapper" posture — `node:util.parseArgs` is a plain function call, not a library object to instantiate.

---

### `scripts/sync-gsd-linear/config.ts` (config, file-I/O)

**Analog:** `src/lib/roadmap/schema.ts` (Zod shape style) + `src/lib/roadmap/loader.ts` (validate-or-throw boundary discipline)

**Zod object-schema style to copy** (`schema.ts` lines 1-28):
```typescript
import { z } from "zod";

const MilestoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetDate: z.string().nullable(),
});
...
const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string().nullable(),
  url: z.string().nullish(),
  planAhead: z.boolean().nullish(), // OV-04 (D-05-02) — populated by Phase 6 walker; badge renders only when truthy
  ...
});

export const RoadmapJsonSchema = z.object({ ... });
export type RoadmapJson = z.infer<typeof RoadmapJsonSchema>;
```
Define `SyncConfigSchema` (allow-list entries: `{ repoPath, label, initiative?, teamKey? }`) and `LinearMapSchema` (`{ projects: Record<string,...>, milestones: Record<string,...>, issues: Record<string,...>, projectLabels: Record<string,...>, issueLabels: Record<string,...> }`) in this exact `z.object({...})` + trailing `export type X = z.infer<typeof XSchema>` shape — one schema const per concept, composed bottom-up, matching this file's `MilestoneSchema`→`ProjectSchema`→`RoadmapJsonSchema` layering.

**Validate-or-throw boundary function shape** (`loader.ts` lines 53-68, adapted from fetch to fs):
```typescript
const json: unknown = await res.json();
const parsed = RoadmapJsonSchema.safeParse(json);
if (!parsed.success) {
  throw new Response("Roadmap snapshot is malformed", { status: 500 });
}
return { data: parsed.data, live: false, liveUnavailable: wantLive };
```
`config.ts`'s `loadSyncConfig()`/`loadLinearMap()` should follow the same `readFileSync` → `JSON.parse` → `Schema.safeParse` → throw-a-clear-Error-on-failure / return-typed-data-on-success shape (swap `loader.ts`'s `Response` throw for a plain `Error` throw, since this is a Node CLI not a router loader — but keep the "parse, don't assume" discipline identical).

---

## Shared Patterns

### Process-free vs. Node-only module boundary
**Source:** `scripts/linear/query.ts`, `map.ts`, `fetch-workspace.ts` (process-free — no `process`/Node-only globals) vs. `scripts/linear/client.ts` (Node-only, reads `process.env`)
**Apply to:** All of `scripts/sync-gsd-linear/*` is itself a Node CLI (not shared with a Worker), so strict process-freedom is not required project-wide — but `mutations.ts`, `resolve.ts`'s query builders, `hash.ts`, `diff.ts`, and `dates.ts` should still avoid `process.env`/`node:fs` so they stay independently unit-testable with injected `fetch`/inputs; only `config.ts` (fs reads), `apply.ts` (fs writes + `process.env`), and `cli.ts`/`prompt.ts` (readline, argv) should touch Node-only globals.
```typescript
// scripts/linear/fetch-workspace.ts line 4-6
// Process-free: MUST NOT reference `process`, `node:*`, or any Node-only global.
// Safe to import from both Node scripts (client.ts) and the Cloudflare Worker.
// Mirrors the map.ts boundary discipline.
```

### GraphQL variables discipline (never string-interpolate)
**Source:** `scripts/linear/fetch-workspace.ts` line 117 (`variables: { after: afterCursor }`); `scripts/linear/query.ts` (`$after: String` param placeholders)
**Apply to:** `mutations.ts`, `resolve.ts`, `apply.ts` — every value derived from untrusted `.planning/` content (plan headings, slugs, repo names) must go through the GraphQL `variables` object, never `` `${value}` `` inside the query/mutation string body. This is both an established codebase convention and RESEARCH.md's explicit V5 Input Validation control (GraphQL injection via untrusted plan headings).

### Leak/schema gate on any `public/roadmap.json` write
**Source:** `scripts/linear/transform.ts` `assertNoLeak` (lines 66-90) + `RoadmapJsonSchema.parse` (line 168); field already present in `src/lib/roadmap/schema.ts` line 20 (`planAhead: z.boolean().nullish()`)
**Apply to:** `apply.ts`'s `planAhead` patch step — import and reuse `assertNoLeak` directly (do not reimplement), call it on the serialized patched object, then `RoadmapJsonSchema.parse` before `writeFileSync`. This is the only file in this phase that touches the app's existing token-free data contract, so it must go through the exact same gate the full `sync:snapshot` path already uses.

### `tsx scripts/*.ts` entrypoint + `package.json` script wiring
**Source:** `scripts/sync-snapshot.ts` (full file) + `package.json` line 11 (`"sync:snapshot": "tsx scripts/sync-snapshot.ts"`)
**Apply to:** `scripts/sync-gsd-linear.ts` + new `package.json` entry. Add directly under the existing `sync:snapshot` line:
```json
"sync:gsd": "tsx scripts/sync-gsd-linear.ts"
```
(CONTEXT.md's example invocation `pnpm sync:gsd -- --project claude-workflow` confirms args pass through after `--`, standard npm-script behavior — no wrapper needed.)

### Mocked-`fetch` test fixture pattern
**Source:** `functions/api/linear/[[path]].test.ts` lines 20-100 (`vi.stubGlobal("fetch", ...)`, fixtures are full `GqlResponse`-shaped objects returned directly from `.json()`, `afterEach(() => vi.unstubAllGlobals())`); fixture files `scripts/linear/__fixtures__/main-response.ts`, `issues-page.ts`
**Apply to:** `resolve.test.ts` and `apply.test.ts` (and the idempotency test from RESEARCH.md's Validation Architecture — "apply → mutate mocked Linear state → re-resolve → second diff is empty"):
```typescript
let callIndex = 0;
vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
  const payloads = [
    { ok: true, status: 200, json: async () => mainResponseClean },
    { ok: true, status: 200, json: async () => issuesPageSingle },
  ];
  return Promise.resolve(payloads[callIndex++]);
}));
```
For the write-path idempotency test, extend this with an in-memory mutable mock workspace (per RESEARCH.md's Wave-0 gap `linear-mutation-mock.ts`) rather than a fixed payload array, so a second `apply()` call against the now-populated mock resolves via the stored/label/hash path instead of re-creating.

### Pure-function unit test structure (fixture import + `describe`/`it` per behavior)
**Source:** `scripts/linear/transform.test.ts` lines 1-27 (imports fixtures from `./__fixtures__/`, one `describe` block per exported function, `expect(() => fn(...)).toThrow()` for the security-gate cases)
**Apply to:** `walker.test.ts`, `parser.test.ts`, `hash.test.ts`, `diff.test.ts`, `dates.test.ts` — build `scripts/sync-gsd-linear/__fixtures__/planning-trees/` (per RESEARCH.md's Wave-0 gap) the same way `__fixtures__/raw-clean.ts`/`raw-malicious.ts` are structured: named exported fixture constants, one "clean" and one "edge case" (duplicate-`NN`, decimal-phase, frontmatter-less) per test file.

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md's Code Examples / Recommended Project Structure instead):

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/sync-gsd-linear/walker.ts` | utility | file-I/O | No existing code in this repo walks a filesystem directory tree — all prior file I/O is either a single `writeFileSync` (`sync-snapshot.ts`) or browser `fetch` (`loader.ts`). Use Node's `node:fs.readdirSync`/`readFileSync` directly (RESEARCH.md: zero new deps); structure the module like `parser.ts`'s analog (`transform.ts`) for the typed-output half, but the traversal itself is novel. |
| `scripts/sync-gsd-linear/prompt.ts` | utility | request-response (interactive) | No existing code in this repo is interactive (it's a static site + read-only sync scripts). RESEARCH.md's Standard Stack section gives the exact builtin (`node:readline/promises`, `createInterface().question()`) — keep it to the ~10-line helper RESEARCH.md scopes it at. |
| `sync.config.json` (data) | config | file-I/O | New committed data file; no prior "allow-list config" file exists in this repo. Shape is fully specified by CONTEXT.md D-06-04 and validated by the new `config.ts` Zod schema (styled after `src/lib/roadmap/schema.ts`, see Pattern Assignments above). |
| `linear-map.json` (data) | config/state | file-I/O | New committed data file; no prior "persisted id map" exists (the app is snapshot-only, stateless). Shape per D-06-05/D-06-03 (`projects`/`milestones`/`issues`/`projectLabels`/`issueLabels` id maps), validated the same way as `sync.config.json`. |
| `scripts/sync-gsd-linear/dates.ts` | utility | transform | No existing date-arithmetic code in this repo (all date fields are passed through opaquely as ISO strings in `transform.ts`/`schema.ts`, never computed). Use plain `Date`/`Intl` arithmetic per RESEARCH.md's Pitfall 1 guidance (component-wise numeric phase-order comparison, not `parseFloat`); style the file like `transform.ts`'s small pure-helper functions (`bucketFor`). |
| `scripts/sync-gsd-linear/hash.ts` | utility | transform | No existing hashing code in this repo. `node:crypto.createHash("sha256")` per RESEARCH.md; style as a single ~5-line exported pure function, matching the file-size/scope discipline of `transform.ts`'s `redactEmails`. |

## Metadata

**Analog search scope:** `scripts/linear/*`, `scripts/sync-snapshot.ts`, `src/lib/roadmap/*`, `functions/api/linear/[[path]].ts` + `.test.ts`, `package.json`
**Files scanned:** `client.ts`, `map.ts`, `transform.ts`, `transform.test.ts`, `fetch-workspace.ts`, `query.ts`, `sync-snapshot.ts`, `schema.ts`, `loader.ts`, `[[path]].test.ts`, `main-response.ts` (fixture), `package.json`
**Pattern extraction date:** 2026-07-15
