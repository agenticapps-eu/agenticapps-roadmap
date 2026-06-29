import { describe, it, expect, vi, afterEach } from "vitest";
import type { LoaderFunctionArgs } from "react-router-dom";
import { roadmapLoader } from "./loader.ts";
import type { RoadmapJson } from "./schema.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal LoaderFunctionArgs from a URL string. */
function args(url: string): LoaderFunctionArgs {
  return { request: new Request(url) } as LoaderFunctionArgs;
}

/** A schema-valid RoadmapJson snapshot fixture. */
const validSnapshot: RoadmapJson = {
  generatedAt: "2026-06-29T00:00:00.000Z",
  initiatives: [
    { id: "ini-001", name: "AgenticApps Workflow", color: "#5e6ad2", status: "started" },
  ],
  projects: [
    {
      id: "proj-001",
      name: "AgenticApps Roadmap",
      summary: "The roadmap app",
      initiativeId: "ini-001",
      status: "started",
      priority: 1,
      startDate: "2026-06-22",
      targetDate: "2026-08-17",
      milestones: [{ id: "ms-001", name: "Phase 1", targetDate: "2026-06-30" }],
      issueCounts: { backlog: 1, started: 1, done: 1 },
    },
  ],
};

/** A fetch stub that serves a given body for a given URL, and serves a valid
 *  snapshot for any other URL (i.e. /roadmap.json).
 */
function makeFetchStub(
  matchUrl: string,
  matchResponse: Response,
): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string) => {
    if (url === matchUrl) return matchResponse;
    // Default: serve a valid snapshot for /roadmap.json
    return new Response(JSON.stringify(validSnapshot), { status: 200 });
  });
}

/** A 200 Response that serves a valid RoadmapJson body. */
function okSnapshot(): Response {
  return new Response(JSON.stringify(validSnapshot), { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

// ---------------------------------------------------------------------------
// SNAPSHOT-DEFAULT: with no ?source the loader makes ZERO /api/linear/* calls
// ---------------------------------------------------------------------------

describe("snapshot default (no ?source)", () => {
  it("returns live=false and makes NO /api/linear/* fetch", async () => {
    const fetchMock = vi.fn(async (_url: string) => okSnapshot());
    vi.stubGlobal("fetch", fetchMock);

    const result = await roadmapLoader(args("http://localhost/"));

    expect(result.live).toBe(false);
    expect(result.liveUnavailable).toBe(false);
    expect(result.data).toBeDefined();

    // The key assertion: no /api/linear/* call must have been made
    const linearCalls = fetchMock.mock.calls.filter(([url]: [string]) =>
      url.includes("/api/linear"),
    );
    expect(linearCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// LIVE-SUCCESS
// ---------------------------------------------------------------------------

describe("live success (?source=live)", () => {
  it("returns live=true and liveUnavailable=false when /api/linear/snapshot succeeds", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/linear/snapshot") {
        return new Response(JSON.stringify(validSnapshot), { status: 200 });
      }
      return okSnapshot();
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await roadmapLoader(args("http://localhost/?source=live"));

    expect(result.live).toBe(true);
    expect(result.liveUnavailable).toBe(false);
    expect(result.data).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// LIVE-FALLBACK matrix: all four failure modes fall back gracefully
// ---------------------------------------------------------------------------

describe("live fallback (?source=live) — failure modes", () => {
  it("(a) rejected fetch falls back: resolves with liveUnavailable=true, no throw", async () => {
    const fetchMock = makeFetchStub(
      "/api/linear/snapshot",
      // This factory won't be used — we override the matched path to reject
      okSnapshot(),
    );
    // Override: /api/linear/snapshot rejects (network error)
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/linear/snapshot") throw new Error("Network failure");
        return okSnapshot();
      }),
    );

    const result = await roadmapLoader(args("http://localhost/?source=live"));

    expect(result.live).toBe(false);
    expect(result.liveUnavailable).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("(b) res.json() throws SyntaxError falls back: resolves with liveUnavailable=true, no throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/linear/snapshot") {
          // A response whose .json() will throw a SyntaxError
          return new Response("this is not json", { status: 200 });
        }
        return okSnapshot();
      }),
    );

    const result = await roadmapLoader(args("http://localhost/?source=live"));

    expect(result.live).toBe(false);
    expect(result.liveUnavailable).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("(c) !res.ok (non-200) falls back: resolves with liveUnavailable=true, no throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/linear/snapshot") {
          return new Response("upstream error", { status: 502 });
        }
        return okSnapshot();
      }),
    );

    const result = await roadmapLoader(args("http://localhost/?source=live"));

    expect(result.live).toBe(false);
    expect(result.liveUnavailable).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("(d) schema-invalid JSON falls back: resolves with liveUnavailable=true, no throw", async () => {
    const schemaInvalidBody = { generatedAt: "2026-06-29T00:00:00.000Z" }; // missing required fields
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/linear/snapshot") {
          return new Response(JSON.stringify(schemaInvalidBody), { status: 200 });
        }
        return okSnapshot();
      }),
    );

    const result = await roadmapLoader(args("http://localhost/?source=live"));

    expect(result.live).toBe(false);
    expect(result.liveUnavailable).toBe(true);
    expect(result.data).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SNAPSHOT FAILURE — genuine outage still throws a Response (error boundary)
// ---------------------------------------------------------------------------

describe("snapshot failure — error boundary", () => {
  it("throws a Response when /roadmap.json returns !ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );

    await expect(
      roadmapLoader(args("http://localhost/")),
    ).rejects.toBeInstanceOf(Response);
  });

  it("throws a Response when /roadmap.json returns malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );

    await expect(
      roadmapLoader(args("http://localhost/")),
    ).rejects.toBeInstanceOf(Response);
  });
});
