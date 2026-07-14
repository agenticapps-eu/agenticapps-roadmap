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

/**
 * Root route HydrateFallback — shown during the initial loader run. Skeleton
 * swimlanes (D-12 loading state): a pulsing axis row of muted rectangles plus a
 * few lane placeholders (rail pills + a grid bar). No copy, purely a shape.
 */
export function RoadmapLoading() {
  return (
    <div className="px-6 py-8">
      <div className="min-w-[840px] animate-pulse">
        {/* Axis: 7 muted rectangles beside the rail column. */}
        <div className="flex h-8 items-center">
          <div className="w-40 shrink-0 px-4" />
          <div className="grid flex-1 grid-cols-7 gap-8 px-2">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-2 rounded bg-(--color-muted)" />
            ))}
          </div>
        </div>
        {/* Lanes: rail pill shapes + one grid bar shape each. */}
        {Array.from({ length: 3 }, (_, lane) => (
          <div
            key={lane}
            className="flex min-h-12 border-t border-(--color-border)"
          >
            <div className="w-40 shrink-0 space-y-2 p-2">
              {Array.from({ length: 2 }, (_, pill) => (
                <div
                  key={pill}
                  className="h-7 rounded-[0.875rem] bg-(--color-muted)"
                />
              ))}
            </div>
            <div className="relative flex-1 py-2.5">
              <div
                className="h-7 w-1/3 rounded bg-(--color-muted)"
                style={{ marginLeft: "12%" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
