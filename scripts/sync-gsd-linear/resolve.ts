// ---------------------------------------------------------------------------
// SYNC-02 resolver: for every Linear write target (Team, ProjectLabel,
// IssueLabel, Initiative, Project, ProjectMilestone, Issue) resolve to an
// EXISTING record via the locked order — stored linear-map.json id -> the
// roadmap:<repo> label / a durable identity marker -> title-hash fallback —
// before apply.ts (06-06) ever considers a create. This is what makes
// SYNC-04's "re-run is a no-op" true.
//
// Reuses the existing read plumbing (fetchAssembledWorkspace + mapWorkspace)
// for the base MAIN_QUERY/ISSUES_QUERY workspace read. All NEW lookups
// (teams, both label pools, the paginated per-project issue read) use the
// typed queries already defined in mutations.ts (06-03).
//
// CR-01 — durable issue identity via a description marker: readProjectIssues
// recovers `identityKey` by parsing a `<!--gsd-key:<plan.key>-->` marker
// apply.ts's issueCreate embeds in every created issue's description (see
// PROJECT_ISSUES_QUERY's `description` field). This makes issue dedup
// (diff.ts's issue-create decision) survive a lost/rebased linear-map.json —
// the map id is still consulted FIRST (apply.ts's withIssueIdentity), the
// marker is the fallback tier, never the reverse.
//
// WHY resolveProjectByLabel is a small query defined LOCALLY in this file
// (not mutations.ts, not a workspace scan): RawWorkspace's MAIN_QUERY read
// intentionally does not expose per-project label attachment —
// map.ts/transform.ts's explicit allow-list omits it (it was never needed by
// the read-only snapshot path). So Project's "carries the roadmap:<repo>
// label" resolve step (D-06-03 order, step 2) needs its own dedicated
// lookup rather than scanning the already-fetched workspace. It soft-fails
// (returns null) on any transport/GraphQL error rather than throwing — a
// miss on this secondary signal must fall through to the name-match step,
// exactly like a real miss on this step would; only the mandatory team
// resolve and a NAMED-but-missing initiative are fail-closed (throw).
//
// Every fetchFn is injected (never the global `fetch`), matching
// fetch-workspace.ts's testability convention. Every untrusted value (team
// key, label name, plan/phase identity strings) is passed through GraphQL
// `variables`, never string-interpolated into a query body (T-06-01).
// ---------------------------------------------------------------------------

import { fetchAssembledWorkspace } from "../linear/fetch-workspace.ts";
import { mapWorkspace } from "../linear/map.ts";
import type { RawWorkspace } from "../linear/transform.ts";
import {
  TEAMS_QUERY,
  PROJECT_LABELS_QUERY,
  ISSUE_LABELS_QUERY,
  PROJECT_ISSUES_QUERY,
  type TeamsQueryResponse,
  type ProjectLabelsQueryResponse,
  type IssueLabelsQueryResponse,
  type ProjectIssuesQueryResponse,
} from "./mutations.ts";
import { titleHash } from "./hash.ts";
import type {
  LinearMap,
  SyncConfigEntry,
  ResolvedIssue,
  ResolvedProject,
  ResolvedWorkspace,
} from "./config.ts";

// ---------------------------------------------------------------------------
// Team (required before any projectCreate/issueCreate — Pitfall 4)
// ---------------------------------------------------------------------------

export async function resolveTeam(
  fetchFn: typeof fetch,
  endpoint: string,
  auth: string,
  teamKey: string
): Promise<string> {
  const headers = { "Content-Type": "application/json", Authorization: auth };
  const res = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: TEAMS_QUERY, variables: { key: teamKey } }),
  });
  if (!res.ok) {
    throw new Error(`Linear team request failed: ${res.status}`);
  }
  const json = (await res.json()) as TeamsQueryResponse;
  if (json.errors && json.errors.length > 0) {
    throw new Error(
      `Linear GraphQL errors (team): ${json.errors.map((e) => e.message).join(", ")}`
    );
  }
  const team = json.data.teams.nodes[0];
  if (!team) {
    throw new Error(`Linear team "${teamKey}" not found`);
  }
  return team.id;
}

// ---------------------------------------------------------------------------
// Both label pools — ProjectLabel and IssueLabel are distinct id spaces
// (Pitfall 2). Resolved independently; each is null when its own pool has
// no match for `labelName`.
// ---------------------------------------------------------------------------

export async function resolveLabels(
  fetchFn: typeof fetch,
  endpoint: string,
  auth: string,
  labelName: string
): Promise<{ projectLabelId: string | null; issueLabelId: string | null }> {
  const headers = { "Content-Type": "application/json", Authorization: auth };

  const projectRes = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: PROJECT_LABELS_QUERY, variables: { name: labelName } }),
  });
  if (!projectRes.ok) {
    throw new Error(`Linear project-label request failed: ${projectRes.status}`);
  }
  const projectJson = (await projectRes.json()) as ProjectLabelsQueryResponse;
  if (projectJson.errors && projectJson.errors.length > 0) {
    throw new Error(
      `Linear GraphQL errors (project-label): ${projectJson.errors.map((e) => e.message).join(", ")}`
    );
  }

  const issueRes = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: ISSUE_LABELS_QUERY, variables: { name: labelName } }),
  });
  if (!issueRes.ok) {
    throw new Error(`Linear issue-label request failed: ${issueRes.status}`);
  }
  const issueJson = (await issueRes.json()) as IssueLabelsQueryResponse;
  if (issueJson.errors && issueJson.errors.length > 0) {
    throw new Error(
      `Linear GraphQL errors (issue-label): ${issueJson.errors.map((e) => e.message).join(", ")}`
    );
  }

  return {
    projectLabelId: projectJson.data.projectLabels.nodes[0]?.id ?? null,
    issueLabelId: issueJson.data.issueLabels.nodes[0]?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Initiative NAME -> id. null when the config entry names no initiative at
// all; fail-closed (throws) when a name IS configured but matches nothing in
// the already-read workspace — mirrors resolveTeam's fail-closed contract.
// Matches over the already-read workspace; never a separate query (no
// untrusted string is ever interpolated — this is a plain array find).
// ---------------------------------------------------------------------------

export function resolveInitiative(
  workspace: RawWorkspace,
  name: string | undefined
): string | null {
  if (!name) return null;
  const match = workspace.initiatives.find((ini) => ini.name === name);
  if (!match) {
    throw new Error(`Linear initiative "${name}" not found`);
  }
  return match.id;
}

// ---------------------------------------------------------------------------
// Project label-carrying lookup (D-06-03 step 2 for Project). See file
// header for why this is a dedicated query rather than a workspace scan.
// ---------------------------------------------------------------------------

const PROJECT_BY_LABEL_QUERY = `
  query ProjectByLabel($name: String!) {
    projects(filter: { labels: { name: { eq: $name } } }, first: 1) {
      nodes { id }
    }
  }
`;

interface ProjectByLabelResponse {
  data: { projects: { nodes: { id: string }[] } } | null;
  errors?: Array<{ message: string }>;
}

export async function resolveProjectByLabel(
  fetchFn: typeof fetch,
  endpoint: string,
  auth: string,
  labelName: string
): Promise<string | null> {
  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ query: PROJECT_BY_LABEL_QUERY, variables: { name: labelName } }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ProjectByLabelResponse;
    if (json.errors && json.errors.length > 0) return null;
    return json.data?.projects.nodes[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Project: stored map id -> label-carrying project -> configured name match
// (D-06-03 order). Pure/sync over an already-resolved `labeledProjectId`
// (from resolveProjectByLabel) so it stays trivially unit-testable.
// ---------------------------------------------------------------------------

export function resolveProject(
  workspace: RawWorkspace,
  map: LinearMap,
  entry: SyncConfigEntry,
  labeledProjectId: string | null = null
): ResolvedProject | null {
  const repoKey = entry.name;

  const storedId = map.projects[repoKey]?.id;
  let raw = storedId ? workspace.projects.find((p) => p.id === storedId) : undefined;

  if (!raw && labeledProjectId) {
    raw = workspace.projects.find((p) => p.id === labeledProjectId);
  }

  if (!raw && entry.projectName) {
    raw = workspace.projects.find((p) => p.name === entry.projectName);
  }

  if (!raw) return null;

  return {
    id: raw.id,
    name: raw.name,
    repoKey,
    milestones: raw.projectMilestones.nodes.map((m) => ({
      id: m.id,
      name: m.name,
      targetDate: m.targetDate,
    })),
    issues: [],
  };
}

// ---------------------------------------------------------------------------
// Paginated, target-scoped issue read — the dedup identity surface
// (06-REVIEWS.md Consensus item 1). Copies fetch-workspace.ts's cursor-loop
// + endCursor invariant check. Every returned issue's `identityKey` is
// recovered from its description's `<!--gsd-key:...-->` marker (CR-01) —
// null when the issue predates this CLI's marker convention.
// ---------------------------------------------------------------------------

const ISSUE_IDENTITY_MARKER_RE = /<!--gsd-key:([^>]+)-->/;

export async function readProjectIssues(
  fetchFn: typeof fetch,
  endpoint: string,
  auth: string,
  projectId: string
): Promise<ResolvedIssue[]> {
  const headers = { "Content-Type": "application/json", Authorization: auth };
  const issues: ResolvedIssue[] = [];

  let afterCursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: PROJECT_ISSUES_QUERY,
        variables: { projectId, after: afterCursor },
      }),
    });
    if (!res.ok) {
      throw new Error(`Linear project-issues request failed: ${res.status}`);
    }
    const json = (await res.json()) as ProjectIssuesQueryResponse;
    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `Linear GraphQL errors (project-issues): ${json.errors.map((e) => e.message).join(", ")}`
      );
    }

    const { nodes, pageInfo } = json.data.issues;
    for (const node of nodes) {
      const marker = ISSUE_IDENTITY_MARKER_RE.exec(node.description ?? "");
      issues.push({
        id: node.id,
        title: node.title,
        identityKey: marker?.[1] ?? null,
        projectId,
        milestoneId: node.projectMilestone?.id ?? null,
        labelIds: node.labels.nodes.map((l) => l.id),
      });
    }

    hasNextPage = pageInfo.hasNextPage;
    if (hasNextPage && pageInfo.endCursor === null) {
      throw new Error("Pagination invariant violated: hasNextPage=true but endCursor=null");
    }
    afterCursor = pageInfo.endCursor;
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Milestone: stored map id -> titleHash match (WR-05). This is the single
// implementation of that order — diff.ts's findMatchingMilestone and
// apply.ts's executeOperations milestone seed both call this directly rather
// than re-implementing the match inline, so a renamed-in-Linear-UI milestone
// still resolves via its stored id instead of producing a duplicate
// milestone-create (WR-03's "don't advertise a dedup tier that isn't wired
// into the real path" applies here too).
//
// (There is no equivalent resolveIssue: issue identity is recovered via the
// description marker in readProjectIssues / apply.ts's withIssueIdentity,
// see CR-01 — a separate title-hash-of-planKey tier would just re-advertise
// the same non-functional fallback WR-03 flagged, since a real issue's title
// is never the plan key.)
// ---------------------------------------------------------------------------

export function resolveMilestone(
  project: ResolvedProject,
  phaseSlug: string,
  map: LinearMap
): string | null {
  const mapKey = `${project.repoKey}/${phaseSlug}`;
  const storedId = map.milestones[mapKey]?.id;
  if (storedId) {
    const stored = project.milestones.find((m) => m.id === storedId);
    if (stored) return stored.id;
  }
  const hash = titleHash(phaseSlug);
  const existing = project.milestones.find((m) => titleHash(m.name) === hash);
  return existing?.id ?? null;
}

// ---------------------------------------------------------------------------
// Compose everything: base workspace read + team + both labels + initiative
// + project (with its issues) into a single ResolvedWorkspace.
// ---------------------------------------------------------------------------

export async function buildResolvedWorkspace(
  fetchFn: typeof fetch,
  endpoint: string,
  auth: string,
  entry: SyncConfigEntry,
  map: LinearMap
): Promise<ResolvedWorkspace> {
  const assembled = await fetchAssembledWorkspace(fetchFn, endpoint, auth);
  const workspace = mapWorkspace(assembled);

  const teamId = entry.teamKey ? await resolveTeam(fetchFn, endpoint, auth, entry.teamKey) : null;
  const { projectLabelId, issueLabelId } = await resolveLabels(fetchFn, endpoint, auth, entry.label);
  const initiativeId = resolveInitiative(workspace, entry.initiative);
  const labeledProjectId = await resolveProjectByLabel(fetchFn, endpoint, auth, entry.label);

  let project = resolveProject(workspace, map, entry, labeledProjectId);
  if (project) {
    const issues = await readProjectIssues(fetchFn, endpoint, auth, project.id);
    project = { ...project, issues };
  }

  return { teamId, project, projectLabelId, issueLabelId, initiativeId };
}
