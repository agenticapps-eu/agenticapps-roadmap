import * as React from "react";

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
import type { Project } from "@/lib/roadmap/schema";
import { cn } from "@/lib/utils";

/**
 * D-04 undated "needs-backfill" pill: a dashed, initiative-colored pill that opens
 * the shared project popover. Desktop (pointer: fine) uses HoverCard; touch
 * (pointer: coarse) uses Popover — detected on mount so desktop is the SSR-safe
 * default (RESEARCH Pitfall 5). The trigger renders a focusable <button> carrying
 * the project name as its accessible label; base-ui provides Escape-to-dismiss.
 */
export function UndatedPill({
  project,
  color,
}: {
  project: Project;
  color: string;
}) {
  const [isTouch, setIsTouch] = React.useState(false);
  React.useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const pillClass = cn(
    "block h-7 max-w-full truncate rounded-[0.875rem] border border-dashed px-2 text-xs leading-7"
  );
  const pillStyle: React.CSSProperties = {
    borderColor: color,
    backgroundColor: `${color}14`, // ~8% opacity
    color,
  };

  const body = <ProjectPopoverContent project={project} color={color} />;

  if (isTouch) {
    return (
      <Popover>
        <PopoverTrigger
          aria-label={project.name}
          className={pillClass}
          style={pillStyle}
        >
          {project.name}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">{body}</PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        render={<button type="button" />}
        delay={300}
        closeDelay={200}
        aria-label={project.name}
        className={pillClass}
        style={pillStyle}
      >
        {project.name}
      </HoverCardTrigger>
      <HoverCardContent className="w-auto p-0">{body}</HoverCardContent>
    </HoverCard>
  );
}
