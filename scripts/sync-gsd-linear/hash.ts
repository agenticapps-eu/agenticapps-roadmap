// ---------------------------------------------------------------------------
// Stable identity-hash for sync-gsd-linear's title-hash dedup fallback.
//
// This helper is IDENTITY-AGNOSTIC — it is the CALLERS' contract that
// decides what string gets hashed:
//   - Milestone identity hashes the full phase directory SLUG
//     (NormalizedPhase.slug, e.g. "01-go-routing"), never the bare leading
//     number (claude-workflow has duplicate "01-*" dirs — see
//     06-RESEARCH.md Pitfall 1).
//   - Issue identity hashes the plan's stable identity KEY
//     (NormalizedPlan.key, i.e. `${repo}/${phaseSlug}/${relativePlanPath}`),
//     NEVER the display `title` — two generic-H1 plans in one phase must
//     never collapse onto the same hash (06-REVIEWS.md Consensus item 1).
//
// No caller may pass a display title into titleHash().
// ---------------------------------------------------------------------------

import * as crypto from "node:crypto";

/** Stable hex sha256 digest of `input`. Same input -> identical output. */
export function titleHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
