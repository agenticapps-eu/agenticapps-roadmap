// ---------------------------------------------------------------------------
// Backfill dispatch — allow-listed workflow_dispatch trigger with
// server-side preview-before-apply enforcement (LIVE-02)
// Plan 07-02, mirrors functions/api/linear/[[path]].ts exactly.
//
// Security invariants (enforced in tests):
//  - `project` accepted ONLY from the fixed allow-list; `mode` enum-validated;
//    both rejected before any fetch (T-07-02).
//  - `mode === "apply"` requires a server-verified successful dry-run
//    previewRunId — a direct apply without a real prior preview is rejected
//    403 (T-07-10).
//  - Single try/catch around the entire GitHub-call stretch; ANY failure
//    collapses to a generic 502. The token is only ever read from
//    env.GH_BACKFILL_TOKEN and placed in the Authorization header — never
//    logged, never echoed in any response body (T-07-01).
//  - Cache-Control: no-store on every response.
// ---------------------------------------------------------------------------

interface Env {
  GH_BACKFILL_TOKEN: string;
  BACKFILL_NONCE: KVNamespace; // D-08-06
}

const GITHUB_API = "https://api.github.com";
const REPO = "agenticapps-eu/agenticapps-roadmap";

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "agenticapps-roadmap-backfill",
});

// Server-side allow-list (finding #4/#6) — the ONLY accepted `project` values
// are the three sync.config keys.
const ALLOWED_PROJECTS = ["claude-workflow", "cparx", "fx-signal-agent"] as const;
type AllowedProject = (typeof ALLOWED_PROJECTS)[number];

const ALLOWED_MODES = ["dry-run", "apply"] as const;
type Mode = (typeof ALLOWED_MODES)[number];

function isAllowedProject(value: unknown): value is AllowedProject {
  return (
    typeof value === "string" &&
    (ALLOWED_PROJECTS as readonly string[]).includes(value)
  );
}

function isAllowedMode(value: unknown): value is Mode {
  return typeof value === "string" && (ALLOWED_MODES as readonly string[]).includes(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

interface PreviewRun {
  path: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  name: string;
  run_started_at?: string;
  created_at?: string;
}

// WR-02: runtime shape validation for GitHub API responses, matching the
// isDispatchResponse/isStatusResponse guard style already used client-side
// in src/lib/backfill/backfill.ts — no `any`, no blind `as` casts on
// untrusted upstream data.
function isPreviewRun(value: unknown): value is PreviewRun {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.path === "string" &&
    typeof v.head_branch === "string" &&
    typeof v.event === "string" &&
    typeof v.status === "string" &&
    (v.conclusion === null || typeof v.conclusion === "string") &&
    typeof v.name === "string" &&
    (v.run_started_at === undefined || typeof v.run_started_at === "string") &&
    (v.created_at === undefined || typeof v.created_at === "string")
  );
}

function isWorkflowRunIdResponse(value: unknown): value is { workflow_run_id: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.workflow_run_id === "number";
}

// CR-01: a previewRunId must be recent — an arbitrarily old successful
// dry-run no longer reflects the current sibling-repo/Linear state, and the
// review's fix guidance calls for rejecting anything older than this bound.
const MAX_PREVIEW_AGE_MS = 15 * 60 * 1000;

// D-08-06: consume-once nonce TTL. 900s matches MAX_PREVIEW_AGE_MS (15 min) —
// the nonce never needs to outlive the recency bound above.
const NONCE_TTL_SECONDS = 900;

// WR-04: escape regex metacharacters before anchoring a value into a
// dynamically-built RegExp (project is allow-list-validated already, but
// this keeps the helper correct regardless).
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Server-side verification that a previewRunId is a real, successful,
 * matching-project, RECENT dry-run of THIS workflow on `main` (finding #5,
 * T-07-10; CR-01 recency bound). The run-name contract (set by
 * backfill.yml, 07-06) is the only channel exposing a run's project/mode.
 *
 * WR-04: the run-name is anchored with a full-string regex (escaped
 * delimiters) rather than free-form `.includes()`, so a run whose name
 * merely CONTAINS a forged `[proj:...]`/`[mode:dry-run]` substring
 * alongside its real, different values cannot pass verification.
 */
function isValidPreviewRun(run: PreviewRun, project: string): boolean {
  const startedAt = new Date(run.run_started_at ?? run.created_at ?? 0).getTime();
  const ageMs = Date.now() - startedAt;
  const namePattern = new RegExp(
    `^backfill \\[proj:${escapeRegExp(project)}\\] \\[mode:dry-run\\] \\[cid:[^\\]]+\\]$`
  );
  return (
    run.path === ".github/workflows/backfill.yml" &&
    run.head_branch === "main" &&
    run.event === "workflow_dispatch" &&
    run.status === "completed" &&
    run.conclusion === "success" &&
    namePattern.test(run.name) &&
    Number.isFinite(startedAt) &&
    ageMs >= 0 &&
    ageMs <= MAX_PREVIEW_AGE_MS
  );
}

// ---------------------------------------------------------------------------
// Per-isolate fixed-window rate limit (WR-01) — mirrors
// functions/api/linear/[[path]].ts's isRateLimited(). Cloudflare Access is
// the primary auth control for this route; this is defense-in-depth in
// case Access is ever misconfigured for this specific path. A tighter
// window than the read-only Linear proxy is used here because this route
// can push commits to `main` and write to a production Linear workspace.
// ---------------------------------------------------------------------------

const LIMIT = 10;
const WINDOW_MS = 60_000;

let windowStart = Date.now();
let requestCount = 0;

function isRateLimited(): boolean {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    requestCount = 0;
  }
  requestCount += 1;
  return requestCount > LIMIT;
}

/** Resets the in-memory rate-limit counters. For test use only. */
export function _resetRateLimitForTest(): void {
  windowStart = Date.now();
  requestCount = 0;
}

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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // 1. Parse + validate body against the allow-list and mode enum — reject
  //    before any fetch (V5 input validation).
  let body: { project?: unknown; mode?: unknown; previewRunId?: unknown };
  try {
    body = await request.json();
  } catch {
    return textResponse("invalid request body", 400);
  }

  const { project, mode, previewRunId } = body;

  if (!isAllowedProject(project) || !isAllowedMode(mode)) {
    return textResponse("invalid project or mode", 400);
  }

  if (mode === "apply" && !isPositiveInt(previewRunId)) {
    return textResponse("apply requires a valid previewRunId", 400);
  }

  // 2. Rate limit (WR-01, defense-in-depth) — before any fetch.
  if (isRateLimited()) {
    return textResponse("rate limited", 429);
  }

  // 3. Env check — generic 500 before any fetch (fail closed).
  if (!env.GH_BACKFILL_TOKEN) {
    return textResponse("internal error", 500);
  }

  // 4. Single try/catch around the entire GitHub-call stretch. ANY failure
  //    (network throw, non-ok, malformed body) collapses to a generic 502.
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

      // D-08-06: best-effort sequential replay suppression. Not atomic (KV
      // has no compare-and-swap), so this is a co-mitigation alongside the
      // 15-min recency bound above, not an exactly-once guarantee.
      const nonceKey = `previewRunId:${previewRunId}`;
      const consumed = await env.BACKFILL_NONCE.get(nonceKey);
      if (consumed !== null) {
        return textResponse("preview already applied", 403);
      }
      await env.BACKFILL_NONCE.put(nonceKey, "1", {
        expirationTtl: NONCE_TTL_SECONDS,
      });
    }

    const correlationId = crypto.randomUUID();
    const dispatchRes = await fetch(
      `${GITHUB_API}/repos/${REPO}/actions/workflows/backfill.yml/dispatches`,
      {
        method: "POST",
        headers: {
          ...GH_HEADERS(env.GH_BACKFILL_TOKEN),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: { project, mode, correlation_id: correlationId },
          return_run_details: true,
        }),
      }
    );

    if (dispatchRes.status === 200) {
      const dispatchedJson: unknown = await dispatchRes.json();
      if (!isWorkflowRunIdResponse(dispatchedJson)) {
        throw new Error("malformed dispatch response");
      }
      return jsonResponse({ runId: dispatchedJson.workflow_run_id }, 200);
    }
    if (dispatchRes.status === 204) {
      return jsonResponse({ runId: null, correlationId }, 200);
    }
    throw new Error("dispatch failed");
  } catch {
    return textResponse("upstream error", 502);
  }
};
