// ---------------------------------------------------------------------------
// GraphQL queries for Linear API.
// Extracted so both the Node sync script and the Worker handler can import
// one copy without transitively pulling in process.env.
//
// WHY TWO QUERIES instead of one WORKSPACE_QUERY with nested issues:
//   Fetching `issues { nodes { state { type } } }` inside every project node
//   exceeds Linear's per-request GraphQL complexity limit, returning HTTP 400
//   ("Query too complex"). The fix is a two-part strategy:
//     1. MAIN_QUERY: projects + initiatives (no issues nested) — low complexity.
//     2. ISSUES_QUERY: flat paginated top-level issues with project.id — also
//        low complexity. Loop with `after` cursor until hasNextPage is false,
//        bucket by project.id, then reassemble into the GqlResponse shape that
//        mapWorkspace expects.
// ---------------------------------------------------------------------------

/**
 * Main query — fetches initiatives and projects (metadata + milestones).
 * Intentionally omits issues; those are fetched separately via ISSUES_QUERY.
 * Validated to pass Linear's complexity limit.
 */
export const MAIN_QUERY = `
  query WorkspaceMain {
    initiatives(first: 50) {
      nodes {
        id
        name
        color
        status
      }
    }
    projects(first: 50) {
      nodes {
        id
        name
        description
        initiatives(first: 3) {
          nodes {
            id
          }
        }
        status {
          name
          type
        }
        priority
        startedAt
        targetDate
        projectMilestones(first: 25) {
          nodes {
            id
            name
            targetDate
          }
        }
      }
    }
  }
`;

/**
 * Issues query — fetches all issues flat with their project association.
 * Paginated: pass `after: null` first, then endCursor, until hasNextPage is false.
 * Issues whose `project` is null are orphan/inbox issues and must be skipped.
 * Validated to pass Linear's complexity limit even with large workspaces.
 */
export const ISSUES_QUERY = `
  query WorkspaceIssues($after: String) {
    issues(first: 250, after: $after) {
      nodes {
        project {
          id
        }
        state {
          type
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
