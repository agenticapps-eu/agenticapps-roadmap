// ---------------------------------------------------------------------------
// BUNDLING PROBE — Plan 03-01, Task 3
// This trivial handler exists solely to verify that wrangler's Pages build can
// bundle a cross-directory relative TypeScript import from functions/ into
// scripts/linear/ before the full handler is built in 03-03.
//
// The response body is String(WORKSPACE_QUERY.length) — a deterministic value
// derived from the imported constant so the probe proves the import actually
// bundled and evaluated (not just type-resolved).
//
// This file is FULLY REPLACED in plan 03-03.
// ---------------------------------------------------------------------------

import { WORKSPACE_QUERY } from "../../../scripts/linear/query.ts";

export const onRequestGet = async (): Promise<Response> => {
  return new Response(String(WORKSPACE_QUERY.length), { status: 200 });
};
