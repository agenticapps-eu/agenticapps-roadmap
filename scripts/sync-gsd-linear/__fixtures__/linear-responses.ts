/**
 * Read-side GraphQL response fixtures for sync-gsd-linear's resolver reads
 * (teams, labels, workspace, initiatives, per-project issues).
 *
 * Full-GqlResponse fixture contract (mirrors scripts/linear/__fixtures__/
 * main-response.ts / issues-page.ts): every export is a complete `{ data:
 * {...} }` shaped object. A mocked-fetch test stub returns these DIRECTLY
 * from `.json()` — no double-wrap.
 */

// ---------------------------------------------------------------------------
// TeamByKey (RESEARCH.md Code Examples — TEAMS_QUERY)
// ---------------------------------------------------------------------------

export interface GqlTeam {
  id: string;
  name: string;
  key: string;
}

export interface GqlTeamsResponse {
  data: { teams: { nodes: GqlTeam[] } };
  errors?: Array<{ message: string }>;
}

/** A single team resolves for key "AGE" — the shared team across all three target repos. */
export const teamsResponseAge: GqlTeamsResponse = {
  data: {
    teams: { nodes: [{ id: "team-age-001", name: "AgenticApps Engineering", key: "AGE" }] },
  },
};

// ---------------------------------------------------------------------------
// ProjectLabelByName / IssueLabelByName (RESEARCH.md — two distinct label pools)
// ---------------------------------------------------------------------------

export interface GqlLabel {
  id: string;
  name: string;
}

export interface GqlProjectLabelsResponse {
  data: { projectLabels: { nodes: GqlLabel[] } };
  errors?: Array<{ message: string }>;
}

export interface GqlIssueLabelsResponse {
  data: { issueLabels: { nodes: GqlLabel[] } };
  errors?: Array<{ message: string }>;
}

export const projectLabelsEmpty: GqlProjectLabelsResponse = {
  data: { projectLabels: { nodes: [] } },
};

export const projectLabelsExisting: GqlProjectLabelsResponse = {
  data: {
    projectLabels: { nodes: [{ id: "plabel-001", name: "roadmap:claude-workflow" }] },
  },
};

export const issueLabelsEmpty: GqlIssueLabelsResponse = {
  data: { issueLabels: { nodes: [] } },
};

export const issueLabelsExisting: GqlIssueLabelsResponse = {
  data: {
    issueLabels: { nodes: [{ id: "ilabel-001", name: "roadmap:claude-workflow" }] },
  },
};

// ---------------------------------------------------------------------------
// Workspace reads (MAIN_QUERY shape — reused from scripts/linear/map.ts's
// GqlResponse contract so mapWorkspace can consume these unchanged).
// ---------------------------------------------------------------------------

export interface GqlWorkspaceMilestone {
  id: string;
  name: string;
  targetDate: string | null;
}

export interface GqlWorkspaceProject {
  id: string;
  name: string;
  description: string | null;
  url: string;
  initiatives: { nodes: { id: string }[] };
  status: { name: string; type: string };
  priority: number;
  startedAt: string | null;
  targetDate: string | null;
  projectMilestones: { nodes: GqlWorkspaceMilestone[] };
  issues: { nodes: { state: { type: string } | null }[] };
}

export interface GqlWorkspaceInitiative {
  id: string;
  name: string;
  color: string | null;
  status: string;
}

export interface GqlWorkspaceResponse {
  data: {
    initiatives: { nodes: GqlWorkspaceInitiative[] };
    projects: { nodes: GqlWorkspaceProject[] };
  };
  errors?: Array<{ message: string }>;
}

/** A workspace where claude-workflow's project already exists (second-run resolve path). */
export const workspaceWithProject: GqlWorkspaceResponse = {
  data: {
    initiatives: {
      nodes: [{ id: "ini-age-001", name: "agenticapps-workflow", color: "#5e6ad2", status: "started" }],
    },
    projects: {
      nodes: [
        {
          id: "proj-cw-001",
          name: "claude-workflow",
          description: "AgenticApps Claude Workflow",
          url: "https://linear.app/agenticapps/project/claude-workflow",
          initiatives: { nodes: [{ id: "ini-age-001" }] },
          status: { name: "In Progress", type: "started" },
          priority: 1,
          startedAt: "2026-06-01",
          targetDate: null,
          projectMilestones: {
            nodes: [{ id: "ms-cw-01-go-routing", name: "01-go-routing", targetDate: "2026-06-15" }],
          },
          issues: { nodes: [] },
        },
      ],
    },
  },
};

/** An empty workspace — first-run resolve path (nothing pre-exists in Linear yet). */
export const workspaceEmpty: GqlWorkspaceResponse = {
  data: {
    initiatives: { nodes: [] },
    projects: { nodes: [] },
  },
};

// ---------------------------------------------------------------------------
// Per-project issue read — resolver's issue identity surface. Distinct from
// the flat ISSUES_QUERY (scripts/linear/query.ts), which only carries
// project.id + state.type for counting; this carries the fields resolve.ts
// needs for issue dedup (id, title, milestone, labels).
// ---------------------------------------------------------------------------

export interface GqlProjectIssue {
  id: string;
  title: string;
  projectMilestone: { id: string } | null;
  labels: { nodes: { id: string }[] };
}

export interface GqlProjectIssuesResponse {
  data: { project: { issues: { nodes: GqlProjectIssue[] } } | null };
  errors?: Array<{ message: string }>;
}

export const projectIssuesPage: GqlProjectIssuesResponse = {
  data: {
    project: {
      issues: {
        nodes: [
          {
            id: "issue-001",
            title: "01-go-routing",
            projectMilestone: { id: "ms-cw-01-go-routing" },
            labels: { nodes: [{ id: "ilabel-001" }] },
          },
        ],
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Initiatives read — resolveInitiative's fixture input.
// ---------------------------------------------------------------------------

export interface GqlInitiativesResponse {
  data: { initiatives: { nodes: GqlWorkspaceInitiative[] } };
  errors?: Array<{ message: string }>;
}

export const initiativesResponse: GqlInitiativesResponse = {
  data: {
    initiatives: {
      nodes: [
        { id: "ini-age-001", name: "agenticapps-workflow", color: "#5e6ad2", status: "started" },
        { id: "ini-factiv-001", name: "Factiv", color: null, status: "started" },
      ],
    },
  },
};
