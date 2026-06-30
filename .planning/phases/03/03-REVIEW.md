---
phase: 03-linear-proxy
reviewed: 2026-06-30T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - functions/api/linear/[[path]].ts
  - scripts/linear/fetch-workspace.ts
  - scripts/linear/query.ts
  - scripts/linear/map.ts
  - scripts/linear/client.ts
  - scripts/linear/transform.ts
  - src/lib/roadmap/loader.ts
  - src/components/AppHeader.tsx
  - src/pages/OverviewPage.tsx
  - src/pages/TimelinePage.tsx
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
fixed:
  - CR-01  # pagination invariant guard + 502 test
  - WR-01  # 429 rate-limit tests + _resetRateLimitForTest helper
  - WR-02  # null-safe useRouteLoaderData in OverviewPage + TimelinePage
  - WR-03  # renamed issuesPageEmpty → issuesPageForEmailLeak; added true empty fixture
  - IN-03  # deleted orphaned gql-clean.ts + gql-with-email.ts
deferred:
  - IN-01  # server-side logging — follow-up task; no security risk, diagnostic quality only
  - IN-02  # clarifying comment in transform.ts — cosmetic; deferred to cleanup pass
status: fixes_applied
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-30
**Depth:** standard (per-file + immediate imports; test files read to verify contracts)
**Files Reviewed:** 10 source files + supporting tests/fixtures
**Status:** issues_found

## Summary

The Linear proxy and data layer are structurally sound. The security invariants
— token isolation, named-operation registry, single try/catch, PII gate —
hold across all error paths including mid-pagination failures. The loader's
live-branch fallback is correctly scoped so it never throws. The `assertNoLeak`
/ `mapWorkspace` explicit-allowlist combination properly prevents token and
email leakage in successful responses. The Zod schema adds a second layer of
shape validation after the security gate.

One blocker was found: the pagination loop has no guard against the degenerate
case where `hasNextPage=true` and `endCursor=null`, which is an infinite loop
in the Node CLI (and a Cloudflare CPU-timeout waste in the Worker). Three
warnings cover a missing 429 test, an inconsistent null-guard in the page
components, and a misleadingly-named fixture. Three info items cover silent
error swallowing, a no-op code path in the Worker, and orphaned fixture files.

---

## Critical Issues

### CR-01: Infinite loop in pagination when `hasNextPage=true` and `endCursor=null`

**File:** `scripts/linear/fetch-workspace.ts:142-143`

**Issue:** At the bottom of the pagination while-loop the code unconditionally
updates both control variables before re-evaluating the loop condition:

```typescript
hasNextPage = pageInfo.hasNextPage;
afterCursor = pageInfo.endCursor;
```

If the upstream API ever returns `{ hasNextPage: true, endCursor: null }` —
whether through a Linear bug, an API version change, or a test double that
models this edge case — the cursor is reset to `null` and the next request
sends `after: null`, which Linear treats as the first page. That first page
returns the same `{ hasNextPage: true, endCursor: null }` payload again, and
the loop never terminates.

**Impact:**
- **Node CLI path** (`client.ts` → `fetchAssembledWorkspace`): genuine infinite
  loop with no timeout. The process hangs until killed.
- **Worker path** (`[[path]].ts` → `fetchAssembledWorkspace`): Cloudflare's
  CPU-time budget is exhausted and the isolate is terminated, resulting in a
  5xx error and wasted billable compute.

The invariant `hasNextPage=true implies endCursor≠null` is a Linear API
contract, not an enforced TypeScript invariant, so the violation cannot be
caught at compile time and is not currently tested.

**Fix:** Assert the pagination invariant before updating the cursor. Any
violation throws, is caught by the handler's outer try/catch, and returns a
generic 502.

```typescript
hasNextPage = pageInfo.hasNextPage;
if (hasNextPage && pageInfo.endCursor === null) {
  throw new Error(
    "Pagination invariant violated: hasNextPage=true but endCursor=null"
  );
}
afterCursor = pageInfo.endCursor;
```

---

## Warnings

### WR-01: No test for the 429 rate-limited path

**File:** `functions/api/linear/[[path]].test.ts` (missing test section)

**Issue:** The test file covers REQ-PROXY-1 (404 unknown op), REQ-PROXY-2
(200 success), REQ-PROXY-3 (502 email leak), 500 missing key, 502 upstream
errors, 502 malformed JSON, and the full pagination matrix. The 429 rate-limit
path is never exercised. The rate-limit logic contains a window-reset branch
(`if (now - windowStart > WINDOW_MS)`) and an off-by-one decision
(`requestCount > LIMIT` vs `>= LIMIT`) that are untested. A bug in either
branch would silently allow unlimited proxy access or incorrectly block
legitimate callers.

**Fix:** Add a describe block for `429 rate limit`:

```typescript
describe("429 rate limit", () => {
  it("returns 429 on the 31st request within the window", async () => {
    // Arrange: exhaust the 30-request allowance
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => mainResponseClean,
    }));
    // NOTE: rate-limit state is module-level — reset requires a fresh module
    // import or exposing a resetRateLimit() helper for tests.
  });
});
```

Note: because `windowStart` and `requestCount` are module-level singletons,
test isolation requires either resetting them via an exported helper or
re-importing the module fresh per test. Expose a `_resetRateLimitForTest()`
function (stripped in production via dead-code elimination) or move the counter
into a factory so it can be re-created per test.

---

### WR-02: `OverviewPage` and `TimelinePage` cast loader data without null guard

**Files:**
- `src/pages/OverviewPage.tsx:5`
- `src/pages/TimelinePage.tsx:5`

**Issue:** Both pages cast the route loader data without allowing for null:

```typescript
// OverviewPage.tsx:5 and TimelinePage.tsx:5
const { data } = useRouteLoaderData("root") as RoadmapLoaderData;
```

`AppHeader.tsx` correctly uses the defensive form:

```typescript
const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;
const liveUnavailable = loaderData?.liveUnavailable ?? false;
```

If `useRouteLoaderData("root")` returns `undefined` — possible when the root
route's loader has not yet resolved, during streaming SSR, or if the route ID
is ever renamed — the destructuring `{ data }` on `undefined` throws a
TypeError that is not caught by the route's error boundary (since the error
occurs inside the component render, not inside the loader).

**Fix:** Match the defensive pattern from `AppHeader`:

```typescript
// OverviewPage.tsx
const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;
const { data } = loaderData ?? { data: null };
if (!data) return null; // or a skeleton
```

Or, for minimal change, at least add the null cast so TypeScript enforces
guarding at the call site:

```typescript
const { data } = (useRouteLoaderData("root") as RoadmapLoaderData | null) ?? (() => { throw new Error("root loader data missing"); })();
```

---

### WR-03: `issuesPageEmpty` fixture is not empty

**File:** `scripts/linear/__fixtures__/issues-page.ts:86-97`

**Issue:** The export named `issuesPageEmpty` (used in all email-leak tests as
the second-fetch stub) contains one issue node:

```typescript
export const issuesPageEmpty: GqlIssuesPage = {
  data: {
    issues: {
      nodes: [
        { project: { id: "proj-bad-001" }, state: { type: "started" } }, // ← not empty
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
};
```

The existing tests are not broken by this (the email-leak is in the main
response description, so the issue node in the second-fetch has no effect).
However, a maintainer who needs "a genuinely empty issues page" as a stub and
reaches for `issuesPageEmpty` gets a fixture with a live issue, potentially
causing incorrect test counts in new tests.

**Fix:** Rename to `issuesPageForEmailLeak` (the actual intent) and add a
truly empty fixture for use cases that require zero nodes:

```typescript
export const issuesPageForEmailLeak: GqlIssuesPage = { /* current content */ };

export const issuesPageEmpty: GqlIssuesPage = {
  data: {
    issues: {
      nodes: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
};
```

Update all imports accordingly.

---

## Info

### IN-01: All thrown errors are silently swallowed; no server-side logging

**File:** `functions/api/linear/[[path]].ts:107`

**Issue:** The single catch block discards the error entirely:

```typescript
} catch {
  return new Response("upstream error", { status: 502 });
}
```

This is correct for the client-facing response (no upstream content, no token,
no stack trace). However, the error's message — which includes Linear's
GraphQL error text, HTTP status codes, and assertion failure reasons — is
completely lost. A production 502 spike provides zero diagnostic signal.

**Fix:** Log the error server-side before returning. In a Cloudflare Worker,
`console.error` writes to the Worker's log stream (visible in the dashboard /
Logpush):

```typescript
} catch (err) {
  console.error("[linear-proxy] upstream error", err instanceof Error ? err.message : String(err));
  return new Response("upstream error", { status: 502 });
}
```

The `err.message` does not contain the auth header (verified: only status codes
and upstream GraphQL error messages are interpolated into thrown Errors). This
is safe to log.

---

### IN-02: `assertNoLeak` live-key check is a no-op in the Worker context

**File:** `scripts/linear/transform.ts:64-73`

**Issue:** The comment explains the `globalThis["process"]` probe but does not
note that the result is always `undefined` in a Cloudflare Worker (Workers have
no `process` global). The `liveKey` check therefore never fires in production;
only the static regex `TOKEN_RE = /lin_api_.../` is active in the Worker.

This is safe — the token never enters the data pipeline (it lives only in the
Authorization header, which `mapWorkspace`'s explicit allowlist never copies
to the output), and the regex catches a literal `lin_api_` pattern if one
somehow appeared. But the comment creates the impression that the check is
active in both runtimes.

**Fix:** Add a one-line clarifying comment:

```typescript
// In a Cloudflare Worker, `process` is absent so liveKey is always undefined
// here. The TOKEN_RE regex above remains the active guard in the Worker.
const nodeProcess = ...
```

---

### IN-03: Orphaned fixture files after the two-fetch refactor

**Files:**
- `scripts/linear/__fixtures__/gql-clean.ts`
- `scripts/linear/__fixtures__/gql-with-email.ts`

**Issue:** These fixtures were the test doubles for the original single-fetch
strategy. After the refactor to the two-part MAIN_QUERY + ISSUES_QUERY
strategy, the test file was updated to use `main-response.ts` and
`issues-page.ts` instead. No file in the project now imports `gql-clean.ts`
or `gql-with-email.ts` (confirmed via grep). They are dead code that will
drift out of sync with the types they reference (`GqlResponse`).

**Fix:** Delete both files:

```bash
rm scripts/linear/__fixtures__/gql-clean.ts
rm scripts/linear/__fixtures__/gql-with-email.ts
```

---

## Verdict

The security invariants hold. Token isolation is end-to-end: the auth header
never enters any response, error message, or log. The `mapWorkspace` allowlist
and `assertNoLeak` gate together prevent PII leakage in the success path. All
five error categories (unknown op, missing key, upstream non-ok, GraphQL
errors, malformed body) return generic responses for both the main and
pagination requests.

The one blocker (CR-01) is a pagination invariant that should be hardened
before shipping: the cost is two lines of code. The warnings are test coverage
and naming quality issues. Fix CR-01 and WR-01 before this ships; WR-02 and
WR-03 can follow in a cleanup pass.

---

_Reviewed: 2026-06-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
