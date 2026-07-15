import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRIORITY_LABELS } from "@/lib/overview/selectors";
import type { Kpis } from "@/lib/overview/selectors";

/**
 * OV-01 — one row per distribution entry with a proportional single-color bar.
 * Reuses the ProjectPopoverContent total===0 guard so an empty distribution
 * renders a neutral, non-NaN bar (T-05-07).
 */
function DistributionRows({
  entries,
}: {
  entries: Array<{ label: string; count: number }>;
}) {
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  return (
    <div className="space-y-1.5">
      {entries.map(({ label, count }) => (
        <div key={label} className="space-y-0.5">
          <div className="flex justify-between text-xs text-(--color-muted-foreground)">
            <span>{label}</span>
            <span>{count}</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full">
            {total === 0 ? (
              <div className="h-full w-full bg-(--color-muted)" />
            ) : (
              <div
                className="h-full bg-(--color-primary)"
                style={{ width: `${(count / total) * 100}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * OV-01 (D-05-01) — five KPI tiles: initiatives, projects, scheduled vs
 * undated, by-priority, by-status. Dumb component: sole input is an
 * already-computed `Kpis` prop (from selectors.ts); no data fetch, no hook.
 */
export function KpiCards({ kpis }: { kpis: Kpis }) {
  const scheduledTotal = kpis.scheduled + kpis.undated;
  const priorityEntries = Object.entries(kpis.byPriority)
    .map(([priority, count]) => ({
      priority: Number(priority),
      label: PRIORITY_LABELS[Number(priority)] ?? priority,
      count,
    }))
    .sort((a, b) => a.priority - b.priority);
  const statusEntries = Object.entries(kpis.byStatus)
    .map(([status, count]) => ({ label: status, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader>
          <CardTitle>Initiatives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{kpis.initiatives}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{kpis.projects}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled vs Undated</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between text-xs text-(--color-muted-foreground)">
            <span>{kpis.scheduled} scheduled</span>
            <span>{kpis.undated} undated</span>
          </div>
          <div className="mt-1.5 flex h-2 overflow-hidden rounded-full">
            {scheduledTotal === 0 ? (
              <div className="h-full w-full bg-(--color-muted)" />
            ) : (
              <>
                <div
                  className="h-full bg-sky-500"
                  style={{ width: `${(kpis.scheduled / scheduledTotal) * 100}%` }}
                />
                <div
                  className="h-full bg-(--color-muted)"
                  style={{ width: `${(kpis.undated / scheduledTotal) * 100}%` }}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By priority</CardTitle>
        </CardHeader>
        <CardContent>
          <DistributionRows entries={priorityEntries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By status</CardTitle>
        </CardHeader>
        <CardContent>
          <DistributionRows entries={statusEntries} />
        </CardContent>
      </Card>
    </div>
  );
}
