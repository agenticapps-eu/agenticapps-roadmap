import type { RawWorkspace } from "./transform.ts";
import { fetchAssembledWorkspace } from "./fetch-workspace.ts";
import { mapWorkspace } from "./map.ts";

// Re-export for existing Node callers — keeps client.ts's public surface stable.
export { mapWorkspace } from "./map.ts";
export type { GqlResponse } from "./map.ts";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const LINEAR_API_URL = "https://api.linear.app/graphql";

/**
 * Fetches the AGE workspace snapshot from Linear using the complexity-safe
 * two-part strategy (MAIN_QUERY + paginated ISSUES_QUERY).
 * Throws a clear error if LINEAR_API_KEY is not set.
 * Maps the assembled GraphQL response into the RawWorkspace shape expected
 * by buildSnapshot.
 *
 * NOTE: This function reads process.env and is intentionally Node-only.
 * The Worker handler calls fetchAssembledWorkspace directly with context.env.
 */
export async function fetchWorkspace(): Promise<RawWorkspace> {
  const apiKey = process.env["LINEAR_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "LINEAR_API_KEY environment variable is not set. " +
        "Export it before running sync:snapshot."
    );
  }

  const assembled = await fetchAssembledWorkspace(fetch, LINEAR_API_URL, apiKey);
  return mapWorkspace(assembled);
}
