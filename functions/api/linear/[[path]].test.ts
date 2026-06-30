/**
 * Unit tests for the Linear proxy Pages Function handler.
 *
 * Test contract (cross-AI review honored):
 * - Fixtures are FULL GqlResponse objects; fetch stub returns them DIRECTLY
 *   from `.json()` — no double-wrap in `{ data: ... }`.
 * - The handler is imported as `onRequestGet` from the sibling .ts file.
 * - vi.stubGlobal("fetch") intercepts the global fetch the handler calls.
 * - A constructed context (not a real EventContext) is used; types cast.
 *
 * Tests cover REQ-PROXY-1..4 + 500 missing key + 502 upstream + 502
 * malformed-JSON + token-never-present across ALL paths.
 *
 * Two-fetch strategy (complexity-safe):
 * - First fetch: MAIN_QUERY (projects + initiatives, no issues nested)
 * - Second+ fetches: ISSUES_QUERY paginated (flat issues with project.id)
 * The stub returns different payloads per call index.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { onRequestGet } from "./[[path]].ts";
import {
  mainResponseClean,
  mainResponseWithEmail,
} from "../../../scripts/linear/__fixtures__/main-response.ts";
import {
  issuesPageSingle,
  issuesPageOne,
  issuesPageTwo,
  issuesPageEmpty,
} from "../../../scripts/linear/__fixtures__/issues-page.ts";
import { RoadmapJsonSchema } from "../../../src/lib/roadmap/schema.ts";

// ---------------------------------------------------------------------------
// Context helper — constructs a minimal PagesFunction first-arg
// ---------------------------------------------------------------------------

const TEST_KEY = "lin_api_TESTKEY000";

function ctx(
  path: string[],
  env: Record<string, string> = { LINEAR_API_KEY: TEST_KEY }
) {
  // Cast to unknown first to satisfy the strict PagesFunction typing without
  // depending on the full EventContext shape from workers-types.
  return { params: { path }, env } as unknown as Parameters<
    typeof onRequestGet
  >[0];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// REQ-PROXY-1: Unknown operation → 404, no fetch
// ---------------------------------------------------------------------------

describe("REQ-PROXY-1: unknown operation", () => {
  it("returns 404 for an unregistered op and does not call fetch", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await onRequestGet(ctx(["nope"]));

    expect(res.status).toBe(404);
    expect(await res.text()).toContain("unknown operation");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// REQ-PROXY-2: Success path — schema-valid 200 + Cache-Control
// ---------------------------------------------------------------------------

describe("REQ-PROXY-2: snapshot success", () => {
  it("returns 200 with schema-valid RoadmapJson and Cache-Control header", async () => {
    // Two-fetch strategy: call 1 = MAIN_QUERY, call 2 = ISSUES_QUERY
    let callIndex = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const payloads = [
          { ok: true, status: 200, json: async () => mainResponseClean },
          { ok: true, status: 200, json: async () => issuesPageSingle },
        ];
        return Promise.resolve(payloads[callIndex++]);
      })
    );

    const res = await onRequestGet(ctx(["snapshot"]));

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");

    const body = await res.json();
    const parsed = RoadmapJsonSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// REQ-PROXY-3: Email in upstream → 502, no PII in body
// ---------------------------------------------------------------------------

describe("REQ-PROXY-3: email leak gate", () => {
  it("returns 502 when upstream contains an email and body has no PII", async () => {
    // Email is in mainResponseWithEmail's project description (main request).
    // The issues request also completes so assembledWorkspace is built — then
    // mapWorkspace + buildSnapshot → assertNoLeak fires on the description.
    let callIndex = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const payloads = [
          { ok: true, status: 200, json: async () => mainResponseWithEmail },
          { ok: true, status: 200, json: async () => issuesPageEmpty },
        ];
        return Promise.resolve(payloads[callIndex++]);
      })
    );

    const res = await onRequestGet(ctx(["snapshot"]));

    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).not.toContain("@");
    expect(body).not.toContain("secret@example.com");
  });
});

// ---------------------------------------------------------------------------
// 502 malformed-JSON: upstream body fails JSON parse → 502 generic
// ---------------------------------------------------------------------------

describe("502 malformed-JSON upstream", () => {
  it("returns 502 generic when upstream JSON parse throws and body has no PII", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      })
    );

    const res = await onRequestGet(ctx(["snapshot"]));

    expect(res.status).toBe(502);
    const body = await res.text();
    // Generic body — must not contain token, email, or upstream parse error
    expect(body).not.toMatch(/lin_api_/);
    expect(body).not.toContain("@");
    expect(body).not.toContain("Unexpected token");
  });
});

// ---------------------------------------------------------------------------
// REQ-PROXY-4: Token never in any response body across ALL paths
// ---------------------------------------------------------------------------

describe("REQ-PROXY-4: token never present in any response body", () => {
  async function bodyOf(response: Response): Promise<string> {
    return response.text();
  }

  it("404 unknown op body does not contain the API key", async () => {
    const body = await bodyOf(await onRequestGet(ctx(["nope"])));
    expect(body).not.toContain(TEST_KEY);
    expect(body).not.toMatch(/lin_api_/);
  });

  it("500 missing key body does not contain the API key", async () => {
    // Pass empty env to trigger the missing-key path
    const res = await onRequestGet(ctx(["snapshot"], {}));
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain(TEST_KEY);
    expect(body).not.toMatch(/lin_api_/);
  });

  it("200 success body does not contain the API key", async () => {
    let callIndex = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const payloads = [
          { ok: true, status: 200, json: async () => mainResponseClean },
          { ok: true, status: 200, json: async () => issuesPageSingle },
        ];
        return Promise.resolve(payloads[callIndex++]);
      })
    );
    const res = await onRequestGet(ctx(["snapshot"]));
    const body = await bodyOf(res);
    expect(body).not.toContain(TEST_KEY);
    expect(body).not.toMatch(/lin_api_/);
  });

  it("502 upstream-non-ok body does not contain the API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );
    const res = await onRequestGet(ctx(["snapshot"]));
    expect(res.status).toBe(502);
    const body = await bodyOf(res);
    expect(body).not.toContain(TEST_KEY);
    expect(body).not.toMatch(/lin_api_/);
  });

  it("502 email-leak body does not contain the API key", async () => {
    let callIndex = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const payloads = [
          { ok: true, status: 200, json: async () => mainResponseWithEmail },
          { ok: true, status: 200, json: async () => issuesPageEmpty },
        ];
        return Promise.resolve(payloads[callIndex++]);
      })
    );
    const res = await onRequestGet(ctx(["snapshot"]));
    expect(res.status).toBe(502);
    const body = await bodyOf(res);
    expect(body).not.toContain(TEST_KEY);
    expect(body).not.toMatch(/lin_api_/);
  });

  it("502 malformed-JSON body does not contain the API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("bad json");
        },
      })
    );
    const res = await onRequestGet(ctx(["snapshot"]));
    expect(res.status).toBe(502);
    const body = await bodyOf(res);
    expect(body).not.toContain(TEST_KEY);
    expect(body).not.toMatch(/lin_api_/);
  });
});

// ---------------------------------------------------------------------------
// 500: missing env.LINEAR_API_KEY
// ---------------------------------------------------------------------------

describe("500 missing LINEAR_API_KEY", () => {
  it("returns 500 generic when LINEAR_API_KEY is absent and does not call fetch", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await onRequestGet(ctx(["snapshot"], {}));

    expect(res.status).toBe(500);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 502 upstream errors
// ---------------------------------------------------------------------------

describe("502 upstream errors", () => {
  it("returns 502 when upstream returns non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );

    const res = await onRequestGet(ctx(["snapshot"]));
    expect(res.status).toBe(502);
  });

  it("returns 502 when upstream returns GraphQL errors array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { initiatives: { nodes: [] }, projects: { nodes: [] } },
          errors: [{ message: "boom" }],
        }),
      })
    );

    const res = await onRequestGet(ctx(["snapshot"]));
    expect(res.status).toBe(502);
  });
});

// ---------------------------------------------------------------------------
// Two-fetch strategy: REQ-PROXY-PAGINATE — multi-page issue aggregation
// ---------------------------------------------------------------------------

describe("REQ-PROXY-PAGINATE: two-fetch complexity-safe strategy", () => {
  /**
   * Helper: build a fetch stub from an ordered list of response payloads.
   * Each call to fetch() consumes the next payload in sequence.
   */
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

  it("aggregates issue counts correctly across two pages (hasNextPage true → false)", async () => {
    // Call 1: MAIN_QUERY response (no issues)
    // Call 2: ISSUES_QUERY page 1 (hasNextPage: true, endCursor: "cursor-abc")
    // Call 3: ISSUES_QUERY page 2 (hasNextPage: false)
    stubFetchSequence([
      { ok: true, json: async () => mainResponseClean },
      { ok: true, json: async () => issuesPageOne },
      { ok: true, json: async () => issuesPageTwo },
    ]);

    const res = await onRequestGet(ctx(["snapshot"]));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { projects: Array<{ id: string; issueCounts: { backlog: number; started: number; done: number } }> };
    const parsed = RoadmapJsonSchema.safeParse(body);
    expect(parsed.success).toBe(true);

    // proj-001: started+1, completed+1 (from page 1) → started:1, done:1, backlog:0
    const p1 = body.projects.find((p) => p.id === "proj-001");
    expect(p1?.issueCounts.started).toBe(1);
    expect(p1?.issueCounts.done).toBe(1);
    expect(p1?.issueCounts.backlog).toBe(0);

    // proj-002: backlog+1, triage+1 (from page 2) → backlog:2, started:0, done:0
    const p2 = body.projects.find((p) => p.id === "proj-002");
    expect(p2?.issueCounts.backlog).toBe(2);
    expect(p2?.issueCounts.started).toBe(0);
    expect(p2?.issueCounts.done).toBe(0);
  });

  it("skips null-project issues (orphan/inbox) without attributing them anywhere", async () => {
    // issuesPageOne has one null-project issue — it must not bump any project count
    stubFetchSequence([
      { ok: true, json: async () => mainResponseClean },
      { ok: true, json: async () => issuesPageOne },
      { ok: true, json: async () => issuesPageTwo },
    ]);

    const res = await onRequestGet(ctx(["snapshot"]));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { projects: Array<{ id: string; issueCounts: { backlog: number; started: number; done: number } }> };
    // Total attributed issues = proj-001 (started+done=2) + proj-002 (backlog=2) = 4
    // The null-project started issue must NOT appear in any project
    const totalIssues = body.projects.reduce(
      (sum, p) => sum + p.issueCounts.backlog + p.issueCounts.started + p.issueCounts.done,
      0
    );
    expect(totalIssues).toBe(4); // not 5 (the null-project issue is skipped)
  });

  it("returns 502 when the issues request fails (non-ok status)", async () => {
    // Call 1: main request succeeds; Call 2: issues request fails
    stubFetchSequence([
      { ok: true, json: async () => mainResponseClean },
      { ok: false },
    ]);

    const res = await onRequestGet(ctx(["snapshot"]));
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).not.toMatch(/lin_api_/);
    expect(body).not.toContain("@");
  });

  it("returns 502 when the issues request returns GraphQL errors", async () => {
    stubFetchSequence([
      { ok: true, json: async () => mainResponseClean },
      {
        ok: true,
        json: async () => ({
          data: { issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
          errors: [{ message: "issues query failed" }],
        }),
      },
    ]);

    const res = await onRequestGet(ctx(["snapshot"]));
    expect(res.status).toBe(502);
  });

  it("returns 502 when hasNextPage=true but endCursor=null (pagination invariant violation)", async () => {
    // Linear API contract: hasNextPage=true implies endCursor≠null. If violated,
    // fetchAssembledWorkspace throws (prevents infinite loop) and the handler returns 502.
    stubFetchSequence([
      { ok: true, json: async () => mainResponseClean },
      {
        ok: true,
        json: async () => ({
          data: {
            issues: {
              nodes: [],
              pageInfo: { hasNextPage: true, endCursor: null },
            },
          },
        }),
      },
    ]);

    const res = await onRequestGet(ctx(["snapshot"]));
    expect(res.status).toBe(502);
    const body = await res.text();
    // Generic error — must not contain token, email, or cursor value
    expect(body).not.toMatch(/lin_api_/);
    expect(body).not.toContain("@");
  });

  it("single-page issues: correct issue counts from single issues page", async () => {
    stubFetchSequence([
      { ok: true, json: async () => mainResponseClean },
      { ok: true, json: async () => issuesPageSingle },
    ]);

    const res = await onRequestGet(ctx(["snapshot"]));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { projects: Array<{ id: string; issueCounts: { backlog: number; started: number; done: number } }> };
    // proj-001: unstarted→backlog, started, completed→done, cancelled→skip
    const p1 = body.projects.find((p) => p.id === "proj-001");
    expect(p1?.issueCounts.backlog).toBe(1);
    expect(p1?.issueCounts.started).toBe(1);
    expect(p1?.issueCounts.done).toBe(1);

    // proj-002: triage→backlog, backlog→backlog
    const p2 = body.projects.find((p) => p.id === "proj-002");
    expect(p2?.issueCounts.backlog).toBe(2);
  });

  it("email-leak via main response still fires assertNoLeak and returns 502 with no PII", async () => {
    stubFetchSequence([
      { ok: true, json: async () => mainResponseWithEmail },
      { ok: true, json: async () => issuesPageEmpty },
    ]);

    const res = await onRequestGet(ctx(["snapshot"]));
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).not.toContain("@");
    expect(body).not.toContain("secret@example.com");
    expect(body).not.toMatch(/lin_api_/);
  });
});
