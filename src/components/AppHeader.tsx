import { useEffect, useRef, useState } from "react";
import {
  NavLink,
  useSearchParams,
  useRouteLoaderData,
  useNavigation,
  useRevalidator,
} from "react-router-dom";
import type { RoadmapLoaderData } from "@/lib/roadmap/loader";
import { formatFreshness } from "@/lib/roadmap/freshness";

export function AppHeader() {
  const [params, setParams] = useSearchParams();
  const live = params.get("source") === "live";
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const revalidator = useRevalidator();
  const refreshing = revalidator.state === "loading";

  // liveUnavailable is only present after the loader has run; may be null
  // during initial hydration — read defensively.
  const loaderData = useRouteLoaderData("root") as RoadmapLoaderData | null;
  const liveUnavailable = loaderData?.liveUnavailable ?? false;

  // Tracks the LAST successful refresh, not the live projection's own
  // request-time `generatedAt` (which is always "just now" in live mode).
  // Seeded from the initial load, then bumped on every loading -> idle
  // transition of an explicit revalidate.
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | undefined>(
    () => loaderData?.data.generatedAt,
  );
  const prevRevalidatorState = useRef(revalidator.state);
  useEffect(() => {
    if (prevRevalidatorState.current === "loading" && revalidator.state === "idle") {
      setLastRefreshedAt(new Date().toISOString());
    }
    prevRevalidatorState.current = revalidator.state;
  }, [revalidator.state]);

  function handleToggle() {
    if (live) {
      // Toggling OFF: remove the param entirely — clean default URL (not ?source=snapshot)
      setParams((prev) => {
        prev.delete("source");
        return prev;
      });
    } else {
      // Toggling ON: set ?source=live
      setParams((prev) => {
        prev.set("source", "live");
        return prev;
      });
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-(--color-background)/95 backdrop-blur">
      <div className="flex h-14 items-center px-6">
        <span className="mr-8 font-semibold tracking-tight">
          AgenticApps Roadmap
        </span>

        <nav className="flex items-center gap-6 text-sm">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive
                ? "font-medium text-(--color-foreground)"
                : "text-(--color-muted-foreground) transition-colors hover:text-(--color-foreground)"
            }
          >
            Overview
          </NavLink>
          <NavLink
            to="/timeline"
            className={({ isActive }) =>
              isActive
                ? "font-medium text-(--color-foreground)"
                : "text-(--color-muted-foreground) transition-colors hover:text-(--color-foreground)"
            }
          >
            Timeline
          </NavLink>
        </nav>

        {/* Right-side slot: Snapshot / Live toggle */}
        <div className="ml-auto flex items-center gap-3">
          {liveUnavailable && (
            <span className="text-xs text-(--color-muted-foreground)">
              live unavailable — showing snapshot
            </span>
          )}
          {live && loaderData && (
            <>
              <span className="text-xs text-(--color-muted-foreground)">
                {formatFreshness(lastRefreshedAt, new Date())}
              </span>
              <button
                onClick={() => revalidator.revalidate()}
                disabled={refreshing}
                aria-label="Refresh from Linear"
                className={[
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  refreshing ? "opacity-60 cursor-wait" : "cursor-pointer",
                  "border border-(--color-border) text-(--color-muted-foreground) hover:text-(--color-foreground)",
                ].join(" ")}
              >
                {refreshing ? "Refreshing…" : "↻ Refresh"}
              </button>
            </>
          )}
          <button
            onClick={handleToggle}
            aria-label={live ? "Switch to snapshot data" : "Switch to live data"}
            className={[
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              isLoading ? "opacity-60 cursor-wait" : "cursor-pointer",
              live
                ? "bg-(--color-foreground) text-(--color-background)"
                : "border border-(--color-border) text-(--color-muted-foreground) hover:text-(--color-foreground)",
            ].join(" ")}
          >
            {live ? "Live" : "Snapshot"}
          </button>
        </div>
      </div>
    </header>
  );
}
