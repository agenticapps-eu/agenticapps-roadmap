/**
 * Email-leak GQL fixture — full GqlResponse envelope shape.
 * Contains `secret@example.com` planted in a project description.
 *
 * When passed through mapWorkspace → buildSnapshot → assertNoLeak, this
 * fixture MUST cause assertNoLeak to throw (EMAIL_RE match), which the
 * proxy handler must catch and return a generic 502 with no PII.
 *
 * The test stub's `.json()` returns this fixture DIRECTLY — no wrapping.
 * Mirrors raw-malicious.ts's email address for the leak regression.
 */

import type { GqlResponse } from "../map.ts";

export const gqlWithEmail: GqlResponse = {
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
          issues: {
            nodes: [{ state: { type: "started" } }],
          },
        },
      ],
    },
  },
};
