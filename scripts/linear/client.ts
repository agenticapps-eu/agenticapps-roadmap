import type { RawWorkspace } from "./transform.ts";

// ---------------------------------------------------------------------------
// GraphQL query — fetches initiatives → projects → milestones + issue counts
// ---------------------------------------------------------------------------

const WORKSPACE_QUERY = `
  query WorkspaceSnapshot {
    initiatives {
      nodes {
        id
        name
        color
        state
      }
    }
    projects {
      nodes {
        id
        name
        description
        initiative {
          id
        }
        state {
          name
          type
        }
        priority
        startedAt
        targetDate
        projectMilestones {
          nodes {
            id
            name
            targetDate
          }
        }
        issues {
          nodes {
            state {
              type
            }
          }
        }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Typed GraphQL response interfaces
// ---------------------------------------------------------------------------

interface GqlIssueState {
  type: string;
}

interface GqlIssue {
  state: GqlIssueState | null;
}

interface GqlMilestone {
  id: string;
  name: string;
  targetDate: string | null;
}

interface GqlProjectState {
  name: string;
  type: string;
}

interface GqlProject {
  id: string;
  name: string;
  description: string | null;
  initiative: { id: string } | null;
  state: GqlProjectState;
  priority: number;
  startedAt: string | null;
  targetDate: string | null;
  projectMilestones: { nodes: GqlMilestone[] };
  issues: { nodes: GqlIssue[] };
}

interface GqlInitiative {
  id: string;
  name: string;
  color: string | null;
  state: string;
}

interface GqlResponse {
  data: {
    initiatives: { nodes: GqlInitiative[] };
    projects: { nodes: GqlProject[] };
  };
  errors?: Array<{ message: string }>;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const LINEAR_API_URL = "https://api.linear.app/graphql";

/**
 * Fetches the AGE workspace snapshot from Linear.
 * Throws a clear error if LINEAR_API_KEY is not set.
 * Maps the GraphQL response into the RawWorkspace shape expected by buildSnapshot.
 */
export async function fetchWorkspace(): Promise<RawWorkspace> {
  const apiKey = process.env["LINEAR_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "LINEAR_API_KEY environment variable is not set. " +
        "Export it before running sync:snapshot."
    );
  }

  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query: WORKSPACE_QUERY }),
  });

  if (!response.ok) {
    throw new Error(
      `Linear API request failed: ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json()) as GqlResponse;

  if (json.errors && json.errors.length > 0) {
    throw new Error(
      `Linear GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`
    );
  }

  const { initiatives, projects } = json.data;

  // Map to RawWorkspace — explicit allow-list, no spreading
  return {
    initiatives: initiatives.nodes.map((ini) => ({
      id: ini.id,
      name: ini.name,
      color: ini.color,
      state: ini.state,
    })),
    projects: projects.nodes.map((proj) => ({
      id: proj.id,
      name: proj.name,
      description: proj.description,
      initiativeId: proj.initiative?.id ?? null,
      state: proj.state,
      priority: proj.priority,
      startedAt: proj.startedAt,
      targetDate: proj.targetDate,
      projectMilestones: proj.projectMilestones,
      issues: proj.issues,
    })),
  };
}
