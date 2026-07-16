/**
 * Unit tests for the backfill status/diff-readback Pages Function handler.
 *
 * Test contract (mirrors functions/api/linear/[[path]].test.ts):
 * - `ctx(url, env)` builds a minimal PagesFunction first-arg with a GET
 *   Request carrying `?run=` or `?correlationId=`.
 * - `stubFetchSequence` stubs global fetch to return payloads in order.
 *   Call sequence depends on the path taken:
 *     - `?correlationId=` (unresolved or resolved): list-runs call first.
 *     - identity verification: GET run (also carries status/conclusion).
 *     - only when status === "completed": jobs call, then job-logs call.
 * - Every response must set Cache-Control: no-store and never contain the
 *   token value or a GH-PAT-shaped string.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { onRequestGet, _resetRateLimitForTest } from "./status.ts";

const TEST_TOKEN = "ghp_TESTTOKEN000";
const TOKEN_REGEX = /ghp_|github_pat_/;
const CID = "11111111-1111-1111-1111-111111111111";

function ctx(
  url: string,
  env: Record<string, string> = { GH_BACKFILL_TOKEN: TEST_TOKEN }
) {
  const request = new Request(url);
  return { request, env } as unknown as Parameters<typeof onRequestGet>[0];
}

function stubFetchSequence(
  payloads: Array<{ ok: boolean; status?: number; json?: () => Promise<unknown>; text?: () => Promise<string> }>
) {
  let callIndex = 0;
  const mockFetch = vi.fn().mockImplementation(() => {
    const payload = payloads[callIndex++];
    return Promise.resolve(payload);
  });
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
}

function runPayload(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      path: ".github/workflows/backfill.yml",
      head_branch: "main",
      event: "workflow_dispatch",
      status: "in_progress",
      conclusion: null,
      name: `backfill [proj:cparx] [mode:dry-run] [cid:${CID}]`,
      ...overrides,
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  _resetRateLimitForTest();
});

// ---------------------------------------------------------------------------
// Input validation — 400 before any fetch
// ---------------------------------------------------------------------------

describe("input validation (400 before any fetch)", () => {
  it("rejects a request with neither ?run= nor ?correlationId=", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await onRequestGet(ctx("https://x/api/backfill/status"));

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects a non-positive-integer ?run=", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=-3"));

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric ?run=", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=abc"));

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 500: missing env.GH_BACKFILL_TOKEN
// ---------------------------------------------------------------------------

describe("500 missing GH_BACKFILL_TOKEN", () => {
  it("returns 500 generic and does not call fetch", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123", {}));

    expect(res.status).toBe(500);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// (a) in-progress run — identity-valid, no jobs/logs read
// ---------------------------------------------------------------------------

describe("in-progress run", () => {
  it("returns { status, conclusion } without reading jobs/logs", async () => {
    const mockFetch = stubFetchSequence([runPayload()]);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; conclusion: string | null; diff?: unknown };
    expect(body.status).toBe("in_progress");
    expect(body.conclusion).toBeNull();
    expect(body.diff).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// (b) completed run with a typed diff marker in job logs
// ---------------------------------------------------------------------------

describe("completed run with typed diff marker", () => {
  it("returns { status, conclusion, diff } via the run -> jobs -> job-logs sequence", async () => {
    const diffPayload = { milestones: 2, issues: 5, labels: 1, dates: 3 };
    const mockFetch = stubFetchSequence([
      runPayload({ status: "completed", conclusion: "success" }),
      { ok: true, status: 200, json: async () => ({ jobs: [{ id: 999, name: "backfill" }] }) },
      {
        ok: true,
        status: 200,
        text: async () =>
          `2026-07-16T00:00:00Z some log line\n2026-07-16T00:00:01Z ___DIFF_JSON___${JSON.stringify(diffPayload)}___END_DIFF___\n`,
      },
    ]);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; conclusion: string; diff: typeof diffPayload };
    expect(body.status).toBe("completed");
    expect(body.conclusion).toBe("success");
    expect(body.diff).toEqual(diffPayload);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// (c) completed run whose logs lack the marker — diff undefined
// ---------------------------------------------------------------------------

describe("completed run without a diff marker", () => {
  it("returns diff: undefined when the marker line is absent", async () => {
    const mockFetch = stubFetchSequence([
      runPayload({ status: "completed", conclusion: "success" }),
      { ok: true, status: 200, json: async () => ({ jobs: [{ id: 999, name: "backfill" }] }) },
      { ok: true, status: 200, text: async () => "no marker here\nnothing to see\n" },
    ]);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; diff?: unknown };
    expect(body.status).toBe("completed");
    expect(body.diff).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// (d) identity-verification failures — 403, no jobs/logs fetch
// ---------------------------------------------------------------------------

describe("identity verification failure (403, no jobs/logs read)", () => {
  it("rejects a run with the wrong workflow path", async () => {
    const mockFetch = stubFetchSequence([
      runPayload({ path: ".github/workflows/other.yml" }),
    ]);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));

    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a run on the wrong branch", async () => {
    const mockFetch = stubFetchSequence([runPayload({ head_branch: "feature-x" })]);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));

    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a run with the wrong event", async () => {
    const mockFetch = stubFetchSequence([runPayload({ event: "schedule" })]);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));

    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// (e) correlationId resolves to a matching run
// ---------------------------------------------------------------------------

describe("correlationId resolve — matching run found", () => {
  it("resolves the run id from the runs list and proceeds", async () => {
    const mockFetch = stubFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          workflow_runs: [
            { id: 123, name: `backfill [proj:cparx] [mode:dry-run] [cid:${CID}]` },
          ],
        }),
      },
      runPayload(),
    ]);

    const res = await onRequestGet(ctx(`https://x/api/backfill/status?correlationId=${CID}`));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("in_progress");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// (f) correlationId — no matching run yet
// ---------------------------------------------------------------------------

// WR-04: a run name that merely contains an unbracketed/forged
// correlationId substring must not match the anchored cid regex.
describe("correlationId resolve — regex-injection safe", () => {
  it("does not match a run whose name contains the correlationId without matching cid brackets", async () => {
    const mockFetch = stubFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          workflow_runs: [{ id: 999, name: `backfill [proj:cparx] [mode:dry-run] [cid:${CID}999]` }],
        }),
      },
    ]);

    const res = await onRequestGet(ctx(`https://x/api/backfill/status?correlationId=${CID}`));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("queued");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("correlationId resolve — not found yet", () => {
  it("returns { status: 'queued', conclusion: null } without further fetches", async () => {
    const mockFetch = stubFetchSequence([
      { ok: true, status: 200, json: async () => ({ workflow_runs: [] }) },
    ]);

    const res = await onRequestGet(ctx(`https://x/api/backfill/status?correlationId=${CID}`));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; conclusion: string | null };
    expect(body.status).toBe("queued");
    expect(body.conclusion).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Generic 502 on any GitHub failure
// ---------------------------------------------------------------------------

describe("generic 502 on upstream failure", () => {
  it("returns 502 when the run fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));

    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).not.toContain("network down");
  });

  it("returns 502 when the run fetch responds non-ok", async () => {
    stubFetchSequence([{ ok: false, status: 500 }]);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));

    expect(res.status).toBe(502);
  });

  it("returns 502 when the jobs fetch fails for a completed run", async () => {
    stubFetchSequence([
      runPayload({ status: "completed", conclusion: "success" }),
      { ok: false, status: 500 },
    ]);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));

    expect(res.status).toBe(502);
  });

  // WR-02: a malformed (missing-field) GitHub response fails the runtime
  // shape guard and collapses to the generic 502 path, not a crash.
  it("returns 502 when the run response is malformed (missing fields)", async () => {
    stubFetchSequence([{ ok: true, status: 200, json: async () => ({ unexpected: true }) }]);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));

    expect(res.status).toBe(502);
  });

  it("returns 502 when the runs-list response is malformed", async () => {
    stubFetchSequence([{ ok: true, status: 200, json: async () => ({ nonsense: true }) }]);

    const res = await onRequestGet(ctx(`https://x/api/backfill/status?correlationId=${CID}`));

    expect(res.status).toBe(502);
  });

  it("returns 502 when the jobs response is malformed for a completed run", async () => {
    stubFetchSequence([
      runPayload({ status: "completed", conclusion: "success" }),
      { ok: true, status: 200, json: async () => ({ nonsense: true }) },
    ]);

    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));

    expect(res.status).toBe(502);
  });
});

// ---------------------------------------------------------------------------
// Cache-Control: no-store on every response
// ---------------------------------------------------------------------------

describe("Cache-Control: no-store on every response", () => {
  it("sets no-store on a 400", async () => {
    const res = await onRequestGet(ctx("https://x/api/backfill/status"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no-store on a 500", async () => {
    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123", {}));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no-store on a 403", async () => {
    stubFetchSequence([runPayload({ path: ".github/workflows/other.yml" })]);
    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no-store on a 200", async () => {
    stubFetchSequence([runPayload()]);
    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no-store on a 502", async () => {
    stubFetchSequence([{ ok: false, status: 500 }]);
    const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

// ---------------------------------------------------------------------------
// Token never present in any response body across every status code
// ---------------------------------------------------------------------------

describe("token never present in any response body", () => {
  async function bodyOf(response: Response): Promise<string> {
    return response.text();
  }

  it("400 body has no token", async () => {
    const body = await bodyOf(await onRequestGet(ctx("https://x/api/backfill/status")));
    expect(body).not.toContain(TEST_TOKEN);
    expect(body).not.toMatch(TOKEN_REGEX);
  });

  it("500 body has no token", async () => {
    const body = await bodyOf(
      await onRequestGet(ctx("https://x/api/backfill/status?run=123", {}))
    );
    expect(body).not.toContain(TEST_TOKEN);
    expect(body).not.toMatch(TOKEN_REGEX);
  });

  it("403 body has no token", async () => {
    stubFetchSequence([runPayload({ path: ".github/workflows/other.yml" })]);
    const body = await bodyOf(await onRequestGet(ctx("https://x/api/backfill/status?run=123")));
    expect(body).not.toContain(TEST_TOKEN);
    expect(body).not.toMatch(TOKEN_REGEX);
  });

  it("200 body has no token", async () => {
    stubFetchSequence([runPayload()]);
    const body = await bodyOf(await onRequestGet(ctx("https://x/api/backfill/status?run=123")));
    expect(body).not.toContain(TEST_TOKEN);
    expect(body).not.toMatch(TOKEN_REGEX);
  });

  it("502 body has no token", async () => {
    stubFetchSequence([{ ok: false, status: 500 }]);
    const body = await bodyOf(await onRequestGet(ctx("https://x/api/backfill/status?run=123")));
    expect(body).not.toContain(TEST_TOKEN);
    expect(body).not.toMatch(TOKEN_REGEX);
  });
});

// ---------------------------------------------------------------------------
// WR-01: 429 rate limit
// ---------------------------------------------------------------------------

describe("429 rate limit", () => {
  beforeEach(() => {
    _resetRateLimitForTest();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  });

  it("30th request is not rate limited but 31st is (> LIMIT off-by-one)", async () => {
    for (let i = 0; i < 29; i++) {
      await onRequestGet(ctx("https://x/api/backfill/status?run=123"));
    }

    const res30 = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));
    expect(res30.status).not.toBe(429);

    const res31 = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));
    expect(res31.status).toBe(429);
    expect(await res31.text()).toBe("rate limited");
  });

  it("allows requests again after the window resets", async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 31; i++) {
        await onRequestGet(ctx("https://x/api/backfill/status?run=123"));
      }

      vi.advanceTimersByTime(60_001);

      const res = await onRequestGet(ctx("https://x/api/backfill/status?run=123"));
      expect(res.status).not.toBe(429);
    } finally {
      vi.useRealTimers();
    }
  });
});
