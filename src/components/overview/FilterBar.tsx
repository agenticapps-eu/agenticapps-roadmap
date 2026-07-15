// FilterBar — URL-encoded filter controls for the Overview route (OV-02).
// The URL IS the state: reads decodeFilters(searchParams) on every render
// (no useState mirror) and writes via encodeFilters, always threading the
// current searchParams as `base` so co-resident params (?project, ?source)
// survive (05-RESEARCH Pitfall 2). Quarter and custom from/to may coexist —
// this component never clears one when the other is set (05-REVIEWS finding 3).

import { useSearchParams } from "react-router-dom";
import {
  decodeFilters,
  encodeFilters,
  PRIORITY_LABELS,
  type Filters,
} from "@/lib/overview/selectors";
import type { RoadmapJson } from "@/lib/roadmap/schema";
import { Button } from "@/components/ui/button";

const PRIORITIES = [0, 1, 2, 3, 4];

/** Current + next 3 quarters as "YYYY-Qn" presets, computed from `now`. */
function quarterPresets(now: Date): string[] {
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1; // 1..4
  const presets: string[] = [];
  for (let i = 0; i < 4; i++) {
    const total = (quarter - 1 + i) % 4;
    const y = year + Math.floor((quarter - 1 + i) / 4);
    presets.push(`${y}-Q${total + 1}`);
  }
  return presets;
}

export function FilterBar({ data }: { data: RoadmapJson }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = decodeFilters(searchParams);

  function update(edit: (next: Filters) => void) {
    setSearchParams((prev) => {
      const next = decodeFilters(prev);
      edit(next);
      return encodeFilters(next, prev);
    });
  }

  function toggleInitiative(id: string) {
    update((next) => {
      next.initiatives = next.initiatives.includes(id)
        ? next.initiatives.filter((x) => x !== id)
        : [...next.initiatives, id];
    });
  }

  function toggleStatus(status: string) {
    update((next) => {
      next.statuses = next.statuses.includes(status)
        ? next.statuses.filter((x) => x !== status)
        : [...next.statuses, status];
    });
  }

  function togglePriority(priority: number) {
    update((next) => {
      next.priorities = next.priorities.includes(priority)
        ? next.priorities.filter((x) => x !== priority)
        : [...next.priorities, priority];
    });
  }

  function selectQuarter(quarter: string) {
    update((next) => {
      // Coexistence: toggling a quarter does NOT clear from/to.
      next.quarter = next.quarter === quarter ? null : quarter;
    });
  }

  function setFrom(value: string) {
    update((next) => {
      // Coexistence: setting a custom date does NOT clear quarter.
      next.from = value || null;
    });
  }

  function setTo(value: string) {
    update((next) => {
      next.to = value || null;
    });
  }

  function clearAll() {
    setSearchParams((prev) => {
      const cleared: Filters = {
        initiatives: [],
        quarter: null,
        from: null,
        to: null,
        statuses: [],
        priorities: [],
      };
      return encodeFilters(cleared, prev);
    });
  }

  const statuses = [...new Set(data.projects.map((p) => p.status))].sort();
  const quarters = quarterPresets(new Date());

  return (
    <div className="flex flex-wrap items-start gap-6 border-b border-(--color-border) pb-4">
      {/* Initiative multi-select */}
      <fieldset aria-label="Filter by initiative" className="flex flex-col gap-1.5">
        <legend className="text-xs font-medium text-(--color-muted-foreground)">
          Initiative
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {data.initiatives.map((initiative) => {
            const active = filters.initiatives.includes(initiative.id);
            return (
              <Button
                key={initiative.id}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                aria-pressed={active}
                aria-label={`Toggle initiative ${initiative.name}`}
                onClick={() => toggleInitiative(initiative.id)}
              >
                {initiative.name}
              </Button>
            );
          })}
        </div>
      </fieldset>

      {/* Status multi-select */}
      <fieldset aria-label="Filter by status" className="flex flex-col gap-1.5">
        <legend className="text-xs font-medium text-(--color-muted-foreground)">
          Status
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((status) => {
            const active = filters.statuses.includes(status);
            return (
              <Button
                key={status}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                aria-pressed={active}
                aria-label={`Toggle status ${status}`}
                onClick={() => toggleStatus(status)}
              >
                {status}
              </Button>
            );
          })}
        </div>
      </fieldset>

      {/* Priority multi-select */}
      <fieldset aria-label="Filter by priority" className="flex flex-col gap-1.5">
        <legend className="text-xs font-medium text-(--color-muted-foreground)">
          Priority
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITIES.map((priority) => {
            const active = filters.priorities.includes(priority);
            return (
              <Button
                key={priority}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                aria-pressed={active}
                aria-label={`Toggle priority ${PRIORITY_LABELS[priority]}`}
                onClick={() => togglePriority(priority)}
              >
                {PRIORITY_LABELS[priority]}
              </Button>
            );
          })}
        </div>
      </fieldset>

      {/* Time range: quarter presets + custom from/to (coexisting) */}
      <fieldset aria-label="Filter by time range" className="flex flex-col gap-1.5">
        <legend className="text-xs font-medium text-(--color-muted-foreground)">
          Time range
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {quarters.map((quarter) => {
            const active = filters.quarter === quarter;
            return (
              <Button
                key={quarter}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                aria-pressed={active}
                aria-label={`Toggle quarter ${quarter}`}
                onClick={() => selectQuarter(quarter)}
              >
                {quarter}
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="filter-from" className="text-xs text-(--color-muted-foreground)">
            From
          </label>
          <input
            id="filter-from"
            type="date"
            aria-label="Custom range start date"
            value={filters.from ?? ""}
            onChange={(e) => setFrom(e.target.value)}
            className="h-7 rounded-md border border-(--color-border) bg-(--color-background) px-2 text-xs"
          />
          <label htmlFor="filter-to" className="text-xs text-(--color-muted-foreground)">
            To
          </label>
          <input
            id="filter-to"
            type="date"
            aria-label="Custom range end date"
            value={filters.to ?? ""}
            onChange={(e) => setTo(e.target.value)}
            className="h-7 rounded-md border border-(--color-border) bg-(--color-background) px-2 text-xs"
          />
        </div>
      </fieldset>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Clear all filters"
        onClick={clearAll}
        className="mt-5"
      >
        Clear filters
      </Button>
    </div>
  );
}
