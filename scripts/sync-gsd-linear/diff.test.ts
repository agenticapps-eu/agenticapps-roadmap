import { describe, it, expect } from "vitest";
import { buildDiff, renderDiff } from "./diff.ts";
import type { NormalizedModel, NormalizedPhase, ResolvedWorkspace } from "./config.ts";

const PLAN_KEY = "test-repo/01-alpha/phases/01-alpha/01-01-PLAN.md";

function alphaPhase(overrides: Partial<NormalizedPhase> = {}): NormalizedPhase {
  return {
    slug: "01-alpha",
    number: "01",
    completed: false,
    proposedDate: "2026-08-01",
    plans: [
      {
        file: "phases/01-alpha/01-01-PLAN.md",
        title: "Alpha Plan",
        key: PLAN_KEY,
        taskLines: [],
      },
    ],
    ...overrides,
  };
}

function baseModel(overrides: Partial<NormalizedModel> = {}): NormalizedModel {
  return {
    repo: "test-repo",
    projectName: "Test Repo",
    teamKey: "AGE",
    initiative: "Test Initiative",
    phases: [alphaPhase()],
    ...overrides,
  };
}

const resolvedAllNew: ResolvedWorkspace = {
  teamId: "team-1",
  project: null,
  projectLabelId: null,
  issueLabelId: null,
  initiativeId: null,
};

function resolvedMatched(targetDate: string | null): ResolvedWorkspace {
  return {
    teamId: "team-1",
    project: {
      id: "proj-1",
      name: "Test Repo",
      repoKey: "test-repo",
      milestones: [{ id: "ms-1", name: "01-alpha", targetDate }],
      issues: [
        {
          id: "iss-1",
          title: "Alpha Plan",
          identityKey: PLAN_KEY,
          projectId: "proj-1",
          milestoneId: "ms-1",
          labelIds: [],
        },
      ],
    },
    projectLabelId: "plabel-1",
    issueLabelId: "ilabel-1",
    initiativeId: "init-1",
  };
}

describe("buildDiff — all-new model", () => {
  const summary = buildDiff(baseModel(), resolvedAllNew);

  it("enumerates project-create, both label-creates, initiative-join, milestone-create, and issue-create", () => {
    const kinds = summary.operations.map((op) => op.kind).sort();
    expect(kinds).toEqual(
      [
        "issue-create",
        "issue-label-create",
        "initiative-join",
        "milestone-create",
        "project-create",
        "project-label-create",
      ].sort()
    );
  });

  it("derives correct human-summary counts from operations", () => {
    expect(summary.milestonesToCreate).toBe(1);
    expect(summary.issuesToCreate).toBe(1);
    expect(summary.labelsToCreate).toBe(2);
  });

  it("does not omit the initiative-join when no initiative is configured", () => {
    const noInitiative = buildDiff(baseModel({ initiative: undefined }), resolvedAllNew);
    expect(noInitiative.operations.some((op) => op.kind === "initiative-join")).toBe(false);
  });

  it("does not join an initiative for an already-existing project (v1 create-only)", () => {
    const existingProject = buildDiff(baseModel(), resolvedMatched("2026-08-01"));
    expect(existingProject.operations.some((op) => op.kind === "initiative-join")).toBe(false);
  });
});

describe("buildDiff — fully-resolved model (idempotency)", () => {
  it("produces an empty operations[] even though a date has drifted", () => {
    const summary = buildDiff(baseModel(), resolvedMatched("2026-06-01"));
    expect(summary.operations).toEqual([]);
  });

  it("surfaces the drifted existing-milestone date as informational, not an operation", () => {
    const summary = buildDiff(baseModel(), resolvedMatched("2026-06-01"));
    expect(summary.datesInformational).toHaveLength(1);
    expect(summary.datesInformational[0]).toContain("01-alpha");
    expect(summary.operations.some((op) => op.kind === "milestone-create")).toBe(false);
  });

  it("reports no date drift when the existing milestone's date already matches", () => {
    const summary = buildDiff(baseModel(), resolvedMatched("2026-08-01"));
    expect(summary.datesInformational).toEqual([]);
    expect(summary.datesToChange).toBe(0);
  });
});

describe("renderDiff", () => {
  it("renders a '+ N milestones, + M issues, + L labels' summary line", () => {
    const summary = buildDiff(baseModel(), resolvedAllNew);
    const output = renderDiff(summary, "test-repo");
    expect(output).toContain("+ ");
    expect(output).toContain("1 milestones");
    expect(output).toContain("1 issues");
  });

  it("labels drifted existing-milestone dates as informational only, never as a write", () => {
    const summary = buildDiff(baseModel(), resolvedMatched("2026-06-01"));
    const output = renderDiff(summary, "test-repo");
    expect(output).toContain("informational only");
  });

  it("omits the dates section entirely when nothing has drifted", () => {
    const summary = buildDiff(baseModel(), resolvedMatched("2026-08-01"));
    const output = renderDiff(summary, "test-repo");
    expect(output).not.toContain("informational only");
  });
});
