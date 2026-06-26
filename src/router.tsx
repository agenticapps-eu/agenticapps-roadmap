import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout";
import { OverviewPage } from "./pages/OverviewPage";
import { TimelinePage } from "./pages/TimelinePage";
import { roadmapLoader } from "./lib/roadmap/loader";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    loader: roadmapLoader,
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
