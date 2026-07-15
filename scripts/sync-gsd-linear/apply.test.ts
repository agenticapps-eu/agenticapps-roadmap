import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  applyProject,
  writeLinearMap,
  patchPlanAhead,
  type ApplyDeps,
} from "./apply.ts";
import {
  createMutationMock,
  type MutationMock,
} from "./__fixtures__/linear-mutation-mock.ts";
import type { LinearMap, NormalizedModel } from "./config.ts";
import type { RoadmapJson } from "../../src/lib/roadmap/schema.ts";

// node:fs built-ins can't be vi.spyOn'd directly under ESM (module namespace
// is not configurable) — wrap the real implementations in vi.fn() via
// vi.mock's importOriginal so calls stay real (files are actually written)
// but are also observable for the atomic-map assertions below.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: vi.fn(actual.writeFileSync),
    renameSync: vi.fn(actual.renameSync),
  };
});

const ENDPOINT = "https://api.linear.app/graphql";
const AUTH = "test-token";

function emptyMap(): LinearMap {
  return {
    projects: {},
    milestones: {},
    issues: {},
    projectLabels: {},
    issueLabels: {},
  };
}

const PLAN_KEY = "test-repo/01-alpha/01-01-PLAN.md";

function baseModel(overrides: Partial<NormalizedModel> = {}): NormalizedModel {
  return {
    repo: "test-repo",
    projectName: "Test Repo",
    teamKey: "AGE",
    initiative: "agenticapps-workflow",
    phases: [
      {
        slug: "01-alpha",
        number: "01",
        completed: false,
        proposedDate: "2026-08-01",
        plans: [
          {
            file: "phases/01-alpha/01-01-PLAN.md",
            title: "Alpha Plan",
            key: PLAN_KEY,
            taskLines: ["- [ ] Task 1", "- [ ] Task 2"],
          },
        ],
      },
    ],
    ...overrides,
  };
}

/** Extracts every GraphQL operation name a spy on mock.fetchFn observed. */
function operationNameOf(query: string): string | null {
  const match = /^\s*(?:query|mutation)\s+(\w+)/.exec(query);
  return match?.[1] ?? null;
}

function opNamesCalled(spy: ReturnType<typeof vi.fn>): string[] {
  return spy.mock.calls.map((call) => {
    const init = call[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body ?? "{}")) as { query: string };
    return operationNameOf(body.query) ?? "";
  });
}

function spiedDeps(mock: MutationMock): {
  deps: ApplyDeps;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn(mock.fetchFn);
  return {
    deps: {
      fetchFn: spy as unknown as typeof fetch,
      endpoint: ENDPOINT,
      auth: AUTH,
    },
    spy,
  };
}

const MUTATION_OP_NAMES = [
  "ProjectCreate",
  "ProjectLabelCreate",
  "IssueLabelCreate",
  "InitiativeToProjectCreate",
  "ProjectMilestoneCreate",
  "ProjectMilestoneUpdate",
  "IssueCreate",
  "IssueUpdate",
];

// ---------------------------------------------------------------------------
// roadmap.json fixture (temp file per test)
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-gsd-linear-apply-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

/** Every applyProject call in this file passes an explicit, tmpDir-scoped
 * mapPath — never the DEFAULT_MAP_PATH ("linear-map.json") fallback, which
 * resolves relative to cwd and would otherwise clobber this repo's own
 * committed linear-map.json when tests run from the repo root. */
function tmpMapPath(): string {
  return path.join(tmpDir, "linear-map.json");
}

function writeRoadmapFixture(
  overrides: Partial<RoadmapJson["projects"][number]> = {},
): string {
  const roadmapPath = path.join(tmpDir, "roadmap.json");
  const roadmap: RoadmapJson = {
    generatedAt: "2026-07-15T00:00:00.000Z",
    initiatives: [],
    projects: [
      {
        id: "proj-1",
        name: "Test Repo",
        summary: null,
        url: null,
        initiativeId: null,
        status: "In Progress",
        priority: 1,
        startDate: null,
        targetDate: null,
        milestones: [],
        issueCounts: { backlog: 0, started: 0, done: 0 },
        ...overrides,
      },
    ],
  };
  fs.writeFileSync(roadmapPath, JSON.stringify(roadmap, null, 2));
  return roadmapPath;
}

// ---------------------------------------------------------------------------
// dry-run: zero mutation calls
// ---------------------------------------------------------------------------

describe("applyProject dry-run", () => {
  it("issues zero mutation fetches", async () => {
    const mock = createMutationMock();
    const { deps, spy } = spiedDeps(mock);
    const roadmapPath = writeRoadmapFixture();

    const result = await applyProject(deps, baseModel(), emptyMap(), {
      dryRun: true,
      roadmapPath,
      mapPath: tmpMapPath(),
    });

    expect(result.operations.length).toBeGreaterThan(0);
    const opNames = opNamesCalled(spy);
    for (const mutationName of MUTATION_OP_NAMES) {
      expect(opNames).not.toContain(mutationName);
    }
  });
});

// ---------------------------------------------------------------------------
// idempotent: second apply against the now-populated map/mock creates nothing
// ---------------------------------------------------------------------------

describe("applyProject idempotent re-run", () => {
  it("second applyProject creates nothing", async () => {
    const mock = createMutationMock();
    const { deps } = spiedDeps(mock);
    const roadmapPath = writeRoadmapFixture();
    const map = emptyMap();

    const first = await applyProject(deps, baseModel(), map, {
      dryRun: false,
      roadmapPath,
      mapPath: tmpMapPath(),
    });
    expect(first.operations.length).toBeGreaterThan(0);
    expect(mock.state.projects.length).toBe(1);
    expect(mock.state.projectMilestones.length).toBe(1);
    expect(mock.state.issues.length).toBe(1);

    const second = await applyProject(deps, baseModel(), map, {
      dryRun: false,
      roadmapPath,
      mapPath: tmpMapPath(),
    });
    expect(second.operations).toEqual([]);
    expect(mock.state.projects.length).toBe(1);
    expect(mock.state.projectMilestones.length).toBe(1);
    expect(mock.state.issues.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// CR-01: issue dedup survives total linear-map.json loss. The old title-hash
// fallback could never match (issues are titled with plan.title, never
// plan.key) -- this proves the description-marker tier does.
// ---------------------------------------------------------------------------

describe("applyProject survives linear-map.json loss (CR-01)", () => {
  it("a second apply with a FRESH EMPTY map creates nothing (project/milestone/issue all re-resolve)", async () => {
    const mock = createMutationMock();
    const { deps } = spiedDeps(mock);
    const roadmapPath = writeRoadmapFixture();

    const first = await applyProject(deps, baseModel(), emptyMap(), {
      dryRun: false,
      roadmapPath,
      mapPath: tmpMapPath(),
    });
    expect(first.operations.length).toBeGreaterThan(0);
    expect(mock.state.projects).toHaveLength(1);
    expect(mock.state.projectMilestones).toHaveLength(1);
    expect(mock.state.issues).toHaveLength(1);
    // apply.ts never titles an issue with its identity key (D-06-01).
    expect(mock.state.issues[0]?.title).toBe("Alpha Plan");
    expect(mock.state.issues[0]?.description).toContain(`<!--gsd-key:${PLAN_KEY}-->`);

    // Simulate linear-map.json being lost/rebased: a brand-new, unrelated
    // empty map object -- NOT the one `first` mutated in place.
    const second = await applyProject(deps, baseModel(), emptyMap(), {
      dryRun: false,
      roadmapPath,
      mapPath: tmpMapPath(),
    });
    expect(second.operations).toEqual([]);
    expect(mock.state.projects).toHaveLength(1);
    expect(mock.state.projectMilestones).toHaveLength(1);
    expect(mock.state.issues).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// initiative-join: fires exactly once, uses resolved.initiativeId (not name)
// ---------------------------------------------------------------------------

describe("applyProject initiative-join", () => {
  it("joins with the resolved Initiative id on first apply, not again on second", async () => {
    const mock = createMutationMock();
    const { deps } = spiedDeps(mock);
    const roadmapPath = writeRoadmapFixture();
    const map = emptyMap();

    await applyProject(deps, baseModel(), map, {
      dryRun: false,
      roadmapPath,
      mapPath: tmpMapPath(),
    });
    expect(mock.state.initiativeToProjects.length).toBe(1);
    expect(mock.state.initiativeToProjects[0]?.initiativeId).toBe(
      "ini-age-001",
    );
    expect(mock.state.initiativeToProjects[0]?.initiativeId).not.toBe(
      "agenticapps-workflow",
    );

    await applyProject(deps, baseModel(), map, {
      dryRun: false,
      roadmapPath,
      mapPath: tmpMapPath(),
    });
    expect(mock.state.initiativeToProjects.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// create-only: an existing drifted milestone date is never written
// ---------------------------------------------------------------------------

describe("applyProject create-only", () => {
  it("does not call ProjectMilestoneUpdate for a drifted existing milestone", async () => {
    const mock = createMutationMock();

    const projectId = "mock-project-seed";
    mock.state.projects.push({
      id: projectId,
      name: "Test Repo",
      teamIds: ["team-age-001"],
      labelIds: [],
    });
    mock.state.projectMilestones.push({
      id: "mock-milestone-seed",
      name: "01-alpha",
      projectId,
      targetDate: "2026-01-01",
    });

    const { deps, spy } = spiedDeps(mock);
    const roadmapPath = writeRoadmapFixture();
    const map: LinearMap = {
      ...emptyMap(),
      projects: { "test-repo": { id: projectId } },
    };

    const result = await applyProject(deps, baseModel(), map, {
      dryRun: false,
      roadmapPath,
      mapPath: tmpMapPath(),
    });

    expect(result.datesInformational.length).toBe(1);
    expect(result.datesInformational[0]).toContain("2026-01-01");
    const opNames = opNamesCalled(spy);
    expect(opNames).not.toContain("ProjectMilestoneUpdate");
    expect(mock.state.projectMilestones[0]?.targetDate).toBe("2026-01-01");
  });
});

// ---------------------------------------------------------------------------
// atomic-map: temp-file + rename, persisted after each create (not batched)
// ---------------------------------------------------------------------------

describe("applyProject atomic-map write-back", () => {
  it("uses writeLinearMap's temp-file + rename directly", () => {
    vi.mocked(fs.writeFileSync).mockClear();
    vi.mocked(fs.renameSync).mockClear();

    const mapPath = path.join(tmpDir, "linear-map.json");
    writeLinearMap(mapPath, emptyMap());

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      `${mapPath}.tmp`,
      expect.any(String),
    );
    expect(fs.renameSync).toHaveBeenCalledWith(`${mapPath}.tmp`, mapPath);
  });

  it("persists ids after each create, not only at the end", async () => {
    const mock = createMutationMock();
    const { deps } = spiedDeps(mock);
    const roadmapPath = writeRoadmapFixture();
    const mapPath = path.join(tmpDir, "linear-map.json");
    fs.writeFileSync(mapPath, JSON.stringify(emptyMap(), null, 2));

    vi.mocked(fs.renameSync).mockClear();

    const result = await applyProject(deps, baseModel(), emptyMap(), {
      dryRun: false,
      roadmapPath,
      mapPath,
    });

    // Every create writes into a map pool except initiative-join (no pool).
    const mapWritingOps = result.operations.filter(
      (op) => op.kind !== "initiative-join",
    ).length;
    expect(mapWritingOps).toBeGreaterThan(1);
    expect(vi.mocked(fs.renameSync).mock.calls.length).toBe(mapWritingOps);

    // The persisted file on disk reflects the writes (proves per-create,
    // not an in-memory-only batch at the very end).
    const persisted = JSON.parse(
      fs.readFileSync(mapPath, "utf-8"),
    ) as LinearMap;
    expect(persisted.projects["test-repo"]).toBeTruthy();
    expect(persisted.issues[PLAN_KEY]).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// abort-on-drift: TOCTOU guard
// ---------------------------------------------------------------------------

describe("applyProject abort-on-drift", () => {
  it("throws when Linear state changes between the shown diff and the write", async () => {
    const mock = createMutationMock();
    let workspaceMainCalls = 0;

    const drifting: typeof fetch = (async (url, init) => {
      const body = JSON.parse(String((init as RequestInit)?.body ?? "{}")) as {
        query: string;
      };
      if (operationNameOf(body.query) === "WorkspaceMain") {
        workspaceMainCalls += 1;
        if (workspaceMainCalls === 2) {
          // Simulate an out-of-band change between applyProject's baseline
          // resolve and its TOCTOU re-resolve: someone else created the
          // project label directly in Linear.
          mock.state.projectLabels.push({
            id: "external-label",
            name: "roadmap:test-repo",
          });
        }
      }
      return mock.fetchFn(url, init);
    }) as typeof fetch;

    const deps: ApplyDeps = {
      fetchFn: drifting,
      endpoint: ENDPOINT,
      auth: AUTH,
    };
    const roadmapPath = writeRoadmapFixture();

    await expect(
      applyProject(deps, baseModel(), emptyMap(), {
        dryRun: false,
        roadmapPath,
        mapPath: tmpMapPath(),
      }),
    ).rejects.toThrow(/Linear state changed since the diff was shown/);
  });
});

// ---------------------------------------------------------------------------
// planAhead: gated leak/schema-safe patch
// ---------------------------------------------------------------------------

describe("applyProject planAhead patch", () => {
  it("keeps roadmap.json schema-valid and sets planAhead on real apply", async () => {
    const mock = createMutationMock();
    const { deps } = spiedDeps(mock);
    const roadmapPath = writeRoadmapFixture();

    await applyProject(deps, baseModel(), emptyMap(), {
      dryRun: false,
      roadmapPath,
      mapPath: tmpMapPath(),
    });

    const patched = JSON.parse(
      fs.readFileSync(roadmapPath, "utf-8"),
    ) as RoadmapJson;
    expect(patched.projects[0]?.planAhead).toBe(true);
  });

  it("throws via assertNoLeak before writing when the roadmap already contains a token", () => {
    const roadmapPath = writeRoadmapFixture({
      summary: "leaked lin_api_FAKESECRET123 in notes",
    });
    expect(() => patchPlanAhead(roadmapPath, "Test Repo", true)).toThrow(
      /SECURITY/,
    );
  });

  it("does not patch roadmap.json on a plain dry-run (no --write-snapshot)", async () => {
    const mock = createMutationMock();
    const { deps } = spiedDeps(mock);
    const roadmapPath = writeRoadmapFixture();
    const before = fs.readFileSync(roadmapPath, "utf-8");

    await applyProject(deps, baseModel(), emptyMap(), {
      dryRun: true,
      roadmapPath,
      mapPath: tmpMapPath(),
    });

    const after = fs.readFileSync(roadmapPath, "utf-8");
    expect(after).toBe(before);
  });

  it("patches roadmap.json on dry-run WITH --write-snapshot, with zero mutations", async () => {
    const mock = createMutationMock();
    const { deps, spy } = spiedDeps(mock);
    const roadmapPath = writeRoadmapFixture();

    await applyProject(deps, baseModel(), emptyMap(), {
      dryRun: true,
      writeSnapshot: true,
      roadmapPath,
      mapPath: tmpMapPath(),
    });

    const patched = JSON.parse(
      fs.readFileSync(roadmapPath, "utf-8"),
    ) as RoadmapJson;
    expect(patched.projects[0]?.planAhead).toBe(true);
    const opNames = opNamesCalled(spy);
    for (const mutationName of MUTATION_OP_NAMES) {
      expect(opNames).not.toContain(mutationName);
    }
  });
});
