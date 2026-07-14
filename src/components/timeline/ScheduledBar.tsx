import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ProjectPopoverContent } from "@/components/timeline/ProjectPopoverContent";
import { MilestoneMarker } from "@/components/timeline/MilestoneMarker";
import { barPosition, type TimelineWindow } from "@/lib/timeline/dateUtils";
import { luminanceFor } from "@/lib/timeline/colorUtils";
import type { Milestone, Project } from "@/lib/roadmap/schema";
import { cn } from "@/lib/utils";

/** Cluster count threshold: milestones within 12px collapse to one indicator (D-10). */
const CLUSTER_PX = 12;

/** Parse a YYYY-MM-DD snapshot date as local midnight (matches dateUtils). */
function localMidnight(date: string): number {
  return new Date(date + "T00:00:00").getTime();
}

/**
 * A dated milestone's position as a percentage of the bar's own width. Only
 * meaningful for a full span bar (startDate + targetDate); startDate-less bars
 * (D-07) and off-window stubs have no interior span, so markers pin to the end.
 */
function markerLeftPercent(
  msDate: string,
  project: Project,
  isSpan: boolean
): number {
  if (!isSpan || project.startDate === null || project.targetDate === null) {
    return 100;
  }
  const start = localMidnight(project.startDate);
  const target = localMidnight(project.targetDate);
  const span = target - start;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, ((localMidnight(msDate) - start) / span) * 100));
}

type MarkerCluster = {
  milestone: Milestone;
  leftPercent: number;
  count: number;
};

/**
 * Collapse markers whose on-screen gap is under 12px into a single counted
 * cluster (D-10). Needs the measured bar width; before measurement (barWidthPx
 * === 0) every marker renders individually.
 */
function clusterMarkers(
  positioned: Array<{ milestone: Milestone; leftPercent: number }>,
  barWidthPx: number
): MarkerCluster[] {
  const sorted = [...positioned].sort((a, b) => a.leftPercent - b.leftPercent);
  const clusters: MarkerCluster[] = [];
  for (const item of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && barWidthPx > 0) {
      const gapPx = ((item.leftPercent - last.leftPercent) / 100) * barWidthPx;
      if (gapPx <= CLUSTER_PX) {
        last.count += 1;
        continue;
      }
    }
    clusters.push({ milestone: item.milestone, leftPercent: item.leftPercent, count: 1 });
  }
  return clusters;
}

/**
 * D-05/D-06/D-07 scheduled project bar: absolutely positioned via barPosition,
 * branching on `pos.kind` (never on width <= 0). Renders D-03 clamp cues, D-10
 * milestone markers, and the shared popover behind a pointer-typed trigger.
 */
export function ScheduledBar({
  project,
  color,
  window,
}: {
  project: Project;
  color: string;
  window: TimelineWindow;
}) {
  // NOTE: the `window` prop (TimelineWindow) shadows the global; reach the real
  // matchMedia via globalThis. Initialize false so desktop is the SSR-safe default.
  const [isTouch, setIsTouch] = React.useState(false);
  React.useEffect(() => {
    setIsTouch(globalThis.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Measure the rendered bar so 12px milestone clustering has a pixel basis. A
  // callback ref (typed HTMLElement) fits both trigger elements — the desktop
  // HoverCard trigger renders an <a>, the touch Popover trigger a <button>.
  const [barWidthPx, setBarWidthPx] = React.useState(0);
  const observerRef = React.useRef<ResizeObserver | null>(null);
  const setBarRef = React.useCallback((el: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const update = () => setBarWidthPx(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    observerRef.current = ro;
  }, []);

  // Scheduled iff targetDate is present (D-06). Defensive narrow for typing.
  if (project.targetDate === null) return null;
  const pos = barPosition(project.startDate, project.targetDate, window);

  // Position box per kind (D-05 span %, D-07 fixed 64px right-aligned, D-03 32px stub).
  const box: React.CSSProperties = { "--bar-fill": color } as React.CSSProperties;
  if (pos.kind === "span") {
    box.left = `${pos.left}%`;
    box.width = `${pos.width}%`;
  } else if (pos.kind === "fixedEnd") {
    box.right = `${100 - pos.left}%`;
    box.width = "64px";
  } else {
    // stub — entirely off-window
    box.width = "32px";
    if (pos.clampedLeft) box.left = "0";
    else box.right = "0";
  }

  const isSpan = pos.kind === "span";
  const showText = pos.kind !== "stub";
  const textColor = luminanceFor(color) < 0.4 ? "#ffffff" : "#1a1a1a";

  const positioned = project.milestones
    .filter((m): m is Milestone & { targetDate: string } => m.targetDate !== null)
    .map((m) => ({
      milestone: m,
      leftPercent: markerLeftPercent(m.targetDate, project, isSpan),
    }));
  const clusters = clusterMarkers(positioned, barWidthPx);

  const barClass = cn(
    "absolute flex h-7 items-center overflow-hidden rounded bg-(--bar-fill)/80 dark:bg-(--bar-fill)/70"
  );

  const barContent = (
    <>
      {pos.clampedLeft && (
        <ChevronLeft
          role="img"
          aria-label="Continues before window start"
          size={10}
          className="absolute left-0 top-1/2 -translate-y-1/2 text-(--color-muted-foreground)"
        />
      )}
      {pos.clampedRight && (
        <ChevronRight
          role="img"
          aria-label="Continues past window end"
          size={10}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-(--color-muted-foreground)"
        />
      )}
      {showText && (
        <span
          className="truncate px-1.5 text-xs leading-7"
          style={{ color: textColor }}
        >
          {project.name}
        </span>
      )}
      {clusters.map((c) => (
        <MilestoneMarker
          key={c.milestone.id}
          milestone={c.milestone}
          color={color}
          leftPercent={c.leftPercent}
          count={c.count >= 2 ? c.count : undefined}
        />
      ))}
    </>
  );

  const body = <ProjectPopoverContent project={project} color={color} />;

  if (isTouch) {
    return (
      <Popover>
        <PopoverTrigger
          ref={setBarRef}
          aria-label={project.name}
          className={barClass}
          style={box}
        >
          {barContent}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">{body}</PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        ref={setBarRef}
        render={<button type="button" />}
        delay={300}
        closeDelay={200}
        aria-label={project.name}
        className={barClass}
        style={box}
      >
        {barContent}
      </HoverCardTrigger>
      <HoverCardContent className="w-auto p-0">{body}</HoverCardContent>
    </HoverCard>
  );
}
