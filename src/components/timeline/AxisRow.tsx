import { todayLeftPercent, type TimelineWindow } from "@/lib/timeline/dateUtils";

/**
 * D-01 month-axis header + D-02 today marker. A fixed-left RailHeader captioned
 * "Needs dates" (framing the parking rail below) sits beside a 7-column month grid.
 * A non-interactive vertical line marks today at its offset within the window.
 */
export function AxisRow({
  window,
  monthColumns,
}: {
  window: TimelineWindow;
  monthColumns: Array<{ label: string; date: Date }>;
}) {
  const todayPct = todayLeftPercent(
    new Date(),
    window.windowStart,
    window.windowDays
  );

  return (
    <div className="flex h-8">
      <div className="flex w-40 shrink-0 items-center px-4">
        <span className="text-xs text-(--color-muted-foreground)">
          Needs dates
        </span>
      </div>
      <div className="relative grid flex-1 grid-cols-7">
        {monthColumns.map((col) => (
          <div
            key={col.label}
            className="flex items-center justify-center text-xs font-semibold"
          >
            {col.label}
          </div>
        ))}
        <div
          aria-label="Today"
          className="pointer-events-none absolute bottom-0 top-0 bg-(--color-foreground)"
          style={{ left: `${todayPct}%`, width: "1.5px" }}
        />
      </div>
    </div>
  );
}
