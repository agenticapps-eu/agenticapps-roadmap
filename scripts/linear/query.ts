// ---------------------------------------------------------------------------
// GraphQL query — fetches initiatives → projects → milestones + issue counts
// Extracted from client.ts so both the Node sync script and the Worker handler
// can import one copy without transitively pulling in process.env.
// ---------------------------------------------------------------------------

export const WORKSPACE_QUERY = `
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
