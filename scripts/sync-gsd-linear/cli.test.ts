// ---------------------------------------------------------------------------
// Orchestration tests for runCli -- every neighboring stage (config load,
// walker, parser, apply, prompt) is mocked so this file proves the CLI's
// OWN wiring/truth-table logic (parseArgs -> --project resolution ->
// dry-run/apply branching -> confirm gating) without ever touching the real
// committed sync.config.json/linear-map.json/public/roadmap.json or the
// network -- mirrors 06-06's own caution (apply.test.ts's Rule-1 deviation)
// about never writing test state into real repo-root files.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./config.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config.ts")>();
  return { ...actual, loadSyncConfig: vi.fn(), loadLinearMap: vi.fn() };
});
vi.mock("./walker.ts", () => ({ walkPlanning: vi.fn(() => []) }));
vi.mock("./parser.ts", () => ({ parseRepo: vi.fn() }));
vi.mock("./apply.ts", () => ({ applyProject: vi.fn(), writeLinearMap: vi.fn() }));
vi.mock("./prompt.ts", () => ({ confirm: vi.fn() }));

import { runCli } from "./cli.ts";
import { loadSyncConfig, loadLinearMap } from "./config.ts";
import { parseRepo } from "./parser.ts";
import { applyProject, writeLinearMap } from "./apply.ts";
import { confirm } from "./prompt.ts";
import type { DiffSummary, LinearMap, NormalizedModel, SyncConfigEntry } from "./config.ts";

function emptyMap(): LinearMap {
  return { projects: {}, milestones: {}, issues: {}, projectLabels: {}, issueLabels: {} };
}

const ENTRY_A: SyncConfigEntry = {
  repoPath: "../repo-a",
  name: "repo-a",
  label: "roadmap:repo-a",
  teamKey: "AGE",
};
const ENTRY_B: SyncConfigEntry = {
  repoPath: "../repo-b",
  name: "repo-b",
  label: "roadmap:repo-b",
  teamKey: "AGE",
};

function fakeModel(repo: string): NormalizedModel {
  return { repo, projectName: repo, teamKey: "AGE", phases: [] };
}

const EMPTY_DIFF: DiffSummary = {
  operations: [],
  datesInformational: [],
  milestonesToCreate: 0,
  issuesToCreate: 0,
  labelsToCreate: 0,
  datesToChange: 0,
  detail: [],
};

describe("runCli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["LINEAR_API_KEY"] = "test-key";
    vi.mocked(loadSyncConfig).mockReturnValue([ENTRY_A, ENTRY_B]);
    vi.mocked(loadLinearMap).mockReturnValue(emptyMap());
    vi.mocked(parseRepo).mockImplementation((_dirs, meta) => fakeModel(meta.repo));
    vi.mocked(applyProject).mockResolvedValue(EMPTY_DIFF);
    vi.mocked(confirm).mockResolvedValue(true);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("a --project-less --dry-run prints a preview and performs zero mutations", async () => {
    const code = await runCli(["--dry-run"]);
    expect(code).toBe(0);
    expect(applyProject).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(applyProject).mock.calls) {
      expect(call[3]).toMatchObject({ dryRun: true });
    }
    expect(writeLinearMap).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("a --project-less --apply throws the bulk-write error", async () => {
    await expect(runCli(["--apply"])).rejects.toThrow(/bulk write is disallowed/);
    expect(applyProject).not.toHaveBeenCalled();
  });

  it("a --project-less --yes throws the bulk-write error", async () => {
    await expect(runCli(["--yes"])).rejects.toThrow(/bulk write is disallowed/);
    expect(applyProject).not.toHaveBeenCalled();
  });

  it("--project matching zero entries errors without applying", async () => {
    await expect(runCli(["--project", "nope"])).rejects.toThrow(/bulk write is disallowed/);
    expect(applyProject).not.toHaveBeenCalled();
  });

  it("--project matching multiple entries errors without applying, even in dry-run", async () => {
    vi.mocked(loadSyncConfig).mockReturnValue([ENTRY_A, { ...ENTRY_A }]);
    await expect(runCli(["--project", "repo-a"])).rejects.toThrow(/bulk write is disallowed/);
    expect(applyProject).not.toHaveBeenCalled();
  });

  it("dry-run default (single project) performs no write", async () => {
    const code = await runCli(["--project", "repo-a"]);
    expect(code).toBe(0);
    expect(applyProject).toHaveBeenCalledTimes(1);
    expect(vi.mocked(applyProject).mock.calls[0]![3]).toMatchObject({ dryRun: true });
    expect(confirm).not.toHaveBeenCalled();
    expect(writeLinearMap).not.toHaveBeenCalled();
  });

  it("--project X --apply calls confirm() then applyProject in write mode", async () => {
    const code = await runCli(["--project", "repo-a", "--apply"]);
    expect(code).toBe(0);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(applyProject).toHaveBeenCalledTimes(2);
    expect(vi.mocked(applyProject).mock.calls[0]![3]).toMatchObject({ dryRun: true });
    expect(vi.mocked(applyProject).mock.calls[1]![3]).toMatchObject({ dryRun: false });
    expect(writeLinearMap).toHaveBeenCalledTimes(1);
  });

  it("--project X --yes writes without confirm()", async () => {
    const code = await runCli(["--project", "repo-a", "--yes"]);
    expect(code).toBe(0);
    expect(confirm).not.toHaveBeenCalled();
    expect(applyProject).toHaveBeenCalledTimes(2);
    expect(vi.mocked(applyProject).mock.calls[1]![3]).toMatchObject({ dryRun: false });
    expect(writeLinearMap).toHaveBeenCalledTimes(1);
  });

  it("--project X --apply aborts without writing when confirm() returns false", async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    const code = await runCli(["--project", "repo-a", "--apply"]);
    expect(code).toBe(0);
    expect(applyProject).toHaveBeenCalledTimes(1);
    expect(writeLinearMap).not.toHaveBeenCalled();
  });

  it("--project resolves against entry.name", async () => {
    await runCli(["--project", "repo-b"]);
    expect(parseRepo).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ repo: "repo-b" })
    );
  });

  it("throws a clear error when LINEAR_API_KEY is unset", async () => {
    delete process.env["LINEAR_API_KEY"];
    await expect(runCli(["--dry-run"])).rejects.toThrow(/LINEAR_API_KEY/);
    expect(loadSyncConfig).not.toHaveBeenCalled();
  });

  it("throws a clear error for a malformed --anchor before any I/O (WR-02)", async () => {
    await expect(runCli(["--dry-run", "--anchor", "xyz"])).rejects.toThrow(
      /--anchor "xyz" is not a valid YYYY-MM-DD date/
    );
    expect(loadSyncConfig).not.toHaveBeenCalled();
  });

  it("accepts a well-formed --anchor", async () => {
    const code = await runCli(["--dry-run", "--anchor", "2026-08-01"]);
    expect(code).toBe(0);
  });

  it("throws a clear error for --cadence 0 (IN-04)", async () => {
    await expect(runCli(["--dry-run", "--cadence", "0"])).rejects.toThrow(
      /--cadence "0" is not a valid positive number of weeks/
    );
    expect(loadSyncConfig).not.toHaveBeenCalled();
  });

  it("throws a clear error for a negative --cadence (IN-04)", async () => {
    await expect(runCli(["--dry-run", "--cadence=-2"])).rejects.toThrow(
      /is not a valid positive number of weeks/
    );
    expect(loadSyncConfig).not.toHaveBeenCalled();
  });
});
