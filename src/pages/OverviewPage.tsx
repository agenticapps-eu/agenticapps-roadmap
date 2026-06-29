import { useRouteLoaderData } from "react-router-dom";
import type { RoadmapLoaderData } from "@/lib/roadmap/loader";

export function OverviewPage() {
  const { data } = useRouteLoaderData("root") as RoadmapLoaderData;

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="mt-1 text-(--color-muted-foreground)">
        {data.initiatives.length} initiative{data.initiatives.length !== 1 ? "s" : ""},{" "}
        {data.projects.length} project{data.projects.length !== 1 ? "s" : ""}
      </p>
      <ul className="mt-4 space-y-1">
        {data.projects.map((project) => (
          <li key={project.id} className="text-sm">
            <span className="font-medium">{project.name}</span>
            {" — "}
            <span className="text-(--color-muted-foreground)">{project.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
