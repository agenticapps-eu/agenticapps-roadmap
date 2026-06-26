import { createBrowserRouter, useRouteError } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout";
import { OverviewPage } from "./pages/OverviewPage";
import { TimelinePage } from "./pages/TimelinePage";
import { roadmapLoader } from "./lib/roadmap/loader";

function RoadmapError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Failed to load the roadmap snapshot.";
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Roadmap unavailable</h1>
      <p className="mt-2 text-(--color-muted-foreground)">{message}</p>
    </div>
  );
}

function RoadmapLoading() {
  return <div className="p-6 text-(--color-muted-foreground)">Loading roadmap…</div>;
}

export const router = createBrowserRouter([
  {
    id: "root",
    path: "/",
    element: <RootLayout />,
    loader: roadmapLoader,
    errorElement: <RoadmapError />,
    HydrateFallback: RoadmapLoading,
    children: [
      {
        index: true,
        element: <OverviewPage />,
      },
      {
        path: "timeline",
        element: <TimelinePage />,
      },
    ],
  },
]);
