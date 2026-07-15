# Phase 7: Live refresh & write-back - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 14
**Analogs found:** 12 / 14 (2 are self-modifications of an already-read file; 1 hook has no direct in-repo analog and is flagged in "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `functions/api/backfill/dispatch.ts` (NEW) | route (Pages Function) | request-response (triggers an external event) | `functions/api/linear/[[path]].ts` | exact (same tier, same trust boundary, same single-try/catch discipline) |
| `functions/api/backfill/status.ts` (NEW) | route (Pages Function) | request-response (polling readback) | `functions/api/linear/[[path]].ts` | exact |
| `functions/api/backfill/dispatch.test.ts` (NEW) | test | request-response | `functions/api/linear/[[path]].test.ts` | exact (context-helper + `vi.stubGlobal("fetch")` fixture shape) |
| `functions/api/backfill/status.test.ts` (NEW) | test | request-response | `functions/api/linear/[[path]].test.ts` | exact |
| `src/lib/backfill/useBackfill.ts` (NEW) | hook | event-driven (optimistic flip + poll + rollback) | `src/lib/roadmap/loader.ts` (single try/catch + fallback shape) + `src/pages/OverviewPage.tsx` (local `useState`/URL-param pattern) | role-match (no existing hook in the codebase — see "No Analog Found") |
| `src/lib/backfill/useBackfill.test.ts` (NEW) | test | event-driven | `src/lib/roadmap/loader.test.ts` | role-match (`vi.stubGlobal("fetch")`, `vi.useFakeTimers()` for poll-interval tests) |
| `src/components/AppHeader.tsx` (MODIFY) | component | request-response (revalidate trigger) | itself (existing Snapshot/Live toggle in the same file) | exact |
| `src/lib/roadmap/loader.ts` (MODIFY) | utility (router loader + revalidation gate) | request-response | itself | exact |
| `src/lib/roadmap/loader.test.ts` (MODIFY/extend) | test | request-response | itself | exact |
| `src/components/overview/SyncBadge.tsx` (MODIFY) | component | CRUD (pure render) | itself | exact |
| `src/components/overview/ProjectDrillDownDialog.tsx` (MODIFY) | component | request-response (dispatch + optimistic render) | itself | exact |
| `src/pages/OverviewPage.tsx` (MODIFY — optimistic-state owner, per RESEARCH "Don't Hand-Roll") | component | event-driven (local state Map) | itself | exact |
| `.github/workflows/backfill.yml` (NEW) | config (CI workflow) | batch / event-driven | `.github/workflows/snapshot.yml` | exact (same `tsx`/pnpm toolchain, same commit-on-change + concurrency shape) |
| `scripts/sync-gsd-linear/cli.ts` (READ-ONLY — invoked unchanged by `backfill.yml`) | service (CLI) | CRUD/batch | n/a — reference only, not modified | n/a |

## Pattern Assignments

### `functions/api/backfill/dispatch.ts` (route, request-response)

**Analog:** `functions/api/linear/[[path]].ts` (full file read, 126 lines)

**Imports / Env pattern** (lines 29-31, adapt per RESEARCH Pattern 1):
```typescript
interface Env {
  LINEAR_API_KEY: string;
  GH_BACKFILL_TOKEN: string; // NEW binding — distinct name from LINEAR_API_KEY,
                              // never reuse (RESEARCH anti-pattern)
}
```

**Ordering discipline — cheap rejects BEFORE any fetch** (lines 79-97, mirror exactly):
```typescript
export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  // 1. Resolve op / input — reject malformed input before any fetch
  // 2. Registry / validation lookup -> 404 or 400 on miss (before any fetch)
  // 3. Rate limit -> 429 (before any fetch)          [carry over if reused]
  // 4. Env check -> 500 generic (before any fetch)
  if (!env.GH_BACKFILL_TOKEN) {
    return new Response("internal error", { status: 500 });
  }
  ...
```
Adapt for `dispatch.ts`: it is `onRequestPost` (not `onRequestGet`), and step 1 validates
`{ project: string, mode: "dry-run" | "apply" }` from the JSON body — reject empty/
non-string `project` before calling GitHub (RESEARCH V5 Input Validation note).

**Single try/catch -> generic error, token never in body** (lines 99-115, copy shape verbatim):
```typescript
  let result;
  try {
    const assembled = await fetchAssembledWorkspace(fetch, LINEAR_ENDPOINT, env.LINEAR_API_KEY);
    const raw = mapWorkspace(assembled);
    result = entry.transform(raw);
  } catch {
    return new Response("upstream error", { status: 502 });
  }
```
For `dispatch.ts`: replace the body with the GitHub `workflow_dispatch` POST (RESEARCH
Code Examples §1 — `dispatchBackfill()`), still wrapped in exactly one try/catch that
collapses every failure (network, non-2xx, malformed body) to a single generic
502 — **never** echo the upstream GitHub response body or the `Authorization` header.

**Success response + headers** (lines 117-125, adapt — no `Cache-Control` needed for a
POST/mutation-trigger response; return `{ runId }` or `{ runId: null, correlationId }`
per RESEARCH Code Examples §1):
```typescript
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
```

**GitHub-specific header helper** (new — not in the analog, from RESEARCH Pattern 1,
required to avoid Pitfall 3 — 403 from missing `User-Agent`):
```typescript
const GITHUB_API = "https://api.github.com";
const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "agenticapps-roadmap-backfill",
});
```

---

### `functions/api/backfill/status.ts` (route, request-response)

**Analog:** `functions/api/linear/[[path]].ts` — identical Env/ordering/try-catch shape
as `dispatch.ts` above. Additional shape specifics:

- `onRequestGet` reads `?run=<id>` from the URL (mirror the `[[path]]` catch-all's
  `params.path` read at line 81, but via `new URL(request.url).searchParams.get("run")`
  since this is a fixed route, not a catch-all).
- Calls `getRunStatus()` (RESEARCH Code Examples §2) then, only if `status === "completed"`,
  calls `readDiffFromLogs()` (RESEARCH Code Examples §3) to extract the dry-run diff
  marker line.
- Returns `{ status, conclusion, diff? }` — `diff` is `undefined` unless a dry-run job's
  marker line was found (per the Wave-0 test map row for LIVE-02 status shape).
- Same single-try/catch -> generic error discipline as `dispatch.ts` (lines 99-115 shape).

---

### `functions/api/backfill/dispatch.test.ts` / `status.test.ts` (test, request-response)

**Analog:** `functions/api/linear/[[path]].test.ts` (full file read, 518 lines)

**Context helper — copy verbatim, rename types** (lines 38-49):
```typescript
const TEST_KEY = "lin_api_TESTKEY000"; // -> rename to a GH-token-shaped fixture,
                                        // e.g. "ghp_TESTTOKEN000"

function ctx(
  path: string[],
  env: Record<string, string> = { LINEAR_API_KEY: TEST_KEY } // -> GH_BACKFILL_TOKEN
) {
  return { params: { path }, env } as unknown as Parameters<
    typeof onRequestGet // -> onRequestPost for dispatch.ts
  >[0];
}
```
For `status.ts` (a fixed GET route, no catch-all), replace `ctx(path, env)`'s
`params.path` with a `request: new Request("https://x/api/backfill/status?run=123")`
field instead — mirror the `roadmapLoader` test's `args()` helper
(`src/lib/roadmap/loader.test.ts` lines 10-13) for the URL-bearing context shape.

**`vi.stubGlobal("fetch")` sequenced-payload fixture pattern** (lines 78-100, and the
reusable `stubFetchSequence` helper at lines 311-322):
```typescript
function stubFetchSequence(
  payloads: Array<{ ok: boolean; json?: () => Promise<unknown> }>
) {
  let callIndex = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => {
      const payload = payloads[callIndex++];
      return Promise.resolve(payload);
    })
  );
}
```
Use this directly for `status.test.ts`'s two-call sequence (run-status fetch, then
job-logs fetch) and for `dispatch.test.ts`'s single dispatch-call fixture.

**Token-never-in-body assertion suite — copy the shape of REQ-PROXY-4** (lines 165-251):
Every response body (200/404/500/502) must be asserted with
`expect(body).not.toContain(TEST_KEY)` and a token-shape regex
(`expect(body).not.toMatch(/lin_api_/)` -> adapt to a GH-PAT-shaped regex, e.g.
`/ghp_|github_pat_/`). This is the same invariant the RESEARCH Wave-0 test map calls
out for LIVE-02 ("GitHub token never appears in response body").

**Generic-502-on-upstream-failure suite** (lines 273-300, `describe("502 upstream errors")`):
copy directly — one test for non-ok upstream status, one for a malformed/errored
upstream body, both asserting a generic message with no leaked detail.

**afterEach cleanup** (lines 51-54):
```typescript
afterEach(() => {
  vi.unstubAllGlobals();
  _resetRateLimitForTest(); // omit if dispatch/status don't reuse the rate limiter
});
```

---

### `src/lib/backfill/useBackfill.ts` (hook, event-driven)

**No direct hook analog exists in this codebase** (confirmed: no `src/hooks/` dir, no
file matching `export function use*` outside React Router's own hooks). Compose the
pattern from two existing shapes instead:

**Fetch discipline — single try/catch, never let a failure throw past the caller**
(from `src/lib/roadmap/loader.ts` lines 34-51, the live-fetch try/catch block):
```typescript
try {
  const res = await fetch("/api/linear/snapshot");
  if (!res.ok) {
    throw new Error(`live not ok: ${res.status}`);
  }
  const json: unknown = await res.json();
  const parsed = RoadmapJsonSchema.safeParse(json);
  if (parsed.success) {
    return { data: parsed.data, live: true, liveUnavailable: false };
  }
} catch {
  // Any failure — fall through / roll back, never throw past the caller.
}
```
Apply the same discipline to the dispatch call and each poll tick: a poll failure or a
`conclusion !== "success"` result should set the hook's local error/rollback state, not
throw.

**State-holding shape — local `useState`, no new state library** (RESEARCH "Don't
Hand-Roll" table, explicit recommendation): hold
`Map<projectId, { pendingBackfill: boolean; planAheadOverride?: boolean }>` in
`OverviewPage.tsx` (see below) and have `useBackfill` return setter callbacks
(`startPreview`, `applyBackfill`) plus per-poll status, rather than owning global state
itself — mirrors `OverviewPage.tsx`'s existing `useSearchParams`-driven local-state
style (lines 28-29 of `OverviewPage.tsx`: two hooks called unconditionally before any
guard, Rules-of-Hooks discipline carried over from the 05-REVIEWS finding cited in that
file's own header comment).

**Polling loop:** no existing polling code in this repo — implement with
`setInterval`/`setTimeout` gated by an `AbortController` or a `mounted` ref, testable via
`vi.useFakeTimers()` (already proven in this codebase at
`functions/api/linear/[[path]].test.ts` lines 500-515, `vi.useFakeTimers()` +
`vi.advanceTimersByTime()`, for the rate-limit-window-reset test).

---

### `src/lib/backfill/useBackfill.test.ts` (test, event-driven)

**Analog:** `src/lib/roadmap/loader.test.ts` (full file read, 250 lines)

**`vi.stubGlobal("fetch")` with URL-branching mock** (lines 73-79):
```typescript
const fetchMock = vi.fn(async (url: string) => {
  if (url === "/api/linear/snapshot") {
    return new Response(JSON.stringify(validSnapshot), { status: 200 });
  }
  return okSnapshot();
});
vi.stubGlobal("fetch", fetchMock);
```
Adapt for `/api/backfill/dispatch` (POST) vs `/api/backfill/status?run=...` (GET)
branching.

**Fallback/rollback matrix pattern — 4 failure modes, each asserted independently**
(lines 93-166, `describe("live fallback ... failure modes")`): copy this exact
structure for the rollback matrix — (a) dispatch network failure, (b) malformed status
response, (c) polled `conclusion: "failure"`, (d) polled `conclusion: "cancelled"` —
each asserting the optimistic `planAheadOverride` reverts to `undefined`/false and an
error state is set, mirroring `liveUnavailable: true` as the "graceful, no-throw"
signal in the original.

**`afterEach(() => vi.unstubAllGlobals())`** (line 43) — copy verbatim.

---

### `src/components/AppHeader.tsx` (component, request-response) — MODIFY

**Analog:** itself (full file read, 87 lines) — the file already contains the exact
Snapshot/Live toggle + `liveUnavailable` notice pattern the Refresh button must sit
beside.

**Existing loader-data read pattern to extend** (lines 1-13):
```typescript
import { NavLink, useSearchParams, useRouteLoaderData, useNavigation } from "react-router-dom";
import type { RoadmapLoaderData } from "@/lib/roadmap/loader";

export function AppHeader() {
  const [params, setParams] = useSearchParams();
  const live = params.get("source") === "live";
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;
  const liveUnavailable = loaderData?.liveUnavailable ?? false;
```
Add `const revalidator = useRevalidator();` and `const refreshing = revalidator.state === "loading";`
here — do not introduce a second loading-state derivation; `navigation.state` already
covers full navigations, `revalidator.state` covers the explicit-revalidate case
(RESEARCH Pattern 3 / Code Examples, D-07-05).

**Right-side slot insertion point** (lines 62-82, the existing toggle button + notice —
add the Refresh button in this `<div className="ml-auto ...">` block, live-mode-gated):
```typescript
<div className="ml-auto flex items-center gap-3">
  {liveUnavailable && (
    <span className="text-xs text-(--color-muted-foreground)">
      live unavailable — showing snapshot
    </span>
  )}
  {/* NEW: freshness hint + Refresh, both Live-mode-only (D-07-05) */}
  {live && (
    <>
      <span className="text-xs text-(--color-muted-foreground)">
        {/* derive from loaderData?.data.generatedAt */}
      </span>
      <button
        onClick={() => revalidator.revalidate()}
        disabled={refreshing}
        aria-label="Refresh from Linear"
      >
        {refreshing ? "Refreshing…" : "↻ Refresh"}
      </button>
    </>
  )}
  <button onClick={handleToggle} ...>{live ? "Live" : "Snapshot"}</button>
</div>
```
Match the existing button's Tailwind class-array style (lines 72-78) rather than
introducing a new styling convention.

---

### `src/lib/roadmap/loader.ts` (utility, request-response) — MODIFY (R-4 fix)

**Analog:** itself (full file read, 92 lines) — `shouldRevalidateRoadmap` (lines 83-91)
is the exact function to fix; do not replace it wholesale.

**Current (buggy) function — the ONLY block that changes:**
```typescript
export function shouldRevalidateRoadmap({
  currentUrl,
  nextUrl,
}: ShouldRevalidateFunctionArgs): boolean {
  const sourceMode = (u: URL) =>
    u.searchParams.get("source") === "live" ? "live" : "snapshot";
  return sourceMode(currentUrl) !== sourceMode(nextUrl);
}
```

**Verified fix (RESEARCH Pattern 3 / Pitfall 1) — additive, not a reversion:**
```typescript
export function shouldRevalidateRoadmap({
  currentUrl,
  nextUrl,
}: ShouldRevalidateFunctionArgs): boolean {
  const sourceMode = (u: URL) =>
    u.searchParams.get("source") === "live" ? "live" : "snapshot";
  if (sourceMode(currentUrl) !== sourceMode(nextUrl)) {
    return true; // existing behavior: toggle flips source — unchanged
  }
  // An explicit revalidator.revalidate() re-navigates to the CURRENT location
  // unchanged, so pathname+search are IDENTICAL between currentUrl/nextUrl.
  // A filter/?project navigation always changes search, so stays false there.
  const asString = (u: URL) => u.pathname + u.search;
  return asString(currentUrl) === asString(nextUrl);
}
```
`roadmapLoader` itself (lines 28-68) is **unchanged** — only the revalidation gate moves.

---

### `src/lib/roadmap/loader.test.ts` (test, request-response) — MODIFY/extend

**Analog:** itself (full file read, 250 lines) — the `rargs()` helper (lines 200-209)
and the existing `describe("shouldRevalidateRoadmap")` block (lines 211-248) are the
exact harness to extend, not replace.

**Existing helper to reuse verbatim:**
```typescript
function rargs(current: string, next: string): ShouldRevalidateFunctionArgs {
  return {
    currentUrl: new URL(current, "http://x"),
    nextUrl: new URL(next, "http://x"),
    currentParams: {},
    nextParams: {},
    defaultShouldRevalidate: true,
  } as ShouldRevalidateFunctionArgs;
}
```

**New test cases to add (TDD — write these BEFORE the loader.ts fix, per RESEARCH Wave 0):**
```typescript
it("returns true for an explicit same-URL revalidate in live mode", () => {
  expect(
    shouldRevalidateRoadmap(rargs("/?source=live", "/?source=live")),
  ).toBe(true);
});

it("returns true for an explicit same-URL revalidate in snapshot mode", () => {
  expect(shouldRevalidateRoadmap(rargs("/", "/"))).toBe(true);
});
```
Keep every existing case in the file (lines 212-248) passing unchanged — they assert
the filter/drill-down suppression this fix must not regress.

---

### `src/components/overview/SyncBadge.tsx` (component, CRUD) — MODIFY (optional override)

**Analog:** itself (full file read, 16 lines) — currently a pure `project.planAhead`
render.

**Current shape:**
```typescript
export function SyncBadge({ project }: { project: Project }) {
  return project.planAhead ? (
    <Badge variant="destructive">Out of sync with plan</Badge>
  ) : null;
}
```
For D-07-06's optimistic flip, extend the prop surface additively (do not change the
existing `{ project }` call sites in `OverviewPage.tsx` line 99 and
`ProjectDrillDownDialog.tsx` line 53 unless they need to pass the override):
```typescript
export function SyncBadge({
  project,
  planAheadOverride, // NEW, optional — undefined = use project.planAhead unchanged
  pending,           // NEW, optional — renders a "backfilling…" indicator
}: { project: Project; planAheadOverride?: boolean; pending?: boolean }) {
  const outOfSync = planAheadOverride ?? project.planAhead;
  return (
    <>
      {outOfSync ? <Badge variant="destructive">Out of sync with plan</Badge> : null}
      {pending && <Badge variant="outline">backfilling…</Badge>}
    </>
  );
}
```
Keep the graceful-nullish-render discipline noted in the file's own header comment
(lines 1-6: "absent/false/null renders nothing, never errors").

---

### `src/components/overview/ProjectDrillDownDialog.tsx` (component, request-response) — MODIFY

**Analog:** itself (full file read, 127 lines) — the `?project`-driven open/close
pattern (lines 17-34) and the `SyncBadge` mount point (line 53) are the two insertion
points.

**Existing `useSearchParams`-driven open/close — do not change this shape:**
```typescript
const [searchParams, setSearchParams] = useSearchParams();
const projectId = searchParams.get("project");
const project = projectId
  ? (data.projects.find((p) => p.id === projectId) ?? null)
  : null;
```

**SyncBadge mount point to extend with the optimistic-state Map from
`OverviewPage.tsx`** (line 53):
```typescript
<SyncBadge project={project} />
```
becomes (passing through the Map entry for `project.id`, owned by the parent per the
RESEARCH "Don't Hand-Roll" recommendation):
```typescript
<SyncBadge
  project={project}
  planAheadOverride={backfillState.get(project.id)?.planAheadOverride}
  pending={backfillState.get(project.id)?.pendingBackfill}
/>
```

**Guarded Linear deep-link pattern to copy for the new Backfill button's placement**
(lines 109-121 — same `border-t border-(--color-border) pt-2` footer-section style):
```typescript
{project.url?.startsWith("https://linear.app/") && (
  <div className="border-t border-(--color-border) pt-2">
    <a href={project.url} target="_blank" rel="noopener noreferrer" ...>
      Open in Linear ↗
    </a>
  </div>
)}
```
Add the Backfill button (`Backfill: {project.name}` -> preview -> Apply, per the
CONTEXT.md "Specific Ideas" two-phase UX shape) in a sibling `border-t` section,
wired to `useBackfill()`.

---

### `src/pages/OverviewPage.tsx` (component, event-driven) — MODIFY (state owner)

**Analog:** itself (full file read, 112 lines) — the two-unconditional-hooks-before-guard
discipline (lines 24-40) and the `openProject`/`setSearchParams` callback style (lines
54-61) are the patterns to extend, not replace.

**Existing hook-ordering discipline (MUST be preserved — do not add a hook after the
`if (!loaderData)` guard):**
```typescript
const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;
const [searchParams, setSearchParams] = useSearchParams();
// NEW: const [backfillState, setBackfillState] = useState<Map<string, {...}>>(new Map());
//      must also be called here, unconditionally, before the guard below.

if (!loaderData) {
  return ( ... );
}
```

**Threading the Map into `SyncBadge` at the project-list row (line 99) and into
`ProjectDrillDownDialog` (line 109):**
```typescript
<SyncBadge project={project} /* + planAheadOverride/pending from backfillState */ />
...
<ProjectDrillDownDialog data={data} /* + backfillState + setBackfillState */ />
```

---

### `.github/workflows/backfill.yml` (config, batch/event-driven) — NEW

**Analog:** `.github/workflows/snapshot.yml` (full file read, 47 lines)

**Trigger + concurrency shape to mirror (adapt `on:` for `workflow_dispatch` inputs,
drop the `schedule:` block — backfill is UI-triggered only):**
```yaml
on:
  workflow_dispatch:
    inputs:
      project:
        required: true
        type: string
      mode:
        required: true
        type: choice
        options: [dry-run, apply]
      correlation_id:
        required: false
        type: string

concurrency:
  group: backfill-${{ inputs.project }}
  cancel-in-progress: false
```
(`snapshot.yml` lines 3-11 for the base shape; the `group` here is per-project, not a
single fixed string, since two different projects' backfills should not block each
other — a deliberate deviation, not a copy error.)

**Toolchain steps — copy verbatim** (`snapshot.yml` lines 20-32):
```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 9
- uses: actions/setup-node@v4
  with:
    node-version: 24
    cache: pnpm
- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

**Checkout layout — NOT in the analog (snapshot.yml checks out only itself at the
workspace root, line 20: `- uses: actions/checkout@v4`); this is new, per RESEARCH
Pattern 2 / Pitfall 2 (verbatim, already vetted against `actions/checkout`'s
workspace-sandboxing restriction):**
```yaml
- name: Checkout agenticapps-roadmap
  uses: actions/checkout@v4
  with:
    path: agenticapps-roadmap
- name: Checkout claude-workflow
  uses: actions/checkout@v4
  with:
    repository: agenticapps-eu/claude-workflow
    token: ${{ secrets.GH_CROSS_REPO_TOKEN }}
    path: claude-workflow
- name: Checkout cparx
  uses: actions/checkout@v4
  with:
    repository: agenticapps-eu/cparx
    token: ${{ secrets.GH_CROSS_REPO_TOKEN }}
    path: factiv/cparx
- name: Checkout fx-signal-agent
  uses: actions/checkout@v4
  with:
    repository: agenticapps-eu/fx-signal-agent
    token: ${{ secrets.GH_CROSS_REPO_TOKEN }}
    path: factiv/fx-signal-agent
```
This reproduces `sync.config.json`'s `../claude-workflow`, `../../factiv/cparx`,
`../../factiv/fx-signal-agent` relative paths (verified against `sync.config.json`,
lines 1-20) — do NOT edit `sync.config.json` itself (Surgical Changes discipline; the
CLI's paths are correct for their CWD-relative contract).

**Commit-on-change pattern to copy verbatim for the `apply` mode leg** (`snapshot.yml`
lines 39-46, R-3 — the apply job must commit the refreshed `roadmap.json`):
```yaml
- name: Commit snapshot if changed
  run: |
    git diff --quiet public/roadmap.json && echo "No changes" && exit 0
    git config user.name  "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add public/roadmap.json
    git commit -m "chore: refresh roadmap snapshot [skip ci]"
    git push
```
(`working-directory: agenticapps-roadmap` on every `git`/`pnpm` step, per RESEARCH
Pattern 2 — CWD must be the checked-out roadmap subdirectory, not the workspace root.)

**CLI invocation — the exact truth table this workflow's `run:` line must match**
(`scripts/sync-gsd-linear/cli.ts` lines 13-20, read-only reference, invoked unchanged):
```
--project X (dry-run default)                  -> one-project read-only preview
--project X --apply --yes                       -> print ops, write, no prompt
```
So the workflow step is:
```yaml
- name: Run sync-gsd-linear
  working-directory: agenticapps-roadmap
  env:
    LINEAR_API_KEY: ${{ secrets.LINEAR_API_KEY }}
  run: |
    pnpm sync:gsd -- --project "${{ inputs.project }}" ${{ inputs.mode == 'apply' && '--apply --yes' || '' }}
```
For the dry-run leg's diff readback, wrap the same invocation with the stdout-marker
pattern from RESEARCH Code Examples §3 (`___DIFF_JSON___...___END_DIFF___`), consumed
by `status.ts`'s `readDiffFromLogs()`.

---

## Shared Patterns

### Single try/catch -> generic error (server-side, no leaked detail)
**Source:** `functions/api/linear/[[path]].ts` lines 99-115
**Apply to:** `functions/api/backfill/dispatch.ts`, `functions/api/backfill/status.ts`
```typescript
let result;
try {
  // entire upstream-call stretch here
} catch {
  return new Response("upstream error", { status: 502 });
}
```

### Token-server-side invariant (never in body, never logged)
**Source:** `functions/api/linear/[[path]].ts` (Env interface, lines 29-31) +
`functions/api/linear/[[path]].test.ts` REQ-PROXY-4 suite (lines 165-251)
**Apply to:** `dispatch.ts`, `status.ts`, and their test files — every response body
across every status code must be asserted free of the token value/shape.

### `vi.stubGlobal("fetch")` fixture pattern
**Source:** `functions/api/linear/[[path]].test.ts` lines 78-100, 311-322; also
`src/lib/roadmap/loader.test.ts` lines 51-79
**Apply to:** all four new/extended test files (`dispatch.test.ts`, `status.test.ts`,
`useBackfill.test.ts`, extended `loader.test.ts`)
```typescript
vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(payload)));
// afterEach(() => vi.unstubAllGlobals());
```

### Zero-network-by-default preservation (D-07-05, D-05-06)
**Source:** `src/lib/roadmap/loader.ts` lines 34-51 (live branch only runs when
`?source=live`) + `src/components/AppHeader.tsx` lines 6-8 (`live` derived from
`params.get("source")`)
**Apply to:** `AppHeader.tsx`'s new Refresh button (Live-mode-only render gate) and
`ProjectDrillDownDialog.tsx`'s new Backfill button (should also consider Access-gating
context, though enforcement is at the edge per D-07-03, not client code).

### CI toolchain (`tsx` scripts + pnpm + node 24)
**Source:** `.github/workflows/snapshot.yml` lines 20-32
**Apply to:** `.github/workflows/backfill.yml` (identical setup steps, new checkout +
dispatch-specific steps layered on top per Pattern 2 above).

### Local `useState`, no new state library
**Source:** RESEARCH "Don't Hand-Roll" table (confirmed by grep: no global state lib in
this repo) + `src/pages/OverviewPage.tsx` lines 24-29 (hook-ordering discipline)
**Apply to:** `useBackfill.ts` + `OverviewPage.tsx`'s new `backfillState` Map — do not
introduce Zustand/Redux/Context for this phase's single-project, ephemeral optimistic
state.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/backfill/useBackfill.ts` | hook | event-driven | No existing custom hook (`src/hooks/` doesn't exist; no `export function use*`/`export const use*` found anywhere in `src/` besides React Router's own). Composed from `loader.ts`'s try/catch discipline + `OverviewPage.tsx`'s local-state style instead (see Pattern Assignments above) — grounded in RESEARCH's explicit Code Examples and the "Don't Hand-Roll" table, not invented here. |
| Error-toast UI (D-07-06/07 "error toast" on rollback) | component | event-driven | No toast/notification component exists in `src/components/ui/` (confirmed: only `badge`, `button`, `card`, `dialog`, `hover-card`, `popover`). Styling/placement is explicitly Claude's Discretion per CONTEXT.md — the planner should scope a minimal inline component (e.g. reuse `Badge variant="destructive"` or a small dismissible banner) rather than adding a toast library, per Simplicity First. |

## Metadata

**Analog search scope:** `functions/api/**`, `.github/workflows/**`, `src/components/**`,
`src/lib/**`, `src/pages/**`, `scripts/sync-gsd-linear/**`, `scripts/sync-snapshot.ts`,
`sync.config.json`, `package.json`.
**Files scanned/read in full:** `functions/api/linear/[[path]].ts` (126 lines),
`functions/api/linear/[[path]].test.ts` (518 lines), `src/lib/roadmap/loader.ts` (92
lines), `src/lib/roadmap/loader.test.ts` (250 lines), `src/components/AppHeader.tsx` (87
lines), `src/components/overview/SyncBadge.tsx` (16 lines),
`src/components/overview/ProjectDrillDownDialog.tsx` (127 lines),
`.github/workflows/snapshot.yml` (47 lines), `scripts/sync-snapshot.ts` (7 lines),
`scripts/sync-gsd-linear/cli.ts` (229 lines), `src/pages/OverviewPage.tsx` (112 lines),
`package.json` (52 lines), `sync.config.json` (20 lines).
**Pattern extraction date:** 2026-07-15
