// SyncBadge — OV-04 "out of sync with plan" badge. Graceful-nullish render
// guard identical to Phase-4 D-13 (`project.url`): absent/false/null renders
// nothing, never errors. `planAhead` has no live data source until Phase 6's
// `.planning/` walker populates it (D-05-02) — this component is the shared
// render primitive reused by the drill-down dialog header (here) and the
// OverviewPage project list (05-06).

import { Badge } from "@/components/ui/badge";
import type { Project } from "@/lib/roadmap/schema";

export function SyncBadge({ project }: { project: Project }) {
  return project.planAhead ? (
    <Badge variant="destructive">Out of sync with plan</Badge>
  ) : null;
}
