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

export interface Filters {
  initiatives: string[]; // repeated ?initiative=<id>
  quarter: string | null; // preset, e.g. "2026-Q3"
  from: string | null; // custom range lower bound (YYYY-MM-DD)
  to: string | null; // custom range upper bound
  statuses: string[]; // repeated ?status=<value>
  priorities: number[]; // repeated ?priority=<0..4>
}

const FILTER_KEYS = [
  "initiative",
  "status",
  "priority",
  "quarter",
  "from",
  "to",
] as const;

/**
 * OV-02 / V5 (T-05-02) — strict canonical-decimal-integer check, so
 * ""/" "/"0x2"/"1e1"/"1.5" are dropped rather than coerced by `Number()`.
 */
function parsePriority(v: string): number | null {
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 4 ? n : null;
}

/**
 * OV-02 / V5 (T-05-02) — real-calendar ISO validate: reject "2026-02-31" /
 * "2026-13-01" by round-tripping through the Date constructor, not just
 * regex shape.
 */
function isRealIsoDate(v: string | null): v is string {
  if (v === null) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * OV-02 / D-05-05 — decode is DEFENSIVE (URLSearchParams is attacker-
 * controllable, T-05-02): repeated params via getAll (never CSV); priority
 * clamped to strict integers 0..4 and deduped; from/to dropped unless a
 * real-calendar ISO date; `project`/`source` are never read here.
 */
export function decodeFilters(sp: URLSearchParams): Filters {
  const priorities = [
    ...new Set(
      sp
        .getAll("priority")
        .map(parsePriority)
        .filter((n): n is number => n !== null)
    ),
  ];
  const from = sp.get("from");
  const to = sp.get("to");
  return {
    initiatives: sp.getAll("initiative"),
    quarter: sp.get("quarter"),
    from: isRealIsoDate(from) ? from : null,
    to: isRealIsoDate(to) ? to : null,
    statuses: sp.getAll("status"),
    priorities,
  };
}

/**
 * OV-02 — writes ONLY set dimensions (empty arrays/null omitted -> clean
 * shareable URL); clones `base` and re-appends the six filter keys so
 * co-resident params (?project, ?source) survive untouched (Pitfall 2).
 */
export function encodeFilters(
  filters: Filters,
  base: URLSearchParams = new URLSearchParams()
): URLSearchParams {
  const sp = new URLSearchParams(base);
  FILTER_KEYS.forEach((k) => sp.delete(k));
  filters.initiatives.forEach((id) => sp.append("initiative", id));
  filters.statuses.forEach((s) => sp.append("status", s));
  filters.priorities.forEach((p) => sp.append("priority", String(p)));
  if (filters.quarter) sp.set("quarter", filters.quarter);
  if (filters.from) sp.set("from", filters.from);
  if (filters.to) sp.set("to", filters.to);
  return sp;
}

const QUARTER_MONTH_RANGES: Record<string, [string, string]> = {
  "1": ["01-01", "03-31"],
  "2": ["04-01", "06-30"],
  "3": ["07-01", "09-30"],
  "4": ["10-01", "12-31"],
};

/**
 * OV-02 / 05-REVIEWS finding 3 — SETTLED: quarter and custom from/to may
 * COEXIST in the URL (FilterBar does not clear one when setting the other).
 * Custom from/to takes PRECEDENCE when either bound is present (this branch is
 * reachable, not dead). A lone bound is open-ended (WR-01): a lone `from` means
 * "on/after from", a lone `to` means "on/before to". Bounds are normalized so a
 * reversed from > to still filters rather than excluding everything (WR-02).
 * Falls back to the quarter's resolved range, else null. An
 * invalid/out-of-range/malformed quarter resolves to null.
 */
export function resolveRange(
  filters: Filters
): { start: string; end: string } | null {
  if (filters.from || filters.to) {
    const lo = filters.from ?? "0000-01-01";
    const hi = filters.to ?? "9999-12-31";
    return lo <= hi ? { start: lo, end: hi } : { start: hi, end: lo };
  }
  if (filters.quarter) {
    const m = /^(\d{4})-Q([1-4])$/.exec(filters.quarter);
    if (!m) return null;
    const [, year, q] = m;
    const [start, end] = QUARTER_MONTH_RANGES[q];
    return { start: `${year}-${start}`, end: `${year}-${end}` };
  }
  return null;
}

/**
 * OV-02 / D-05-05 — AND-composes initiative/status/priority + the resolved
 * time range. A1 (SETTLED YES): undated projects are EXCLUDED whenever a
 * range is active; included when range is null.
 */
export function applyFilters(
  projects: Project[],
  filters: Filters,
  range: { start: string; end: string } | null
): Project[] {
  return projects.filter((p) => {
    if (
      filters.initiatives.length &&
      !filters.initiatives.includes(p.initiativeId ?? "")
    )
      return false;
    if (filters.statuses.length && !filters.statuses.includes(p.status))
      return false;
    if (
      filters.priorities.length &&
      !filters.priorities.includes(p.priority)
    )
      return false;
    if (range) {
      if (!p.targetDate) return false;
      if (p.targetDate < range.start || p.targetDate > range.end)
        return false;
    }
    return true;
  });
}
