// SyncBadge — OV-04 "out of sync with plan" badge. Graceful-nullish render
// guard identical to Phase-4 D-13 (`project.url`): absent/false/null renders
// nothing, never errors. `planAhead` has no live data source until Phase 6's
// `.planning/` walker populates it (D-05-02) — this component is the shared
// render primitive reused by the drill-down dialog header (here) and the
// OverviewPage project list (05-06).
//
// 07-04 (LIVE-02): additive optimistic props. `planAheadOverride` lets the
// backfill-state Map (owned by OverviewPage) flip the badge ahead of the
// next snapshot; when absent, falls back to the real `project.planAhead`
// signal. `pending` renders a distinct "backfilling…" indicator alongside
// the out-of-sync badge. Both are optional — existing `{ project }`-only
// call sites are unaffected.

import { Badge } from "@/components/ui/badge";
import type { Project } from "@/lib/roadmap/schema";

export function SyncBadge({
  project,
  planAheadOverride,
  pending,
}: {
  project: Project;
  planAheadOverride?: boolean;
  pending?: boolean;
}) {
  const outOfSync = planAheadOverride ?? project.planAhead;
  return (
    <>
      {outOfSync ? (
        <Badge variant="destructive">Out of sync with plan</Badge>
      ) : null}
      {pending ? <Badge variant="outline">backfilling…</Badge> : null}
    </>
  );
}
