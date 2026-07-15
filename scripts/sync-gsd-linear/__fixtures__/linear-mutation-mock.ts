/**
 * In-memory, mutable mock GraphQL "server" for sync-gsd-linear's write-path
 * (apply.test.ts's idempotency test — "apply -> mutate mocked state -> re-
 * resolve -> second diff is empty").
 *
 * DUP-CREATE -> RETURN-EXISTING-ID (06-REVIEWS.md Consensus item 5 / OpenCode
 * C1): every *Create handler below runs the SAME resolve-key check the real
 * CLI uses (label match, then name/title-hash-equivalent match) against the
 * current in-memory state BEFORE appending a new record, and returns the
 * EXISTING id on a match. Real Linear happily creates duplicate same-named
 * records, so a mock that always appends would let a duplicate-create bug in
 * apply.ts pass the idempotency test green while hiding real duplication.
 * Title-hashing itself (sha256, hash.ts, not yet built in this Wave-0 plan)
 * is not reproduced here; matching on exact name/title is the equivalent
 * check since the CLI's title-hash is a pure deterministic function of that
 * same string (same name => same hash).
 */

// ---------------------------------------------------------------------------
// In-memory workspace state
// ---------------------------------------------------------------------------

export interface MockTeam {
  id: string;
  key: string;
  name: string;
}

export interface MockInitiative {
  id: string;
  name: string;
}

export interface MockProject {
  id: string;
  name: string;
  teamIds: string[];
  labelIds: string[];
}

export interface MockProjectLabel {
  id: string;
  name: string;
}

export interface MockIssueLabel {
  id: string;
  name: string;
}

export interface MockProjectMilestone {
  id: string;
  name: string;
  projectId: string;
  targetDate: string | null;
}

export interface MockIssue {
  id: string;
  title: string;
  teamId: string;
  projectId: string;
  projectMilestoneId: string | null;
  labelIds: string[];
}

export interface MockInitiativeToProject {
  id: string;
  initiativeId: string;
  projectId: string;
}

export interface MockState {
  teams: MockTeam[];
  initiatives: MockInitiative[];
  projects: MockProject[];
  projectLabels: MockProjectLabel[];
  issueLabels: MockIssueLabel[];
  projectMilestones: MockProjectMilestone[];
  issues: MockIssue[];
  initiativeToProjects: MockInitiativeToProject[];
}

function emptyState(): MockState {
  return {
    teams: [{ id: "team-age-001", key: "AGE", name: "AgenticApps Engineering" }],
    initiatives: [{ id: "ini-age-001", name: "agenticapps-workflow" }],
    projects: [],
    projectLabels: [],
    issueLabels: [],
    projectMilestones: [],
    issues: [],
    initiativeToProjects: [],
  };
}

// ---------------------------------------------------------------------------
// Request/response plumbing
// ---------------------------------------------------------------------------

interface GqlRequestBody {
  query: string;
  variables?: Record<string, unknown>;
}

/** Extracts the operation name from `query OpName(...) {` / `mutation OpName(...) {`. */
function operationNameOf(query: string): string | null {
  const match = /^\s*(?:query|mutation)\s+(\w+)/.exec(query);
  return match?.[1] ?? null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `mock-${prefix}-${idCounter}`;
}

// ---------------------------------------------------------------------------
// Per-operation handlers
// ---------------------------------------------------------------------------

type Handler = (state: MockState, variables: Record<string, unknown>) => unknown;

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

const handlers: Record<string, Handler> = {
  // ---- Reads ----
  TeamByKey: (state, vars) => {
    const key = asString(vars["key"]);
    const nodes = state.teams.filter((t) => t.key === key);
    return { data: { teams: { nodes } } };
  },
  ProjectLabelByName: (state, vars) => {
    const name = asString(vars["name"]);
    const nodes = state.projectLabels.filter((l) => l.name === name);
    return { data: { projectLabels: { nodes } } };
  },
  IssueLabelByName: (state, vars) => {
    const name = asString(vars["name"]);
    const nodes = state.issueLabels.filter((l) => l.name === name);
    return { data: { issueLabels: { nodes } } };
  },
  WorkspaceMain: (state) => ({
    data: {
      initiatives: { nodes: state.initiatives.map((i) => ({ id: i.id, name: i.name, color: null, status: "started" })) },
      projects: {
        nodes: state.projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: null,
          url: `https://linear.app/mock/project/${p.id}`,
          initiatives: { nodes: [] },
          status: { name: "In Progress", type: "started" },
          priority: 1,
          startedAt: null,
          targetDate: null,
          projectMilestones: {
            nodes: state.projectMilestones
              .filter((m) => m.projectId === p.id)
              .map((m) => ({ id: m.id, name: m.name, targetDate: m.targetDate })),
          },
        })),
      },
    },
  }),
  WorkspaceIssues: (state) => ({
    data: {
      issues: {
        nodes: state.issues.map((i) => ({ project: { id: i.projectId }, state: { type: "unstarted" } })),
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  }),
  // Target-scoped per-project issue read (PROJECT_ISSUES_QUERY, mutations.ts
  // 06-03) -- resolve.ts's readProjectIssues, driving apply.ts's (06-06)
  // idempotency re-resolve. Deliberately left out of 06-05's fixture scope
  // (see resolve.test.ts's own comment) and added here since 06-06's
  // "second apply is a no-op" proof calls buildResolvedWorkspace's full
  // network path against an already-populated project.
  ProjectIssues: (state, vars) => {
    const projectId = asString(vars["projectId"]);
    const nodes = state.issues
      .filter((i) => i.projectId === projectId)
      .map((i) => ({
        id: i.id,
        title: i.title,
        projectMilestone: i.projectMilestoneId ? { id: i.projectMilestoneId } : null,
        labels: { nodes: i.labelIds.map((id) => ({ id })) },
      }));
    return { data: { issues: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } } };
  },

  // ---- Creates (resolve-before-create; return existing id on duplicate) ----
  ProjectCreate: (state, vars) => {
    const input = asRecord(vars["input"]);
    const name = asString(input["name"]);
    const labelIds = asStringArray(input["labelIds"]);

    // 1. label match
    const byLabel = state.projects.find((p) => p.labelIds.some((id) => labelIds.includes(id)));
    // 2. name (== title-hash-equivalent) match
    const byName = state.projects.find((p) => p.name === name);
    const existing = byLabel ?? byName;
    if (existing) {
      return { data: { projectCreate: { success: true, project: { id: existing.id, name: existing.name } } } };
    }

    const created: MockProject = {
      id: nextId("project"),
      name,
      teamIds: asStringArray(input["teamIds"]),
      labelIds,
    };
    state.projects.push(created);
    return { data: { projectCreate: { success: true, project: { id: created.id, name: created.name } } } };
  },

  ProjectLabelCreate: (state, vars) => {
    const input = asRecord(vars["input"]);
    const name = asString(input["name"]);
    const existing = state.projectLabels.find((l) => l.name === name);
    if (existing) {
      return { data: { projectLabelCreate: { success: true, projectLabel: { id: existing.id, name: existing.name } } } };
    }
    const created: MockProjectLabel = { id: nextId("plabel"), name };
    state.projectLabels.push(created);
    return { data: { projectLabelCreate: { success: true, projectLabel: { id: created.id, name: created.name } } } };
  },

  IssueLabelCreate: (state, vars) => {
    const input = asRecord(vars["input"]);
    const name = asString(input["name"]);
    const existing = state.issueLabels.find((l) => l.name === name);
    if (existing) {
      return { data: { issueLabelCreate: { success: true, issueLabel: { id: existing.id, name: existing.name } } } };
    }
    const created: MockIssueLabel = { id: nextId("ilabel"), name };
    state.issueLabels.push(created);
    return { data: { issueLabelCreate: { success: true, issueLabel: { id: created.id, name: created.name } } } };
  },

  InitiativeToProjectCreate: (state, vars) => {
    const input = asRecord(vars["input"]);
    const initiativeId = asString(input["initiativeId"]);
    const projectId = asString(input["projectId"]);
    const existing = state.initiativeToProjects.find(
      (j) => j.initiativeId === initiativeId && j.projectId === projectId
    );
    if (existing) {
      return { data: { initiativeToProjectCreate: { success: true, initiativeToProject: { id: existing.id } } } };
    }
    const created: MockInitiativeToProject = { id: nextId("i2p"), initiativeId, projectId };
    state.initiativeToProjects.push(created);
    return { data: { initiativeToProjectCreate: { success: true, initiativeToProject: { id: created.id } } } };
  },

  ProjectMilestoneCreate: (state, vars) => {
    const input = asRecord(vars["input"]);
    const name = asString(input["name"]);
    const projectId = asString(input["projectId"]);
    const existing = state.projectMilestones.find((m) => m.projectId === projectId && m.name === name);
    if (existing) {
      return {
        data: {
          projectMilestoneCreate: {
            success: true,
            projectMilestone: { id: existing.id, name: existing.name, targetDate: existing.targetDate },
          },
        },
      };
    }
    const created: MockProjectMilestone = {
      id: nextId("milestone"),
      name,
      projectId,
      targetDate: (input["targetDate"] as string | undefined) ?? null,
    };
    state.projectMilestones.push(created);
    return {
      data: {
        projectMilestoneCreate: {
          success: true,
          projectMilestone: { id: created.id, name: created.name, targetDate: created.targetDate },
        },
      },
    };
  },

  IssueCreate: (state, vars) => {
    const input = asRecord(vars["input"]);
    const title = asString(input["title"]);
    const projectId = asString(input["projectId"]);
    const existing = state.issues.find((i) => i.projectId === projectId && i.title === title);
    if (existing) {
      return {
        data: {
          issueCreate: {
            success: true,
            issue: { id: existing.id, identifier: existing.id, title: existing.title },
          },
        },
      };
    }
    const created: MockIssue = {
      id: nextId("issue"),
      title,
      teamId: asString(input["teamId"]),
      projectId,
      projectMilestoneId: (input["projectMilestoneId"] as string | undefined) ?? null,
      labelIds: asStringArray(input["labelIds"]),
    };
    state.issues.push(created);
    return {
      data: { issueCreate: { success: true, issue: { id: created.id, identifier: created.id, title: created.title } } },
    };
  },
};

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export interface MutationMock {
  fetchFn: typeof fetch;
  state: MockState;
}

/**
 * Builds a fresh in-memory mock workspace plus a `fetchFn` compatible with
 * `fetchAssembledWorkspace`/resolve.ts/apply.ts's injected-fetch signature.
 * Dispatches on the GraphQL operation name; unmatched operations return a
 * GraphQL error payload (never throws — mirrors a real API's error shape).
 */
export function createMutationMock(seed?: Partial<MockState>): MutationMock {
  const state: MockState = { ...emptyState(), ...seed };

  const fetchFn = (async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body ?? "{}")) as GqlRequestBody;
    const opName = operationNameOf(body.query);
    const handler = opName ? handlers[opName] : undefined;
    if (!handler) {
      return jsonResponse({ data: null, errors: [{ message: `mock: unknown operation "${opName ?? ""}"` }] });
    }
    return jsonResponse(handler(state, body.variables ?? {}));
  }) as typeof fetch;

  return { fetchFn, state };
}
