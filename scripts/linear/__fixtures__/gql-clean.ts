/**
 * Clean GQL fixture — full GqlResponse envelope shape.
 * Derived from raw-clean.ts data so the resulting RoadmapJson is schema-valid.
 *
 * The top-level `data` key MUST be present — this is what the test stub's
 * `.json()` returns DIRECTLY. mapWorkspace reads `json.data.initiatives` /
 * `json.data.projects` so no wrapper is needed.
 *
 * Note: `initiatives: { nodes: [{ id }] }` is the nested GQL connection shape
 * (vs flat `initiativeId` in RawWorkspace). mapWorkspace takes the first node.
 */

import type { GqlResponse } from "../map.ts";

export const gqlClean: GqlResponse = {
  data: {
    initiatives: {
      nodes: [
        {
          id: "ini-age-001",
          name: "agenticapps-workflow",
          color: "#5e6ad2",
          status: "started",
        },
        {
          id: "ini-factiv-001",
          name: "Factiv",
          color: null,
          status: "backlog",
        },
      ],
    },
    projects: {
      nodes: [
        {
          id: "proj-001",
          name: "AgenticApps Roadmap",
          description: "The roadmap web app",
          initiatives: { nodes: [{ id: "ini-age-001" }] },
          status: { name: "In Progress", type: "started" },
          priority: 1,
          startedAt: "2026-06-22",
          targetDate: "2026-08-17",
          projectMilestones: {
            nodes: [
              {
                id: "ms-001",
                name: "Phase 1 — Scaffold",
                targetDate: "2026-06-30",
              },
              {
                id: "ms-002",
                name: "Phase 2 — Data layer",
                targetDate: "2026-07-15",
              },
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
          initiatives: { nodes: [{ id: "ini-age-001" }] },
          status: { name: "Backlog", type: "backlog" },
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
          initiatives: { nodes: [{ id: "ini-factiv-001" }] },
          status: { name: "Cancelled", type: "cancelled" },
          priority: 0,
          startedAt: null,
          targetDate: null,
          projectMilestones: { nodes: [] },
          issues: {
            nodes: [{ state: { type: "cancelled" } }],
          },
        },
      ],
    },
  },
};
