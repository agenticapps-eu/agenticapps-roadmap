/**
 * Malicious fixture — contains a planted API token and email address.
 * buildSnapshot() MUST throw when given this input.
 */
export const rawMalicious = {
  initiatives: [
    {
      id: "ini-bad-001",
      name: "lin_api_DEADBEEF1234567890abcdef — injected token",
      color: null,
      state: "started",
    },
  ],
  projects: [
    {
      id: "proj-bad-001",
      name: "Malicious Project",
      description: "Contact secret@example.com for details",
      initiativeId: "ini-bad-001",
      state: { name: "In Progress", type: "started" },
      priority: 1,
      startedAt: null,
      targetDate: null,
      projectMilestones: { nodes: [] },
      issues: {
        nodes: [{ state: { type: "started" } }],
      },
    },
  ],
};
