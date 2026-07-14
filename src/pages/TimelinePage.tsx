import { useRouteLoaderData } from "react-router-dom";
import type { RoadmapLoaderData } from "@/lib/roadmap/loader";
import { getWindow, getMonthColumns } from "@/lib/timeline/dateUtils";
import { resolveInitiativeColor } from "@/lib/timeline/colorUtils";
import { AxisRow } from "@/components/timeline/AxisRow";
import { InitiativeLane } from "@/components/timeline/InitiativeLane";

/**
 * Timeline hero view: the month axis (D-01/D-02) over one lane per initiative,
 * ordered by scheduled-count desc then name asc. Reads validated loader data;
 * renders empty and error states inline (loading is the root HydrateFallback).
 */
export function TimelinePage() {
  const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;

  // The snapshot loader throws on genuine failure (RoadmapError renders), so a
  // null here is the defensive out-of-band case — surface the muted error line.
  if (!loaderData) {
    return (
      <p className="mt-8 text-sm text-(--color-muted-foreground)">
        Could not load timeline data. Switch to Snapshot mode above.
      </p>
    );
  }

  const { data } = loaderData;

  if (data.projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <span className="text-2xl">📅</span>
        <p className="text-sm font-semibold">No projects found</p>
        <p className="text-sm text-(--color-muted-foreground)">
          Projects will appear once Linear is synced with your plans.
        </p>
      </div>
    );
  }

  const window = getWindow();
  const monthColumns = getMonthColumns(window.windowStart);

  // One lane per initiative (all initiatives, including zero-project ones), each
  // colored via resolveInitiativeColor, then sorted scheduled-count desc, name asc.
  const lanes = data.initiatives
    .map((initiative) => {
      const projects = data.projects.filter(
        (p) => p.initiativeId === initiative.id
      );
      return {
        initiative,
        projects,
        color: resolveInitiativeColor(initiative, data.initiatives),
        scheduledCount: projects.filter((p) => p.targetDate !== null).length,
      };
    })
    .sort(
      (a, b) =>
        b.scheduledCount - a.scheduledCount ||
        (a.initiative.name < b.initiative.name
          ? -1
          : a.initiative.name > b.initiative.name
            ? 1
            : 0)
    );

  return (
    <section aria-label="Timeline" className="overflow-x-auto">
      <h1 className="mb-8 text-xl font-semibold">Timeline</h1>
      <div className="min-w-[840px]">
        <AxisRow window={window} monthColumns={monthColumns} />
        <div className="divide-y divide-(--color-border) border-t border-(--color-border)">
          {lanes.map((lane) => (
            <InitiativeLane
              key={lane.initiative.id}
              initiative={lane.initiative}
              projects={lane.projects}
              color={lane.color}
              window={window}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
