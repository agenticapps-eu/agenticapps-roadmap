/**
 * Main-query fixture — response shape for MAIN_QUERY.
 * Projects do NOT have issues nested (that would exceed Linear's complexity limit).
 * The issues field is intentionally absent here; it is populated via ISSUES_QUERY
 * separately and merged before mapWorkspace is called.
 *
 * Used by the Worker handler tests and client.ts tests. The test stub's `.json()`
 * returns this fixture DIRECTLY on the first fetch call (the main request).
 */

export interface GqlMainProject {
  id: string;
  name: string;
  description: string | null;
  initiatives: { nodes: { id: string }[] };
  status: { name: string; type: string };
  priority: number;
  startedAt: string | null;
  targetDate: string | null;
  projectMilestones: { nodes: { id: string; name: string; targetDate: string | null }[] };
}

export interface GqlMainInitiative {
  id: string;
  name: string;
  color: string | null;
  status: string;
}

export interface GqlMainResponse {
  data: {
    initiatives: { nodes: GqlMainInitiative[] };
    projects: { nodes: GqlMainProject[] };
  };
  errors?: Array<{ message: string }>;
}

export const mainResponseClean: GqlMainResponse = {
  data: {
    initiatives: {
      nodes: [
        {
          id: "ini-age-001",
          name: "agenticapps-workflow",
          color: "#5e6ad2",
          status: "started",
        },
        {
          id: "ini-factiv-001",
          name: "Factiv",
          color: null,
          status: "backlog",
        },
      ],
    },
    projects: {
      nodes: [
        {
          id: "proj-001",
          name: "AgenticApps Roadmap",
          description: "The roadmap web app",
          initiatives: { nodes: [{ id: "ini-age-001" }] },
          status: { name: "In Progress", type: "started" },
          priority: 1,
          startedAt: "2026-06-22",
          targetDate: "2026-08-17",
          projectMilestones: {
            nodes: [
              {
                id: "ms-001",
                name: "Phase 1 — Scaffold",
                targetDate: "2026-06-30",
              },
              {
                id: "ms-002",
                name: "Phase 2 — Data layer",
                targetDate: "2026-07-15",
              },
            ],
          },
        },
        {
          id: "proj-002",
          name: "Dashboard: Codex host integration",
          description: null,
          initiatives: { nodes: [{ id: "ini-age-001" }] },
          status: { name: "Backlog", type: "backlog" },
          priority: 2,
          startedAt: null,
          targetDate: null,
          projectMilestones: { nodes: [] },
        },
        {
          id: "proj-003",
          name: "cPARX Prototype",
          description: "Prototype for cPARX",
          initiatives: { nodes: [{ id: "ini-factiv-001" }] },
          status: { name: "Cancelled", type: "cancelled" },
          priority: 0,
          startedAt: null,
          targetDate: null,
          projectMilestones: { nodes: [] },
        },
      ],
    },
  },
};

/**
 * Main response fixture for the email-leak test.
 * The email is in a project description so assertNoLeak fires through
 * the assembled path (same as the old gql-with-email fixture).
 */
export const mainResponseWithEmail: GqlMainResponse = {
  data: {
    initiatives: {
      nodes: [
        {
          id: "ini-bad-001",
          name: "Leaked Initiative",
          color: null,
          status: "started",
        },
      ],
    },
    projects: {
      nodes: [
        {
          id: "proj-bad-001",
          name: "Malicious Project",
          description: "Contact secret@example.com for details",
          initiatives: { nodes: [{ id: "ini-bad-001" }] },
          status: { name: "In Progress", type: "started" },
          priority: 1,
          startedAt: null,
          targetDate: null,
          projectMilestones: { nodes: [] },
        },
      ],
    },
  },
};
