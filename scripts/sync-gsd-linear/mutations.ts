// ---------------------------------------------------------------------------
// GraphQL read queries + write mutations for sync-gsd-linear.
// Mirrors scripts/linear/query.ts's const-string-with-$variable-placeholders
// convention. Every value ever derived from untrusted `.planning/` content
// (slugs, headings, plan keys) MUST be passed through the GraphQL `variables`
// object at the call site — never string-interpolated into a query body
// (06-RESEARCH.md Security Domain, V5 Input Validation; 06-PLAN.md threat
// T-06-01). This file is pure doc + type definitions — no `fetch`, no
// `process` — the actual POSTs live in resolve.ts (06-05) / apply.ts (06-06).
//
// WHY teamIds MUST be resolved before any projectCreate/issueCreate call:
//   ProjectCreateInput.teamIds is a required [String!]! and IssueCreateInput.
//   teamId is a required String! (verified via live schema introspection,
//   06-RESEARCH.md Pitfall 4) — not optional, even though the read-side
//   scripts/linear/* code never needed a team concept. TEAMS_QUERY must run
//   once per config entry before any create call in that project's apply pass.
//
// WHY labels are resolved TWICE — ProjectLabel vs IssueLabel are different
// pools:
//   Project.labels is a ProjectLabelConnection; Issue.labels is backed by a
//   separate IssueLabel type, each with its own query root
//   (projectLabels/issueLabels) and create mutation
//   (projectLabelCreate/issueLabelCreate). The label NAME string
//   (`roadmap:<repo>`) is shared, but the underlying ids are NOT — attaching
//   a ProjectLabel id to an issue's labelIds (or vice versa) silently
//   no-ops/errors (06-RESEARCH.md Pitfall 2). Resolve/create in both pools.
//
// WHY a dedicated PROJECT_ISSUES_QUERY exists (beyond scripts/linear/
// query.ts's ISSUES_QUERY):
//   The existing read path (ISSUES_QUERY) only fetches issue.state.type for
//   backlog/started/done counting — it has no id/title/milestone/label
//   fields, which issue dedup (map -> label -> title-hash resolve order)
//   needs to match an existing issue on re-run. PROJECT_ISSUES_QUERY is
//   target-scoped (filtered to one project.id) and cursor-paginated, keeping
//   complexity low the same way ISSUES_QUERY does.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Read queries
// ---------------------------------------------------------------------------

/** Resolve a Linear Team by its short key (e.g. "AGE"). */
export const TEAMS_QUERY = `
  query TeamByKey($key: String!) {
    teams(filter: { key: { eq: $key } }, first: 1) {
      nodes { id name key }
    }
  }
`;

export interface TeamsQueryVariables {
  key: string;
}

export interface TeamNode {
  id: string;
  name: string;
  key: string;
}

export interface TeamsQueryResponse {
  data: { teams: { nodes: TeamNode[] } };
  errors?: Array<{ message: string }>;
}

/** Resolve a ProjectLabel by exact name (the `roadmap:<repo>` project-pool label). */
export const PROJECT_LABELS_QUERY = `
  query ProjectLabelByName($name: String!) {
    projectLabels(filter: { name: { eq: $name } }, first: 1) { nodes { id name } }
  }
`;

export interface ProjectLabelsQueryVariables {
  name: string;
}

export interface LabelNode {
  id: string;
  name: string;
}

export interface ProjectLabelsQueryResponse {
  data: { projectLabels: { nodes: LabelNode[] } };
  errors?: Array<{ message: string }>;
}

/** Resolve an IssueLabel by exact name (the `roadmap:<repo>` issue-pool label — a distinct id space from ProjectLabel). */
export const ISSUE_LABELS_QUERY = `
  query IssueLabelByName($name: String!) {
    issueLabels(filter: { name: { eq: $name } }, first: 1) { nodes { id name } }
  }
`;

export interface IssueLabelsQueryVariables {
  name: string;
}

export interface IssueLabelsQueryResponse {
  data: { issueLabels: { nodes: LabelNode[] } };
  errors?: Array<{ message: string }>;
}

/**
 * Target-scoped, cursor-paginated issue read for dedup. Filters to one
 * project.id and exposes the fields the resolve-order (map id -> description
 * marker -> title-hash) needs: id, title, description (carries the
 * `<!--gsd-key:...-->` identity marker, see apply.ts's issueCreate and
 * CR-01), milestone id, label ids. Pass `after: null` first, then endCursor,
 * until hasNextPage is false (same loop shape as
 * scripts/linear/fetch-workspace.ts's ISSUES_QUERY pagination).
 */
export const PROJECT_ISSUES_QUERY = `
  query ProjectIssues($projectId: String!, $after: String) {
    issues(filter: { project: { id: { eq: $projectId } } }, first: 100, after: $after) {
      nodes {
        id
        title
        description
        projectMilestone { id }
        labels { nodes { id } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export interface ProjectIssuesQueryVariables {
  projectId: string;
  after: string | null;
}

export interface ProjectIssueNode {
  id: string;
  title: string;
  description: string | null;
  projectMilestone: { id: string } | null;
  labels: { nodes: { id: string }[] };
}

export interface ProjectIssuesPage {
  issues: {
    nodes: ProjectIssueNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

export interface ProjectIssuesQueryResponse {
  data: ProjectIssuesPage;
  errors?: Array<{ message: string }>;
}

// ---------------------------------------------------------------------------
// Write mutations
// ---------------------------------------------------------------------------

/** Create a Project. teamIds is required (Pitfall 4) — resolve a team id first. Initiative attachment is a separate join mutation (see INITIATIVE_TO_PROJECT_CREATE). */
export const PROJECT_CREATE = `
  mutation ProjectCreate($input: ProjectCreateInput!) {
    projectCreate(input: $input) {
      success
      project { id name }
    }
  }
`;

export interface ProjectCreateInput {
  name: string;
  teamIds: string[];
  description?: string;
  labelIds?: string[];
  color?: string;
  icon?: string;
}

export interface ProjectCreateVariables {
  input: ProjectCreateInput;
}

export interface ProjectCreatePayload {
  success: boolean;
  project: { id: string; name: string } | null;
}

export interface ProjectCreateResponse {
  data: { projectCreate: ProjectCreatePayload };
  errors?: Array<{ message: string }>;
}

/** Update an existing Project (e.g. label attachment after project-label resolve/create). */
export const PROJECT_UPDATE = `
  mutation ProjectUpdate($id: String!, $input: ProjectUpdateInput!) {
    projectUpdate(id: $id, input: $input) {
      success
      project { id name }
    }
  }
`;

export interface ProjectUpdateInput {
  name?: string;
  description?: string;
  targetDate?: string;
  labelIds?: string[];
}

export interface ProjectUpdateVariables {
  id: string;
  input: ProjectUpdateInput;
}

export interface ProjectUpdatePayload {
  success: boolean;
  project: { id: string; name: string } | null;
}

export interface ProjectUpdateResponse {
  data: { projectUpdate: ProjectUpdatePayload };
  errors?: Array<{ message: string }>;
}

/** Create a ProjectMilestone. name is the phase directory slug (never the bare number — Pitfall 1). */
export const PROJECT_MILESTONE_CREATE = `
  mutation ProjectMilestoneCreate($input: ProjectMilestoneCreateInput!) {
    projectMilestoneCreate(input: $input) {
      success
      projectMilestone { id name targetDate }
    }
  }
`;

export interface ProjectMilestoneCreateInput {
  name: string;
  projectId: string;
  description?: string;
  targetDate?: string;
}

export interface ProjectMilestoneCreateVariables {
  input: ProjectMilestoneCreateInput;
}

export interface ProjectMilestoneCreatePayload {
  success: boolean;
  projectMilestone: { id: string; name: string; targetDate: string | null } | null;
}

export interface ProjectMilestoneCreateResponse {
  data: { projectMilestoneCreate: ProjectMilestoneCreatePayload };
  errors?: Array<{ message: string }>;
}

/** Update an existing ProjectMilestone (e.g. a drifted target date — informational only in v1 apply, see DiffSummary.datesInformational). */
export const PROJECT_MILESTONE_UPDATE = `
  mutation ProjectMilestoneUpdate($id: String!, $input: ProjectMilestoneUpdateInput!) {
    projectMilestoneUpdate(id: $id, input: $input) {
      success
      projectMilestone { id name targetDate }
    }
  }
`;

export interface ProjectMilestoneUpdateInput {
  name?: string;
  description?: string;
  targetDate?: string;
}

export interface ProjectMilestoneUpdateVariables {
  id: string;
  input: ProjectMilestoneUpdateInput;
}

export interface ProjectMilestoneUpdatePayload {
  success: boolean;
  projectMilestone: { id: string; name: string; targetDate: string | null } | null;
}

export interface ProjectMilestoneUpdateResponse {
  data: { projectMilestoneUpdate: ProjectMilestoneUpdatePayload };
  errors?: Array<{ message: string }>;
}

/** Create an Issue. teamId is required (Pitfall 4). labelIds must be IssueLabel ids, not ProjectLabel ids (Pitfall 2). */
export const ISSUE_CREATE = `
  mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { id identifier title }
    }
  }
`;

export interface IssueCreateInput {
  teamId: string;
  title: string;
  description?: string;
  projectId?: string;
  projectMilestoneId?: string;
  labelIds?: string[];
}

export interface IssueCreateVariables {
  input: IssueCreateInput;
}

export interface IssueCreatePayload {
  success: boolean;
  issue: { id: string; identifier: string; title: string } | null;
}

export interface IssueCreateResponse {
  data: { issueCreate: IssueCreatePayload };
  errors?: Array<{ message: string }>;
}

/** Update an existing Issue (e.g. re-bucket into a resolved milestone). */
export const ISSUE_UPDATE = `
  mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      success
      issue { id identifier title }
    }
  }
`;

export interface IssueUpdateInput {
  title?: string;
  description?: string;
  projectMilestoneId?: string;
  labelIds?: string[];
}

export interface IssueUpdateVariables {
  id: string;
  input: IssueUpdateInput;
}

export interface IssueUpdatePayload {
  success: boolean;
  issue: { id: string; identifier: string; title: string } | null;
}

export interface IssueUpdateResponse {
  data: { issueUpdate: IssueUpdatePayload };
  errors?: Array<{ message: string }>;
}

/** Create a ProjectLabel (the project-pool half of the `roadmap:<repo>` label — see Pitfall 2). */
export const PROJECT_LABEL_CREATE = `
  mutation ProjectLabelCreate($input: ProjectLabelCreateInput!) {
    projectLabelCreate(input: $input) {
      success
      projectLabel { id name }
    }
  }
`;

export interface ProjectLabelCreateInput {
  name: string;
  color?: string;
  description?: string;
}

export interface ProjectLabelCreateVariables {
  input: ProjectLabelCreateInput;
}

export interface ProjectLabelCreatePayload {
  success: boolean;
  projectLabel: { id: string; name: string } | null;
}

export interface ProjectLabelCreateResponse {
  data: { projectLabelCreate: ProjectLabelCreatePayload };
  errors?: Array<{ message: string }>;
}

/** Create an IssueLabel (the issue-pool half of the `roadmap:<repo>` label — a distinct id space from ProjectLabel, see Pitfall 2). */
export const ISSUE_LABEL_CREATE = `
  mutation IssueLabelCreate($input: IssueLabelCreateInput!) {
    issueLabelCreate(input: $input) {
      success
      issueLabel { id name }
    }
  }
`;

export interface IssueLabelCreateInput {
  name: string;
  teamId?: string;
  color?: string;
  description?: string;
}

export interface IssueLabelCreateVariables {
  input: IssueLabelCreateInput;
}

export interface IssueLabelCreatePayload {
  success: boolean;
  issueLabel: { id: string; name: string } | null;
}

export interface IssueLabelCreateResponse {
  data: { issueLabelCreate: IssueLabelCreatePayload };
  errors?: Array<{ message: string }>;
}

/** Attach a Project to an Initiative. This is a separate join mutation — NOT a projectCreate field. */
export const INITIATIVE_TO_PROJECT_CREATE = `
  mutation InitiativeToProjectCreate($input: InitiativeToProjectCreateInput!) {
    initiativeToProjectCreate(input: $input) {
      success
      initiativeToProject { id }
    }
  }
`;

export interface InitiativeToProjectCreateInput {
  projectId: string;
  initiativeId: string;
}

export interface InitiativeToProjectCreateVariables {
  input: InitiativeToProjectCreateInput;
}

export interface InitiativeToProjectCreatePayload {
  success: boolean;
  initiativeToProject: { id: string } | null;
}

export interface InitiativeToProjectCreateResponse {
  data: { initiativeToProjectCreate: InitiativeToProjectCreatePayload };
  errors?: Array<{ message: string }>;
}
