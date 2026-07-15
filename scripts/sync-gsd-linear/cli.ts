// ---------------------------------------------------------------------------
// sync-gsd-linear CLI orchestrator (SYNC-04).
//
// Pipeline: parseArgs -> resolve --project against SyncConfigEntry.name ->
// walkPlanning -> parseRepo -> proposeDates -> applyProject(dryRun:true) ->
// renderDiff -> [confirm() unless --yes] -> applyProject(dryRun:false) ->
// writeLinearMap. Per the 06-06 apply.ts hand-off note, the dry-run call
// that renders the approval-prompt diff and the dryRun:false call that
// executes the write happen back-to-back in the same invocation, keeping
// the human-visible diff and the executed write as close in time as
// applyProject's own TOCTOU guard already assumes.
//
// INVOCATION TRUTH TABLE (06-CONTEXT.md D-06-07, hardened per
// 06-REVIEWS.md Consensus item 3 / C7):
//   no flags / --dry-run                          -> all-repo read-only preview
//   --project X (dry-run default)                  -> one-project read-only preview
//   --project X --apply                             -> print ops, y/N prompt, then write
//   --project X --apply --yes / --project X --yes   -> print ops, write, no prompt
//   --apply/--yes without exactly one --project      -> HARD ERROR (bulk-write guard, T-06-03)
//   --project matching zero/multiple entries         -> HARD ERROR regardless of mode
//
// --project matches SyncConfigEntry.name (never repoPath/label). A
// --project-less run is permitted ONLY in dry-run -- it performs zero
// mutations, so it does not violate the no-bulk-write constraint (which
// governs writes only).
//
// LINEAR_API_KEY is read exactly once, at this Node-only boundary, mirroring
// scripts/linear/client.ts's fetchWorkspace fail-fast message style.
// ---------------------------------------------------------------------------

import { parseArgs } from "node:util";
import {
  loadSyncConfig,
  loadLinearMap,
  type SyncConfigEntry,
  type LinearMap,
  type NormalizedModel,
} from "./config.ts";
import { walkPlanning } from "./walker.ts";
import { parseRepo } from "./parser.ts";
import { proposeDates } from "./dates.ts";
import { renderDiff } from "./diff.ts";
import { applyProject, writeLinearMap, type ApplyDeps } from "./apply.ts";
import { confirm } from "./prompt.ts";

const CONFIG_PATH = "sync.config.json";
const MAP_PATH = "linear-map.json";
const ROADMAP_PATH = "public/roadmap.json";
const LINEAR_API_URL = "https://api.linear.app/graphql";

const BULK_WRITE_ERROR =
  "--project <name> must match exactly one configured repo before an apply (bulk write is disallowed)";

interface CliOptions {
  applyMode: boolean;
  yes: boolean;
  anchor: string | undefined;
  cadenceWeeks: number | undefined;
  writeSnapshot: boolean;
}

/** walkPlanning -> parseRepo -> proposeDates for one config entry. */
function buildModel(
  entry: SyncConfigEntry,
  anchor: string | undefined,
  cadenceWeeks: number | undefined
): NormalizedModel {
  if (!entry.teamKey) {
    throw new Error(`Config entry "${entry.name}" has no teamKey configured`);
  }
  const rawDirs = walkPlanning(entry.repoPath);
  const parsed = parseRepo(rawDirs, {
    repo: entry.name,
    projectName: entry.projectName ?? entry.name,
    teamKey: entry.teamKey,
    initiative: entry.initiative,
  });
  const phases = proposeDates(parsed.phases, { anchor, cadenceWeeks });
  return { ...parsed, phases };
}

/** Read-only preview for one entry -- zero mutations regardless of flags. */
async function previewProject(
  deps: ApplyDeps,
  entry: SyncConfigEntry,
  map: LinearMap,
  opts: CliOptions
): Promise<void> {
  const model = buildModel(entry, opts.anchor, opts.cadenceWeeks);
  const diffSummary = await applyProject(deps, model, map, {
    dryRun: true,
    writeSnapshot: opts.writeSnapshot,
    mapPath: MAP_PATH,
    roadmapPath: ROADMAP_PATH,
  });
  console.log(`--- ${entry.name} ---`);
  console.log(renderDiff(diffSummary, entry.name));
}

/** Single-project pipeline: dry-run diff always; a real write only in apply mode. */
async function applyOneProject(
  deps: ApplyDeps,
  entry: SyncConfigEntry,
  map: LinearMap,
  opts: CliOptions
): Promise<void> {
  const model = buildModel(entry, opts.anchor, opts.cadenceWeeks);

  const diffSummary = await applyProject(deps, model, map, {
    dryRun: true,
    // WR-06: in apply mode this leg is the PRE-APPROVAL preview -- it must
    // never patch public/roadmap.json, or declining the y/N prompt below
    // would still have mutated the snapshot. Only a plain preview (no
    // --apply, no approval gate at all) or the real post-approval write
    // below may patch it.
    writeSnapshot: opts.applyMode ? false : opts.writeSnapshot,
    mapPath: MAP_PATH,
    roadmapPath: ROADMAP_PATH,
  });
  console.log(renderDiff(diffSummary, entry.name));

  if (!opts.applyMode) {
    return;
  }

  const approved = opts.yes || (await confirm("Apply these writes? (y/N) "));
  if (!approved) {
    console.log("Aborted -- no writes made.");
    return;
  }

  await applyProject(deps, model, map, {
    dryRun: false,
    writeSnapshot: opts.writeSnapshot,
    mapPath: MAP_PATH,
    roadmapPath: ROADMAP_PATH,
  });
  writeLinearMap(MAP_PATH, map);
  console.log(`Applied writes for ${entry.name}.`);
}

export async function runCli(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean" },
      apply: { type: "boolean" },
      project: { type: "string" },
      yes: { type: "boolean" },
      anchor: { type: "string" },
      cadence: { type: "string" },
      "write-snapshot": { type: "boolean" },
    },
    strict: true,
  });

  const applyMode = Boolean(values.apply || values.yes);

  let cadenceWeeks: number | undefined;
  if (values.cadence !== undefined) {
    cadenceWeeks = Number(values.cadence);
    // IN-04: zero collapses every not-completed phase onto the same date;
    // negative walks dates backwards from the anchor -- neither is a
    // meaningful cadence.
    if (!Number.isFinite(cadenceWeeks) || cadenceWeeks <= 0) {
      throw new Error(`--cadence "${values.cadence}" is not a valid positive number of weeks`);
    }
  }

  // WR-02: an invalid --anchor would otherwise flow all the way to
  // proposeDates' `new Date(...)` as Invalid Date -> "NaN-NaN-NaN", and on a
  // real apply into PROJECT_MILESTONE_CREATE's targetDate.
  if (
    values.anchor !== undefined &&
    Number.isNaN(new Date(`${values.anchor}T00:00:00.000Z`).getTime())
  ) {
    throw new Error(`--anchor "${values.anchor}" is not a valid YYYY-MM-DD date`);
  }

  const opts: CliOptions = {
    applyMode,
    yes: values.yes === true,
    anchor: values.anchor,
    cadenceWeeks,
    writeSnapshot: values["write-snapshot"] === true,
  };

  const apiKey = process.env["LINEAR_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "LINEAR_API_KEY environment variable is not set. Export it before running sync:gsd."
    );
  }
  const deps: ApplyDeps = { fetchFn: fetch, endpoint: LINEAR_API_URL, auth: apiKey };

  const config = loadSyncConfig(CONFIG_PATH);
  const map = loadLinearMap(MAP_PATH);

  if (values.project !== undefined) {
    const matches = config.filter((entry) => entry.name === values.project);
    if (matches.length !== 1) {
      throw new Error(BULK_WRITE_ERROR);
    }
    await applyOneProject(deps, matches[0]!, map, opts);
    return 0;
  }

  if (applyMode) {
    throw new Error(BULK_WRITE_ERROR);
  }

  // WR-04: walkPlanning already fails soft (warns, returns []) for a missing
  // sibling repo -- buildModel/parseRepo can still throw (e.g. no teamKey,
  // schema-parse failure), so wrap each entry so one misconfigured repo is
  // warned+skipped rather than aborting every other repo's read-only preview.
  for (const entry of config) {
    try {
      await previewProject(deps, entry, map, opts);
    } catch (err) {
      console.warn(`Skipping "${entry.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return 0;
}
