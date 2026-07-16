// ---------------------------------------------------------------------------
// Entrypoint test (IN-03): proves runCli's throw path is caught here rather
// than surfacing as an unhandled promise rejection with a raw stack trace.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./sync-gsd-linear/cli.ts", () => ({ runCli: vi.fn() }));

import { runCli } from "./sync-gsd-linear/cli.ts";

describe("sync-gsd-linear entrypoint", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // The entrypoint runs its top-level `await runCli(...)` on import --
    // reset the module registry so each test re-executes it fresh.
    vi.resetModules();
  });

  it("exits with runCli's resolved code on success", async () => {
    vi.mocked(runCli).mockResolvedValue(0);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await import("./sync-gsd-linear.ts");

    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("prints err.message and exits 1 instead of an unhandled rejection when runCli throws", async () => {
    vi.mocked(runCli).mockRejectedValue(new Error("LINEAR_API_KEY environment variable is not set."));
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await import("./sync-gsd-linear.ts");

    expect(errorSpy).toHaveBeenCalledWith("LINEAR_API_KEY environment variable is not set.");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
