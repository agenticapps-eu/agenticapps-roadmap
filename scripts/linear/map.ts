// ---------------------------------------------------------------------------
// Process-free GQL→RawWorkspace mapping.
// MUST NOT reference `process`, `fetch`, or any Node/Worker global.
// Safe to import from both Node scripts and the Cloudflare Worker isolate.
// ---------------------------------------------------------------------------

import type { RawWorkspace } from "./transform.ts";

// ---------------------------------------------------------------------------
// Typed GraphQL response interfaces (moved from client.ts)
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
  url: string;
  // Linear projects belong to an initiatives connection (a project can have
  // several); we take the first as the primary. Empty nodes → no initiative.
  initiatives: { nodes: { id: string }[] };
  status: GqlProjectState;
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
  // Linear's InitiativeStatus is an enum scalar (Proposed/Planned/Active/…).
  status: string;
}

export interface GqlResponse {
  data: {
    initiatives: { nodes: GqlInitiative[] };
    projects: { nodes: GqlProject[] };
  };
  errors?: Array<{ message: string }>;
}

// ---------------------------------------------------------------------------
// Pure mapping function — no I/O, no process references
// ---------------------------------------------------------------------------

/**
 * Maps a Linear GraphQL response into the RawWorkspace shape expected by
 * buildSnapshot. Explicit allow-list; no spreading of upstream fields.
 */
export function mapWorkspace(json: GqlResponse): RawWorkspace {
  const { initiatives, projects } = json.data;

  return {
    initiatives: initiatives.nodes.map((ini) => ({
      id: ini.id,
      name: ini.name,
      color: ini.color,
      state: ini.status,
    })),
    projects: projects.nodes.map((proj) => ({
      id: proj.id,
      name: proj.name,
      description: proj.description,
      url: proj.url,
      initiativeId: proj.initiatives.nodes[0]?.id ?? null,
      state: proj.status,
      priority: proj.priority,
      startedAt: proj.startedAt,
      targetDate: proj.targetDate,
      projectMilestones: proj.projectMilestones,
      issues: proj.issues,
    })),
  };
}
