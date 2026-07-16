import { describe, it, expect, vi, afterEach } from "vitest";
import {
  dispatchBackfill,
  pollBackfillStatus,
  applyBackfillOutcome,
  type BackfillStateMap,
} from "./backfill.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A typed diff payload matching the status.ts DiffCounts shape. */
const DIFF = { milestones: 1, issues: 2, labels: 0, dates: 3 };

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// dispatchBackfill
// ---------------------------------------------------------------------------

describe("dispatchBackfill", () => {
  it("resolves { ok: true, runId } on a 200 dispatch response", async () => {
    const fetchMock = vi.fn(async () => jsonRes({ runId: 42 }));
    const result = await dispatchBackfill(fetchMock, "claude-workflow", "dry-run");

    expect(result).toEqual({ ok: true, runId: 42 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backfill/dispatch",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("resolves { ok: true, runId: null, correlationId } on the 204 fallback shape", async () => {
    const fetchMock = vi.fn(async () =>
      jsonRes({ runId: null, correlationId: "abc-123" }),
    );
    const result = await dispatchBackfill(fetchMock, "claude-workflow", "dry-run");

    expect(result).toEqual({ ok: true, runId: null, correlationId: "abc-123" });
  });

  it("passes previewRunId through in the request body for apply mode", async () => {
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) =>
      jsonRes({ runId: 99 }),
    );
    await dispatchBackfill(fetchMock, "claude-workflow", "apply", 42);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ project: "claude-workflow", mode: "apply", previewRunId: 42 });
  });

  it("(a) resolves a typed failure — never throws — on a dispatch network failure", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });

    const result = await dispatchBackfill(fetchMock, "claude-workflow", "dry-run");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("failure");
    }
  });

  it("resolves a typed failure on a non-ok dispatch response (e.g. 403)", async () => {
    const fetchMock = vi.fn(async () => new Response("preview verification failed", { status: 403 }));

    const result = await dispatchBackfill(fetchMock, "claude-workflow", "apply", 1);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("failure");
    }
  });

  it("resolves a typed failure on a malformed dispatch response body", async () => {
    const fetchMock = vi.fn(async () => jsonRes({ nonsense: true }));

    const result = await dispatchBackfill(fetchMock, "claude-workflow", "dry-run");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("failure");
    }
  });
});

// ---------------------------------------------------------------------------
// pollBackfillStatus — happy path, 204->correlation, transient retry, every
// terminal conclusion, maxTicks exhaustion, abort cleanup
// ---------------------------------------------------------------------------

describe("pollBackfillStatus", () => {
  it("happy path: dispatch -> poll completes success -> resolves { ok: true, outcome: 'success' }", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () =>
      jsonRes({ status: "completed", conclusion: "success", diff: DIFF }),
    );

    const promise = pollBackfillStatus(
      fetchMock,
      { runId: 42 },
      { intervalMs: 1000, maxTicks: 5, maxRetries: 2 },
    );

    const result = await promise;
    expect(result).toEqual({ ok: true, outcome: "success", conclusion: "success", diff: DIFF });
    expect(fetchMock).toHaveBeenCalledWith("/api/backfill/status?run=42");
  });

  it("(b) 204 -> correlation resolve -> completed success: polls via ?correlationId=", async () => {
    const fetchMock = vi.fn(async () =>
      jsonRes({ status: "completed", conclusion: "success" }),
    );

    const result = await pollBackfillStatus(
      fetchMock,
      { correlationId: "abc-123" },
      { intervalMs: 1000, maxTicks: 5, maxRetries: 2 },
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/backfill/status?correlationId=abc-123");
  });

  it("(h) transient 502 then success: retry recovers without declaring failure", async () => {
    vi.useFakeTimers();
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1) return new Response("upstream error", { status: 502 });
      return jsonRes({ status: "completed", conclusion: "success" });
    });

    const promise = pollBackfillStatus(
      fetchMock,
      { runId: 1 },
      { intervalMs: 1000, maxTicks: 5, maxRetries: 2 },
    );
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("(c) malformed response retries then resolves unknown once retries are exhausted", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => jsonRes({ nonsense: true }));

    const promise = pollBackfillStatus(
      fetchMock,
      { runId: 1 },
      { intervalMs: 1000, maxTicks: 10, maxRetries: 2 },
    );
    await vi.advanceTimersByTimeAsync(1000 * 4);

    const result = await promise;
    expect(result).toEqual({ ok: false, kind: "unknown", message: expect.any(String) });
  });

  it("(d) polled conclusion:'failure' resolves a terminal failure", async () => {
    const fetchMock = vi.fn(async () =>
      jsonRes({ status: "completed", conclusion: "failure" }),
    );

    const result = await pollBackfillStatus(
      fetchMock,
      { runId: 1 },
      { intervalMs: 1000, maxTicks: 5, maxRetries: 2 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("failure");
  });

  it("(e) polled conclusion:'cancelled' resolves a distinct terminal cancelled outcome", async () => {
    const fetchMock = vi.fn(async () =>
      jsonRes({ status: "completed", conclusion: "cancelled" }),
    );

    const result = await pollBackfillStatus(
      fetchMock,
      { runId: 1 },
      { intervalMs: 1000, maxTicks: 5, maxRetries: 2 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("cancelled");
  });

  it("(f) polled conclusion:'timed_out' maps to terminal failure (any non-success/cancelled conclusion)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonRes({ status: "completed", conclusion: "timed_out" }),
    );

    const result = await pollBackfillStatus(
      fetchMock,
      { runId: 1 },
      { intervalMs: 1000, maxTicks: 5, maxRetries: 2 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("failure");
  });

  it.each(["startup_failure", "stale", "skipped", "action_required", "neutral"])(
    "every other terminal conclusion (%s) also maps to failure, never left unhandled",
    async (conclusion) => {
      const fetchMock = vi.fn(async () => jsonRes({ status: "completed", conclusion }));

      const result = await pollBackfillStatus(
        fetchMock,
        { runId: 1 },
        { intervalMs: 1000, maxTicks: 5, maxRetries: 2 },
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("failure");
    },
  );

  it("(g) maxTicks exhausted while still in_progress resolves unknown, not failure", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () =>
      jsonRes({ status: "in_progress", conclusion: null }),
    );

    const promise = pollBackfillStatus(
      fetchMock,
      { runId: 1 },
      { intervalMs: 1000, maxTicks: 3, maxRetries: 2 },
    );
    await vi.advanceTimersByTimeAsync(1000 * 3);

    const result = await promise;
    expect(result).toEqual({ ok: false, kind: "unknown", message: expect.any(String) });
  });

  it("never throws even when fetchFn always rejects", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => {
      throw new Error("down");
    });

    const promise = pollBackfillStatus(
      fetchMock,
      { runId: 1 },
      { intervalMs: 1000, maxTicks: 3, maxRetries: 1 },
    );
    await vi.advanceTimersByTimeAsync(1000 * 3);

    await expect(promise).resolves.toEqual({
      ok: false,
      kind: "unknown",
      message: expect.any(String),
    });
  });

  it("abort cleanup: an aborted signal stops polling with no further fetch calls", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () =>
      jsonRes({ status: "in_progress", conclusion: null }),
    );
    const controller = new AbortController();

    const promise = pollBackfillStatus(
      fetchMock,
      { runId: 1 },
      { intervalMs: 1000, maxTicks: 10, maxRetries: 2, signal: controller.signal },
    );

    // Let the first tick fire, observe in_progress, then abort before tick 2.
    await vi.advanceTimersByTimeAsync(0);
    const callsBeforeAbort = fetchMock.mock.calls.length;
    controller.abort();

    await vi.advanceTimersByTimeAsync(1000 * 9);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("unknown");
    expect(fetchMock.mock.calls.length).toBe(callsBeforeAbort);
  });
});

// ---------------------------------------------------------------------------
// applyBackfillOutcome — pure reducer
// ---------------------------------------------------------------------------

describe("applyBackfillOutcome", () => {
  it("'start' sets pendingBackfill true + planAheadOverride false (optimistic in-sync)", () => {
    const state: BackfillStateMap = new Map();
    const next = applyBackfillOutcome(state, "proj-1", "start");

    expect(next).not.toBe(state);
    expect(next.get("proj-1")).toEqual({ pendingBackfill: true, planAheadOverride: false });
  });

  it("'success' clears pending and keeps planAheadOverride false (in-sync)", () => {
    const state: BackfillStateMap = new Map([
      ["proj-1", { pendingBackfill: true, planAheadOverride: false }],
    ]);
    const next = applyBackfillOutcome(state, "proj-1", "success");

    expect(next).not.toBe(state);
    expect(next.get("proj-1")).toEqual({ pendingBackfill: false, planAheadOverride: false });
  });

  it("'failure' clears pending and reverts planAheadOverride to undefined", () => {
    const state: BackfillStateMap = new Map([
      ["proj-1", { pendingBackfill: true, planAheadOverride: false }],
    ]);
    const next = applyBackfillOutcome(state, "proj-1", "failure");

    expect(next.get("proj-1")).toEqual({ pendingBackfill: false, planAheadOverride: undefined });
  });

  it("'cancelled' clears pending and reverts planAheadOverride to undefined", () => {
    const state: BackfillStateMap = new Map([
      ["proj-1", { pendingBackfill: true, planAheadOverride: false }],
    ]);
    const next = applyBackfillOutcome(state, "proj-1", "cancelled");

    expect(next.get("proj-1")).toEqual({ pendingBackfill: false, planAheadOverride: undefined });
  });

  it("'unknown' clears pending but does NOT revert planAheadOverride (no re-dispatch over a live run)", () => {
    const state: BackfillStateMap = new Map([
      ["proj-1", { pendingBackfill: true, planAheadOverride: false }],
    ]);
    const next = applyBackfillOutcome(state, "proj-1", "unknown");

    expect(next.get("proj-1")).toEqual({ pendingBackfill: false, planAheadOverride: false });
  });

  it("never mutates the input Map in place", () => {
    const state: BackfillStateMap = new Map([
      ["proj-1", { pendingBackfill: false, planAheadOverride: undefined }],
    ]);
    applyBackfillOutcome(state, "proj-1", "start");

    expect(state.get("proj-1")).toEqual({ pendingBackfill: false, planAheadOverride: undefined });
  });
});
