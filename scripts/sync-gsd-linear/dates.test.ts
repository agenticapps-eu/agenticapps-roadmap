import { describe, it, expect } from "vitest";
import { comparePhaseNumber, proposeDates } from "./dates.ts";
import type { NormalizedPhase } from "./config.ts";

function phase(overrides: Partial<NormalizedPhase>): NormalizedPhase {
  return {
    slug: "01-example",
    number: "01",
    completed: false,
    plans: [],
    proposedDate: null,
    ...overrides,
  };
}

describe("comparePhaseNumber", () => {
  it("orders 04.2 before 04.10 (component-wise, not parseFloat)", () => {
    expect(comparePhaseNumber("04.2", "04.10")).toBeLessThan(0);
  });

  it("orders a bare phase before its decimal insertion (04 before 04.2)", () => {
    expect(comparePhaseNumber("04", "04.2")).toBeLessThan(0);
  });

  it("orders 03.5 between 03 and 04", () => {
    expect(comparePhaseNumber("03", "03.5")).toBeLessThan(0);
    expect(comparePhaseNumber("03.5", "04")).toBeLessThan(0);
  });

  it("returns 0 for equal numbers", () => {
    expect(comparePhaseNumber("04.2", "04.2")).toBe(0);
  });

  it("orders a non-numeric phase slug (no leading numeric token) after every numeric one (WR-01)", () => {
    expect(comparePhaseNumber("intro-notes", "01")).toBeGreaterThan(0);
    expect(comparePhaseNumber("01", "intro-notes")).toBeLessThan(0);
  });

  it("stays a total comparator across a mixed list -- no NaN ordering (WR-01)", () => {
    const numbers = ["03", "intro-notes", "01", "02"];
    const sorted = [...numbers].sort(comparePhaseNumber);
    expect(sorted).toEqual(["01", "02", "03", "intro-notes"]);
  });
});

describe("proposeDates", () => {
  it("anchors the first not-completed phase at the anchor date", () => {
    const phases = [phase({ slug: "01-a", number: "01" })];
    const result = proposeDates(phases, { anchor: "2026-08-01", cadenceWeeks: 2 });
    expect(result[0]?.proposedDate).toBe("2026-08-01");
  });

  it("adds cadenceWeeks per subsequent not-completed phase", () => {
    const phases = [
      phase({ slug: "01-a", number: "01" }),
      phase({ slug: "02-b", number: "02" }),
    ];
    const result = proposeDates(phases, { anchor: "2026-08-01", cadenceWeeks: 2 });
    expect(result[0]?.proposedDate).toBe("2026-08-01");
    expect(result[1]?.proposedDate).toBe("2026-08-15");
  });

  it("leaves a completed phase's existing proposedDate untouched", () => {
    const phases = [
      phase({ slug: "01-a", number: "01", completed: true, proposedDate: "2026-01-01" }),
      phase({ slug: "02-b", number: "02" }),
    ];
    const result = proposeDates(phases, { anchor: "2026-08-01", cadenceWeeks: 2 });
    expect(result[0]?.proposedDate).toBe("2026-01-01");
    // Cadence still starts at the anchor for the first not-completed phase.
    expect(result[1]?.proposedDate).toBe("2026-08-01");
  });

  it("inserts a decimal phase in the correct order and cadence position", () => {
    const phases = [
      phase({ slug: "04-a", number: "04" }),
      phase({ slug: "04.10-c", number: "04.10" }),
      phase({ slug: "04.2-b", number: "04.2" }),
    ];
    const result = proposeDates(phases, { anchor: "2026-08-01", cadenceWeeks: 1 });
    expect(result.map((p) => p.slug)).toEqual(["04-a", "04.2-b", "04.10-c"]);
    expect(result[0]?.proposedDate).toBe("2026-08-01");
    expect(result[1]?.proposedDate).toBe("2026-08-08");
    expect(result[2]?.proposedDate).toBe("2026-08-15");
  });

  it("does not mutate the input array or its phase objects", () => {
    const phases = [phase({ slug: "01-a", number: "01", proposedDate: null })];
    const snapshot = JSON.parse(JSON.stringify(phases)) as unknown;
    proposeDates(phases, { anchor: "2026-08-01", cadenceWeeks: 2 });
    expect(phases).toEqual(snapshot);
  });

  it("defaults cadenceWeeks to 2 and anchor to today", () => {
    const phases = [phase({ slug: "01-a", number: "01" })];
    const result = proposeDates(phases);
    expect(result[0]?.proposedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
