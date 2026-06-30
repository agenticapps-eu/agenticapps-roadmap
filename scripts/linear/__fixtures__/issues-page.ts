/**
 * Issues-query fixture — response shape for ISSUES_QUERY (flat paginated issues).
 * Each issue node has `project { id }` (nullable) and `state { type }`.
 *
 * The test stub's `.json()` returns these DIRECTLY on the second (and subsequent)
 * fetch calls (the issues pagination requests).
 */

export interface GqlIssueNode {
  project: { id: string } | null;
  state: { type: string } | null;
}

export interface GqlIssuesPage {
  data: {
    issues: {
      nodes: GqlIssueNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Single-page issues response for proj-001, proj-002, proj-003.
 * Matches the issue counts in gql-clean.ts for backward compatibility:
 *   proj-001: unstarted, started, completed, cancelled → backlog+1, started+1, done+1
 *   proj-002: triage, backlog → backlog+2
 *   proj-003: cancelled → (excluded)
 * Plus one null-project issue that must be skipped.
 */
export const issuesPageSingle: GqlIssuesPage = {
  data: {
    issues: {
      nodes: [
        { project: { id: "proj-001" }, state: { type: "unstarted" } },
        { project: { id: "proj-001" }, state: { type: "started" } },
        { project: { id: "proj-001" }, state: { type: "completed" } },
        { project: { id: "proj-001" }, state: { type: "cancelled" } },
        { project: { id: "proj-002" }, state: { type: "triage" } },
        { project: { id: "proj-002" }, state: { type: "backlog" } },
        { project: { id: "proj-003" }, state: { type: "cancelled" } },
        // Orphan/inbox issue with no project — must be skipped
        { project: null, state: { type: "backlog" } },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
};

/**
 * Page 1 of 2 for the multi-page pagination test.
 * proj-001 gets issues on page 1, proj-002 on page 2.
 */
export const issuesPageOne: GqlIssuesPage = {
  data: {
    issues: {
      nodes: [
        { project: { id: "proj-001" }, state: { type: "started" } },
        { project: { id: "proj-001" }, state: { type: "completed" } },
        // Null-project issue — must be skipped
        { project: null, state: { type: "started" } },
      ],
      pageInfo: { hasNextPage: true, endCursor: "cursor-abc" },
    },
  },
};

/**
 * Page 2 of 2 for the multi-page pagination test.
 * proj-002 issues on this page. Aggregated with page 1.
 */
export const issuesPageTwo: GqlIssuesPage = {
  data: {
    issues: {
      nodes: [
        { project: { id: "proj-002" }, state: { type: "backlog" } },
        { project: { id: "proj-002" }, state: { type: "triage" } },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
};

/**
 * Issues response used as the second-fetch stub in email-leak tests.
 * The main response carries the email; this page just needs to exist so the
 * pagination loop completes before assertNoLeak fires.
 */
export const issuesPageForEmailLeak: GqlIssuesPage = {
  data: {
    issues: {
      nodes: [
        { project: { id: "proj-bad-001" }, state: { type: "started" } },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
};

/**
 * Genuinely empty issues response (zero nodes). Use when a test requires a
 * stub that contributes no issue counts to any project.
 */
export const issuesPageEmpty: GqlIssuesPage = {
  data: {
    issues: {
      nodes: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
};
