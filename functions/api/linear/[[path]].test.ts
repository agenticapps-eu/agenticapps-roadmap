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
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { onRequestGet } from "./[[path]].ts";
import { gqlClean } from "../../../scripts/linear/__fixtures__/gql-clean.ts";
import { gqlWithEmail } from "../../../scripts/linear/__fixtures__/gql-with-email.ts";
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => gqlClean, // returned DIRECTLY — not wrapped in { data: ... }
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => gqlWithEmail, // fixture has secret@example.com planted
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => gqlClean,
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => gqlWithEmail,
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
