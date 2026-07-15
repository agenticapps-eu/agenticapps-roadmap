import { describe, it, expect } from "vitest";
import path from "node:path";
import { walkPlanning } from "./walker.ts";

const FIXTURES_ROOT = path.join(import.meta.dirname, "__fixtures__/planning-trees");

describe("walkPlanning", () => {
  it("enumerates duplicate leading-number dirs as distinct slugs", () => {
    const result = walkPlanning(path.join(FIXTURES_ROOT, "duplicate-NN"));
    const slugs = result.map((r) => r.slug);
    expect(slugs).toContain("01-go-routing");
    expect(slugs).toContain("01-gsd-bug-fixes");
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("captures each duplicate-NN phase dir's own planFiles, not merged together", () => {
    const result = walkPlanning(path.join(FIXTURES_ROOT, "duplicate-NN"));
    const goRouting = result.find((r) => r.slug === "01-go-routing");
    const bugFixes = result.find((r) => r.slug === "01-gsd-bug-fixes");
    expect(goRouting?.planFiles).toHaveLength(1);
    expect(goRouting?.planFiles[0]).toMatch(/01-go-routing[/\\]01-01-PLAN\.md$/);
    expect(bugFixes?.planFiles).toHaveLength(1);
    expect(bugFixes?.planFiles[0]).toMatch(/01-gsd-bug-fixes[/\\]01-01-PLAN\.md$/);
  });

  it("detects the optional root ROADMAP.md and reports null STATE.md when absent", () => {
    const result = walkPlanning(path.join(FIXTURES_ROOT, "duplicate-NN"));
    for (const raw of result) {
      expect(raw.roadmapPath).toMatch(/ROADMAP\.md$/);
      expect(raw.statePath).toBeNull();
    }
  });

  it("enumerates all decimal-numbered phase dirs", () => {
    const result = walkPlanning(path.join(FIXTURES_ROOT, "decimal-phase"));
    const slugs = result.map((r) => r.slug).sort();
    expect(slugs).toEqual(["03.5-quality", "04.10-x", "04.2-y"]);
  });

  it("reports null roadmapPath/statePath when neither file exists at the repo root", () => {
    const result = walkPlanning(path.join(FIXTURES_ROOT, "decimal-phase"));
    for (const raw of result) {
      expect(raw.roadmapPath).toBeNull();
      expect(raw.statePath).toBeNull();
    }
  });

  it("captures exactly one planFile for a bare single-PLAN.md phase directory", () => {
    const result = walkPlanning(path.join(FIXTURES_ROOT, "bare-PLAN"));
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("05-bare");
    expect(result[0]?.planFiles).toHaveLength(1);
    expect(result[0]?.planFiles[0]).toMatch(/PLAN\.md$/);
  });

  it("captures both generic-H1 plan files in a single phase directory", () => {
    const result = walkPlanning(path.join(FIXTURES_ROOT, "two-generic-plans-in-one-phase"));
    expect(result).toHaveLength(1);
    expect(result[0]?.planFiles).toHaveLength(2);
  });

  it("returns an empty array and does not throw when phases/ is missing", () => {
    const result = walkPlanning(path.join(FIXTURES_ROOT, "does-not-exist"));
    expect(result).toEqual([]);
  });

  it("returns an empty array and does not throw when the repo path itself is missing", () => {
    const result = walkPlanning(path.join(FIXTURES_ROOT, "totally-missing-repo"));
    expect(result).toEqual([]);
  });
});
