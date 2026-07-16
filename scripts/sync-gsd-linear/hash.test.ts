import { describe, expect, it } from "vitest";
import { titleHash } from "./hash.ts";

describe("titleHash", () => {
  it("is stable across repeat calls with the same input", () => {
    const input = "01-go-routing";
    expect(titleHash(input)).toBe(titleHash(input));
  });

  it("is deterministic across a fixed known input (regression pin)", () => {
    // sha256("01-go-routing") — pinned so an accidental algorithm swap is caught.
    expect(titleHash("01-go-routing")).toBe(
      "bda0b4e9f355b9a1349990821b5c704f4cf18802ef711404d13895dbddabb906"
    );
  });

  it("hashes two duplicate-NN phase slugs differently (collision-freedom)", () => {
    const routingHash = titleHash("01-go-routing");
    const bugFixesHash = titleHash("01-gsd-bug-fixes");
    expect(routingHash).not.toBe(bugFixesHash);
  });

  it("hashes two distinct plan keys that share a generic display title differently", () => {
    // Both plans would display as the generic H1 "# Phase 09 — PLAN" if the
    // display title were (wrongly) used as the hash input — proving the
    // hash must key on the stable identity `key`, not `title`.
    const planAKey = "claude-workflow/09-generic-phase/09-01-PLAN.md";
    const planBKey = "claude-workflow/09-generic-phase/09-02-PLAN.md";
    expect(titleHash(planAKey)).not.toBe(titleHash(planBKey));
  });
});
