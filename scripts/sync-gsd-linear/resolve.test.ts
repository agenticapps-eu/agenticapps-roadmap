import { describe, it, expect } from "vitest";
import {
  resolveTeam,
  resolveLabels,
  resolveInitiative,
  resolveProjectByLabel,
  resolveProject,
  readProjectIssues,
  readProjectMilestones,
  resolveMilestone,
  buildResolvedWorkspace,
} from "./resolve.ts";
import { fetchAssembledWorkspace } from "../linear/fetch-workspace.ts";
import { mapWorkspace } from "../linear/map.ts";
import type { RawWorkspace } from "../linear/transform.ts";
import type { LinearMap, ResolvedProject, SyncConfigEntry } from "./config.ts";
import {
  teamsResponseAge,
  projectLabelsEmpty,
  projectLabelsExisting,
  issueLabelsEmpty,
  issueLabelsExisting,
  workspaceEmpty,
  workspaceWithProject,
} from "./__fixtures__/linear-responses.ts";
import { createMutationMock } from "./__fixtures__/linear-mutation-mock.ts";
import {
  PROJECT_CREATE,
  PROJECT_MILESTONE_CREATE,
  ISSUE_CREATE,
  PROJECT_ISSUES_QUERY,
} from "./mutations.ts";

const ENDPOINT = "https://api.linear.app/graphql";
const AUTH = "test-token";

function operationNameOf(query: string): string | null {
  const match = /^\s*(?:query|mutation)\s+(\w+)/.exec(query);
  return match?.[1] ?? null;
}

/** Dispatches by GraphQL operation name to a fixed response map — robust to
 * call ordering (unlike a sequential-array mock), mirrors linear-mutation-
 * mock.ts's own dispatch style but for read-only fixed fixtures. */
function stubFetch(responses: Record<string, unknown>): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { query: string };
    const opName = operationNameOf(body.query);
    const payload = opName ? responses[opName] : undefined;
    if (payload === undefined) {
      return new Response(
        JSON.stringify({
          data: null,
          errors: [{ message: `stub: unknown operation "${opName ?? ""}"` }],
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;
}

function emptyMap(): LinearMap {
  return { projects: {}, milestones: {}, issues: {}, projectLabels: {}, issueLabels: {} };
}

// ---------------------------------------------------------------------------
// Task 1: team + both label pools
// ---------------------------------------------------------------------------

describe("resolveTeam", () => {
  it("resolves the AGE team id", async () => {
    const fetchFn = stubFetch({ TeamByKey: teamsResponseAge });
    const id = await resolveTeam(fetchFn, ENDPOINT, AUTH, "AGE");
    expect(id).toBe("team-age-001");
  });

  it("throws a clear error when the configured team key does not resolve", async () => {
    const fetchFn = stubFetch({ TeamByKey: { data: { teams: { nodes: [] } } } });
    await expect(resolveTeam(fetchFn, ENDPOINT, AUTH, "NOPE")).rejects.toThrow(
      'Linear team "NOPE" not found'
    );
  });

  it("resolves a DIFFERENT team via a second, per-entry teamKey override (closes RESEARCH A1)", async () => {
    const fetchFn = stubFetch({
      TeamByKey: { data: { teams: { nodes: [{ id: "team-fct-001", name: "Factiv", key: "FCT" }] } } },
    });
    const id = await resolveTeam(fetchFn, ENDPOINT, AUTH, "FCT");
    expect(id).toBe("team-fct-001");
    expect(id).not.toBe("team-age-001");
  });
});

describe("resolveLabels", () => {
  it("queries both pools independently: one hit (project), one miss (issue)", async () => {
    const fetchFn = stubFetch({
      ProjectLabelByName: projectLabelsExisting,
      IssueLabelByName: issueLabelsEmpty,
    });
    const result = await resolveLabels(fetchFn, ENDPOINT, AUTH, "roadmap:claude-workflow");
    expect(result).toEqual({ projectLabelId: "plabel-001", issueLabelId: null });
  });

  it("resolves both pools when both exist", async () => {
    const fetchFn = stubFetch({
      ProjectLabelByName: projectLabelsExisting,
      IssueLabelByName: issueLabelsExisting,
    });
    const result = await resolveLabels(fetchFn, ENDPOINT, AUTH, "roadmap:claude-workflow");
    expect(result).toEqual({ projectLabelId: "plabel-001", issueLabelId: "ilabel-001" });
  });

  it("passes the label name through GraphQL variables, never string interpolation", async () => {
    let capturedProjectVars: unknown;
    let capturedIssueVars: unknown;
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { query: string; variables?: unknown };
      const opName = operationNameOf(body.query);
      if (opName === "ProjectLabelByName") capturedProjectVars = body.variables;
      if (opName === "IssueLabelByName") capturedIssueVars = body.variables;
      const payload = opName === "ProjectLabelByName" ? projectLabelsEmpty : issueLabelsEmpty;
      return new Response(JSON.stringify(payload), { status: 200 });
    }) as typeof fetch;

    await resolveLabels(fetchFn, ENDPOINT, AUTH, "roadmap:cparx");
    expect(capturedProjectVars).toEqual({ name: "roadmap:cparx" });
    expect(capturedIssueVars).toEqual({ name: "roadmap:cparx" });
  });
});

// ---------------------------------------------------------------------------
// Task 2: initiative, project, milestone, issue (map -> label -> hash)
// ---------------------------------------------------------------------------

describe("resolveInitiative", () => {
  const workspace: RawWorkspace = {
    initiatives: [
      { id: "ini-age-001", name: "agenticapps-workflow", color: "#5e6ad2", state: "started" },
      { id: "ini-factiv-001", name: "Factiv", color: null, state: "started" },
    ],
    projects: [],
  };

  it("resolves a configured initiative name to its Linear id", () => {
    expect(resolveInitiative(workspace, "Factiv")).toBe("ini-factiv-001");
  });

  it("returns null when the config entry names no initiative", () => {
    expect(resolveInitiative(workspace, undefined)).toBeNull();
  });

  it("throws a clear error (fail-closed) when a configured name has no match", () => {
    expect(() => resolveInitiative(workspace, "Nonexistent")).toThrow(
      'Linear initiative "Nonexistent" not found'
    );
  });
});

describe("resolveProjectByLabel", () => {
  it("resolves the project id carrying the given label", async () => {
    const fetchFn = stubFetch({ ProjectByLabel: { data: { projects: { nodes: [{ id: "proj-x" }] } } } });
    const id = await resolveProjectByLabel(fetchFn, ENDPOINT, AUTH, "roadmap:repo1");
    expect(id).toBe("proj-x");
  });

  it("returns null (soft-fail) when the query itself errors, rather than throwing", async () => {
    const fetchFn = stubFetch({ ProjectByLabel: { data: null, errors: [{ message: "boom" }] } });
    await expect(resolveProjectByLabel(fetchFn, ENDPOINT, AUTH, "roadmap:repo1")).resolves.toBeNull();
  });

  it("returns null when the transport doesn't implement the operation at all", async () => {
    const fetchFn = stubFetch({});
    await expect(resolveProjectByLabel(fetchFn, ENDPOINT, AUTH, "roadmap:repo1")).resolves.toBeNull();
  });
});

describe("resolveProject", () => {
  const workspace: RawWorkspace = {
    initiatives: [],
    projects: [
      {
        id: "proj-a",
        name: "Other Name",
        description: null,
        url: "https://linear.app/x/a",
        initiativeId: null,
        state: { name: "In Progress", type: "started" },
        priority: 1,
        startedAt: null,
        targetDate: null,
        projectMilestones: { nodes: [{ id: "ms-a-1", name: "01-go", targetDate: null }] },
        issues: { nodes: [] },
      },
      {
        id: "proj-b",
        name: "repo1-project",
        description: null,
        url: "https://linear.app/x/b",
        initiativeId: null,
        state: { name: "In Progress", type: "started" },
        priority: 1,
        startedAt: null,
        targetDate: null,
        projectMilestones: { nodes: [] },
        issues: { nodes: [] },
      },
    ],
  };

  const entry: SyncConfigEntry = {
    repoPath: "../repo1",
    name: "repo1",
    label: "roadmap:repo1",
    projectName: "repo1-project",
  };

  it("returns null when neither map, label, nor name match anything", () => {
    const empty: RawWorkspace = { initiatives: [], projects: [] };
    expect(resolveProject(empty, emptyMap(), entry, null)).toBeNull();
  });

  it("resolves via the configured project name when map id and label are both absent (step 3)", () => {
    const resolved = resolveProject(workspace, emptyMap(), entry, null);
    expect(resolved?.id).toBe("proj-b");
    expect(resolved?.milestones).toEqual([]);
  });

  it("the label-carrying project wins over the name match when map id is absent (step 2 beats step 3)", () => {
    const resolved = resolveProject(workspace, emptyMap(), entry, "proj-a");
    expect(resolved?.id).toBe("proj-a");
    expect(resolved?.milestones).toEqual([{ id: "ms-a-1", name: "01-go", targetDate: null }]);
  });

  it("the stored map id wins over both the label and name steps", () => {
    const map = emptyMap();
    map.projects["repo1"] = { id: "proj-b" };
    // labeledProjectId points at proj-a, entry.projectName also matches
    // proj-b — the stored map id must still win.
    const resolved = resolveProject(workspace, map, entry, "proj-a");
    expect(resolved?.id).toBe("proj-b");
  });
});

describe("readProjectIssues", () => {
  it("reads and maps a single page of project issues", async () => {
    const fetchFn = stubFetch({
      ProjectIssues: {
        data: {
          issues: {
            nodes: [
              {
                id: "issue-001",
                title: "01-go-routing",
                projectMilestone: { id: "ms-cw-01-go-routing" },
                labels: { nodes: [{ id: "ilabel-001" }] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });

    const issues = await readProjectIssues(fetchFn, ENDPOINT, AUTH, "proj-cw-001");
    expect(issues).toEqual([
      {
        id: "issue-001",
        title: "01-go-routing",
        identityKey: null,
        projectId: "proj-cw-001",
        milestoneId: "ms-cw-01-go-routing",
        labelIds: ["ilabel-001"],
      },
    ]);
  });

  it("paginates until hasNextPage is false", async () => {
    let call = 0;
    const fetchFn = (async () => {
      call += 1;
      const nodes =
        call === 1
          ? [{ id: "issue-a", title: "a", projectMilestone: null, labels: { nodes: [] } }]
          : [{ id: "issue-b", title: "b", projectMilestone: null, labels: { nodes: [] } }];
      const pageInfo =
        call === 1 ? { hasNextPage: true, endCursor: "cursor-1" } : { hasNextPage: false, endCursor: null };
      return new Response(JSON.stringify({ data: { issues: { nodes, pageInfo } } }), { status: 200 });
    }) as typeof fetch;

    const issues = await readProjectIssues(fetchFn, ENDPOINT, AUTH, "proj-x");
    expect(issues.map((i) => i.id)).toEqual(["issue-a", "issue-b"]);
  });

  it("recovers identityKey from a `<!--gsd-key:...-->` description marker (CR-01)", async () => {
    const planKey = "repo1/01-go-routing/01-01-PLAN.md";
    const fetchFn = stubFetch({
      ProjectIssues: {
        data: {
          issues: {
            nodes: [
              {
                id: "issue-001",
                title: "Go-based routing scaffold",
                description: `- [ ] Task 1\n\n<!--gsd-key:${planKey}-->`,
                projectMilestone: null,
                labels: { nodes: [] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });

    const issues = await readProjectIssues(fetchFn, ENDPOINT, AUTH, "proj-cw-001");
    expect(issues[0]?.identityKey).toBe(planKey);
  });

  it("leaves identityKey null when the description carries no marker (issue predates this CLI's convention)", async () => {
    const fetchFn = stubFetch({
      ProjectIssues: {
        data: {
          issues: {
            nodes: [
              {
                id: "issue-002",
                title: "Some pre-existing issue",
                description: "No marker here.",
                projectMilestone: null,
                labels: { nodes: [] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });

    const issues = await readProjectIssues(fetchFn, ENDPOINT, AUTH, "proj-cw-001");
    expect(issues[0]?.identityKey).toBeNull();
  });
});

describe("resolveMilestone", () => {
  const project: ResolvedProject = {
    id: "proj-1",
    name: "repo1-project",
    repoKey: "repo1",
    milestones: [{ id: "ms-1", name: "01-go-routing", targetDate: null }],
    issues: [],
  };

  it("resolves via titleHash match on the full phase slug when no map id is stored", () => {
    expect(resolveMilestone(project, "01-go-routing", emptyMap())).toBe("ms-1");
  });

  it("returns null when neither the map nor the hash matches", () => {
    expect(resolveMilestone(project, "02-something-else", emptyMap())).toBeNull();
  });

  it("resolves via the stored map id when present", () => {
    const map = emptyMap();
    map.milestones["repo1/01-go-routing"] = { id: "ms-1" };
    expect(resolveMilestone(project, "01-go-routing", map)).toBe("ms-1");
  });

  it("resolves via the stored map id even when the milestone was renamed in the Linear UI (WR-05)", () => {
    const renamedProject: ResolvedProject = {
      ...project,
      milestones: [{ id: "ms-1", name: "Renamed In Linear UI", targetDate: null }],
    };
    const map = emptyMap();
    map.milestones["repo1/01-go-routing"] = { id: "ms-1" };
    expect(resolveMilestone(renamedProject, "01-go-routing", map)).toBe("ms-1");
  });
});

// Note (WR-03): there is no resolveIssue helper -- the old title-hash-of-
// planKey tier could never match a real issue (apply.ts titles issues with
// plan.title, never plan.key) and was dead code, only "proven" by a
// contradictory fixture that titled an issue with the plan key. Issue
// identity is recovered via the description marker (readProjectIssues,
// above) and consumed directly through ResolvedIssue.identityKey by
// diff.ts/apply.ts -- see diff.test.ts and apply.test.ts's CR-01 coverage.

describe("buildResolvedWorkspace", () => {
  const baseEntry: SyncConfigEntry = {
    repoPath: "../claude-workflow",
    name: "claude-workflow",
    label: "roadmap:claude-workflow",
    teamKey: "AGE",
    projectName: "claude-workflow",
  };

  const noIssuesPage = { data: { issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } };
  const noMilestonesPage = {
    data: { project: { projectMilestones: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } },
  };

  it("first run: empty workspace resolves project null, initiativeId null", async () => {
    const fetchFn = stubFetch({
      WorkspaceMain: workspaceEmpty,
      WorkspaceIssues: noIssuesPage,
      TeamByKey: teamsResponseAge,
      ProjectLabelByName: projectLabelsEmpty,
      IssueLabelByName: issueLabelsEmpty,
      ProjectByLabel: { data: { projects: { nodes: [] } } },
    });

    const resolved = await buildResolvedWorkspace(fetchFn, ENDPOINT, AUTH, baseEntry, emptyMap());
    expect(resolved.project).toBeNull();
    expect(resolved.teamId).toBe("team-age-001");
    expect(resolved.initiativeId).toBeNull();
    expect(resolved.projectLabelId).toBeNull();
    expect(resolved.issueLabelId).toBeNull();
  });

  it("second run: resolves the existing project by name and carries its issues[]", async () => {
    const fetchFn = stubFetch({
      WorkspaceMain: workspaceWithProject,
      WorkspaceIssues: noIssuesPage,
      TeamByKey: teamsResponseAge,
      ProjectLabelByName: projectLabelsEmpty,
      IssueLabelByName: issueLabelsEmpty,
      ProjectByLabel: { data: { projects: { nodes: [] } } },
      ProjectIssues: {
        data: {
          issues: {
            nodes: [
              {
                id: "issue-001",
                title: "01-go-routing",
                projectMilestone: { id: "ms-cw-01-go-routing" },
                labels: { nodes: [{ id: "ilabel-001" }] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
      ProjectMilestones: {
        data: {
          project: {
            projectMilestones: {
              nodes: [{ id: "ms-cw-01-go-routing", name: "01-go-routing", targetDate: "2026-06-15" }],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      },
    });

    const resolved = await buildResolvedWorkspace(fetchFn, ENDPOINT, AUTH, baseEntry, emptyMap());
    expect(resolved.project?.id).toBe("proj-cw-001");
    expect(resolved.project?.milestones).toEqual([
      { id: "ms-cw-01-go-routing", name: "01-go-routing", targetDate: "2026-06-15" },
    ]);
    expect(resolved.project?.issues).toEqual([
      {
        id: "issue-001",
        title: "01-go-routing",
        identityKey: null,
        projectId: "proj-cw-001",
        milestoneId: "ms-cw-01-go-routing",
        labelIds: ["ilabel-001"],
      },
    ]);
  });

  it("resolves the project via the label-carrying lookup when the configured name doesn't match (step 2 beats step 3)", async () => {
    const entryNoNameMatch: SyncConfigEntry = { ...baseEntry, projectName: "not-the-real-name" };
    const fetchFn = stubFetch({
      WorkspaceMain: workspaceWithProject,
      WorkspaceIssues: noIssuesPage,
      TeamByKey: teamsResponseAge,
      ProjectLabelByName: projectLabelsExisting,
      IssueLabelByName: issueLabelsExisting,
      ProjectByLabel: { data: { projects: { nodes: [{ id: "proj-cw-001" }] } } },
      ProjectIssues: noIssuesPage,
      ProjectMilestones: noMilestonesPage,
    });

    const resolved = await buildResolvedWorkspace(fetchFn, ENDPOINT, AUTH, entryNoNameMatch, emptyMap());
    expect(resolved.project?.id).toBe("proj-cw-001");
  });

  it("resolves a configured initiative to its Linear id", async () => {
    const entryWithInitiative: SyncConfigEntry = { ...baseEntry, initiative: "agenticapps-workflow" };
    const fetchFn = stubFetch({
      WorkspaceMain: workspaceWithProject,
      WorkspaceIssues: noIssuesPage,
      TeamByKey: teamsResponseAge,
      ProjectLabelByName: projectLabelsEmpty,
      IssueLabelByName: issueLabelsEmpty,
      ProjectByLabel: { data: { projects: { nodes: [] } } },
      ProjectIssues: noIssuesPage,
      ProjectMilestones: noMilestonesPage,
    });

    const resolved = await buildResolvedWorkspace(fetchFn, ENDPOINT, AUTH, entryWithInitiative, emptyMap());
    expect(resolved.initiativeId).toBe("ini-age-001");
  });
});

// ---------------------------------------------------------------------------
// Idempotency: re-resolving after a mock create finds the existing records
// (no duplicate) — the core SYNC-04 primitive this plan sets up for 06-06.
// ---------------------------------------------------------------------------

describe("idempotent re-resolve after create (mutation mock)", () => {
  it("resolveProject/resolveMilestone/readProjectIssues find the existing records after a create — no duplicate", async () => {
    const mock = createMutationMock();

    // Simulate apply.ts's (06-06) resolve-before-create writes for a first run.
    const projectCreateRes = await mock.fetchFn(ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        query: PROJECT_CREATE,
        variables: { input: { name: "claude-workflow", teamIds: ["team-age-001"] } },
      }),
    });
    const projectCreateJson = (await projectCreateRes.json()) as {
      data: { projectCreate: { project: { id: string } | null } };
    };
    const projectId = projectCreateJson.data.projectCreate.project?.id;
    if (!projectId) throw new Error("test setup: project was not created");

    const planKey = "claude-workflow/01-go-routing/01-01-PLAN.md";

    await mock.fetchFn(ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        query: PROJECT_MILESTONE_CREATE,
        variables: { input: { name: "01-go-routing", projectId } },
      }),
    });

    // apply.ts always titles an issue with the plan's display title, never
    // its identity key (D-06-01) — the identity key travels in the
    // description marker instead (CR-01).
    await mock.fetchFn(ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        query: ISSUE_CREATE,
        variables: {
          input: {
            teamId: "team-age-001",
            title: "Go-based routing scaffold",
            description: `- [ ] Create router\n\n<!--gsd-key:${planKey}-->`,
            projectId,
          },
        },
      }),
    });

    const entry: SyncConfigEntry = {
      repoPath: "../claude-workflow",
      name: "claude-workflow",
      label: "roadmap:claude-workflow",
      teamKey: "AGE",
      projectName: "claude-workflow",
    };

    const assembled = await fetchAssembledWorkspace(mock.fetchFn, ENDPOINT, AUTH);
    const workspace = mapWorkspace(assembled);
    const resolvedProject = resolveProject(workspace, emptyMap(), entry, null);
    if (!resolvedProject) throw new Error("test setup: project did not resolve");
    expect(resolvedProject.id).toBe(projectId);

    const milestoneId = resolveMilestone(resolvedProject, "01-go-routing", emptyMap());
    expect(milestoneId).toBeTruthy();

    // The real per-project read (PROJECT_ISSUES_QUERY) recovers identityKey
    // from the description marker, map-free.
    const issues = await readProjectIssues(mock.fetchFn, ENDPOINT, AUTH, projectId);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.identityKey).toBe(planKey);
    expect(issues[0]?.title).toBe("Go-based routing scaffold");

    // Re-create with identical inputs (what apply.ts's resolve-before-create
    // would do on a second run) — the mock must return the SAME ids, proving
    // no duplicate record is created.
    const secondProjectRes = await mock.fetchFn(ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        query: PROJECT_CREATE,
        variables: { input: { name: "claude-workflow", teamIds: ["team-age-001"] } },
      }),
    });
    const secondProjectJson = (await secondProjectRes.json()) as {
      data: { projectCreate: { project: { id: string } | null } };
    };
    expect(secondProjectJson.data.projectCreate.project?.id).toBe(projectId);
    expect(mock.state.projects).toHaveLength(1);
    expect(mock.state.projectMilestones).toHaveLength(1);
    expect(mock.state.issues).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// CR-01: issue dedup survives total linear-map.json loss via the description
// marker alone — the locked-decision proof this fix requires.
// ---------------------------------------------------------------------------

describe("CR-01: map-loss idempotency via the description marker", () => {
  it("an existing issue titled plan.title and carrying the gsd-key marker resolves identityKey with an EMPTY map", async () => {
    const planKey = "claude-workflow/01-go-routing/01-01-PLAN.md";
    const fetchFn = stubFetch({
      ProjectIssues: {
        data: {
          issues: {
            nodes: [
              {
                id: "issue-001",
                // Titled with the plan's display heading (D-06-01), NEVER
                // the raw identity key — the contradictory pre-CR-01
                // fixtures titled issues with planKey directly.
                title: "Go-based routing scaffold",
                description: `- [ ] Create router\n\n<!--gsd-key:${planKey}-->`,
                projectMilestone: null,
                labels: { nodes: [] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });

    // The map is completely empty — simulating total linear-map.json loss.
    const issues = await readProjectIssues(fetchFn, ENDPOINT, AUTH, "proj-cw-001");
    expect(issues[0]?.identityKey).toBe(planKey);
    // This is exactly the field diff.ts's issue-create decision matches on
    // (titleHash(issue.identityKey) === titleHash(plan.key)), so a re-run
    // against this workspace with an empty map must NOT emit issue-create.
  });
});

describe("readProjectMilestones", () => {
  it("paginates through ALL milestones (the MAIN_QUERY first:25 cap dropped the oldest)", async () => {
    // Regression: milestones came from the shared MAIN_QUERY's capped
    // projectMilestones(first:25) with no pagination, so a project with >25
    // phases lost its oldest milestones from dedup and re-created them on a
    // re-run ("name not unique"). This per-project read pages through them all.
    let call = 0;
    const fetchFn = (async () => {
      call += 1;
      const nodes =
        call === 1
          ? [{ id: "ms-a", name: "01-go-routing", targetDate: null }]
          : [{ id: "ms-b", name: "02-impeccable", targetDate: "2026-08-01" }];
      const pageInfo =
        call === 1 ? { hasNextPage: true, endCursor: "cursor-1" } : { hasNextPage: false, endCursor: null };
      return new Response(
        JSON.stringify({ data: { project: { projectMilestones: { nodes, pageInfo } } } }),
        { status: 200 }
      );
    }) as typeof fetch;

    const milestones = await readProjectMilestones(fetchFn, ENDPOINT, AUTH, "proj-x");
    expect(milestones.map((m) => m.id)).toEqual(["ms-a", "ms-b"]);
    expect(milestones[1]?.targetDate).toBe("2026-08-01");
  });
});

describe("PROJECT_ISSUES_QUERY", () => {
  it("declares $projectId as ID! (an id-filter comparator position, not String!)", () => {
    // Regression: `$projectId: String!` used in `id: { eq: ... }` (an
    // IDComparator position) is rejected by Linear's API with HTTP 400
    // ("used in position expecting type ID"). The mocked read path never
    // type-checks GraphQL, so only the live apply-twice re-run (which fetches
    // existing issues once the project exists) surfaced it.
    expect(PROJECT_ISSUES_QUERY).toContain("$projectId: ID!");
    expect(PROJECT_ISSUES_QUERY).not.toContain("$projectId: String!");
  });
});
