import { describe, it, expect } from "vitest";
import { buildSnapshot, assertNoLeak } from "./transform.ts";
import { RoadmapJsonSchema } from "../../src/lib/roadmap/schema.ts";
import { rawMalicious } from "./__fixtures__/raw-malicious.ts";
import { rawClean } from "./__fixtures__/raw-clean.ts";

describe("assertNoLeak", () => {
  it("throws on lin_api_ token pattern", () => {
    expect(() =>
      assertNoLeak('{"name":"lin_api_DEADBEEF1234567890abcdef"}')
    ).toThrow();
  });

  it("throws on email address", () => {
    expect(() => assertNoLeak('{"contact":"secret@example.com"}')).toThrow();
  });

  it("does not throw on clean text", () => {
    expect(() => assertNoLeak('{"name":"AgenticApps Roadmap"}')).not.toThrow();
  });
});

describe("buildSnapshot — malicious fixture", () => {
  it("throws when a planted token is present in the raw data", () => {
    expect(() => buildSnapshot(rawMalicious)).toThrow();
  });
});

describe("buildSnapshot — clean fixture", () => {
  it("returns a value that passes RoadmapJsonSchema.safeParse", () => {
    const result = buildSnapshot(rawClean);
    const parsed = RoadmapJsonSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("produces correct issueCounts bucketing for proj-001", () => {
    const result = buildSnapshot(rawClean);
    const proj = result.projects.find((p) => p.id === "proj-001");
    expect(proj?.issueCounts).toEqual({ backlog: 1, started: 1, done: 1 });
  });

  it("produces correct issueCounts for proj-002 (triage + backlog → backlog bucket)", () => {
    const result = buildSnapshot(rawClean);
    const proj = result.projects.find((p) => p.id === "proj-002");
    expect(proj?.issueCounts).toEqual({ backlog: 2, started: 0, done: 0 });
  });

  it("excludes canceled issues from all buckets for proj-003", () => {
    const result = buildSnapshot(rawClean);
    const proj = result.projects.find((p) => p.id === "proj-003");
    expect(proj?.issueCounts).toEqual({ backlog: 0, started: 0, done: 0 });
  });

  it("maps nullable color correctly", () => {
    const result = buildSnapshot(rawClean);
    const factiv = result.initiatives.find((i) => i.id === "ini-factiv-001");
    expect(factiv?.color).toBeNull();
  });

  it("maps non-null color correctly", () => {
    const result = buildSnapshot(rawClean);
    const age = result.initiatives.find((i) => i.id === "ini-age-001");
    expect(age?.color).toBe("#5e6ad2");
  });

  it("includes milestones for proj-001", () => {
    const result = buildSnapshot(rawClean);
    const proj = result.projects.find((p) => p.id === "proj-001");
    expect(proj?.milestones).toHaveLength(2);
    expect(proj?.milestones[0]).toEqual({
      id: "ms-001",
      name: "Phase 1 — Scaffold",
      targetDate: "2026-06-30",
    });
  });
});

describe("RoadmapJsonSchema", () => {
  it("rejects a malformed object missing required fields", () => {
    const result = RoadmapJsonSchema.safeParse({ bad: "data" });
    expect(result.success).toBe(false);
  });

  it("rejects a project with missing issueCounts", () => {
    const result = RoadmapJsonSchema.safeParse({
      generatedAt: new Date().toISOString(),
      initiatives: [],
      projects: [{ id: "x", name: "x" }],
    });
    expect(result.success).toBe(false);
  });
});
