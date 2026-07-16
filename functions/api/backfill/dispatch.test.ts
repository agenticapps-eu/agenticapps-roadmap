/**
 * Unit tests for the backfill dispatch Pages Function handler.
 *
 * Test contract (mirrors functions/api/linear/[[path]].test.ts):
 * - `ctx(body, env)` builds a minimal PagesFunction first-arg with a POST
 *   Request whose JSON body is `{ project, mode, previewRunId? }`.
 * - `stubFetchSequence` stubs global fetch to return payloads in order:
 *   dry-run dispatch = 1 call; apply = 2 calls (preview-run GET, then
 *   dispatch POST).
 * - Every response (200/400/403/500/502) must set Cache-Control: no-store
 *   and must never contain the token value or a GH-PAT-shaped string.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { onRequestPost, _resetRateLimitForTest } from "./dispatch.ts";

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

function stubFetchSequence(
  payloads: Array<{ ok: boolean; status: number; json?: () => Promise<unknown> }>
) {
  let callIndex = 0;
  const mockFetch = vi.fn().mockImplementation(() => {
    const payload = payloads[callIndex++];
    return Promise.resolve(payload);
  });
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
}

function goodPreviewRun(project: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      path: ".github/workflows/backfill.yml",
      head_branch: "main",
      event: "workflow_dispatch",
      status: "completed",
      conclusion: "success",
      name: `backfill [proj:${project}] [mode:dry-run] [cid:11111111-1111-1111-1111-111111111111]`,
      run_started_at: new Date().toISOString(),
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  _resetRateLimitForTest();
});

// ---------------------------------------------------------------------------
// Allow-list / mode / previewRunId validation — 400 before any fetch
// ---------------------------------------------------------------------------

describe("input validation (400 before any fetch)", () => {
  it("rejects a project not in the allow-list", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await onRequestPost(ctx({ project: "not-a-real-project", mode: "dry-run" }));

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid mode", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await onRequestPost(ctx({ project: "cparx", mode: "delete-everything" }));

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects apply mode without a previewRunId", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await onRequestPost(ctx({ project: "cparx", mode: "apply" }));

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects apply mode with a non-positive-integer previewRunId", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: -5 })
    );

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

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "dry-run" }, {})
    );

    expect(res.status).toBe(500);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Apply-with-invalid-preview-run — 403 across each failing check
// ---------------------------------------------------------------------------

describe("apply with invalid preview run (403, no dispatch)", () => {
  it("rejects a preview run with the wrong workflow path", async () => {
    const mockFetch = stubFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          ...(await goodPreviewRun("cparx").json()),
          path: ".github/workflows/other.yml",
        }),
      },
    ]);

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );

    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a preview run on the wrong branch", async () => {
    const mockFetch = stubFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          ...(await goodPreviewRun("cparx").json()),
          head_branch: "feature-x",
        }),
      },
    ]);

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );

    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a preview run that is not completed/successful", async () => {
    const mockFetch = stubFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          ...(await goodPreviewRun("cparx").json()),
          status: "in_progress",
          conclusion: null,
        }),
      },
    ]);

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );

    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a preview run whose run-name encodes a different project", async () => {
    const mockFetch = stubFetchSequence([goodPreviewRun("claude-workflow")]);

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );

    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a preview run whose run-name encodes mode=apply (not dry-run)", async () => {
    const mockFetch = stubFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          ...(await goodPreviewRun("cparx").json()),
          name: "backfill [proj:cparx] [mode:apply] [cid:11111111-1111-1111-1111-111111111111]",
        }),
      },
    ]);

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );

    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // CR-01: a previewRunId older than the recency bound (15 min) must be
  // rejected, even if every other check passes.
  it("rejects a preview run older than the 15-minute recency bound", async () => {
    const staleTimestamp = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const mockFetch = stubFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          ...(await goodPreviewRun("cparx").json()),
          run_started_at: staleTimestamp,
        }),
      },
    ]);

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );

    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // WR-04: a run whose name merely CONTAINS the expected substrings amid
  // extra/forged text must be rejected by the anchored full-string regex.
  it("rejects a preview run whose name contains the right substrings but isn't an exact match", async () => {
    const mockFetch = stubFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          ...(await goodPreviewRun("cparx").json()),
          name: "backfill [proj:cparx] [mode:dry-run] [cid:11111111-1111-1111-1111-111111111111] [proj:cparx] [mode:dry-run]",
        }),
      },
    ]);

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );

    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("accepts a preview run within the recency bound using created_at when run_started_at is absent", async () => {
    const recentTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const mockFetch = stubFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => {
          const { run_started_at: _dropped, ...rest } = await goodPreviewRun("cparx").json();
          return { ...rest, created_at: recentTimestamp };
        },
      },
      { ok: true, status: 200, json: async () => ({ workflow_run_id: 7 }) },
    ]);

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Success paths
// ---------------------------------------------------------------------------

describe("dry-run dispatch success", () => {
  it("returns 200 with { runId } on a GitHub 200 return_run_details response", async () => {
    stubFetchSequence([
      { ok: true, status: 200, json: async () => ({ workflow_run_id: 987654 }) },
    ]);

    const res = await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { runId: number };
    expect(body.runId).toBe(987654);
  });

  it("returns 200 with { runId: null, correlationId } on a GitHub 204", async () => {
    stubFetchSequence([{ ok: true, status: 204 }]);

    const res = await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { runId: null; correlationId: string };
    expect(body.runId).toBeNull();
    expect(typeof body.correlationId).toBe("string");
    expect(body.correlationId.length).toBeGreaterThan(0);
  });
});

describe("apply dispatch success", () => {
  it("returns 200 with { runId } after a valid preview-run verification", async () => {
    const mockFetch = stubFetchSequence([
      goodPreviewRun("cparx"),
      { ok: true, status: 200, json: async () => ({ workflow_run_id: 55 }) },
    ]);

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { runId: number };
    expect(body.runId).toBe(55);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Generic 502 on any GitHub failure
// ---------------------------------------------------------------------------

describe("generic 502 on upstream failure", () => {
  it("returns 502 when the dispatch fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    const res = await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));

    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).not.toContain("network down");
  });

  it("returns 502 when the dispatch responds with a non-2xx/204 status", async () => {
    stubFetchSequence([{ ok: false, status: 500 }]);

    const res = await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));

    expect(res.status).toBe(502);
  });

  it("returns 502 when the preview-run GET throws during apply", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );

    expect(res.status).toBe(502);
  });

  // WR-02: a malformed (missing-field) GitHub response fails the runtime
  // shape guard and collapses to the generic 502 path, not a crash.
  it("returns 502 when the preview-run response is malformed (missing fields)", async () => {
    stubFetchSequence([{ ok: true, status: 200, json: async () => ({ unexpected: true }) }]);

    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );

    expect(res.status).toBe(502);
  });

  it("returns 502 when the 200 dispatch response is malformed (missing workflow_run_id)", async () => {
    stubFetchSequence([{ ok: true, status: 200, json: async () => ({ nonsense: true }) }]);

    const res = await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));

    expect(res.status).toBe(502);
  });
});

// ---------------------------------------------------------------------------
// Cache-Control: no-store on every response
// ---------------------------------------------------------------------------

describe("Cache-Control: no-store on every response", () => {
  it("sets no-store on a 400", async () => {
    const res = await onRequestPost(ctx({ project: "nope", mode: "dry-run" }));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no-store on a 500", async () => {
    const res = await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }, {}));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no-store on a 403", async () => {
    stubFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          ...(await goodPreviewRun("cparx").json()),
          conclusion: "failure",
        }),
      },
    ]);
    const res = await onRequestPost(
      ctx({ project: "cparx", mode: "apply", previewRunId: 42 })
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no-store on a 200", async () => {
    stubFetchSequence([{ ok: true, status: 204 }]);
    const res = await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no-store on a 502", async () => {
    stubFetchSequence([{ ok: false, status: 500 }]);
    const res = await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));
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
    const body = await bodyOf(await onRequestPost(ctx({ project: "nope", mode: "dry-run" })));
    expect(body).not.toContain(TEST_TOKEN);
    expect(body).not.toMatch(TOKEN_REGEX);
  });

  it("500 body has no token", async () => {
    const body = await bodyOf(
      await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }, {}))
    );
    expect(body).not.toContain(TEST_TOKEN);
    expect(body).not.toMatch(TOKEN_REGEX);
  });

  it("403 body has no token", async () => {
    stubFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          ...(await goodPreviewRun("cparx").json()),
          conclusion: "failure",
        }),
      },
    ]);
    const body = await bodyOf(
      await onRequestPost(ctx({ project: "cparx", mode: "apply", previewRunId: 42 }))
    );
    expect(body).not.toContain(TEST_TOKEN);
    expect(body).not.toMatch(TOKEN_REGEX);
  });

  it("200 dry-run body has no token", async () => {
    stubFetchSequence([
      { ok: true, status: 200, json: async () => ({ workflow_run_id: 1 }) },
    ]);
    const body = await bodyOf(await onRequestPost(ctx({ project: "cparx", mode: "dry-run" })));
    expect(body).not.toContain(TEST_TOKEN);
    expect(body).not.toMatch(TOKEN_REGEX);
  });

  it("200 apply body has no token", async () => {
    stubFetchSequence([
      goodPreviewRun("cparx"),
      { ok: true, status: 200, json: async () => ({ workflow_run_id: 2 }) },
    ]);
    const body = await bodyOf(
      await onRequestPost(ctx({ project: "cparx", mode: "apply", previewRunId: 42 }))
    );
    expect(body).not.toContain(TEST_TOKEN);
    expect(body).not.toMatch(TOKEN_REGEX);
  });

  it("502 body has no token", async () => {
    stubFetchSequence([{ ok: false, status: 500 }]);
    const body = await bodyOf(await onRequestPost(ctx({ project: "cparx", mode: "dry-run" })));
    expect(body).not.toContain(TEST_TOKEN);
    expect(body).not.toMatch(TOKEN_REGEX);
  });
});

// ---------------------------------------------------------------------------
// WR-01: 429 rate limit (tighter LIMIT=10 than the read-only Linear proxy)
// ---------------------------------------------------------------------------

describe("429 rate limit", () => {
  beforeEach(() => {
    _resetRateLimitForTest();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  });

  it("10th request is not rate limited but 11th is (> LIMIT off-by-one)", async () => {
    for (let i = 0; i < 9; i++) {
      await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));
    }

    const res10 = await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));
    expect(res10.status).not.toBe(429);

    const res11 = await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));
    expect(res11.status).toBe(429);
    expect(await res11.text()).toBe("rate limited");
  });

  it("allows requests again after the window resets", async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 11; i++) {
        await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));
      }

      vi.advanceTimersByTime(60_001);

      const res = await onRequestPost(ctx({ project: "cparx", mode: "dry-run" }));
      expect(res.status).not.toBe(429);
    } finally {
      vi.useRealTimers();
    }
  });
});
