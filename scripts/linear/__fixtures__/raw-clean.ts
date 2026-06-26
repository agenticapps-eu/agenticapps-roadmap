/**
 * Clean fixture — representative of real AGE workspace shape.
 * No secrets, no emails.
 *
 * Reflects two initiatives + several projects + milestones + issue state samples.
 * issueCounts expectation (for tests):
 *   proj-001: backlog=1 (unstarted), started=1, done=1 (completed)  → {backlog:1,started:1,done:1}
 *   proj-002: backlog=2 (triage + backlog), started=0, done=0        → {backlog:2,started:0,done:0}
 *   proj-003: backlog=0, started=0, done=0 (canceled only)           → {backlog:0,started:0,done:0}
 */
export const rawClean = {
  initiatives: [
    {
      id: "ini-age-001",
      name: "agenticapps-workflow",
      color: "#5e6ad2",
      state: "started",
    },
    {
      id: "ini-factiv-001",
      name: "Factiv",
      color: null,
      state: "backlog",
    },
  ],
  projects: [
    {
      id: "proj-001",
      name: "AgenticApps Roadmap",
      description: "The roadmap web app",
      initiativeId: "ini-age-001",
      state: { name: "In Progress", type: "started" },
      priority: 1,
      startedAt: "2026-06-22",
      targetDate: "2026-08-17",
      projectMilestones: {
        nodes: [
          { id: "ms-001", name: "Phase 1 — Scaffold", targetDate: "2026-06-30" },
          { id: "ms-002", name: "Phase 2 — Data layer", targetDate: "2026-07-15" },
        ],
      },
      issues: {
        nodes: [
          { state: { type: "unstarted" } },
          { state: { type: "started" } },
          { state: { type: "completed" } },
          { state: { type: "cancelled" } },
        ],
      },
    },
    {
      id: "proj-002",
      name: "Dashboard: Codex host integration",
      description: null,
      initiativeId: "ini-age-001",
      state: { name: "Backlog", type: "backlog" },
      priority: 2,
      startedAt: null,
      targetDate: null,
      projectMilestones: { nodes: [] },
      issues: {
        nodes: [
          { state: { type: "triage" } },
          { state: { type: "backlog" } },
        ],
      },
    },
    {
      id: "proj-003",
      name: "cPARX Prototype",
      description: "Prototype for cPARX",
      initiativeId: "ini-factiv-001",
      state: { name: "Cancelled", type: "cancelled" },
      priority: 0,
      startedAt: null,
      targetDate: null,
      projectMilestones: { nodes: [] },
      issues: {
        nodes: [{ state: { type: "cancelled" } }],
      },
    },
  ],
};
