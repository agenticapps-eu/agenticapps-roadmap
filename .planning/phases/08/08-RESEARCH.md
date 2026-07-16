# Phase 8: Deploy, gate & document - Research

**Researched:** 2026-07-16
**Domain:** Cloudflare Pages/Access/KV deployment ops, GitHub fine-grained PAT scoping, GitHub Actions dispatch API, documentation/ADR conventions
**Confidence:** MEDIUM-HIGH (platform mechanics HIGH/CITED; org-specific dashboard steps MEDIUM by nature — cannot be executed from this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Access gating (DEPLOY-02)**
- **D-08-01 (gate the whole domain):** A single Cloudflare Access application covers the
  **entire Pages project** — the app root **and all of `/api/*`** (`/api/backfill/*` **and**
  the read-only `/api/linear/*` proxy). Rationale: D-07-03 makes Access the *sole* write
  authorization for backfill, so `/api/backfill/*` must be gated; gating the read proxy too
  is free protection since the app renders fully from the static `public/roadmap.json` with
  no network — live mode requiring login is an acceptable enhancement, not a regression.
  **Rejected:** leaving `/api/linear/*` public (would expose the live read proxy + its
  rate limiter as the only guard).
- **D-08-02 (allow-list = existing family list):** Reuse the email allow-list already
  established in Phase 3 (`docs/access-setup.md`). No new members captured this session;
  the runbook documents how to add/rotate members. Preview-deployment gating was offered
  and **not** selected — production Access is the gate; note it as a residual hardening
  option if `*.pages.dev` preview URLs later become a concern.

**Token / secret topology (DEPLOY-01)**
- **D-08-03 (single fine-grained PAT, both roles):** One **fine-grained GitHub PAT scoped
  to the 4 `agenticapps-eu` repos** (contents:read for sibling checkout + actions:write to
  dispatch `backfill.yml`) serves **both** roles — bound as the **Pages Function dispatch
  secret** and handed to **CI** for cross-repo checkout. One secret to rotate; fits the
  small trusted setup. **Rejected:** split dispatch-only vs checkout-only tokens
  (least-privilege, but two secrets to manage — revisit only if the audience widens).
- **D-08-04 (LINEAR_API_KEY binding):** `LINEAR_API_KEY` binds in **two** places — a
  **Cloudflare Pages secret** (for the `/api/linear/*` proxy Worker) and a **GitHub Actions
  secret** (for the CI `sync:gsd`/`sync:snapshot` runs). Never in the client bundle or
  `roadmap.json` (CLAUDE.md invariant). The runbook documents rotation in both places.

**v0.1.0 ship gate (DEPLOY-04)**
- **D-08-05 (tag on full live end-to-end):** `v0.1.0` is tagged only after the **load-bearing
  `07-HUMAN-UAT.md` items pass for real**: deploy live, Access gating verified end-to-end, a
  real **preview→apply backfill** (git push to `main` + Linear write) succeeds, and a
  **scheduled `snapshot.yml` cron** run fires and commits on `main`. This is what "gating
  verified end-to-end" + "snapshot auto-refreshes" in the success criteria require.
  `package.json` `version` is already `0.1.0`, so tagging is the remaining act.

**CR-01 hardening (carried from Phase 7 code review)**
- **D-08-06 (add KV nonce this phase):** Add a **Cloudflare KV binding** to `wrangler.toml`
  and a **consume-once nonce** in `functions/api/backfill/dispatch.ts`, so a `previewRunId`
  can authorize **exactly one** apply — closing CR-01's replay gap **before** the write path
  first goes live. This supersedes the current recency-only mitigation (15-min bound stays as
  defense-in-depth). Resolves `07-HUMAN-UAT.md` item #13. **Rejected:** ship recency-only and
  defer the nonce (a recent-but-reused preview could authorize multiple applies in-window).

### Claude's Discretion
- Runbook/README structure and ADR prose (DEPLOY-03/04) — standard doc craft; the ADR records
  the hosting choice (Cloudflare Pages + Functions) and the sync architecture (CI-dispatch
  write path, D-07-01). ADR lands in a new `docs/decisions/` directory.
- KV namespace/binding naming, nonce TTL, and the exact dispatch.ts nonce mechanism —
  implementation detail for research/planning.

### Deferred Ideas (OUT OF SCOPE)
- **Public GitHub Pages mirror of the static snapshot** — listed as "optional" in the old stub;
  not part of the private-URL-behind-Access v0.1.0 goal. Revisit as its own small phase if a
  public read-only view is ever wanted.
- **Preview-deployment (`*.pages.dev`) Access gating** — offered, not selected; residual
  hardening option if ungated preview URLs become a concern.
- **Split least-privilege tokens** (dispatch-only vs checkout-only PATs) — deferred in favor
  of the single PAT (D-08-03); revisit if the Access audience widens.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|---------------------|
| DEPLOY-01 | Repo connected to Cloudflare Pages with production + preview builds and `LINEAR_API_KEY` bound. | No Cloudflare Pages project exists yet (confirmed via `wrangler pages project list`) — this is a from-scratch dashboard task, not a verification. See Environment Availability + Code Examples for the exact binding/secret steps and the two-secret-name PAT pattern. |
| DEPLOY-02 | Cloudflare Access policy (email allow-list) applied and gating verified end-to-end. | `docs/access-setup.md` already documents the mechanism (D-08-01/02 reuse it); this research confirms Access blocks at the edge before the Function runs (no in-app JWT code needed) and provides the extended curl checks covering `/api/backfill/*` in Code Examples. |
| DEPLOY-03 | README + `docs/runbook.md` cover deploy, token rotation, snapshot refresh, and backfill. | `docs/runbook.md` does not exist yet (confirmed). Sources section links the ADR/runbook format precedent (`claude-workflow/docs/decisions/`) and this research's Pitfalls/Pattern sections enumerate the exact rotation/troubleshooting content the runbook needs (two-secret-name PAT, KV nonce TTL, merge-to-main prerequisite). |
| DEPLOY-04 | `v0.1.0` tagged with an ADR recording the hosting/sync decision. | `docs/decisions/` does not exist yet (confirmed). Architecture Patterns + Sources sections give the exact ADR header/section format to mirror (Status/Date/Linear/Phase; Context/Decision/Alternatives Rejected/Consequences), sourced from a real sibling-repo ADR read this session. |
| D-08-06 (CR-01 nonce, carried decision) | Cloudflare KV binding + consume-once nonce in `dispatch.ts` so a `previewRunId` authorizes exactly one apply. | Pattern 1/2 in this document give the concrete check-then-set design, wrangler.toml syntax, TTL rationale (matches existing 15-min recency bound), and a fully-testable mock pattern extending `dispatch.test.ts`. Pitfall 4 documents the accepted KV-consistency risk. |
</phase_requirements>

## Summary

Phase 8 is overwhelmingly a **verification and secrets-wiring** phase, not a build
phase — with one real code change (D-08-06's KV consume-once nonce). Research
surfaced one **load-bearing operational gap that blocks every live-verification
item**: `origin/main` is 154 commits behind this branch and is **missing
`backfill.yml`, `functions/api/backfill/*`, and the KV-ready `wrangler.toml`**
entirely. `dispatch.ts` hardcodes `ref: "main"` for every `workflow_dispatch` call,
and GitHub's `schedule:` cron trigger **only fires for workflow files present on the
default branch** — so nothing in `07-HUMAN-UAT.md`'s 13-item checklist (dispatch,
apply, or a real cron fire) can succeed until this branch is merged to `main`. No
Cloudflare Pages project named `agenticapps-roadmap` exists yet either (confirmed via
`wrangler pages project list`), so DEPLOY-01's "connect the repo" is a from-scratch
dashboard action, not a verification of an existing connection.

The KV consume-once nonce (D-08-06) is best implemented as a **check-then-set
idempotency-key pattern** (not read-then-delete): on the `apply` branch of
`dispatch.ts`, after `isValidPreviewRun` passes, check `env.<KV>.get(key)`; if a value
exists, reject 403 (already consumed); otherwise `put()` a consumed marker with a TTL
matching the existing 15-minute recency bound before proceeding to the real GitHub
dispatch call. Cloudflare KV has no compare-and-swap primitive, so a narrow
same-millisecond double-request race is an accepted, documented risk appropriate to
the single-trusted-user allow-list threat model — this matches CR-01's actual concern
(accidental/naive reuse across the 15-minute window), not a sophisticated concurrent
attacker. The pattern is fully unit-testable with the same plain-object `env` mock
already used in `dispatch.test.ts` — no Miniflare/`wrangler dev` dependency required
for the automated test suite.

Two research findings materially change the risk picture from `07-REVIEW.md`:
**WR-05 is resolved** — GitHub shipped `return_run_details` as a real, documented
`workflow_dispatch` parameter on 2026-02-19 (before Phase 8's current date), so
`dispatch.ts`'s 200-branch is live code, not dead code, and Phase 8's HUMAN-UAT item
#9 should confirm 200. And the **fine-grained PAT's permission set is uniform across
all 4 selected repos** — GitHub does not support per-repo permission levels within one
fine-grained token, so "Actions: write on `agenticapps-roadmap` only" (as phrased in
`07-HUMAN-UAT.md`) is not literally achievable; the single PAT (D-08-03) will grant
Actions:write to all 4 repos, which is an accepted trade-off of that decision, not a
new risk this research introduces.

**Primary recommendation:** Sequence Phase 8 as (1) merge this branch to `main` via
PR first — nothing downstream works without it: (2) create the Cloudflare Pages
project + KV namespace + bind all three secret types via dashboard; (3) implement and
unit-test the KV nonce in `dispatch.ts`; (4) run the `07-HUMAN-UAT.md` checklist for
real against the now-live `main` deployment; (5) write the runbook/ADR and tag
`v0.1.0` only after every load-bearing UAT item passes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Access gating (app root + `/api/*`) | CDN / Edge (Cloudflare Access) | — | Access blocks at the edge before any Function/asset is served; no in-app JWT verification code is needed or should be added (matches existing `/api/linear/*` "Access is primary auth" comment pattern). |
| Consume-once nonce state | Database / Storage (Cloudflare KV) | API / Backend (`dispatch.ts` reads/writes it) | KV is the only storage primitive D-08-06 authorizes; the Function tier owns the check-then-set logic, KV owns the durable "consumed" fact. |
| GitHub PAT (dispatch + checkout) | API / Backend (Pages Function secret) + CI (GitHub Actions secret) | — | Same token value, two independent secret stores — Cloudflare holds the copy the Function reads, GitHub Actions holds the copy CI reads. Neither tier can read the other's copy. |
| `LINEAR_API_KEY` | API / Backend (Pages Function secret) + CI (GitHub Actions secret) | — | Existing dual-binding pattern (Phase 2/3), unchanged by Phase 8 except that both must now actually be *set*, not just documented. |
| Scheduled snapshot refresh | CI / Backend (GitHub Actions cron) | — | Confirmed in Phase 7 research: Cloudflare Pages/Workers cron cannot commit to git; CI is the only tier that can write `roadmap.json` back to the repo. |
| Documentation (README/runbook/ADR) | N/A (repo docs) | — | Not an application tier; a deliverable artifact. |

## Standard Stack

No new npm/PyPI/cargo packages are introduced by this phase. The only new
infrastructure primitive is a **Cloudflare KV namespace**, which is a platform
binding declared in `wrangler.toml` — not a package dependency, so the Package
Legitimacy Gate protocol (slopcheck / registry verification) does not apply.

### Core (existing, unchanged)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|---------------|
| Cloudflare Pages | n/a (platform) | Static host + Pages Functions | Locked by Phase 1/3 architecture decision; unchanged this phase. |
| Cloudflare Access (Zero Trust) | n/a (platform) | Edge-level auth gate | Locked by D-08-01/02; existing `docs/access-setup.md` runbook already covers setup mechanics. |
| Cloudflare KV | n/a (platform) | Consume-once nonce store | New this phase per D-08-06. `[VERIFIED: Cloudflare docs]` — binding syntax confirmed via `developers.cloudflare.com/pages/functions/wrangler-configuration/` and `kv/get-started/`. |
| wrangler | `^4` (already pinned via `npx --yes wrangler@4` in existing scripts) | Local Pages/KV dev, secret/namespace creation CLI | Already the project's pattern (`preview:functions` script); reused for `wrangler kv namespace create` and `wrangler pages secret put`. |
| GitHub REST API (Actions) | `2022-11-28` (already pinned via `X-GitHub-Api-Version` header in `dispatch.ts`/`status.ts`) | `workflow_dispatch`, run/job/log reads | Unchanged; `return_run_details` confirmed live on this API version as of 2026-02-19. |

### Installation

No `npm install` needed. Infrastructure commands only (run once, out-of-band, during
Phase 8 execution — not part of `pnpm install`):

```bash
# Create the KV namespace (production). Cloudflare account already authenticated
# in this environment (`wrangler kv namespace list` returned `[]` — none exist yet).
npx --yes wrangler@4 kv namespace create BACKFILL_NONCE
# -> prints an id; add it to wrangler.toml's new [[kv_namespaces]] block.
```

**Version verification performed this session:**
```bash
$ npx --yes wrangler@4 pages project list   # confirms wrangler auth works
$ npx --yes wrangler@4 kv namespace list    # -> [] (no namespaces exist yet)
$ npx --yes wrangler@4 pages project list | grep agenticapps-roadmap  # -> no match, exit 1
```
**Finding:** No Cloudflare Pages project named `agenticapps-roadmap` exists yet.
DEPLOY-01's "connect the repo" is a **from-scratch** dashboard action (Pages →
Create application → Connect to Git), not a verification of prior work.
`[VERIFIED: wrangler CLI, this session]`

## Package Legitimacy Audit

**Not applicable this phase.** No new npm/PyPI/cargo packages are installed. The only
new dependency is a Cloudflare-platform KV namespace binding, which is not a
registry package and is not in scope for the slopcheck/registry verification
protocol.

## Architecture Patterns

### System Architecture Diagram — request path after Phase 8

```
                         Unauthenticated request
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │  Cloudflare Access (edge)  │  ── D-08-01: gates app root
                    │  email allow-list check    │     AND /api/* as ONE app
                    └─────────────┬─────────────┘
                     no session   │  valid session
                          │       │
                          ▼       ▼
                    302/403   ┌─────────────────────────────┐
                    (blocked) │ Cloudflare Pages / Functions │
                              └───────┬──────────┬──────────┘
                                      │          │
                     GET /api/linear/*│          │ POST/GET /api/backfill/*
                                      ▼          ▼
                        ┌──────────────────┐  ┌────────────────────────────┐
                        │ [[path]].ts       │  │ dispatch.ts / status.ts     │
                        │ LINEAR_API_KEY    │  │ GH_BACKFILL_TOKEN           │
                        │ (Pages secret)    │  │ (Pages secret)              │
                        │ → Linear GraphQL  │  │ → GitHub Actions REST API   │
                        └──────────────────┘  └───────────┬────────────────┘
                                                            │ mode=apply
                                                            ▼
                                                  ┌──────────────────────┐
                                                  │ BACKFILL_NONCE (KV)   │  ← D-08-06 NEW
                                                  │ get(previewRunId)     │
                                                  │  exists → 403         │
                                                  │  absent → put + go    │
                                                  └───────────┬──────────┘
                                                              │
                                                              ▼
                                        POST .../workflows/backfill.yml/dispatches
                                        { ref: "main", inputs: {...},
                                          return_run_details: true }
                                                              │
                                                              ▼
                                   GitHub Actions runs backfill.yml on `main`
                                   (requires backfill.yml to EXIST on main —
                                    see Pitfall 1)
                                                              │
                            checks out agenticapps-roadmap + 3 sibling repos
                            (GH_CROSS_REPO_TOKEN, same PAT value, different name)
                                                              │
                                sync-gsd-linear CLI --apply --yes
                                (LINEAR_API_KEY, GitHub Actions secret)
                                                              │
                                    writes Linear + commits roadmap.json
                                    + linear-map.json to main
                                    (shared roadmap-git-writer concurrency
                                     group with snapshot.yml)
```

### Pattern 1: Consume-once nonce as check-then-set idempotency key (D-08-06)

**What:** Instead of a read-then-delete "ticket," treat the `previewRunId` as an
idempotency key. On the `apply` branch of `dispatch.ts`, after the existing
`isValidPreviewRun` check passes, do a `get` on a KV key derived from
`previewRunId`; if present, the run was already consumed → 403. If absent, `put` a
consumed marker (short TTL) before issuing the real GitHub dispatch call.

**Why check-then-set over read-then-delete:** A delete-based "ticket" design has the
same TOCTOU race as check-then-set (two concurrent reads could both see the ticket
present before either deletes it), but adds no benefit for this threat model and
requires an extra network round-trip. Check-then-set is the standard idempotency-key
idiom and matches KV's actual capabilities (no CAS; `put`/`delete`/`get` only).
`[CITED: developers.cloudflare.com/kv/api/write-key-value-pairs/]` confirms `put()`'s
`expirationTtl` (minimum 60s) is the only built-in expiry mechanism — no atomic
"put-if-absent."

**When to use:** Any single-trusted-audience write-authorization gate where the
audience is small and named (matches D-07-03's rationale for Access-only write auth)
and a rare, narrow race window is an acceptable residual risk — not for
multi-tenant or adversarial-audience authorization.

**Example (dispatch.ts patch shape):**
```ts
// Env interface addition:
interface Env {
  GH_BACKFILL_TOKEN: string;
  BACKFILL_NONCE: KVNamespace; // D-08-06
}

const NONCE_TTL_SECONDS = 900; // matches MAX_PREVIEW_AGE_MS (15 min) — a nonce
// entry never needs to outlive the recency bound that already rejects the
// previewRunId on its own.

// Inside the mode === "apply" branch, immediately after isValidPreviewRun passes:
const nonceKey = `previewRunId:${previewRunId}`;
const consumed = await env.BACKFILL_NONCE.get(nonceKey);
if (consumed !== null) {
  return textResponse("preview already applied", 403);
}
// Claim before dispatching — narrows (does not eliminate) the TOCTOU window.
// Accepted risk for a single-trusted-user email allow-list (D-08-02); a
// stronger primitive (D1 transaction, Durable Object) is explicitly out of
// scope per phase context.
await env.BACKFILL_NONCE.put(nonceKey, "1", { expirationTtl: NONCE_TTL_SECONDS });
```

**Test pattern (extends existing `dispatch.test.ts` mock style — no Miniflare
needed):**
```ts
function ctx(body: Record<string, unknown>, kvOverrides: Partial<Record<string, string>> = {}) {
  const store = new Map<string, string>(Object.entries(kvOverrides));
  const kv = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
  };
  const env = { GH_BACKFILL_TOKEN: TEST_TOKEN, BACKFILL_NONCE: kv };
  const request = new Request("https://x/api/backfill/dispatch", { method: "POST", body: JSON.stringify(body) });
  return { request, env } as unknown as Parameters<typeof onRequestPost>[0];
}
// New test cases to add: (1) second apply with the same previewRunId → 403,
// after the first apply's KV put(); (2) two DIFFERENT previewRunIds both succeed.
```

### Pattern 2: wrangler.toml KV binding for Pages

`[CITED: developers.cloudflare.com/pages/functions/wrangler-configuration/,
developers.cloudflare.com/kv/get-started/]`

```toml
name = "agenticapps-roadmap"
compatibility_date = "2025-01-01"
pages_build_output_dir = "dist"

[[kv_namespaces]]
binding = "BACKFILL_NONCE"
id = "<NAMESPACE_ID_FROM_wrangler_kv_namespace_create>"
```

A single top-level `[[kv_namespaces]]` block (no `[env.production]`/`[env.preview]`
split) is consistent with this repo's existing wrangler.toml (no env-scoped blocks
today) and with D-08-02's choice to defer preview-environment Access gating — one
namespace ID applies to both Production and Preview Pages deployments unless a
`--preview` counterpart namespace is explicitly created later. Cloudflare's
`kv_namespaces` docs note that *if* per-environment overrides are introduced later,
*all* bindings must then be specified per-environment — not a concern for this
phase's scope (only one KV binding is being added).

**Local dev:** `wrangler pages dev dist --kv=BACKFILL_NONCE` (or the existing
`preview:functions` script, once the binding exists in `wrangler.toml`) gives a
Miniflare-local KV emulation automatically — no live Cloudflare KV round-trip needed
for `pnpm dev`/local smoke testing.

### Pattern 3: PAT stored under two secret names, one value

`[ASSUMED — derived from D-08-03 + confirmed GitHub fine-grained PAT constraints]`

Create **one** fine-grained PAT (org: `agenticapps-eu`; repos: `agenticapps-roadmap`,
`claude-workflow`, `cparx`, `fx-signal-agent`; permissions: `Contents: Read`,
`Actions: Read and write` — uniform across all 4, see Pitfall 3). Paste the **same
token value** into:
1. Cloudflare Pages → Settings → Environment Variables → `GH_BACKFILL_TOKEN`
   (Production, encrypted).
2. GitHub → `agenticapps-roadmap` → Settings → Secrets → Actions →
   `GH_CROSS_REPO_TOKEN` (already referenced by `backfill.yml`'s sibling checkout
   steps — confirmed via `git ls-tree`/`Read` this session; not yet set —
   `gh secret list` shows only `LINEAR_API_KEY` bound today).

### Anti-Patterns to Avoid
- **Adding in-app JWT verification for Access:** Not needed. Access blocks
  unauthenticated requests at the edge before the Function runs; the existing
  `/api/linear/*` comment ("Access is primary auth") already establishes this
  pattern. Adding `jose`/JWKS verification code would be new, unrequested surface
  area contradicting CLAUDE.md's simplicity principle and the phase's "no new
  product capability" framing.
- **Split PAT into dispatch-only + checkout-only tokens:** Explicitly rejected by
  D-08-03; do not silently reintroduce it during planning.
- **Read-then-delete nonce:** Technically valid but no safer than check-then-set for
  this threat model (see Pattern 1) and costs an extra round-trip; do not plan it as
  a "more correct" alternative.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Access-session verification | Custom JWT/cookie parsing in a Pages Function | Cloudflare Access edge gate (already the architecture) | Access already blocks unauthenticated traffic before the Function executes; verifying it again in-app is redundant surface area with no security benefit for this phase's scope. |
| Idempotency/nonce storage | A custom SQLite/file-based store, or Durable Objects | Cloudflare KV (`get`/`put` + `expirationTtl`) | D-08-06 explicitly scopes the fix to KV; D1/DO are out of scope per phase context guidance. |
| GitHub run polling backoff | A new polling library | Existing `pollBackfillStatus` in `src/lib/backfill/backfill.ts` (07-03, already TDD'd) | Unchanged by Phase 8 — this phase verifies it against a real run, it does not rebuild it. |

**Key insight:** Nearly everything Phase 8 needs already exists in code from Phases
3/6/7. The only genuinely new code is the ~10-line KV check-then-set block in
`dispatch.ts`. Resist the temptation to "harden" adjacent code while touching this
file — CLAUDE.md's Surgical Changes rule applies directly.

## Runtime State Inventory

Not applicable — this is a deploy/verification phase, not a rename/refactor/migration
phase.

## Common Pitfalls

### Pitfall 1: `origin/main` is missing the code this phase must verify — nothing works until it's merged

**What goes wrong:** Every item in `07-HUMAN-UAT.md`'s checklist (dispatch, apply,
scheduled cron) will fail or be impossible to attempt, because `backfill.yml`,
`functions/api/backfill/*`, and the KV-ready `wrangler.toml` do not exist on `main`
yet — confirmed this session via `git ls-tree -r origin/main` (no
`functions/api/backfill`, no `backfill.yml`) and `git rev-list --count
origin/main..HEAD` (154 commits ahead, no open PR via `gh pr list`).
**Why it happens:** `dispatch.ts` hardcodes `ref: "main"` for every
`workflow_dispatch` call (line: `body: JSON.stringify({ ref: "main", ... })`), and
GitHub's `schedule:` trigger **only evaluates workflow files present on the
repository's default branch** — a scheduled cron on a feature branch is silently
never evaluated, confirmed via GitHub Community discussions and
`latchkey.dev`/community threads. Cloudflare Pages' "production branch" (the branch
that maps to the production, Access-gated domain) is also conventionally `main`.
**How to avoid:** Sequence Phase 8's plan so an early task/wave merges this feature
branch to `main` via PR **before** any HUMAN-UAT dispatch/apply/cron item is
attempted. This is a hard ordering dependency, not a nice-to-have — treat it as a
Wave 0/1 blocking task.
**Warning signs:** Any HUMAN-UAT attempt that returns "workflow not found" from the
GitHub dispatch API, or a cron that "never fires," is very likely just this — check
`git log origin/main` before debugging application code.

### Pitfall 2: Fine-grained PAT permission is uniform across all selected repos — cannot restrict `Actions: write` to one repo among four

**What goes wrong:** `07-HUMAN-UAT.md`'s phrasing ("Actions: write on
`agenticapps-roadmap` only... Contents: read on all 4 repos") describes a
per-repo-scoped permission set that GitHub's fine-grained PAT model does not support.
**Why it happens:** `[CITED: docs.github.com/en/authentication/.../managing-your-personal-access-tokens]`
— a fine-grained PAT applies **one uniform permission set** to every repository
selected in its "Repository access" list; it cannot grant `Actions: write` to one
repo and only `Contents: read` to others within the same token. Fine-grained PATs are
also restricted to a single resource owner (here, the `agenticapps-eu` org — all 4
repos are confirmed same-org, so this constraint is satisfiable, just not the
per-repo split).
**How to avoid:** Accept and document the actual grant: the PAT will have
`Contents: Read` + `Actions: Read and write` on **all 4** repos, not just
`agenticapps-roadmap`. This is a direct, accepted consequence of D-08-03's
single-PAT decision (rejecting split tokens) — the runbook should say so explicitly
rather than implying a tighter scope than what's actually configured. The
application-level mitigation is that `dispatch.ts`/`status.ts` hardcode
`REPO = "agenticapps-eu/agenticapps-roadmap"` — the token's broader capability is
never exercised by the app itself, only by whoever holds the raw token value.
**Warning signs:** A future security review noting the PAT "can dispatch workflows
on sibling repos it shouldn't need to" — this is expected and was already traded off
in D-08-03, not a new finding to re-litigate.

### Pitfall 3: GitHub Actions schedule cron can take 15–60+ minutes to be recognized after a workflow file changes

**What goes wrong:** Immediately after merging `snapshot.yml` (unchanged) to `main`
and expecting the 06:00 UTC cron to fire, a same-day verification attempt may
conclude "the cron doesn't work" when it simply hasn't been picked up yet, or the
06:00 UTC window hasn't occurred yet in the verification session.
**Why it happens:** `[CITED: WebSearch — GitHub Community discussions, multiple
threads]` GitHub can take 15 minutes to over an hour to recognize a new/changed
cron schedule; also, repositories with no recent activity can have scheduled
workflows silently disabled (this repo is active daily, so this specific sub-case
is unlikely but worth a plan-time awareness note).
**How to avoid:** Do not treat "no cron fire observed within the same session" as a
failure. Plan HUMAN-UAT item #11 (real scheduled fire) as a check that may need to
be revisited on a **subsequent day**, or use `workflow_dispatch` to prove the
mechanism works today and treat the very next 06:00 UTC natural firing as the actual
proof — record the date/time of the observed run.
**Warning signs:** A HUMAN-UAT session that tries to force-prove the cron within
minutes of merging.

### Pitfall 4: Cloudflare KV lacks compare-and-swap — the nonce is best-effort, not cryptographically atomic

**What goes wrong:** Assuming the check-then-set (or any read/write) KV pattern
gives the same guarantee as a database transaction or Durable Object lock.
**Why it happens:** `[CITED: developers.cloudflare.com/kv/concepts/how-kv-works/,
Cloudflare Community threads]` KV is eventually consistent; even same-location
read-after-write is "not guaranteed" per Cloudflare's own docs, and there is no
atomic "put-if-absent" operation.
**How to avoid:** Document this explicitly in the ADR/runbook as an accepted,
scoped risk (small trusted allow-list, CR-01's actual concern is naive/accidental
reuse within a 15-minute window, not a sophisticated race attacker) rather than
silently presenting the nonce as a hard guarantee. If the audience or threat model
ever widens, D1 (transactional) or a Durable Object (single-threaded) would be the
correct escalation — explicitly out of scope for this phase.
**Warning signs:** A future reviewer treating the nonce as bulletproof and building
new trust assumptions on top of it.

## Code Examples

### Verifying Access enforcement (extends `docs/access-setup.md`'s existing pattern to `/api/backfill/*`)

```bash
# Source: docs/access-setup.md §4 (existing pattern), extended per D-08-01's
# single-app-covers-everything scope — no new mechanism, same checks, more paths.
curl -sS -o /dev/null -w "%{http_code}\n" https://<deployed-domain>/api/backfill/dispatch
# expect: 302 or 403 (Access redirect/block) — NEVER 200/400/500 from the Function itself
curl -sS -o /dev/null -w "%{http_code}\n" https://<deployed-domain>/api/backfill/status
# expect: 302 or 403
```

### Creating the KV namespace and wiring the binding

```bash
# Source: developers.cloudflare.com/kv/get-started/ (CITED)
npx --yes wrangler@4 kv namespace create BACKFILL_NONCE
# -> { binding = "BACKFILL_NONCE", id = "<printed id>" }
# Paste the printed id into wrangler.toml's new [[kv_namespaces]] block (see Pattern 2).
```

### Confirming the `return_run_details` 200-branch is live (HUMAN-UAT item #9, now expected-pass)

```bash
# Source: docs.github.com/en/rest/actions/workflows (CITED) + github.blog changelog
# 2026-02-19 (VERIFIED live as of this research date, 2026-07-16 — feature predates
# Phase 8 by ~5 months, so it is NOT a bleeding-edge/unreleased assumption anymore).
curl -sS -X POST \
  -H "Authorization: Bearer $GH_BACKFILL_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/agenticapps-eu/agenticapps-roadmap/actions/workflows/backfill.yml/dispatches \
  -d '{"ref":"main","inputs":{"project":"claude-workflow","mode":"dry-run","correlation_id":"test-1"},"return_run_details":true}' \
  -w "\n%{http_code}\n"
# Expected: 200 with a JSON body containing workflow_run_id/run_url/html_url
# (dispatch.ts's isWorkflowRunIdResponse branch). If 204 is observed instead,
# re-open WR-05 as a real bug — the client's previewRunId would never populate.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|----------------|--------|
| `workflow_dispatch` always returns `204 No Content`, run id recovered only via correlation-ID polling of the runs list | `return_run_details: true` in the dispatch request body returns `200` with `{ workflow_run_id, run_url, html_url }` directly | 2026-02-19 (GitHub changelog) | `dispatch.ts`'s 200-branch (previously flagged WR-05 as an unverified assumption / possible dead code) is now confirmed live functionality — no code change needed, just live verification. `[CITED: github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids/, docs.github.com/en/rest/actions/workflows]` |

**Deprecated/outdated:** Nothing else in this phase's stack has moved since Phase
3/6/7's research — Cloudflare Pages/Access/KV mechanics and fine-grained PAT model
are stable as documented.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | A single top-level `[[kv_namespaces]]` block (no per-environment split) is the correct wrangler.toml shape given this repo has no existing `[env.*]` blocks | Pattern 2 | If Cloudflare actually requires an explicit Preview-environment KV binding to be separately configured in the dashboard (not just wrangler.toml) for the Preview *.pages.dev deployments, local `wrangler pages dev` KV emulation would still work but a real Preview deployment's `/api/backfill/*` route could 500 on missing binding. Low practical impact since D-08-02 already excludes Preview from the scope Phase 8 must prove. |
| A2 | Binding name `BACKFILL_NONCE` and TTL `900` seconds are reasonable defaults | Pattern 1/2 | Purely cosmetic/tuning — CONTEXT.md explicitly delegates this naming/TTL choice to "Claude's Discretion," so this is a proposal, not a hard requirement. |
| A3 | The GitHub fine-grained PAT correctly needs `Contents: Read` + `Actions: Read and write` (not `Actions: Write` alone, since `status.ts` needs read on runs/jobs/logs too) | Pitfall 2, Pattern 3 | If under-scoped, `status.ts` polling would 403/502 against real GitHub calls — caught immediately by HUMAN-UAT item 4 (dry-run preview) and easy to fix (re-issue token with corrected permission). |
| A4 | Cloudflare Pages "production branch" for this not-yet-created project should be set to `main` during setup | Summary/Pitfall 1 | If set to a different branch, Access gating + production deploy would target the wrong branch; standard Cloudflare Pages convention and this repo's existing `git-integration` assumption (README/`.github/workflows` all reference `main`) make this a very low-risk assumption but it is a dashboard choice made during setup, not something this session could execute or verify directly. |

## Open Questions (RESOLVED)

> All three questions are resolved by Phase-8 plan tasks; each carries an inline RESOLVED note below.

1. **Will the real `POST .../dispatches` call actually return 200 with `workflow_run_id` for this specific org/repo/PAT combination?**
   - RESOLVED: closed by 08-03 Task 3 (07-HUMAN-UAT item #9) — the plan records the observed live status (200 with `workflow_run_id`, or 204 correlationId fallback) against the real org/repo/PAT; also logged in 08-VALIDATION.md.
   - What we know: The feature is documented and GA as of 2026-02-19 per GitHub's official changelog and REST reference. `dispatch.ts` already codes for both branches (200 and 204 fallback via correlationId).
   - What's unclear: Whether any account/plan-tier restriction applies (not found in available docs), and whether the fine-grained PAT's scopes affect this response shape (unlikely, but unverified).
   - Recommendation: Treat as HIGH-confidence-expected-200, but keep HUMAN-UAT item #9 in the plan as the actual live confirmation — do not skip it on the strength of this research alone.

2. **Does Cloudflare Pages require a separate dashboard-side KV binding configuration for the Preview environment, independent of `wrangler.toml`?**
   - RESOLVED: deprioritized per D-08-02 (preview-scope exclusion). Preview builds only render the static app (no live secrets bound, no `/api/*` dependency) — a security consequence of D-08-02 + D-08-04 + the single-`[[kv_namespaces]]`-binding fact (Assumption A1), not a separate decision. 08-03 Task 2 proves the preview build serves the static app at a `*.pages.dev` URL with the single top-level `[[kv_namespaces]]` block; no separate Preview KV entry is required for this phase's scope.
   - What we know: Pages docs describe dashboard-based binding configuration "for production and preview environments" as one path, and wrangler.toml as another; the two are not fully documented as mutually exclusive or as automatically syncing.
   - What's unclear: Whether a wrangler.toml-declared `[[kv_namespaces]]` block (no env split) automatically applies to a Pages project's Preview deployments too, or whether the dashboard needs an explicit second entry.
   - Recommendation: Since D-08-02 defers Preview-environment Access gating anyway (Preview URLs are out of this phase's proof scope), this is low-priority — verify only if a Preview-deployment KV error surfaces during setup; do not block the phase on it.

3. **Does the existing `docs/access-setup.md` Access-application setup need to be re-created for this not-yet-existing Pages project, or does gating happen only after the project exists?**
   - RESOLVED: 08-03 Task 2 treats Access-application creation as genuinely NEW work (step 4), sequenced after Pages-project creation — not a "verify existing" step.
   - What we know: `docs/access-setup.md` was written against Phase 3's plan when a Pages project was assumed to already exist (Phase 3 deferred its own Access proof to Phase 8, per `STATE.md`).
   - What's unclear: Whether the Access application referenced in that doc was ever actually created in the Cloudflare dashboard, given no Pages project exists yet (an Access "Self-hosted" application needs a domain to target, which needs the Pages project to exist first).
   - Recommendation: Treat Access application creation as a genuinely new Phase 8 task (not "verify existing"), sequenced after Pages project creation, even though the runbook text already exists.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Cloudflare account access (wrangler auth) | Pages project creation, KV namespace creation, secret binding | ✓ (confirmed via `wrangler pages project list`, `wrangler kv namespace list` this session) | wrangler 4.111.0 | — |
| `agenticapps-roadmap` Cloudflare Pages project | DEPLOY-01, DEPLOY-02 | ✗ (confirmed absent this session) | — | None — must be created; this is a genuine Phase-8 task, not pre-existing infra. |
| Cloudflare KV namespace for the nonce | D-08-06 | ✗ (confirmed absent — `wrangler kv namespace list` returned `[]`) | — | None — must be created (`wrangler kv namespace create`). |
| GitHub fine-grained PAT (`GH_BACKFILL_TOKEN`/`GH_CROSS_REPO_TOKEN`) | LIVE-02/DEPLOY-01 | ✗ (confirmed — `gh secret list` shows only `LINEAR_API_KEY` bound today) | — | None — must be created and bound in two places. |
| `LINEAR_API_KEY` GitHub Actions secret | LIVE-03/DEPLOY-01 | ✓ (`gh secret list` shows `LINEAR_API_KEY` set 2026-06-27) | — | Already bound; only the Cloudflare Pages-side binding is outstanding. |
| `origin/main` containing Phase 3/6/7 code | ALL HUMAN-UAT items | ✗ (154 commits behind; missing `backfill.yml`, `functions/api/backfill/*`) | — | None — merge required; see Pitfall 1. |
| `actionlint` (recommended by `07-HUMAN-UAT.md` as a pre-flight validator) | Optional pre-flight check on `snapshot.yml`/`backfill.yml` | Not probed this session (no local install check run) | — | Skippable — nice-to-have, not blocking; the structural checks in `07-HUMAN-UAT.md` Task 1 already substitute for it. |

**Missing dependencies with no fallback:**
- Cloudflare Pages project, KV namespace, both PAT secret bindings, and the
  `main`-branch merge are all hard prerequisites with no substitute — they are the
  actual work of this phase, not external blockers to route around.

## Validation Architecture

### Test Framework
| Property | Value |
|-----------|-------|
| Framework | Vitest (existing, `vitest.config.ts` at repo root) |
| Config file | `vitest.config.ts` — `include: ["scripts/**/*.test.ts", "functions/**/*.test.ts", "src/**/*.test.ts"]` |
| Quick run command | `CI=true npx vitest run functions/api/backfill/dispatch.test.ts` (per this project's documented `pnpm test` non-TTY workaround) |
| Full suite command | `CI=true npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| DEPLOY-01 | Repo connected to Pages with prod+preview builds, `LINEAR_API_KEY` bound | manual-only (dashboard state, no code path) | — (curl smoke: `curl -sS -o /dev/null -w "%{http_code}\n" https://<domain>/`) | N/A — infra state, not testable in-repo |
| DEPLOY-02 | Access policy applied, gating verified end-to-end | manual-only (live curl against deployed domain) | `curl` checks per `docs/access-setup.md` §4, extended to `/api/backfill/*` | N/A |
| DEPLOY-03 | README + runbook.md cover deploy/rotation/refresh/backfill | manual-only (doc review) | — | ❌ `docs/runbook.md` does not exist — Wave 0 gap |
| DEPLOY-04 | v0.1.0 tagged with hosting/sync ADR | manual-only (git tag + doc) | `git tag -l v0.1.0` | ❌ `docs/decisions/` directory does not exist — Wave 0 gap |
| D-08-06 (nonce) | `previewRunId` authorizes exactly one apply | unit | `CI=true npx vitest run functions/api/backfill/dispatch.test.ts -t "previewRunId"` | ❌ new test cases — Wave 0/1 gap, extends existing `dispatch.test.ts` |
| 07-HUMAN-UAT items 1–13 | Live dispatch/apply/cron/Access proof | manual-only (live, real GitHub/Cloudflare calls) | See `07-HUMAN-UAT.md`'s per-item checklist | N/A — inherently human-executed against production |

### Sampling Rate
- **Per task commit:** `CI=true npx vitest run functions/api/backfill/dispatch.test.ts` (nonce logic only — fast, isolated).
- **Per wave merge:** `CI=true npx vitest run` (full suite — confirms no regression in the untouched proxy/status/client code).
- **Phase gate:** Full suite green **and** every `07-HUMAN-UAT.md` item recorded PASS (this phase's actual completion bar per D-08-05) before `v0.1.0` is tagged.

### Wave 0 Gaps
- [ ] `docs/runbook.md` — does not exist; DEPLOY-03 creates it.
- [ ] `docs/decisions/` directory + first ADR — does not exist; DEPLOY-04 creates it. Mirror the format found at `claude-workflow/docs/decisions/0010-*.md` (Status/Date/Linear/Phase header; Context/Decision/Alternatives Rejected/Consequences sections).
- [ ] New test cases in `functions/api/backfill/dispatch.test.ts` for the KV nonce (currently zero KV-related tests exist — `env` mocks in this file today have no `BACKFILL_NONCE` field at all).
- [ ] `.planning/phases/08/08-LIVE-PROOF.md` (or extend `07-HUMAN-UAT.md` in place) — the proof-file artifact for recording PASS/FAIL against each of the 13 checklist items, per that file's own suggested convention (mirrors `03-ACCESS-PROOF.md`'s naming).

*Human-only validation dominates this phase by design — it is a live-deploy
verification phase. The one genuinely automatable slice (the KV nonce) should get
real unit test coverage; do not let "this phase is mostly manual" become an excuse
to skip the automatable 10% of it.*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|-----------------|---------|---------------------|
| V2 Authentication | Yes | Cloudflare Access (Zero Trust) email allow-list — edge-level, no in-app session/password code (unchanged from Phase 3). |
| V3 Session Management | Yes (delegated) | Access session cookie/JWT lifecycle is entirely Cloudflare-managed; no app-level session code exists or should be added (see Anti-Patterns). |
| V4 Access Control | Yes | (a) Access allow-list gates all routes uniformly (D-08-01); (b) `dispatch.ts`'s server-side project/mode allow-list (existing, Phase 7) remains the second layer; (c) NEW — the KV consume-once nonce (D-08-06) is a third layer specifically for the `apply` write path. |
| V5 Input Validation | Yes (existing, unchanged) | `isAllowedProject`/`isAllowedMode`/`isPositiveInt` in `dispatch.ts` already reject before any fetch; the new KV key is derived from an already-validated `previewRunId` (positive integer), so no new injection surface. |
| V6 Cryptography | No new surface | No new crypto primitives introduced. Secrets (PAT, `LINEAR_API_KEY`) remain in Cloudflare/GitHub encrypted-at-rest secret stores, never in code or KV. **Never store the PAT or `LINEAR_API_KEY` value itself in the KV namespace** — the nonce KV entry must contain only an opaque marker (`"1"` or a small JSON diagnostic blob), never a secret. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Replay of a stale/reused `previewRunId` to authorize an unreviewed apply (CR-01) | Elevation of Privilege / Tampering | 15-minute recency bound (existing) + KV consume-once nonce (this phase, D-08-06). |
| Unauthenticated access to `/api/backfill/*` or `/api/linear/*` bypassing the write/read gate | Spoofing | Cloudflare Access single-application gate over app root + `/api/*` (D-08-01); verified via the curl checks in `docs/access-setup.md` and this research's Code Examples section. |
| PAT leakage broader than needed (uniform grant across 4 repos) | Elevation of Privilege | Accepted trade-off (D-08-03); mitigated by app-level hardcoded `REPO` constant limiting *actual* app-driven blast radius to `agenticapps-roadmap` even though the raw token is technically capable of more. Document in the runbook's rotation section so a future reviewer understands this is a known, accepted scope. |
| Secret leakage into `roadmap.json`, client bundle, or KV values | Information Disclosure | Existing CI grep gate (`grep -r "lin_api_"`) + the never-commit-rule in `docs/access-setup.md`; extend the same discipline to the PAT value (`ghp_`/`github_pat_` patterns are already tested against in `dispatch.test.ts`'s `TOKEN_REGEX`). |

## Sources

### Primary (HIGH confidence)
- `developers.cloudflare.com/kv/api/write-key-value-pairs/` — `put()` signature, `expirationTtl` minimum (60s), no atomic put-if-absent.
- `developers.cloudflare.com/pages/functions/wrangler-configuration/` — `[[kv_namespaces]]` binding syntax for Pages.
- `developers.cloudflare.com/kv/get-started/` — `wrangler kv namespace create` command and resulting config block.
- `developers.cloudflare.com/kv/concepts/how-kv-works/` — eventual consistency, no cross-location read-after-write guarantee.
- `docs.github.com/en/rest/actions/workflows` (Create a workflow dispatch event) — `return_run_details` parameter, 200-response shape (`workflow_run_id`, `run_url`, `html_url`).
- `docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens` — Actions permission read/write mapping to specific REST endpoints.
- `docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens` — uniform permission set across selected repos; single-resource-owner restriction.
- `github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids/` — confirms `return_run_details` GA date (2026-02-19), resolving WR-05.
- This session's direct tool verification: `git ls-tree -r origin/main`, `git rev-list --count origin/main..HEAD`, `gh pr list`, `gh secret list`, `wrangler pages project list`, `wrangler kv namespace list` — all `[VERIFIED: this session's tool output]`.

### Secondary (MEDIUM confidence)
- WebSearch on GitHub Actions `schedule:` default-branch-only behavior and cron recognition delay (GitHub Community discussions, `latchkey.dev`) — consistent across multiple independent threads.
- Cloudflare Community threads on KV read-after-write same-colo (non-)guarantee — consistent with the official "how KV works" doc.

### Tertiary (LOW confidence)
- None retained as load-bearing; all findings above were cross-verified against at least one official-docs source.

## Metadata

**Confidence breakdown:**
- Standard stack / platform mechanics: HIGH — verified via official Cloudflare/GitHub docs and direct CLI probing this session.
- Architecture (KV nonce pattern): MEDIUM-HIGH — the mechanism is CITED/verified; the exact binding name/TTL are proposals (Claude's discretion per CONTEXT.md), not verified requirements.
- Pitfalls (merge-to-main gap, PAT scoping): HIGH — directly confirmed via `git`/`gh`/`wrangler` commands in this session, not inferred.
- Runbook/ADR conventions: HIGH — an existing sibling-repo ADR format was read directly (`claude-workflow/docs/decisions/0010-*.md`).

**Research date:** 2026-07-16
**Valid until:** ~14 days (GitHub Actions API and Cloudflare product surfaces move quickly; the `return_run_details` finding in particular is only ~5 months old and worth re-confirming if Phase 8 execution slips significantly past this research date).
