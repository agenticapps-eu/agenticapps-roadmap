import { useRouteError } from "react-router-dom";

/** Root route errorElement — shown when the snapshot loader throws. */
export function RoadmapError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Failed to load the roadmap snapshot.";
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Roadmap unavailable</h1>
      <p className="mt-2 text-(--color-muted-foreground)">{message}</p>
    </div>
  );
}

/** Root route HydrateFallback — shown during the initial loader run. */
export function RoadmapLoading() {
  return <div className="p-6 text-(--color-muted-foreground)">Loading roadmap…</div>;
}
