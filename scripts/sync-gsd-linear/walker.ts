// ---------------------------------------------------------------------------
// Filesystem walker for sync-gsd-linear.
//
// Enumerates every phases/* directory under a sibling repo's `.planning/`
// tree, keyed on the FULL directory slug (never the bare leading number —
// see 06-RESEARCH.md Pitfall 1's duplicate-NN collision). Ordering is
// deliberately not numeric here; that is dates.ts's job. ROADMAP.md/STATE.md
// are surfaced as optional paths for the parser's completion-status
// enrichment only — never treated as the source of phase existence
// (06-RESEARCH.md Pitfall 3 / the duplicate-NN fixture's partial-stub
// ROADMAP.md).
//
// node:fs readdirSync/existsSync are used directly (no analog in this repo
// walks a filesystem tree — see 06-PATTERNS.md "No Analog Found").
// ---------------------------------------------------------------------------

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface RawPhaseDir {
  // Full directory slug under phases/ (e.g. "01-go-routing", "03.5-quality").
  slug: string;
  // Absolute path to the phase directory.
  dir: string;
  // Absolute paths to every PLAN.md-suffixed file directly in the phase dir
  // (both "NN-MM-PLAN.md" and a bare "PLAN.md"), sorted for determinism.
  planFiles: string[];
  roadmapPath: string | null;
  statePath: string | null;
}

/**
 * Lists every subdirectory of `<planningDir>/phases/` as a RawPhaseDir.
 * Returns [] (with a console.warn) instead of throwing when planningDir or
 * its phases/ subdirectory does not exist — a missing sibling repo path
 * must never crash the whole sync run (06-RESEARCH.md Environment
 * Availability fallback).
 */
export function walkPlanning(planningDir: string): RawPhaseDir[] {
  const phasesDir = join(planningDir, "phases");
  if (!existsSync(phasesDir)) {
    console.warn(`No phases/ under ${planningDir}, skipping`);
    return [];
  }

  const roadmapCandidate = join(planningDir, "ROADMAP.md");
  const roadmapPath = existsSync(roadmapCandidate) ? roadmapCandidate : null;
  const stateCandidate = join(planningDir, "STATE.md");
  const statePath = existsSync(stateCandidate) ? stateCandidate : null;

  const phaseEntries = readdirSync(phasesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  return phaseEntries.map((entry) => {
    const dir = join(phasesDir, entry.name);
    const planFiles = readdirSync(dir, { withFileTypes: true })
      .filter((fileEntry) => fileEntry.isFile() && /PLAN\.md$/.test(fileEntry.name))
      .map((fileEntry) => join(dir, fileEntry.name))
      .sort();

    return {
      slug: entry.name,
      dir,
      planFiles,
      roadmapPath,
      statePath,
    };
  });
}
