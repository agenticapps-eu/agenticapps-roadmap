/**
 * Pure, React-free freshness formatter for LIVE-01's "last refreshed" hint.
 *
 * `now` is always injected by the caller (never `Date.now()` internally) so
 * this stays deterministic and unit-testable without fake timers.
 *
 * Null-safe by design: an undefined/null/empty/invalid `generatedAt` returns
 * an empty string rather than throwing, so a caller can render nothing
 * (AppHeader's freshness hint must never crash on an absent loaderData).
 */
export function formatFreshness(
  generatedAt: string | undefined | null,
  now: Date,
): string {
  if (!generatedAt) {
    return "";
  }

  const then = new Date(generatedAt);
  if (Number.isNaN(then.getTime())) {
    return "";
  }

  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return "updated just now";
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `updated ${diffMin}m ago`;
  }

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `updated ${diffHour}h ago`;
  }

  const diffDay = Math.floor(diffHour / 24);
  return `updated ${diffDay}d ago`;
}
