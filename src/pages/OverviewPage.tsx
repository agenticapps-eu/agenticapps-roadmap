import { useRouteLoaderData, useSearchParams } from "react-router-dom";
import type { RoadmapLoaderData } from "@/lib/roadmap/loader";
import {
  decodeFilters,
  resolveRange,
  applyFilters,
  computeKpis,
  rollupInitiativeHealth,
} from "@/lib/overview/selectors";
import { KpiCards } from "@/components/overview/KpiCards";
import { HealthStrip } from "@/components/overview/HealthStrip";
import { FilterBar } from "@/components/overview/FilterBar";
import { ProjectDrillDownDialog } from "@/components/overview/ProjectDrillDownDialog";
import { SyncBadge } from "@/components/overview/SyncBadge";

/**
 * Overview hero view: KPI cards + per-initiative health strip (OV-01), URL-
 * shareable filters (OV-02), a per-project list that opens the ?project
 * drill-down (OV-03) and mounts the OV-04 SyncBadge per row. Reads the root
 * loader snapshot with zero network; the root route's shouldRevalidate
 * (05-07) prevents a refetch on filter/?project navigations.
 */
export function OverviewPage() {
  // Both hooks are called unconditionally, BEFORE the loader-data guard
  // below (05-REVIEWS finding 2 — Rules of Hooks: TimelinePage gets away
  // with a guard-after-one-hook because it calls only ONE hook; this page
  // needs two, so both must precede the guard).
  const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;
  const [searchParams, setSearchParams] = useSearchParams();

  // The snapshot loader throws on genuine failure (RoadmapError renders), so
  // a null here is the defensive out-of-band case — surface the muted error
  // line (mirrors TimelinePage.tsx:18-24).
  if (!loaderData) {
    return (
      <p className="mt-8 text-sm text-(--color-muted-foreground)">
        Could not load roadmap data. Switch to Snapshot mode above.
      </p>
    );
  }

  const { data } = loaderData;

  const filters = decodeFilters(searchParams);
  const range = resolveRange(filters);
  const filtered = applyFilters(data.projects, filters, range);

  // SINGLE-ARG (05-02 / 05-REVIEWS finding 5) — the initiatives KPI is
  // derived from the filtered set inside computeKpis; do NOT pass
  // data.initiatives.length separately.
  const kpis = computeKpis(filtered);
  const health = rollupInitiativeHealth(filtered, data.initiatives);

  function openProject(id: string) {
    // PUSH (no replace) so Back closes the dialog; thread prev so filter
    // params survive alongside ?project (05-RESEARCH Pitfall 2).
    setSearchParams((prev) => {
      prev.set("project", id);
      return prev;
    });
  }

  return (
    <section aria-label="Overview">
      <h1 className="mb-8 text-xl font-semibold">Overview</h1>

      <FilterBar data={data} />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <span className="text-2xl">📊</span>
          <p className="text-sm font-semibold">No projects found</p>
          <p className="text-sm text-(--color-muted-foreground)">
            Adjust or clear the filters above to see more projects.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <KpiCards kpis={kpis} />
          <HealthStrip rows={health} initiatives={data.initiatives} />

          <ul className="divide-y divide-(--color-border) rounded-xl ring-1 ring-foreground/10">
            {filtered.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => openProject(project.id)}
                  aria-label={`Open ${project.name} drill-down`}
                  className="flex w-full items-center justify-between gap-4 p-3 text-left text-sm hover:bg-(--color-muted)"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-(--color-foreground)">
                      {project.name}
                    </span>
                    <span className="shrink-0 text-(--color-muted-foreground)">
                      {project.status}
                    </span>
                  </span>
                  <SyncBadge project={project} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mounted OUTSIDE the empty-state branch so a shared ?project= link
          still opens even when active filters exclude that project. */}
      <ProjectDrillDownDialog data={data} />
    </section>
  );
}
