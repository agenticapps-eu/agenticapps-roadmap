import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout";
import { OverviewPage } from "./pages/OverviewPage";
import { TimelinePage } from "./pages/TimelinePage";
import { roadmapLoader, shouldRevalidateRoadmap } from "./lib/roadmap/loader";
import { RoadmapError, RoadmapLoading } from "./components/RoadmapBoundaries";

export const router = createBrowserRouter([
  {
    id: "root",
    path: "/",
    element: <RootLayout />,
    loader: roadmapLoader,
    shouldRevalidate: shouldRevalidateRoadmap,
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
