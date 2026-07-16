// ---------------------------------------------------------------------------
// Backfill client core — pure, React-free dispatch/poll orchestration + the
// optimistic-state reducer for LIVE-02 (07-03).
//
// Mirrors src/lib/roadmap/loader.ts's discipline: no path ever throws past
// the caller (single try/catch per network stretch; the poll loop guards
// every tick with its own try/catch). `fetchFn` is injected (typed as the
// global `fetch` signature) so this file is unit-testable in the node
// vitest env with zero DOM.
//
// Handles the full 07-02 route contract:
//   POST /api/backfill/dispatch -> { runId } | { runId: null, correlationId }
//   GET  /api/backfill/status?run=|?correlationId= -> { status, conclusion, diff? }
// ---------------------------------------------------------------------------

/** A typed fetch function — matches the global `fetch` signature. */
type FetchFn = typeof fetch;

export type BackfillMode = "dry-run" | "apply";

export interface DiffCounts {
  milestones: number;
  issues: number;
  labels: number;
  dates: number;
}

// ---------------------------------------------------------------------------
// dispatchBackfill
// ---------------------------------------------------------------------------

export type DispatchResult =
  | { ok: true; runId: number }
  | { ok: true; runId: null; correlationId: string }
  | { ok: false; kind: "failure"; message: string };

function isDispatchResponse(
  value: unknown,
): value is { runId: number | null; correlationId?: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.runId === null) return typeof v.correlationId === "string";
  return typeof v.runId === "number";
}

/**
 * POSTs to /api/backfill/dispatch. Resolves to the `{ runId }` /
 * `{ runId: null, correlationId }` union on success (per 07-02), or a typed
 * failure on any non-ok response, malformed body, or thrown/rejected fetch.
 * NEVER throws.
 */
export async function dispatchBackfill(
  fetchFn: FetchFn,
  projectKey: string,
  mode: BackfillMode,
  previewRunId?: number,
): Promise<DispatchResult> {
  try {
    const res = await fetchFn("/api/backfill/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: projectKey,
        mode,
        ...(previewRunId !== undefined ? { previewRunId } : {}),
      }),
    });
    if (!res.ok) {
      return { ok: false, kind: "failure", message: `dispatch not ok: ${res.status}` };
    }
    const json: unknown = await res.json();
    if (!isDispatchResponse(json)) {
      return { ok: false, kind: "failure", message: "malformed dispatch response" };
    }
    if (json.runId === null) {
      return { ok: true, runId: null, correlationId: json.correlationId as string };
    }
    return { ok: true, runId: json.runId };
  } catch {
    return { ok: false, kind: "failure", message: "dispatch network failure" };
  }
}

// ---------------------------------------------------------------------------
// pollBackfillStatus
// ---------------------------------------------------------------------------

/** Either handle dispatchBackfill can resolve to (the 204 fallback included). */
export type PollHandle = { runId: number } | { correlationId: string };

export interface PollOptions {
  intervalMs: number;
  maxTicks: number;
  maxRetries: number;
  /** When aborted, polling stops immediately with no further fetch calls. */
  signal?: AbortSignal;
}

export type PollResult =
  | { ok: true; outcome: "success"; conclusion: string; diff?: DiffCounts }
  | { ok: false; kind: "cancelled"; conclusion: string; message: string }
  | { ok: false; kind: "failure"; conclusion: string; message: string }
  | { ok: false; kind: "unknown"; message: string };

interface StatusResponse {
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  diff?: DiffCounts;
}

function isStatusResponse(value: unknown): value is StatusResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.status === "queued" || v.status === "in_progress" || v.status === "completed") &&
    (v.conclusion === null || typeof v.conclusion === "string")
  );
}

/**
 * Terminal conclusion map (07-REVIEWS finding MEDIUM): `success` -> success,
 * `cancelled` -> a distinct cancelled outcome, every OTHER completed
 * conclusion (`failure`, `timed_out`, `startup_failure`, `stale`, `skipped`,
 * `action_required`, `neutral`, ...) -> failure. Both cancelled and failure
 * are terminal: the caller reverts the optimistic override and records an
 * error.
 */
function mapConclusion(conclusion: string | null, diff?: DiffCounts): PollResult {
  if (conclusion === "success") {
    return { ok: true, outcome: "success", conclusion, diff };
  }
  const resolvedConclusion = conclusion ?? "unknown";
  if (conclusion === "cancelled") {
    return {
      ok: false,
      kind: "cancelled",
      conclusion: resolvedConclusion,
      message: "backfill run was cancelled",
    };
  }
  return {
    ok: false,
    kind: "failure",
    conclusion: resolvedConclusion,
    message: `backfill run failed (conclusion: ${resolvedConclusion})`,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls /api/backfill/status via `?run=` or `?correlationId=` (whichever
 * `handle` carries) until `status === "completed"`, mapping the conclusion
 * per the terminal map above.
 *
 * A single 502 / thrown fetch / malformed body is a TRANSIENT observation
 * failure — retried with backoff (the poll interval) up to `maxRetries`
 * before declaring `unknown` (finding MEDIUM: never conflate an
 * observation failure with a terminal job failure, which would let a
 * rollback+re-enable dispatch a second run over one still executing).
 *
 * Resolves `unknown` if `maxTicks` is exhausted, retries are exhausted, or
 * `signal` is aborted mid-poll. NEVER throws.
 */
export async function pollBackfillStatus(
  fetchFn: FetchFn,
  handle: PollHandle,
  options: PollOptions,
): Promise<PollResult> {
  const { intervalMs, maxTicks, maxRetries, signal } = options;
  const query = "runId" in handle ? `run=${handle.runId}` : `correlationId=${handle.correlationId}`;
  let retries = 0;

  for (let tick = 0; tick < maxTicks; tick++) {
    if (signal?.aborted) {
      return { ok: false, kind: "unknown", message: "poll aborted" };
    }

    try {
      const res = await fetchFn(`/api/backfill/status?${query}`);
      if (!res.ok) {
        throw new Error(`status not ok: ${res.status}`);
      }
      const json: unknown = await res.json();
      if (!isStatusResponse(json)) {
        throw new Error("malformed status response");
      }
      if (json.status === "completed") {
        return mapConclusion(json.conclusion, json.diff);
      }
      // A successful observation of a non-terminal state resets the retry
      // budget — only CONSECUTIVE observation failures count toward it.
      retries = 0;
    } catch {
      retries++;
      if (retries > maxRetries) {
        return { ok: false, kind: "unknown", message: "status observation failed repeatedly" };
      }
    }

    if (signal?.aborted) {
      return { ok: false, kind: "unknown", message: "poll aborted" };
    }
    await wait(intervalMs);
  }

  return { ok: false, kind: "unknown", message: "poll exhausted maxTicks" };
}

// ---------------------------------------------------------------------------
// applyBackfillOutcome — pure optimistic-state reducer
// ---------------------------------------------------------------------------

/** Per-project optimistic backfill state (owned by the consuming UI, e.g. OverviewPage). */
export interface BackfillProjectState {
  pendingBackfill: boolean;
  planAheadOverride?: boolean;
}

export type BackfillStateMap = Map<string, BackfillProjectState>;

export type BackfillOutcome = "start" | "success" | "failure" | "cancelled" | "unknown";

/**
 * Pure reducer over the optimistic-state Map — always returns a NEW Map,
 * never mutates `state` in place.
 *
 * - "start": optimistic flip — in-sync (`planAheadOverride: false`) + pending.
 * - "success": clears pending, keeps in-sync (`planAheadOverride: false`).
 * - "failure" | "cancelled": clears pending, REVERTS the override
 *   (`planAheadOverride: undefined`) so the real `planAhead` shows again.
 * - "unknown": clears pending but LEAVES `planAheadOverride` at its current
 *   (optimistic) value — no revert, no error, so the user is not invited to
 *   re-dispatch over a possibly-still-live run.
 */
export function applyBackfillOutcome(
  state: BackfillStateMap,
  projectId: string,
  outcome: BackfillOutcome,
): BackfillStateMap {
  const next: BackfillStateMap = new Map(state);

  switch (outcome) {
    case "start":
      next.set(projectId, { pendingBackfill: true, planAheadOverride: false });
      break;
    case "success":
      next.set(projectId, { pendingBackfill: false, planAheadOverride: false });
      break;
    case "failure":
    case "cancelled":
      next.set(projectId, { pendingBackfill: false, planAheadOverride: undefined });
      break;
    case "unknown": {
      const existing = next.get(projectId);
      next.set(projectId, {
        pendingBackfill: false,
        planAheadOverride: existing?.planAheadOverride,
      });
      break;
    }
  }

  return next;
}
