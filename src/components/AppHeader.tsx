import { NavLink } from "react-router-dom";

export function AppHeader() {
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

        {/* Right-side slot: reserved for future Connect / live-mode toggle */}
        <div className="ml-auto">
          <button
            disabled
            className="rounded-md px-3 py-1.5 text-sm text-(--color-muted-foreground) opacity-50 cursor-not-allowed"
            aria-label="Connect to Linear (coming soon)"
          >
            Connect
          </button>
        </div>
      </div>
    </header>
  );
}
