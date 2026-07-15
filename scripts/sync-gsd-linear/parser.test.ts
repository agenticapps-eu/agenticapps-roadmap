import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { walkPlanning } from "./walker.ts";
import { parseRepo } from "./parser.ts";

const FIXTURES_ROOT = path.join(import.meta.dirname, "__fixtures__/planning-trees");

const META = { repo: "claude-workflow", projectName: "claude-workflow", teamKey: "AGE" };

describe("parseRepo", () => {
  it("uses the frontmatter H1 as the title (not the slug/filename fallback)", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "duplicate-NN"));
    const model = parseRepo(raw, META);
    const phase = model.phases.find((p) => p.slug === "01-go-routing");
    expect(phase?.plans[0]?.title).toBe("Phase 1 Plan 1: Go-based routing scaffold");
  });

  it("falls back to the FILENAME (not the slug) for a generic-H1 NN-MM-PLAN.md", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "two-generic-plans-in-one-phase"));
    const model = parseRepo(raw, META);
    const phase = model.phases.find((p) => p.slug === "20-execution");
    const titles = phase?.plans.map((p) => p.title).sort();
    expect(titles).toEqual(["20-01-PLAN", "20-02-PLAN"]);
  });

  it("gives two generic-H1 plans in one phase distinct identity keys (no collision)", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "two-generic-plans-in-one-phase"));
    const model = parseRepo(raw, META);
    const phase = model.phases.find((p) => p.slug === "20-execution");
    const keys = phase?.plans.map((p) => p.key) ?? [];
    expect(new Set(keys).size).toBe(keys.length);
    // IN-02: key is `${repo}/${relativePlanPath}` -- relativePlanPath already
    // contains the phase slug, so it is never prepended a second time.
    expect(keys).toEqual(
      expect.arrayContaining([
        "claude-workflow/phases/20-execution/20-01-PLAN.md",
        "claude-workflow/phases/20-execution/20-02-PLAN.md",
      ])
    );
  });

  it("falls back to the directory slug for a single bare PLAN.md phase (generic H1, no frontmatter)", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "bare-PLAN"));
    const model = parseRepo(raw, META);
    const phase = model.phases.find((p) => p.slug === "05-bare");
    expect(phase?.plans).toHaveLength(1);
    expect(phase?.plans[0]?.title).toBe("05-bare");
  });

  it("falls back to the directory slug for a frontmatter-less generic-H1 bare PLAN.md", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "frontmatter-less"));
    const model = parseRepo(raw, META);
    const phase = model.phases.find((p) => p.slug === "09-legacy");
    expect(phase?.plans[0]?.title).toBe("09-legacy");
  });

  it("populates taskLines from a plan's checklist lines", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "duplicate-NN"));
    const model = parseRepo(raw, META);
    const phase = model.phases.find((p) => p.slug === "01-go-routing");
    expect(phase?.plans[0]?.taskLines).toEqual(
      expect.arrayContaining([
        "- [ ] Create router.go with the base mux",
        "- [ ] Wire health-check route",
        "- [ ] Add router_test.go covering the health-check route",
      ])
    );
  });

  it("returns an empty taskLines array for a bodyless plan (no checklist lines)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sync-gsd-linear-parser-test-"));
    try {
      const phasesDir = path.join(dir, "phases", "01-bodyless");
      mkdirSync(phasesDir, { recursive: true });
      writeFileSync(
        path.join(phasesDir, "01-01-PLAN.md"),
        "---\nphase: 01\nplan: 01\n---\n\n# A plan with no checklist\n\nJust prose here, no list items at all.\n"
      );
      const raw = walkPlanning(dir);
      const model = parseRepo(raw, META);
      expect(model.phases[0]?.plans[0]?.taskLines).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores a '#'-comment inside a fenced code block when picking the H1 title", () => {
    // Regression: H1 extraction matched the first `# ` line anywhere in the
    // body, including bash comments inside ``` fences, producing garbage
    // titles for real plans (verifier gap, phase 06). The title must be the
    // genuine markdown H1, not the fenced comment that precedes it.
    const dir = mkdtempSync(path.join(tmpdir(), "sync-gsd-linear-parser-test-"));
    try {
      const phasesDir = path.join(dir, "phases", "01-fenced");
      mkdirSync(phasesDir, { recursive: true });
      writeFileSync(
        path.join(phasesDir, "01-01-PLAN.md"),
        "---\nphase: 01\nplan: 01\n---\n\n" +
          "```bash\n# CURRENT: numeric filters only (0001, 0005)\necho hi\n```\n\n" +
          "# Real Plan Title\n\nBody prose.\n"
      );
      const raw = walkPlanning(dir);
      const model = parseRepo(raw, META);
      expect(model.phases[0]?.plans[0]?.title).toBe("Real Plan Title");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the leading numeric token as a dot-separated string, not parseFloat", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "decimal-phase"));
    const model = parseRepo(raw, META);
    const numbers = model.phases.map((p) => p.number).sort();
    expect(numbers).toEqual(["03.5", "04.10", "04.2"]);
  });

  it("classifies the VERIFICATION.md-bearing phase as completed", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "duplicate-NN"));
    const model = parseRepo(raw, META);
    const phase = model.phases.find((p) => p.slug === "01-go-routing");
    expect(phase?.completed).toBe(true);
  });

  it("classifies the ROADMAP.md-checked phase as completed", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "duplicate-NN"));
    const model = parseRepo(raw, META);
    const phase = model.phases.find((p) => p.slug === "01-gsd-bug-fixes");
    expect(phase?.completed).toBe(true);
  });

  it("classifies the SUMMARY.md-sibling phase as completed", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "decimal-phase"));
    const model = parseRepo(raw, META);
    const phase = model.phases.find((p) => p.slug === "03.5-quality");
    expect(phase?.completed).toBe(true);
  });

  it("classifies a plan-only phase (no ROADMAP/VERIFICATION/SUMMARY) as in-progress", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "decimal-phase"));
    const model = parseRepo(raw, META);
    const phase = model.phases.find((p) => p.slug === "04.10-x");
    expect(phase?.completed).toBe(false);
  });

  it("produces a schema-valid NormalizedModel end to end", () => {
    const raw = walkPlanning(path.join(FIXTURES_ROOT, "duplicate-NN"));
    // parseRepo already calls NormalizedModelSchema.parse internally and
    // throws on an invalid shape, so a successful call is itself the proof.
    expect(() => parseRepo(raw, META)).not.toThrow();
  });
});
