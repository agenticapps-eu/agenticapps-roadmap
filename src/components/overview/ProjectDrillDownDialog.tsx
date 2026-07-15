// ProjectDrillDownDialog — OV-03 ?project-controlled drill-down. Open state
// is derived from the ?project URL param (D-05-04): an unknown/absent id
// resolves to null and renders NO dialog (guarded, T-05-05). Shows the
// issueCounts breakdown, milestones list, a header-mounted SyncBadge
// (OV-04 render surface), and a guarded Linear deep-link (T-05-04) — it does
// NOT list individual issues (D-05-03; the snapshot stores aggregate counts
// only). Closing deletes the param with { replace: true } so Back doesn't
// re-open it, and preserves co-resident filter params (05-RESEARCH Pitfall 2).

import { useSearchParams } from "react-router-dom";
import { PRIORITY_LABELS } from "@/lib/overview/selectors";
import type { RoadmapJson } from "@/lib/roadmap/schema";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SyncBadge } from "@/components/overview/SyncBadge";

export function ProjectDrillDownDialog({ data }: { data: RoadmapJson }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const project = projectId
    ? (data.projects.find((p) => p.id === projectId) ?? null)
    : null;

  function handleOpenChange(open: boolean) {
    if (!open) {
      setSearchParams(
        (prev) => {
          prev.delete("project");
          return prev;
        },
        { replace: true }
      );
    }
  }

  const total = project
    ? project.issueCounts.backlog +
      project.issueCounts.started +
      project.issueCounts.done
    : 0;

  return (
    <Dialog open={project !== null} onOpenChange={handleOpenChange}>
      {project && (
        <DialogContent>
          <div className="flex items-start justify-between gap-2 border-b border-(--color-border) pb-2">
            <DialogTitle className="truncate">{project.name}</DialogTitle>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              <Badge variant="outline">{project.status}</Badge>
              <Badge variant="outline">
                {PRIORITY_LABELS[project.priority] ?? "—"}
              </Badge>
              <SyncBadge project={project} />
            </div>
          </div>

          {/* Issue counts */}
          <div className="py-2">
            <div className="text-xs text-(--color-muted-foreground)">
              Issues
            </div>
            <div className="mt-1 flex h-2 overflow-hidden rounded-full">
              {total === 0 ? (
                <div className="h-full w-full bg-(--color-muted)" />
              ) : (
                <>
                  <div
                    className="h-full bg-(--color-muted)"
                    style={{
                      width: `${(project.issueCounts.backlog / total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-sky-500"
                    style={{
                      width: `${(project.issueCounts.started / total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${(project.issueCounts.done / total) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>
            <div className="mt-1 text-xs text-(--color-muted-foreground)">
              {project.issueCounts.backlog} backlog ·{" "}
              {project.issueCounts.started} started · {project.issueCounts.done}{" "}
              done
            </div>
          </div>

          {/* Milestones */}
          {project.milestones.length > 0 && (
            <div className="border-t border-(--color-border) py-2">
              {project.milestones.map((milestone) => (
                <div key={milestone.id} className="text-xs">
                  {milestone.name}{" "}
                  <span className="text-(--color-muted-foreground)">
                    {milestone.targetDate ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Guarded Linear deep-link (T-05-04, copied verbatim) */}
          {project.url?.startsWith("https://linear.app/") && (
            <div className="border-t border-(--color-border) pt-2">
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-(--color-primary)"
              >
                Open in Linear ↗
              </a>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
