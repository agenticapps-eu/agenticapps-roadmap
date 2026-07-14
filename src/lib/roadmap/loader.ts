import type { LoaderFunctionArgs } from "react-router-dom";
import { RoadmapJsonSchema, type RoadmapJson } from "./schema.ts";

/**
 * Wrapper returned by roadmapLoader.
 * - `data`           — validated RoadmapJson from whichever source succeeded
 * - `live`           — true when /api/linear/snapshot was the source
 * - `liveUnavailable`— true when ?source=live was requested but fell back to snapshot
 */
export type RoadmapLoaderData = {
  data: RoadmapJson;
  live: boolean;
  liveUnavailable: boolean;
};

/**
 * React Router 7 data-router loader.
 *
 * Default (no ?source): fetches /roadmap.json (static snapshot). Zero Linear calls.
 * ?source=live: attempts /api/linear/snapshot; on ANY failure falls back to snapshot
 *               and sets liveUnavailable=true. The live branch NEVER throws.
 *
 * Genuine snapshot failure throws a Response so RoadmapError renders (error boundary intact).
 */
export async function roadmapLoader({
  request,
}: LoaderFunctionArgs): Promise<RoadmapLoaderData> {
  const wantLive =
    new URL(request.url).searchParams.get("source") === "live";

  if (wantLive) {
    // ENTIRE live attempt in ONE try/catch — no throw must escape from this block.
    // Failure modes: rejected fetch, res.json() SyntaxError, !res.ok, schema mismatch.
    try {
      const res = await fetch("/api/linear/snapshot");
      if (!res.ok) {
        throw new Error(`live not ok: ${res.status}`);
      }
      const json: unknown = await res.json();
      const parsed = RoadmapJsonSchema.safeParse(json);
      if (parsed.success) {
        return { data: parsed.data, live: true, liveUnavailable: false };
      }
      // schema mismatch — fall through to snapshot
    } catch {
      // Any failure in the live branch (network, json parse, !ok, schema) — fall through.
    }
  }

  // Snapshot path — throws a Response on failure so the error boundary (RoadmapError) renders.
  const res = await fetch("/roadmap.json");
  if (!res.ok) {
    throw new Response("Failed to load roadmap snapshot", { status: res.status });
  }
  const json: unknown = await res.json();
  const parsed = RoadmapJsonSchema.safeParse(json);
  if (!parsed.success) {
    throw new Response("Roadmap snapshot is malformed", { status: 500 });
  }
  return {
    data: parsed.data,
    live: false,
    liveUnavailable: wantLive,
  };
}
