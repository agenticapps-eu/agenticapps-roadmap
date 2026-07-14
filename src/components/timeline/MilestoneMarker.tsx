import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MilestoneMarker({
  milestone,
  color,
  leftPercent,
  count,
}: {
  milestone: { name: string; targetDate: string | null };
  color: string;
  leftPercent: number;
  count?: number;
}) {
  // D-10: omit undated milestones entirely.
  if (milestone.targetDate === null) return null;

  const diamond = (
    <div
      title={`${milestone.name} — ${milestone.targetDate}`}
      style={{ backgroundColor: color }}
      className="h-2 w-2 rotate-45 ring-2 ring-white"
    />
  );

  // Cluster collapse: two or more milestones within 12px render a single
  // stacked indicator with a count badge instead of overlapping diamonds.
  if (count !== undefined && count >= 2) {
    return (
      <div
        title={`${count} milestones near ${milestone.targetDate}`}
        style={{ left: `${leftPercent}%` }}
        className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5"
      >
        {diamond}
        <Badge variant="outline" className="h-4 px-1 text-xs font-semibold">
          {count}
        </Badge>
      </div>
    );
  }

  return (
    <div
      style={{ left: `${leftPercent}%` }}
      className={cn(
        "absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
      )}
    >
      {diamond}
    </div>
  );
}
