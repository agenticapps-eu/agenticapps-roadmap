import { describe, it, expect } from "vitest";
import { formatFreshness } from "./freshness.ts";

const now = new Date("2026-07-16T12:00:00.000Z");

describe("formatFreshness", () => {
  it("returns 'updated just now' for under 60 seconds", () => {
    expect(formatFreshness("2026-07-16T11:59:30.000Z", now)).toBe(
      "updated just now",
    );
  });

  it("returns 'updated Nm ago' for minutes", () => {
    expect(formatFreshness("2026-07-16T11:55:00.000Z", now)).toBe(
      "updated 5m ago",
    );
  });

  it("returns 'updated Nh ago' for hours", () => {
    expect(formatFreshness("2026-07-16T09:00:00.000Z", now)).toBe(
      "updated 3h ago",
    );
  });

  it("returns 'updated Nd ago' for days", () => {
    expect(formatFreshness("2026-07-13T12:00:00.000Z", now)).toBe(
      "updated 3d ago",
    );
  });

  it("returns a safe fallback for undefined", () => {
    expect(formatFreshness(undefined, now)).toBe("");
  });

  it("returns a safe fallback for null", () => {
    expect(formatFreshness(null, now)).toBe("");
  });

  it("returns a safe fallback for an empty string", () => {
    expect(formatFreshness("", now)).toBe("");
  });

  it("returns a safe fallback for an invalid timestamp, never throws", () => {
    expect(() => formatFreshness("not-a-date", now)).not.toThrow();
    expect(formatFreshness("not-a-date", now)).toBe("");
  });
});
