import { Badge } from "@/components/ui/badge";
import type { Project } from "@/lib/roadmap/schema";

const PRIORITY_LABELS: Record<number, string> = {
  0: "Urgent",
  1: "High",
  2: "Medium",
  3: "Low",
};

function priorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority] ?? "—";
}

export function ProjectPopoverContent({
  project,
  color,
}: {
  project: Project;
  color: string;
}) {
  const { backlog, started, done } = project.issueCounts;
  const total = backlog + started + done;

  return (
    <div className="flex w-[260px] max-h-[420px] flex-col overflow-y-auto p-4 sm:w-[280px]">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 border-b border-(--color-border) pb-2">
        <span className="truncate text-sm font-semibold">{project.name}</span>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline">{project.status}</Badge>
          <Badge variant="outline">{priorityLabel(project.priority)}</Badge>
        </div>
      </div>

      {/* Date row */}
      <div className="flex gap-4 py-2 text-xs text-(--color-muted-foreground)">
        <span>Start: {project.startDate ?? "—"}</span>
        <span>Target: {project.targetDate ?? "—"}</span>
      </div>

      {/* Issue counts */}
      <div className="py-2">
        <div className="text-xs text-(--color-muted-foreground)">Issues</div>
        <div className="mt-1 flex h-2 overflow-hidden rounded-full">
          {total === 0 ? (
            <div className="h-full w-full bg-(--color-muted)" />
          ) : (
            <>
              <div
                className="h-full bg-(--color-muted)"
                style={{ width: `${(backlog / total) * 100}%` }}
              />
              <div
                className="h-full bg-sky-500"
                style={{ width: `${(started / total) * 100}%` }}
              />
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </>
          )}
        </div>
        <div className="mt-1 text-xs text-(--color-muted-foreground)">
          {backlog} backlog · {started} started · {done} done
        </div>
      </div>

      {/* Milestones */}
      {project.milestones.length > 0 && (
        <div className="border-t border-(--color-border) py-2">
          {project.milestones.slice(0, 5).map((milestone) => (
            <div key={milestone.id} className="text-xs">
              <span style={{ color }}>◆</span> {milestone.name}{" "}
              <span className="text-(--color-muted-foreground)">
                {milestone.targetDate ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {project.summary && (
        <div className="border-t border-(--color-border) py-2">
          <p className="line-clamp-3 text-xs text-(--color-muted-foreground)">
            {project.summary}
          </p>
        </div>
      )}

      {/* Footer: guarded Linear link */}
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
    </div>
  );
}
