import { describe, it, expect } from "vitest";
import { resolveInitiativeColor, luminanceFor } from "./colorUtils";

describe("resolveInitiativeColor", () => {
  const all = [
    { id: "ini-callbot", color: "#0ea5e9" },
    { id: "agenticapps-workflow", color: null },
    { id: "ini-cparx", color: "#5e6ad2" },
  ];

  it("returns the API color unchanged when set", () => {
    expect(resolveInitiativeColor(all[0], all)).toBe("#0ea5e9");
  });

  it("returns FALLBACK_PALETTE[0] for the only null-color initiative", () => {
    expect(resolveInitiativeColor(all[1], all)).toBe("#10b981");
  });

  it("assigns palette by lexicographic null-id order (first→[0], second→[1])", () => {
    const two = [
      { id: "zeta", color: null },
      { id: "alpha", color: null },
    ];
    expect(resolveInitiativeColor(two[1], two)).toBe("#10b981"); // "alpha" first
    expect(resolveInitiativeColor(two[0], two)).toBe("#6366f1"); // "zeta" second
  });

  it("is deterministic across repeated calls", () => {
    const a = resolveInitiativeColor(all[1], all);
    const b = resolveInitiativeColor(all[1], all);
    expect(a).toBe(b);
  });
});

describe("luminanceFor", () => {
  it("yellow #f2c94c is bright (> 0.4 → caller uses dark text)", () => {
    expect(luminanceFor("#f2c94c")).toBeGreaterThan(0.4);
  });

  it("purple #5e6ad2 is dark (< 0.4 → caller uses white text)", () => {
    expect(luminanceFor("#5e6ad2")).toBeLessThan(0.4);
  });
});
