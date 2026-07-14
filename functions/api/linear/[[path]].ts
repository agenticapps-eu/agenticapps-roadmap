// ---------------------------------------------------------------------------
// Linear proxy Pages Function — named-operation snapshot
// Plan 03-03 (replaces 03-01 bundling probe)
//
// Security invariants (enforced in tests):
//  - Token only in Authorization header; never logged, never in any body
//  - OPERATIONS registry: client cannot send raw GraphQL; unknown op → 404
//  - Single try/catch around the body-handling stretch; ANY throw → generic 502
//  - Cache-Control: private, max-age=60 on success
//  - Per-isolate fixed-window rate limit → 429 when exceeded
//
// Fetch strategy (complexity-safe):
//  - MAIN_QUERY fetches initiatives + projects (no issues nested)
//  - ISSUES_QUERY paginates flat issues and buckets by project.id
//  - Results are reassembled into GqlResponse shape before mapWorkspace
//  - Both requests use the same auth header; token never appears in responses
// ---------------------------------------------------------------------------

import { fetchAssembledWorkspace } from "../../../scripts/linear/fetch-workspace.ts";
import {
  mapWorkspace,
} from "../../../scripts/linear/map.ts";
import { buildSnapshot } from "../../../scripts/linear/transform.ts";

// ---------------------------------------------------------------------------
// Env binding
// ---------------------------------------------------------------------------

interface Env {
  LINEAR_API_KEY: string;
}

// ---------------------------------------------------------------------------
// Named-operation registry
// Client supplies an op name; the registry resolves the transform.
// The client can never inject raw GraphQL.
// ---------------------------------------------------------------------------

const OPERATIONS = {
  snapshot: {
    transform: buildSnapshot,
  },
} as const;

// ---------------------------------------------------------------------------
// Per-isolate fixed-window rate limit (LIMIT=30 / WINDOW_MS=60_000)
// Simple in-memory counter; resets when the isolate is recycled.
// This is defense-in-depth; Cloudflare Access is the primary auth control.
// ---------------------------------------------------------------------------

const LIMIT = 30;
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const LINEAR_ENDPOINT = "https://api.linear.app/graphql";

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  // 1. Resolve op name — catch-all [[path]] gives an array
  const op = Array.isArray(params.path) ? params.path[0] : params.path;

  // 2. Registry lookup → 404 on miss (before any fetch)
  const entry = OPERATIONS[op as keyof typeof OPERATIONS];
  if (!entry) {
    return new Response("unknown operation", { status: 404 });
  }

  // 3. Rate limit → 429 (before any fetch)
  if (isRateLimited()) {
    return new Response("rate limited", { status: 429 });
  }

  // 4. Env check → 500 generic (before any fetch)
  if (!env.LINEAR_API_KEY) {
    return new Response("internal error", { status: 500 });
  }

  // 5. Two-part fetch + assemble + transform
  //    fetchAssembledWorkspace throws on any upstream non-ok, GraphQL errors,
  //    or malformed body. mapWorkspace + buildSnapshot throw on assertNoLeak or
  //    schema parse failure. Single try/catch: ANY throw → generic 502.
  //    The catch body MUST NOT include the upstream body, parsed json, or auth header.
  let result;
  try {
    const assembled = await fetchAssembledWorkspace(
      fetch,
      LINEAR_ENDPOINT,
      env.LINEAR_API_KEY
    );
    const raw = mapWorkspace(assembled);
    result = entry.transform(raw);
  } catch {
    return new Response("upstream error", { status: 502 });
  }

  // 6. Success — schema-valid RoadmapJson with cache header
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=60",
    },
  });
};
