import { resolveInitiativeColor } from "@/lib/timeline/colorUtils";
import type { InitiativeHealth } from "@/lib/overview/selectors";
import type { RoadmapJson } from "@/lib/roadmap/schema";

/**
 * OV-01 (D-05-01) — one row per InitiativeHealth: a color chip (or a neutral
 * "Unassigned" chip when `row.initiative` is null, A3), the scheduled/undated
 * split, and a backlog/started/done stacked bar (ProjectPopoverContent
 * pattern, total===0 guard, T-05-07). Dumb component: renders only the
 * passed props; rows render in the given order (05-02 already orders +
 * appends Unassigned last).
 */
export function HealthStrip({
  rows,
  initiatives,
}: {
  rows: InitiativeHealth[];
  initiatives: RoadmapJson["initiatives"];
}) {
  return (
    <div className="divide-y divide-(--color-border) rounded-xl ring-1 ring-foreground/10">
      {rows.map((row) => {
        const total = row.backlog + row.started + row.done;
        const color = row.initiative
          ? resolveInitiativeColor(row.initiative, initiatives)
          : "var(--color-muted-foreground)";
        const name = row.initiative ? row.initiative.name : "Unassigned";

        return (
          <div
            key={row.initiative?.id ?? "unassigned"}
            className="flex items-center gap-4 p-3"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="w-32 shrink-0 truncate text-sm font-medium text-(--color-foreground)">
              {name}
            </span>
            <span className="w-36 shrink-0 text-xs text-(--color-muted-foreground)">
              {row.scheduled} scheduled · {row.undated} undated
            </span>
            <div className="flex h-2 flex-1 overflow-hidden rounded-full">
              {total === 0 ? (
                <div className="h-full w-full bg-(--color-muted)" />
              ) : (
                <>
                  <div
                    className="h-full bg-(--color-muted)"
                    style={{ width: `${(row.backlog / total) * 100}%` }}
                  />
                  <div
                    className="h-full bg-sky-500"
                    style={{ width: `${(row.started / total) * 100}%` }}
                  />
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${(row.done / total) * 100}%` }}
                  />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
