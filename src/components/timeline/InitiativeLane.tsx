import { UndatedPill } from "@/components/timeline/UndatedPill";
import { ScheduledBar } from "@/components/timeline/ScheduledBar";
import type { TimelineWindow } from "@/lib/timeline/dateUtils";
import type { Initiative, Project } from "@/lib/roadmap/schema";

/**
 * One initiative swimlane: a color-swatch header plus a body split into the D-04
 * parking rail (undated needs-backfill pills, sorted urgent-first) and the
 * scheduled grid (dated bars, D-06). An initiative with zero projects collapses to
 * a header-only lane — it is never hidden (Factiv case).
 */
export function InitiativeLane({
  initiative,
  projects,
  color,
  window,
}: {
  initiative: Initiative;
  projects: Project[];
  color: string;
  window: TimelineWindow;
}) {
  // D-06 split: scheduled iff targetDate !== null; undated iff targetDate === null.
  const undated = projects
    .filter((p) => p.targetDate === null)
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    );
  const scheduled = projects.filter((p) => p.targetDate !== null);

  return (
    <div>
      <div className="flex h-8 items-center gap-2 border-b border-(--color-border) px-4">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-semibold">{initiative.name}</span>
      </div>

      {projects.length > 0 && (
        <div className="flex min-h-12">
          <div className="w-40 shrink-0 space-y-2 bg-(--color-muted) p-2">
            {undated.map((project) => (
              <UndatedPill key={project.id} project={project} color={color} />
            ))}
          </div>
          <div className="relative flex-1 bg-(--color-background) py-2.5">
            {/* Per-month grid lines (D-01 alignment) — decorative, non-interactive. */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="border-l border-(--color-border)" />
              ))}
            </div>
            {scheduled.map((project) => (
              <ScheduledBar
                key={project.id}
                project={project}
                color={color}
                window={window}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
