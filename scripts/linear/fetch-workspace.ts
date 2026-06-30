// ---------------------------------------------------------------------------
// Shared fetch-and-assemble logic for the complexity-safe two-part strategy.
//
// Process-free: MUST NOT reference `process`, `node:*`, or any Node-only global.
// Safe to import from both Node scripts (client.ts) and the Cloudflare Worker.
// Mirrors the map.ts boundary discipline.
//
// Strategy:
//   1. POST MAIN_QUERY → get initiatives + projects (no issues).
//   2. POST ISSUES_QUERY with after=null; paginate until hasNextPage is false.
//      Bucket issues by project.id. Skip issues where project is null.
//   3. Reassemble: set project.issues = { nodes: bucket[project.id] ?? [] }
//      for each project in the main response, yielding a GqlResponse shape
//      that mapWorkspace already understands. No changes to map.ts required.
// ---------------------------------------------------------------------------

import { MAIN_QUERY, ISSUES_QUERY } from "./query.ts";
import type { GqlResponse } from "./map.ts";

// ---------------------------------------------------------------------------
// Minimal types for the raw API payloads
// ---------------------------------------------------------------------------

interface RawMainProject {
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

interface RawMainResponse {
  data: {
    initiatives: { nodes: { id: string; name: string; color: string | null; status: string }[] };
    projects: { nodes: RawMainProject[] };
  };
  errors?: Array<{ message: string }>;
}

interface RawIssueNode {
  project: { id: string } | null;
  state: { type: string } | null;
}

interface RawIssuesPage {
  data: {
    issues: {
      nodes: RawIssueNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
  errors?: Array<{ message: string }>;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Performs the two-part Linear fetch:
 *   1. MAIN_QUERY for initiatives + projects (no issues nested).
 *   2. Paginated ISSUES_QUERY for all flat issues; buckets by project.id.
 * Returns a GqlResponse-shaped object that mapWorkspace can consume unchanged.
 *
 * @param fetchFn  The global `fetch` function (injected to keep this module
 *                 process-free and testable in both runtimes).
 * @param endpoint  The Linear GraphQL endpoint URL.
 * @param authHeader  The Authorization header value (the token).
 */
export async function fetchAssembledWorkspace(
  fetchFn: typeof fetch,
  endpoint: string,
  authHeader: string
): Promise<GqlResponse> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: authHeader,
  };

  // ---- Step 1: Main request (initiatives + projects metadata) ----
  const mainRes = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: MAIN_QUERY }),
  });

  if (!mainRes.ok) {
    throw new Error(`Linear main request failed: ${mainRes.status}`);
  }

  const mainJson = (await mainRes.json()) as RawMainResponse;

  if (mainJson.errors && mainJson.errors.length > 0) {
    throw new Error(
      `Linear GraphQL errors (main): ${mainJson.errors.map((e) => e.message).join(", ")}`
    );
  }

  // ---- Step 2: Paginated issues ----
  // Bucket: projectId → array of { state: { type } } (or { state: null })
  const bucket: Record<string, Array<{ state: { type: string } | null }>> = {};

  let afterCursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const issuesRes = await fetchFn(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: ISSUES_QUERY,
        variables: { after: afterCursor },
      }),
    });

    if (!issuesRes.ok) {
      throw new Error(`Linear issues request failed: ${issuesRes.status}`);
    }

    const issuesJson = (await issuesRes.json()) as RawIssuesPage;

    if (issuesJson.errors && issuesJson.errors.length > 0) {
      throw new Error(
        `Linear GraphQL errors (issues): ${issuesJson.errors.map((e) => e.message).join(", ")}`
      );
    }

    const { nodes, pageInfo } = issuesJson.data.issues;

    for (const node of nodes) {
      // Skip orphan/inbox issues that have no project association
      if (node.project === null) continue;
      const pid = node.project.id;
      if (!bucket[pid]) bucket[pid] = [];
      bucket[pid].push({ state: node.state });
    }

    hasNextPage = pageInfo.hasNextPage;
    if (hasNextPage && pageInfo.endCursor === null) {
      throw new Error(
        "Pagination invariant violated: hasNextPage=true but endCursor=null"
      );
    }
    afterCursor = pageInfo.endCursor;
  }

  // ---- Step 3: Reassemble into GqlResponse shape ----
  // Merge the buckets into the project nodes so mapWorkspace sees the
  // existing GqlProject shape (with project.issues.nodes[].state.type).
  const assembledProjects = mainJson.data.projects.nodes.map((proj) => ({
    ...proj,
    issues: { nodes: bucket[proj.id] ?? [] },
  }));

  return {
    data: {
      initiatives: mainJson.data.initiatives,
      projects: { nodes: assembledProjects },
    },
  };
}
