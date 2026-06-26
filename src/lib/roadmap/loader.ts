import { RoadmapJsonSchema, type RoadmapJson } from "./schema.ts";

/**
 * React Router 7 data-router loader.
 * Fetches /roadmap.json (same-origin static asset) and validates the shape.
 * Zero external/Linear network calls — the snapshot is static.
 */
export async function roadmapLoader(): Promise<RoadmapJson> {
  const res = await fetch("/roadmap.json");
  if (!res.ok) {
    throw new Response("Failed to load roadmap snapshot", { status: res.status });
  }
  const json: unknown = await res.json();
  return RoadmapJsonSchema.parse(json);
}
