import { useLoaderData } from "react-router-dom";
import type { RoadmapJson } from "@/lib/roadmap/schema";

export function TimelinePage() {
  const data = useLoaderData() as RoadmapJson;

  const withDate = data.projects
    .filter((p) => p.targetDate !== null)
    .sort((a, b) => (a.targetDate! < b.targetDate! ? -1 : 1));

  const withoutDate = data.projects.filter((p) => p.targetDate === null);

  return (
    <div>
      <h1 className="text-2xl font-bold">Timeline</h1>
      {withDate.length === 0 && withoutDate.length === 0 && (
        <p className="mt-2 text-(--color-muted-foreground)">No projects found.</p>
      )}
      {withDate.length > 0 && (
        <ul className="mt-4 space-y-1">
          {withDate.map((project) => (
            <li key={project.id} className="text-sm">
              <span className="font-medium">{project.targetDate}</span>
              {" — "}
              <span>{project.name}</span>
            </li>
          ))}
        </ul>
      )}
      {withoutDate.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-(--color-muted-foreground)">No target date:</p>
          <ul className="mt-1 space-y-1">
            {withoutDate.map((project) => (
              <li key={project.id} className="text-sm">
                {project.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
