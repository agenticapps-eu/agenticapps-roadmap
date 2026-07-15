import { describe, it, expect } from "vitest";
import {
  isScheduled,
  PRIORITY_LABELS,
  computeKpis,
  rollupInitiativeHealth,
} from "./selectors";
import type { Project, Initiative } from "@/lib/roadmap/schema";

function mkProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Project",
    summary: null,
    url: null,
    initiativeId: null,
    status: "In Progress",
    priority: 2,
    startDate: null,
    targetDate: null,
    milestones: [],
    issueCounts: { backlog: 0, started: 0, done: 0 },
    ...overrides,
  };
}

function mkInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: "init-1",
    name: "Initiative",
    color: null,
    status: "Active",
    ...overrides,
  };
}

describe("isScheduled", () => {
  it("is true iff targetDate is set (Phase-4 D-06) — startDate alone does not count", () => {
    expect(isScheduled(mkProject({ targetDate: "2026-08-01" }))).toBe(true);
    expect(
      isScheduled(mkProject({ targetDate: null, startDate: "2026-08-01" }))
    ).toBe(false);
    expect(isScheduled(mkProject({ targetDate: null, startDate: null }))).toBe(
      false
    );
  });
});

describe("computeKpis", () => {
  it("counts scheduled vs undated and total projects", () => {
    const projects = [
      mkProject({ id: "a", targetDate: "2026-08-01" }),
      mkProject({ id: "b", targetDate: "2026-09-01" }),
      mkProject({ id: "c", targetDate: null }),
    ];
    const kpis = computeKpis(projects);
    expect(kpis.scheduled).toBe(2);
    expect(kpis.undated).toBe(1);
    expect(kpis.projects).toBe(3);
  });

  it("counts a startDate-only project as undated (not scheduled)", () => {
    const kpis = computeKpis([
      mkProject({ startDate: "2026-01-01", targetDate: null }),
    ]);
    expect(kpis.scheduled).toBe(0);
    expect(kpis.undated).toBe(1);
  });

  it("builds correct byPriority/byStatus count maps", () => {
    const projects = [
      mkProject({ id: "a", priority: 1, status: "Backlog" }),
      mkProject({ id: "b", priority: 1, status: "Backlog" }),
      mkProject({ id: "c", priority: 3, status: "Done" }),
    ];
    const kpis = computeKpis(projects);
    expect(kpis.byPriority).toEqual({ 1: 2, 3: 1 });
    expect(kpis.byStatus).toEqual({ Backlog: 2, Done: 1 });
  });

  it("initiatives KPI = distinct non-null initiativeId among the PASSED (filtered) projects, null excluded", () => {
    const oneInit = [
      mkProject({ id: "a", initiativeId: "ini-1" }),
      mkProject({ id: "b", initiativeId: "ini-1" }),
    ];
    expect(computeKpis(oneInit).initiatives).toBe(1);

    const threeInits = [
      mkProject({ id: "a", initiativeId: "ini-1" }),
      mkProject({ id: "b", initiativeId: "ini-2" }),
      mkProject({ id: "c", initiativeId: "ini-3" }),
      mkProject({ id: "d", initiativeId: null }),
      mkProject({ id: "e", initiativeId: null }),
    ];
    expect(computeKpis(threeInits).initiatives).toBe(3);
  });
});

describe("PRIORITY_LABELS", () => {
  it("is the canonical Linear-accurate 0..4 map (0=No priority .. 4=Low)", () => {
    expect(PRIORITY_LABELS).toEqual({
      0: "No priority",
      1: "Urgent",
      2: "High",
      3: "Medium",
      4: "Low",
    });
    expect(PRIORITY_LABELS[4]).toBe("Low");
  });
});

describe("rollupInitiativeHealth", () => {
  it("sums issueCounts and the scheduled/undated split for an initiative's projects", () => {
    const initiatives = [mkInitiative({ id: "ini-1" })];
    const projects = [
      mkProject({
        id: "a",
        initiativeId: "ini-1",
        targetDate: "2026-08-01",
        issueCounts: { backlog: 1, started: 2, done: 3 },
      }),
      mkProject({
        id: "b",
        initiativeId: "ini-1",
        targetDate: null,
        issueCounts: { backlog: 4, started: 5, done: 6 },
      }),
    ];
    const rows = rollupInitiativeHealth(projects, initiatives);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      initiative: initiatives[0],
      projectCount: 2,
      scheduled: 1,
      undated: 1,
      backlog: 5,
      started: 7,
      done: 9,
    });
  });

  it("yields an all-zeros row for a zero-project initiative", () => {
    const initiatives = [mkInitiative({ id: "ini-empty" })];
    const rows = rollupInitiativeHealth([], initiatives);
    expect(rows).toEqual([
      {
        initiative: initiatives[0],
        projectCount: 0,
        scheduled: 0,
        undated: 0,
        backlog: 0,
        started: 0,
        done: 0,
      },
    ]);
  });

  it("appends an Unassigned (initiative: null) row when initiativeId === null projects exist", () => {
    const initiatives = [mkInitiative({ id: "ini-1" })];
    const projects = [
      mkProject({ id: "a", initiativeId: "ini-1" }),
      mkProject({
        id: "b",
        initiativeId: null,
        issueCounts: { backlog: 1, started: 0, done: 0 },
      }),
    ];
    const rows = rollupInitiativeHealth(projects, initiatives);
    expect(rows).toHaveLength(2);
    expect(rows[1].initiative).toBeNull();
    expect(rows[1].projectCount).toBe(1);
    expect(rows[1].backlog).toBe(1);
  });

  it("omits the Unassigned row when no null-initiative projects exist", () => {
    const initiatives = [mkInitiative({ id: "ini-1" })];
    const projects = [mkProject({ id: "a", initiativeId: "ini-1" })];
    const rows = rollupInitiativeHealth(projects, initiatives);
    expect(rows).toHaveLength(1);
    expect(rows.some((r) => r.initiative === null)).toBe(false);
  });
});
