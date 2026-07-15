import { describe, it, expect } from "vitest";
import {
  isScheduled,
  PRIORITY_LABELS,
  computeKpis,
  rollupInitiativeHealth,
  decodeFilters,
  encodeFilters,
  resolveRange,
  applyFilters,
  type Filters,
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

const EMPTY_FILTERS: Filters = {
  initiatives: [],
  quarter: null,
  from: null,
  to: null,
  statuses: [],
  priorities: [],
};

describe("decodeFilters/encodeFilters round-trip", () => {
  it("round-trips valid Filters through encode -> decode (number-typed priorities)", () => {
    const f: Filters = {
      initiatives: ["ini-1", "ini-2"],
      quarter: "2026-Q3",
      from: null,
      to: null,
      statuses: ["Backlog", "Done"],
      priorities: [1, 3],
    };
    expect(decodeFilters(encodeFilters(f))).toEqual(f);
  });

  it("decodes repeated params via getAll (not CSV)", () => {
    const sp = new URLSearchParams();
    sp.append("initiative", "A");
    sp.append("initiative", "B");
    expect(decodeFilters(sp).initiatives).toEqual(["A", "B"]);
  });

  it("omits empty dimensions on encode (clean shareable URL)", () => {
    const sp = encodeFilters(EMPTY_FILTERS);
    expect([...sp.keys()]).toEqual([]);
  });

  it("preserves non-filter params (?project, ?source) given as base, which decodeFilters ignores", () => {
    const base = new URLSearchParams("project=p1&source=live");
    const f: Filters = { ...EMPTY_FILTERS, initiatives: ["ini-1"] };
    const sp = encodeFilters(f, base);
    expect(sp.get("project")).toBe("p1");
    expect(sp.get("source")).toBe("live");
    expect(sp.getAll("initiative")).toEqual(["ini-1"]);
  });

  it("defensively drops invalid priority values (non-canonical / out-of-range)", () => {
    const sp = new URLSearchParams();
    ["9", "x", "1.5", "", " ", "0x2", "1e1"].forEach((v) =>
      sp.append("priority", v)
    );
    sp.append("priority", "2");
    expect(decodeFilters(sp).priorities).toEqual([2]);
  });

  it("defensively drops non-real-calendar from/to dates", () => {
    const sp = new URLSearchParams("from=2026-02-31&to=2026-13-01");
    const f = decodeFilters(sp);
    expect(f.from).toBeNull();
    expect(f.to).toBeNull();
  });

  it("accepts a valid real-calendar ISO date", () => {
    const sp = new URLSearchParams("from=2026-02-05&to=2026-03-10");
    const f = decodeFilters(sp);
    expect(f.from).toBe("2026-02-05");
    expect(f.to).toBe("2026-03-10");
  });

  it("ignores project/source params entirely (never read as filters)", () => {
    const sp = new URLSearchParams("project=p1&source=live");
    expect(decodeFilters(sp)).toEqual(EMPTY_FILTERS);
  });
});

describe("resolveRange", () => {
  it("gives custom from/to precedence over a coexisting quarter (05-REVIEWS finding 3)", () => {
    const f: Filters = {
      ...EMPTY_FILTERS,
      quarter: "2026-Q3",
      from: "2026-01-05",
      to: "2026-02-05",
    };
    expect(resolveRange(f)).toEqual({ start: "2026-01-05", end: "2026-02-05" });
  });

  it("resolves a quarter preset when no custom range is set", () => {
    const f: Filters = { ...EMPTY_FILTERS, quarter: "2026-Q3" };
    expect(resolveRange(f)).toEqual({ start: "2026-07-01", end: "2026-09-30" });
  });

  it("returns null when neither quarter nor custom range is set", () => {
    expect(resolveRange(EMPTY_FILTERS)).toBeNull();
  });

  it.each([
    ["2026-Q1", { start: "2026-01-01", end: "2026-03-31" }],
    ["2026-Q2", { start: "2026-04-01", end: "2026-06-30" }],
    ["2026-Q3", { start: "2026-07-01", end: "2026-09-30" }],
    ["2026-Q4", { start: "2026-10-01", end: "2026-12-31" }],
  ])("resolves quarter %s", (quarter, expected) => {
    expect(resolveRange({ ...EMPTY_FILTERS, quarter })).toEqual(expected);
  });

  it.each(["2026-Q5", "2026-Q0", "garbage", "2026-Q1-extra", "2026-Qx"])(
    "returns null for invalid/malformed quarter %s",
    (quarter) => {
      expect(resolveRange({ ...EMPTY_FILTERS, quarter })).toBeNull();
    }
  );

  it("returns the range AS GIVEN for a reversed from > to custom range (no throw)", () => {
    const f: Filters = { ...EMPTY_FILTERS, from: "2026-05-01", to: "2026-01-01" };
    expect(resolveRange(f)).toEqual({ start: "2026-05-01", end: "2026-01-01" });
  });
});

describe("applyFilters", () => {
  it("AND-composes initiative + status + priority dimensions", () => {
    const projects = [
      mkProject({ id: "a", initiativeId: "ini-1", status: "Backlog", priority: 1 }),
      mkProject({ id: "b", initiativeId: "ini-1", status: "Done", priority: 1 }),
      mkProject({ id: "c", initiativeId: "ini-2", status: "Backlog", priority: 1 }),
    ];
    const filters: Filters = {
      ...EMPTY_FILTERS,
      initiatives: ["ini-1"],
      statuses: ["Backlog"],
      priorities: [1],
    };
    const result = applyFilters(projects, filters, null);
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("excludes undated projects when a range is active (A1)", () => {
    const projects = [
      mkProject({ id: "a", targetDate: "2026-08-01" }),
      mkProject({ id: "b", targetDate: null }),
    ];
    const range = { start: "2026-01-01", end: "2026-12-31" };
    const result = applyFilters(projects, EMPTY_FILTERS, range);
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("includes undated projects when range is null", () => {
    const projects = [
      mkProject({ id: "a", targetDate: "2026-08-01" }),
      mkProject({ id: "b", targetDate: null }),
    ];
    const result = applyFilters(projects, EMPTY_FILTERS, null);
    expect(result.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("excludes projects outside the resolved range", () => {
    const projects = [
      mkProject({ id: "a", targetDate: "2026-08-01" }),
      mkProject({ id: "b", targetDate: "2027-01-01" }),
    ];
    const range = { start: "2026-01-01", end: "2026-12-31" };
    const result = applyFilters(projects, EMPTY_FILTERS, range);
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });
});
