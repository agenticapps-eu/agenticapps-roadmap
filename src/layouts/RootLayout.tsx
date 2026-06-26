import { Outlet } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";

export function RootLayout() {
  return (
    <div className="min-h-screen bg-(--color-background)">
      <AppHeader />
      <main className="px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
