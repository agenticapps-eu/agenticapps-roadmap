// Pure Overview selectors — KPI/health aggregation (OV-01) + URL filter
// encode/decode/apply (OV-02). No React/DOM imports; consumed by 05-04
// (KPI cards / health strip), 05-05 (FilterBar / drill-down dialog), and
// 05-06 (OverviewPage assembly). Invariants:
//   - scheduled = has targetDate (Phase-4 D-06); startDate alone does NOT count.
//   - the "initiatives" KPI = distinct non-null initiativeId among the PASSED
//     (already filtered) projects, so every KPI reflects the same filtered
//     input (05-REVIEWS finding 5).

import type { Project, Initiative } from "@/lib/roadmap/schema";

/** OV-01 / D-05-01 — Phase-4 D-06: scheduled = has targetDate. */
export const isScheduled = (p: Project): boolean => p.targetDate !== null;

/**
 * OV-01 / 05-REVIEWS finding 4 — canonical Phase-5 priority domain (Linear-
 * accurate, 0..4). Exported once here; 05-04/05-05 import this so no label
 * copy drifts. Intentionally differs from the pre-existing (off-by-one) 0..3
 * copy in ProjectPopoverContent.tsx, which is out of scope to change.
 */
export const PRIORITY_LABELS: Record<number, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

export interface Kpis {
  initiatives: number;
  projects: number;
  scheduled: number;
  undated: number;
  byPriority: Record<number, number>;
  byStatus: Record<string, number>;
}

/**
 * OV-01 / D-05-01 — single-arg: the initiatives KPI is derived from the
 * passed (already filtered) projects as the count of distinct non-null
 * initiativeId values, so every KPI reflects the same filtered input
 * (05-REVIEWS finding 5).
 */
export function computeKpis(projects: Project[]): Kpis {
  const byPriority: Record<number, number> = {};
  const byStatus: Record<string, number> = {};
  const initiativeIds = new Set<string>();
  let scheduled = 0;
  for (const p of projects) {
    if (isScheduled(p)) scheduled++;
    byPriority[p.priority] = (byPriority[p.priority] ?? 0) + 1;
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    if (p.initiativeId !== null) initiativeIds.add(p.initiativeId);
  }
  return {
    initiatives: initiativeIds.size,
    projects: projects.length,
    scheduled,
    undated: projects.length - scheduled,
    byPriority,
    byStatus,
  };
}

export interface InitiativeHealth {
  initiative: Initiative | null; // null = Unassigned row (A3)
  projectCount: number;
  scheduled: number;
  undated: number;
  backlog: number;
  started: number;
  done: number;
}

function rollupRow(
  initiative: Initiative | null,
  own: Project[]
): InitiativeHealth {
  return {
    initiative,
    projectCount: own.length,
    scheduled: own.filter(isScheduled).length,
    undated: own.filter((p) => !isScheduled(p)).length,
    backlog: own.reduce((s, p) => s + p.issueCounts.backlog, 0),
    started: own.reduce((s, p) => s + p.issueCounts.started, 0),
    done: own.reduce((s, p) => s + p.issueCounts.done, 0),
  };
}

/**
 * OV-01 / D-05-01 — one row per initiative (a zero-project initiative yields
 * an all-zeros row), plus a trailing "Unassigned" row (initiative: null,
 * A3 — SETTLED YES) when >=1 project has initiativeId === null; omitted when
 * no such projects exist.
 */
export function rollupInitiativeHealth(
  projects: Project[],
  initiatives: Initiative[]
): InitiativeHealth[] {
  const rows = initiatives.map((initiative) =>
    rollupRow(
      initiative,
      projects.filter((p) => p.initiativeId === initiative.id)
    )
  );
  const unassigned = projects.filter((p) => p.initiativeId === null);
  if (unassigned.length > 0) rows.push(rollupRow(null, unassigned));
  return rows;
}
