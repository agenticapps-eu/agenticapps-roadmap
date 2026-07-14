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
      url: "https://linear.app/agenticapps/project/test-proj-001",
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
    const fetchMock = vi.fn(async () => okSnapshot());
    vi.stubGlobal("fetch", fetchMock);

    const result = await roadmapLoader(args("http://localhost/"));

    expect(result.live).toBe(false);
    expect(result.liveUnavailable).toBe(false);
    expect(result.data).toBeDefined();

    // The key assertion: no /api/linear/* call must have been made
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/linear"),
    );
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
    // /api/linear/snapshot rejects (network error); /roadmap.json returns valid snapshot
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
