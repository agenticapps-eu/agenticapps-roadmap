# Phase 8: Deploy, gate & document - Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 6
**Analogs found:** 6 / 6 (one cross-repo analog for the ADR)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `functions/api/backfill/dispatch.ts` | route (Pages Function) | request-response (+ new KV read/write) | itself (existing file, same file) + `functions/api/linear/[[path]].ts` | exact (self) / role-match (KV env-binding convention) |
| `functions/api/backfill/dispatch.test.ts` | test | request-response | itself (existing file, same file) | exact |
| `wrangler.toml` | config | n/a (static config) | itself (existing file, same file) | exact |
| `docs/decisions/NNNN-hosting-and-sync-architecture.md` | config (doc/ADR) | n/a | `../claude-workflow/docs/decisions/0010-backend-language-routing-go.md` (cross-repo) | role-match (format convention only; no ADR exists yet in this repo) |
| `docs/runbook.md` | config (doc) | n/a | `docs/access-setup.md` + `docs/architecture.md` (this repo) | role-match |
| `README.md` | config (doc) | n/a | itself (existing file, same file) | exact |

## Pattern Assignments

### `functions/api/backfill/dispatch.ts` (route, request-response + KV)

**Analog:** itself — `functions/api/backfill/dispatch.ts` (264 lines, read in full) — this is a
surgical MODIFY, not a new file. The KV nonce slots into the existing structure exactly where
the file's own `TODO(phase-8)` comment marks it.

**Env interface convention** (lines 19-21, current):
```typescript
interface Env {
  GH_BACKFILL_TOKEN: string;
}
```
Add the KV binding the same way `functions/api/linear/[[path]].ts` declares its single string
binding (lines 29-31 there) — one field per binding, no wrapper object:
```typescript
interface Env {
  GH_BACKFILL_TOKEN: string;
  BACKFILL_NONCE: KVNamespace; // D-08-06
}
```

**Exactly where the nonce check goes — the file already marks the spot** (lines 92-100):
```typescript
// CR-01: a previewRunId must be recent — an arbitrarily old successful
// dry-run no longer reflects the current sibling-repo/Linear state, and the
// review's fix guidance calls for rejecting anything older than this bound.
const MAX_PREVIEW_AGE_MS = 15 * 60 * 1000;

// TODO(phase-8): one-time-use nonce for previewRunId needs a KV/D1 binding
// (none exists in wrangler.toml today) to mark a previewRunId "consumed"
// after it authorizes one apply. Deferred until that binding is added —
// see 07-HUMAN-UAT.md's Phase-8 items.
```
Replace that `TODO` comment with the real constant (RESEARCH.md Pattern 1 proposes
`NONCE_TTL_SECONDS = 900`, matching `MAX_PREVIEW_AGE_MS`) — do not touch `MAX_PREVIEW_AGE_MS`
itself (Surgical Changes: the recency bound is explicitly staying as defense-in-depth per D-08-06).

**Core check-then-set pattern — insert inside the existing `mode === "apply"` branch**
(current code, lines 216-231, is the exact insertion point — after `isValidPreviewRun` passes,
before falling through to the shared dispatch call at line 233):
```typescript
try {
    if (mode === "apply") {
      const previewRes = await fetch(
        `${GITHUB_API}/repos/${REPO}/actions/runs/${previewRunId}`,
        { headers: GH_HEADERS(env.GH_BACKFILL_TOKEN) }
      );
      if (!previewRes.ok) {
        throw new Error("preview run fetch failed");
      }
      const previewRunJson: unknown = await previewRes.json();
      if (!isPreviewRun(previewRunJson)) {
        throw new Error("malformed preview run response");
      }
      if (!isValidPreviewRun(previewRunJson, project)) {
        return textResponse("preview verification failed", 403);
      }
      // NEW (D-08-06): consume-once nonce, inserted here.
    }

    const correlationId = crypto.randomUUID();
    // ... existing dispatch fetch unchanged ...
```
Match this file's own established idioms exactly — the `textResponse(msg, 403)` helper (already
defined at line 179-181) for the "already consumed" rejection, and the same single try/catch
envelope already wrapping this whole stretch (per the file's own header comment, lines 12-15:
"Single try/catch around the entire GitHub-call stretch; ANY failure collapses to a generic
502"). RESEARCH.md's Pattern 1 code shape (`env.BACKFILL_NONCE.get`/`.put` with
`expirationTtl`) fits directly inside this existing try block — no new try/catch needed.

**Error/reject-response convention already established in this file** — reuse verbatim:
```typescript
const NO_STORE = { "Cache-Control": "no-store" };
function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: NO_STORE });
}
```

**What NOT to change (Surgical Changes):** the rate limiter (lines 148-168), the input
validation block (lines 183-211), the allow-list/mode/positive-int guards, and the dispatch
POST body construction (lines 233-248) are all untouched by D-08-06 — the nonce is additive
inside the existing `apply` branch only.

---

### `functions/api/backfill/dispatch.test.ts` (test, request-response)

**Analog:** itself — `functions/api/backfill/dispatch.test.ts` (553 lines, read in full). This
is the single most important analog: it defines the exact mock-`env` idiom the planner must
extend for KV, with **no Miniflare/`wrangler dev` dependency**.

**Current plain-object `env` mock — the pattern to extend** (lines 20-29):
```typescript
const TEST_TOKEN = "ghp_TESTTOKEN000";
const TOKEN_REGEX = /ghp_|github_pat_/;

function ctx(
  body: Record<string, unknown>,
  env: Record<string, string> = { GH_BACKFILL_TOKEN: TEST_TOKEN }
) {
  const request = new Request("https://x/api/backfill/dispatch", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { request, env } as unknown as Parameters<typeof onRequestPost>[0];
}
```
`env` is a bare object cast with `as unknown as Parameters<typeof onRequestPost>[0]` — no
Cloudflare-specific test harness. RESEARCH.md's Pattern 1 test snippet extends this exact
idiom with a `Map`-backed fake `KVNamespace` (`get`/`put` only, matching what `dispatch.ts`
actually calls):
```typescript
function ctx(
  body: Record<string, unknown>,
  kvOverrides: Partial<Record<string, string>> = {}
) {
  const store = new Map<string, string>(Object.entries(kvOverrides));
  const kv = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
  };
  const env = { GH_BACKFILL_TOKEN: TEST_TOKEN, BACKFILL_NONCE: kv };
  const request = new Request("https://x/api/backfill/dispatch", { method: "POST", body: JSON.stringify(body) });
  return { request, env } as unknown as Parameters<typeof onRequestPost>[0];
}
```
Note the signature change (`env: Record<string,string>` → `kvOverrides` param) is a breaking
change to every existing call site of `ctx(...)` in this file (currently called with a 1- or
2-arg form throughout, e.g. lines 73, 83, 93, 104, 122, etc., where the 2nd positional arg is
today's raw `env` object, e.g. line 122's `ctx({ project: "cparx", mode: "dry-run" }, {})` for
the missing-token 500 case). **Planner must decide:** either (a) keep `ctx`'s existing 2-arg
shape (`body`, full `env` object including a pre-built `kv` mock) so all ~30 existing call
sites need zero changes, or (b) adopt RESEARCH.md's `kvOverrides`-shorthand shape and update
every existing call site's 2nd argument from a raw `env`-shaped object to a `kvOverrides` map.
**Recommendation for planner: prefer (a)** — it is the smaller, more surgical diff consistent
with CLAUDE.md's Surgical Changes rule, since this file has ~30 pre-existing `ctx(...)` calls
that pass `{}` or a full env object as the 2nd arg (e.g. line 122, line 411) and none of those
should need to change shape just to add KV support.

**Existing `stubFetchSequence` + `goodPreviewRun` helpers** (lines 31-57) are untouched by the
nonce — they stub `fetch`, not KV; the new KV mock is a parallel, independent helper.

**Structural pattern to mirror for the new nonce test `describe` block** — this file organizes
tests as `describe(...)` blocks per concern with an `afterEach` resetting shared state (lines
59-62):
```typescript
afterEach(() => {
  vi.unstubAllGlobals();
  _resetRateLimitForTest();
});
```
The existing CR-01 recency test is the closest structural sibling for the new nonce tests
(lines 227-248, `"rejects a preview run older than the 15-minute recency bound"` inside the
`describe("apply with invalid preview run (403, no dispatch)", ...)` block) — RESEARCH.md's
Pattern 1 specifies two new cases to add in the same spirit: (1) a second `apply` call reusing
the same `previewRunId` after a first successful apply's `put()` → expect 403 and `mockFetch`
NOT called a second time for the dispatch step; (2) two different `previewRunId`s both succeed
(mirrors the existing "apply dispatch success" `describe` block, lines 325-341).

**Token-leak invariant test convention** — every new status code this nonce introduces (the
403-consumed case) should get a row in the existing "token never present in any response body"
`describe` block (lines 449-513) using its established `bodyOf` + `TOKEN_REGEX` pattern.

**Cache-Control invariant** — likewise, the existing `describe("Cache-Control: no-store on
every response", ...)` block (lines 404-443) is the pattern to extend with the new 403 case,
since `textResponse` already sets `NO_STORE` unconditionally (no new header logic needed).

---

### `wrangler.toml` (config, static)

**Analog:** itself — current 3-line file (read in full):
```toml
name = "agenticapps-roadmap"
compatibility_date = "2025-01-01"
pages_build_output_dir = "dist"
```

**Pattern to append** — RESEARCH.md Pattern 2, `[CITED: developers.cloudflare.com/pages/
functions/wrangler-configuration/]`, confirmed consistent with this repo having no
`[env.*]`-scoped blocks today:
```toml
[[kv_namespaces]]
binding = "BACKFILL_NONCE"
id = "<NAMESPACE_ID_FROM_wrangler_kv_namespace_create>"
```
Single top-level block, no `[env.production]`/`[env.preview]` split — matches the file's
current flat (non-environment-scoped) shape exactly. The `id` value is produced out-of-band by
`npx --yes wrangler@4 kv namespace create BACKFILL_NONCE` (a real, one-time infra command, not
part of any build script) — the planner should treat the placeholder `id` as a manual-fill
value the human executes during Phase 8, not something a task can codegen.

---

### `docs/decisions/NNNN-hosting-and-sync-architecture.md` (doc/ADR, CREATE)

**No same-repo analog** — `docs/decisions/` does not exist yet in `agenticapps-roadmap`
(confirmed absent; this phase creates the directory for the first time).

**Cross-repo analog:** `../claude-workflow/docs/decisions/0010-backend-language-routing-go.md`
(read in full, 90 lines) — this is the sibling-repo convention RESEARCH.md and CONTEXT.md both
point to. Extract the header block and section skeleton exactly:

**Header format** (lines 1-6):
```markdown
# ADR-0010: Backend language routing for Go

**Status:** Accepted
**Date:** 2026-05-03
**Linear:** —
**Phase:** Phase 1 of `feat/wire-go-impeccable-database-sentinel`
```
For this repo's ADR, mirror the same four metadata lines: `Status: Accepted`, `Date:
2026-07-16` (or the actual tag date), `Linear:` (link the AgenticApps Roadmap Linear project /
milestone if available, else `—`), `Phase: Phase 8 of agenticapps-roadmap`.

**Section skeleton** (H2 headings, in this exact order): `## Context`, `## Decision`,
`## Alternatives Rejected`, `## Consequences` (with **Positive:**/**Negative:**/**Follow-ups:**
sub-bullets, lines 63-81), `## References` (lines 82-89, bare bullet list of source docs/URLs).

**Content mapping for this repo's ADR** (per CONTEXT.md's Claude's Discretion note — "the ADR
records the hosting choice (Cloudflare Pages + Functions) and the sync architecture
(CI-dispatch write path, D-07-01)"): source the `## Context`/`## Decision` prose primarily from
`docs/architecture.md` (already read in full, 63 lines — the "Why Cloudflare Pages over GitHub
Pages" section and the Decisions table are the direct source material) plus the D-07-01/D-08-01
through D-08-06 decisions already recorded in `.planning/phases/07/07-CONTEXT.md` and
`.planning/phases/08/08-CONTEXT.md`. This is a compilation/backfill ADR (recording a decision
already made and now being shipped), not a forward-looking proposal — the "Alternatives
Rejected" section should draw on the **Rejected:** notes already present in 08-CONTEXT.md
(D-08-01 through D-08-06 each already state their rejected alternative inline).

---

### `docs/runbook.md` (doc, CREATE)

**No exact analog** — `docs/runbook.md` does not exist yet. **Closest same-repo analogs (both
read in full):**

1. `docs/access-setup.md` (185 lines) — the closer structural match: a **numbered, sequential,
   dashboard-driven runbook** with H2 sections per major step (`## 1. Set the LINEAR_API_KEY
   Pages Secret Binding`, `## 2. Create the Cloudflare Access Email Allow-List Policy`, `## 3.
   Optional: ...`, `## 4. Verify and Record Proof`), each containing an H3 **"Steps (Cloudflare
   dashboard)"** numbered sub-list, inline **`> blockquote` callouts** for hard invariants
   (e.g. line 31: `> **Never-commit rule:** ...`), and terminal `bash`/`curl` code blocks with
   `# expect: ...` comments documenting the expected result of each check.

2. `docs/architecture.md` (63 lines) — shorter, table-driven for the "Decisions" summary
   (lines 5-13, a `| Topic | Decision |` table) — useful if the runbook wants a compact
   "at a glance" section before the step-by-step detail.

**Concrete excerpt to copy the callout/verification idiom from** (`docs/access-setup.md`,
lines 161-185, the "Deployed Access check (required — blocking gate)" section):
```markdown
### Deployed Access check (required — blocking gate)

These checks must be run against the **deployed Pages app** (not localhost):

\`\`\`bash
# Unauthenticated check (no Access session):
curl -sS -o /dev/null -w "%{http_code}\n" https://<deployed-domain>/api/linear/snapshot
# expect: 302 (redirect to Access login) or 403 — NOT 200, NOT any Linear data
\`\`\`
```
`docs/runbook.md` should reuse this exact `curl -sS -o /dev/null -w "%{http_code}\n"` idiom for
its own deploy/rotation/backfill verification steps — RESEARCH.md's "Code Examples" section
already extends this precise pattern to `/api/backfill/*` (`dispatch`/`status`), so the
runbook's verification snippets can be lifted near-verbatim from there.

**Content the runbook must cover per DEPLOY-03** (from CONTEXT.md/RESEARCH.md, not from any
analog — these are the phase's own requirements): deploy (Pages project creation — new, no
existing doc), token rotation (PAT dual-secret-name pattern, RESEARCH.md Pattern 3; LINEAR_API_KEY
dual-binding, D-08-04), snapshot refresh (cron cadence + Pitfall 3's 15-60min propagation delay
caveat), and backfill (dispatch → preview → apply flow, referencing `07-HUMAN-UAT.md`'s
checklist by name rather than duplicating it).

---

### `README.md` (doc, MODIFY)

**Analog:** itself — current 57-line file (read in full). This is a targeted MODIFY, not a
rewrite — CONTEXT.md/RESEARCH.md call for new deploy/rotation/refresh/backfill sections.

**Existing structure to extend, not replace** (section order, current): title/tagline →
bullet feature list (lines 7-12) → `## Architecture (decided)` (ASCII diagram, lines 14-26) →
`## Stack` (line 28) → `## Status` (lines 33-37) → `## Local development` (commands, lines
39-46) → `## Environment` (table, lines 48-57).

**Table convention to follow for any new tabular content** (lines 50-54, the existing
`## Environment` table — reuse this exact `| Var | Where | Purpose |` header shape for any new
rotation/secrets-summary table):
```markdown
## Environment

| Var | Where | Purpose |
|---|---|---|
| `LINEAR_API_KEY` | CI secret / Pages Functions binding | server-side Linear access |
| `LINEAR_TEAM_ID` | build env | `AGE` team id |
| `ROADMAP_REPOS_ROOT` | local | parent dir(s) to scan for `.planning/` |
```
Extend this table with `GH_BACKFILL_TOKEN`/`GH_CROSS_REPO_TOKEN` rows (same PAT value, two
secret names per D-08-03) and `BACKFILL_NONCE` (KV binding, D-08-06) rather than starting a new
table — matches the file's existing single-environment-table convention.

**Command-block convention to follow** (lines 41-46, the existing `## Local development` bash
block) — append new deploy-related commands (if any user-facing ones exist, e.g. `pnpm build`
+ `wrangler pages deploy`) to this same fenced block rather than creating a second one, unless
the new content is substantial enough to warrant its own `## Deploy` H2 section pointing at
`docs/runbook.md` for the full detail (recommended — keep README high-level, defer detail to
the runbook, consistent with `## Status`'s existing "Execute them with the prompts in
[docs/claude-code-prompts.md]" pattern of README-links-out-to-docs/, line 36).

**`## Status` section update** (lines 33-37) — currently says "Spec-first scaffold. Work is
broken into eight GSD phases..."; this is the natural place to update once `v0.1.0` is tagged
(D-08-05), following the same terse, present-tense style already used there.

## Shared Patterns

### Env-binding declaration convention (Pages Functions)
**Source:** `functions/api/linear/[[path]].ts` lines 29-31, `functions/api/backfill/dispatch.ts`
lines 19-21
**Apply to:** `functions/api/backfill/dispatch.ts`'s new `BACKFILL_NONCE: KVNamespace` field
```typescript
interface Env {
  GH_BACKFILL_TOKEN: string; // one field per binding, no wrapper/union type
}
```
Both existing Pages Functions declare a flat `interface Env` with one primitive/typed field per
binding — no shared/base `Env` type exists to extend. The new `BACKFILL_NONCE` field follows
the same flat-field idiom, just with a `KVNamespace` type instead of `string`.

### No-store response header + textResponse/jsonResponse helper pair
**Source:** `functions/api/backfill/dispatch.ts` lines 170-181
**Apply to:** any new reject branch inside `dispatch.ts` (the KV-consumed 403 case)
```typescript
const NO_STORE = { "Cache-Control": "no-store" };
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...NO_STORE },
  });
}
function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: NO_STORE });
}
```
Every response in this file already goes through one of these two helpers — the new 403 must
too (`textResponse("preview already applied", 403)` per RESEARCH.md Pattern 1's exact wording).

### Single try/catch → generic error collapse
**Source:** `functions/api/backfill/dispatch.ts` lines 12-15 (header comment) + lines 213-263
(implementation), mirrored in `functions/api/linear/[[path]].ts` lines 99-115
**Apply to:** the KV `get`/`put` calls — they must live inside the existing try block so any KV
failure (e.g. a transient Cloudflare-side error) collapses to the same generic 502, not a new
error path or a leaked internal detail.

### Plain-object env mock, no Miniflare
**Source:** `functions/api/backfill/dispatch.test.ts` lines 20-29
**Apply to:** `dispatch.test.ts`'s new KV-mock extension (see Pattern Assignments above) — the
project's test convention explicitly avoids `wrangler dev`/Miniflare for unit tests; a bare
object with `get`/`put` `vi.fn()`s backed by a `Map` is sufficient and matches the existing
casting idiom (`as unknown as Parameters<typeof onRequestPost>[0]`).

### ADR header/section skeleton (cross-repo convention)
**Source:** `../claude-workflow/docs/decisions/0010-backend-language-routing-go.md` (full file)
**Apply to:** `docs/decisions/NNNN-hosting-and-sync-architecture.md` (new file, new directory)
```markdown
# ADR-NNNN: <title>

**Status:** Accepted
**Date:** <YYYY-MM-DD>
**Linear:** <link or —>
**Phase:** <phase reference>

## Context
## Decision
## Alternatives Rejected
## Consequences
## References
```

### Numbered-runbook-step + verify-with-curl idiom
**Source:** `docs/access-setup.md` lines 22-29 (numbered dashboard steps), lines 149-178
(curl verification blocks with `# expect:` comments)
**Apply to:** `docs/runbook.md`'s deploy/rotation/refresh/backfill sections — every operational
step this repo documents already follows "numbered dashboard steps, then a verification curl
block with an explicit expected-status comment"; the new runbook should not invent a different
documentation idiom.

## No Analog Found

None. All 6 files have at least a role-match analog (the docs have same-repo structural
analogs plus one explicit cross-repo ADR-format analog; the two code files and the config file
are themselves the analog since they are surgical MODIFYs of existing files, not new files).

## Metadata

**Analog search scope:** `functions/api/**`, `docs/**`, `wrangler.toml`, `README.md`,
`../claude-workflow/docs/decisions/**` (cross-repo, explicitly named in CONTEXT.md/RESEARCH.md)
**Files scanned:** `functions/api/backfill/dispatch.ts` (264 lines, full),
`functions/api/backfill/dispatch.test.ts` (553 lines, full),
`functions/api/linear/[[path]].ts` (125 lines, full), `wrangler.toml` (3 lines, full),
`docs/access-setup.md` (185 lines, full), `docs/architecture.md` (63 lines, full),
`README.md` (57 lines, full), `../claude-workflow/docs/decisions/0010-backend-language-routing-go.md`
(90 lines, full)
**Pattern extraction date:** 2026-07-16
