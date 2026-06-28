import type { RawWorkspace } from "./transform.ts";
import { WORKSPACE_QUERY } from "./query.ts";
import { mapWorkspace, type GqlResponse } from "./map.ts";

// Re-export for existing Node callers — keeps client.ts's public surface stable.
export { mapWorkspace } from "./map.ts";
export type { GqlResponse } from "./map.ts";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const LINEAR_API_URL = "https://api.linear.app/graphql";

/**
 * Fetches the AGE workspace snapshot from Linear.
 * Throws a clear error if LINEAR_API_KEY is not set.
 * Maps the GraphQL response into the RawWorkspace shape expected by buildSnapshot.
 *
 * NOTE: This function reads process.env and is intentionally Node-only.
 * The Worker handler imports mapWorkspace from map.ts directly and supplies
 * context.env.LINEAR_API_KEY itself.
 */
export async function fetchWorkspace(): Promise<RawWorkspace> {
  const apiKey = process.env["LINEAR_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "LINEAR_API_KEY environment variable is not set. " +
        "Export it before running sync:snapshot."
    );
  }

  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query: WORKSPACE_QUERY }),
  });

  if (!response.ok) {
    throw new Error(
      `Linear API request failed: ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json()) as GqlResponse;

  if (json.errors && json.errors.length > 0) {
    throw new Error(
      `Linear GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`
    );
  }

  return mapWorkspace(json);
}
