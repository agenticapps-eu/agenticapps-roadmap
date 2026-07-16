import { describe, it, expect } from "vitest";
import { RoadmapJsonSchema } from "./schema.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal, schema-valid project literal (no planAhead key). */
function baseProject() {
  return {
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
  };
}

/** Wraps a single project literal into a full RoadmapJson snapshot literal. */
function snapshotWith(project: Record<string, unknown>) {
  return {
    generatedAt: "2026-06-29T00:00:00.000Z",
    initiatives: [
      { id: "ini-001", name: "AgenticApps Workflow", color: "#5e6ad2", status: "started" },
    ],
    projects: [project],
  };
}

// ---------------------------------------------------------------------------
// planAhead (OV-04, D-05-02) — back-compat + presence
// ---------------------------------------------------------------------------

describe("ProjectSchema planAhead (OV-04)", () => {
  it("back-compat: a snapshot whose project has NO planAhead key still parses", () => {
    const result = RoadmapJsonSchema.safeParse(snapshotWith(baseProject()));

    expect(result.success).toBe(true);
  });

  it("presence true: a project with planAhead: true parses to planAhead === true", () => {
    const result = RoadmapJsonSchema.safeParse(
      snapshotWith({ ...baseProject(), planAhead: true }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projects[0].planAhead).toBe(true);
    }
  });

  it("presence false: a project with planAhead: false parses to planAhead === false", () => {
    const result = RoadmapJsonSchema.safeParse(
      snapshotWith({ ...baseProject(), planAhead: false }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projects[0].planAhead).toBe(false);
    }
  });

  it("nullish: a project with planAhead: null parses to planAhead === null", () => {
    const result = RoadmapJsonSchema.safeParse(
      snapshotWith({ ...baseProject(), planAhead: null }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projects[0].planAhead).toBe(null);
    }
  });

  it("rejects wrong type: a project with planAhead: \"yes\" fails to parse", () => {
    const result = RoadmapJsonSchema.safeParse(
      snapshotWith({ ...baseProject(), planAhead: "yes" }),
    );

    expect(result.success).toBe(false);
  });
});
