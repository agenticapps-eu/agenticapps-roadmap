import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  SyncConfigSchema,
  LinearMapSchema,
  NormalizedModelSchema,
  loadSyncConfig,
  loadLinearMap,
} from "./config.ts";

// ---------------------------------------------------------------------------
// SyncConfigSchema
// ---------------------------------------------------------------------------

describe("SyncConfigSchema", () => {
  it("accepts a valid entry with a name (the --project match key)", () => {
    const parsed = SyncConfigSchema.safeParse([
      { repoPath: "../claude-workflow", name: "claude-workflow", label: "roadmap:claude-workflow", teamKey: "AGE" },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("accepts an entry with an optional initiative/projectName", () => {
    const parsed = SyncConfigSchema.safeParse([
      {
        repoPath: "../../factiv/cparx",
        name: "cparx",
        label: "roadmap:cparx",
        initiative: "Factiv",
        teamKey: "AGE",
        projectName: "cPARX",
      },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("rejects an entry missing repoPath", () => {
    const parsed = SyncConfigSchema.safeParse([
      { name: "claude-workflow", label: "roadmap:claude-workflow" },
    ]);
    expect(parsed.success).toBe(false);
  });

  it("rejects an entry missing name", () => {
    const parsed = SyncConfigSchema.safeParse([
      { repoPath: "../claude-workflow", label: "roadmap:claude-workflow" },
    ]);
    expect(parsed.success).toBe(false);
  });

  it("rejects an entry missing label", () => {
    const parsed = SyncConfigSchema.safeParse([
      { repoPath: "../claude-workflow", name: "claude-workflow" },
    ]);
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LinearMapSchema
// ---------------------------------------------------------------------------

describe("LinearMapSchema", () => {
  it("accepts all-empty pools", () => {
    const parsed = LinearMapSchema.safeParse({
      projects: {},
      milestones: {},
      issues: {},
      projectLabels: {},
      issueLabels: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts populated pools shaped Record<string, {id: string}>", () => {
    const parsed = LinearMapSchema.safeParse({
      projects: { "claude-workflow": { id: "proj-001" } },
      milestones: { "claude-workflow/01-go-routing": { id: "ms-001" } },
      issues: {},
      projectLabels: {},
      issueLabels: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a pool entry missing id", () => {
    const parsed = LinearMapSchema.safeParse({
      projects: { "claude-workflow": {} },
      milestones: {},
      issues: {},
      projectLabels: {},
      issueLabels: {},
    });
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NormalizedModelSchema
// ---------------------------------------------------------------------------

describe("NormalizedModelSchema", () => {
  const validPlan = {
    file: "01-01-PLAN.md",
    title: "Scaffold routing",
    key: "claude-workflow/01-go-routing/01-01-PLAN.md",
    taskLines: ["- [ ] Task 1", "- [x] Task 2"],
  };

  it("accepts a well-formed model", () => {
    const parsed = NormalizedModelSchema.safeParse({
      repo: "claude-workflow",
      projectName: "claude-workflow",
      teamKey: "AGE",
      initiative: "agenticapps-workflow",
      phases: [
        {
          slug: "01-go-routing",
          number: "01",
          completed: true,
          plans: [validPlan],
          proposedDate: "2026-08-01",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a model with no initiative and no proposedDate", () => {
    const parsed = NormalizedModelSchema.safeParse({
      repo: "cparx",
      projectName: "cparx",
      teamKey: "AGE",
      phases: [
        { slug: "03.5-quality-scoring", number: "03.5", completed: false, plans: [validPlan] },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a phase missing slug", () => {
    const parsed = NormalizedModelSchema.safeParse({
      repo: "claude-workflow",
      projectName: "claude-workflow",
      teamKey: "AGE",
      phases: [{ number: "01", completed: true, plans: [validPlan] }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a plan missing key", () => {
    const parsed = NormalizedModelSchema.safeParse({
      repo: "claude-workflow",
      projectName: "claude-workflow",
      teamKey: "AGE",
      phases: [
        {
          slug: "01-go-routing",
          number: "01",
          completed: true,
          plans: [{ file: "01-01-PLAN.md", title: "Scaffold routing", taskLines: [] }],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadSyncConfig / loadLinearMap — read+parse+throw boundary
// ---------------------------------------------------------------------------

describe("loadSyncConfig / loadLinearMap", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("loadSyncConfig returns typed data for a valid file", () => {
    dir = mkdtempSync(path.join(tmpdir(), "sync-gsd-linear-test-"));
    const file = path.join(dir, "sync.config.json");
    writeFileSync(
      file,
      JSON.stringify([
        { repoPath: "../claude-workflow", name: "claude-workflow", label: "roadmap:claude-workflow", teamKey: "AGE" },
      ])
    );
    const result = loadSyncConfig(file);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("claude-workflow");
  });

  it("loadSyncConfig throws a clear error naming the file on invalid data", () => {
    dir = mkdtempSync(path.join(tmpdir(), "sync-gsd-linear-test-"));
    const file = path.join(dir, "sync.config.json");
    writeFileSync(file, JSON.stringify([{ repoPath: "../claude-workflow" }]));
    expect(() => loadSyncConfig(file)).toThrow(file);
  });

  it("loadLinearMap returns typed data for a valid file", () => {
    dir = mkdtempSync(path.join(tmpdir(), "sync-gsd-linear-test-"));
    const file = path.join(dir, "linear-map.json");
    writeFileSync(
      file,
      JSON.stringify({ projects: {}, milestones: {}, issues: {}, projectLabels: {}, issueLabels: {} })
    );
    const result = loadLinearMap(file);
    expect(result.projects).toEqual({});
  });

  it("loadLinearMap throws a clear error naming the file on invalid data", () => {
    dir = mkdtempSync(path.join(tmpdir(), "sync-gsd-linear-test-"));
    const file = path.join(dir, "linear-map.json");
    writeFileSync(file, JSON.stringify({ projects: {} }));
    expect(() => loadLinearMap(file)).toThrow(file);
  });
});
