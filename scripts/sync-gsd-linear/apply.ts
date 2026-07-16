// ---------------------------------------------------------------------------
// SYNC-04 write engine for sync-gsd-linear.
//
// applyProject upserts ONE project's Linear records: it re-derives the
// resolved workspace + the full write set (buildDiff, 06-04) and executes
// EXACTLY that approved operation set, create-only (v1 never calls a
// *_UPDATE mutation -- existing-record date drift is informational only,
// see diff.ts). Every successful create writes its id back into
// linear-map.json ATOMICALLY (temp file + rename) and IMMEDIATELY -- not
// batched at the end -- so a mid-run crash duplicates at most one record.
//
// Dry-run performs zero mutation calls. A real apply (dryRun=false)
// re-resolves a SECOND time immediately before executing and aborts if the
// freshly-rebuilt operation set differs from the one just computed (TOCTOU
// guard) -- it never writes something that wasn't just shown.
//
// WHY issue-identity enrichment is MAP-FIRST, MARKER-FALLBACK, never
// title-hash-based (CR-01):
//   diff.ts matches issues via `ResolvedIssue.identityKey` (never `title`,
//   per hash.ts's file-header contract: "issue identity hashes the plan's
//   stable identity KEY, NEVER the display title"). resolve.ts's
//   readProjectIssues already recovers identityKey from a
//   `<!--gsd-key:...-->` marker embedded in the issue's description
//   (PROJECT_ISSUES_QUERY fetches `description`) -- this module's
//   withIssueIdentity layers the STORED linear-map.json id on top as the
//   first tier (a reverse lookup through the issues pool, id -> plan key),
//   falling back to that marker-recovered key only when no map entry
//   exists. This is what makes a second apply a no-op even after
//   linear-map.json is lost/rebased -- without ever overloading the real
//   Linear issue's `title` field with the identity key (which would fight
//   D-06-01 "titled from the plan heading" and produce unreadable issue
//   titles in the Linear UI). Internal module layout is explicitly Claude's
//   Discretion per 06-CONTEXT.md.
// ---------------------------------------------------------------------------

import * as fs from "node:fs";
import { assertNoLeak } from "../linear/transform.ts";
import { RoadmapJsonSchema, type RoadmapJson } from "../../src/lib/roadmap/schema.ts";
import { buildResolvedWorkspace, resolveMilestone } from "./resolve.ts";
import { buildDiff } from "./diff.ts";
import {
  PROJECT_CREATE,
  PROJECT_LABEL_CREATE,
  ISSUE_LABEL_CREATE,
  PROJECT_MILESTONE_CREATE,
  ISSUE_CREATE,
  INITIATIVE_TO_PROJECT_CREATE,
  type ProjectCreateInput,
  type ProjectCreateResponse,
  type ProjectLabelCreateInput,
  type ProjectLabelCreateResponse,
  type IssueLabelCreateInput,
  type IssueLabelCreateResponse,
  type ProjectMilestoneCreateInput,
  type ProjectMilestoneCreateResponse,
  type IssueCreateInput,
  type IssueCreateResponse,
  type InitiativeToProjectCreateInput,
  type InitiativeToProjectCreateResponse,
} from "./mutations.ts";
import type {
  DiffSummary,
  LinearMap,
  NormalizedModel,
  NormalizedPhase,
  NormalizedPlan,
  ResolvedWorkspace,
  SyncConfigEntry,
  SyncOperation,
} from "./config.ts";

const DEFAULT_MAP_PATH = "linear-map.json";
const DEFAULT_ROADMAP_PATH = "public/roadmap.json";
const LABEL_NAME_PREFIX = "roadmap:";

/** The `roadmap:<repo>` label convention (D-06-04), matching diff.ts. */
function labelNameFor(repo: string): string {
  return `${LABEL_NAME_PREFIX}${repo}`;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ApplyDeps {
  fetchFn: typeof fetch;
  endpoint: string;
  auth: string;
}

export interface ApplyOpts {
  dryRun: boolean;
  writeSnapshot?: boolean;
  mapPath?: string;
  roadmapPath?: string;
}

// ---------------------------------------------------------------------------
// linear-map.json write-back -- atomic (temp file + rename), never a bare
// writeFileSync, so a crash mid-write never leaves a half-written map.
// ---------------------------------------------------------------------------

export function writeLinearMap(path: string, map: LinearMap): void {
  const tmpPath = `${path}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(map, null, 2));
  fs.renameSync(tmpPath, path);
}

// ---------------------------------------------------------------------------
// planAhead patch -- reuses the audited leak/schema gate verbatim (never
// reimplemented). Gated to (real apply) OR (dry-run AND --write-snapshot);
// a plain dry-run never touches roadmap.json.
// ---------------------------------------------------------------------------

export function patchPlanAhead(roadmapPath: string, projectName: string, planAhead: boolean): void {
  const raw = fs.readFileSync(roadmapPath, "utf-8");
  const parsed = JSON.parse(raw) as RoadmapJson;
  const patched: RoadmapJson = {
    ...parsed,
    projects: parsed.projects.map((project) =>
      project.name === projectName ? { ...project, planAhead } : project
    ),
  };
  const serialized = JSON.stringify(patched, null, 2);
  assertNoLeak(serialized);
  RoadmapJsonSchema.parse(patched);
  fs.writeFileSync(roadmapPath, serialized);
}

// ---------------------------------------------------------------------------
// NormalizedModel -> SyncConfigEntry adapter. applyProject's locked
// signature takes a NormalizedModel (not a SyncConfigEntry); resolve.ts's
// buildResolvedWorkspace needs the latter. `label` is derived via the same
// roadmap:<repo> convention diff.ts already uses (NormalizedModel carries
// no separate label field -- 06-04's own key-decision).
// ---------------------------------------------------------------------------

function entryFromModel(model: NormalizedModel): SyncConfigEntry {
  return {
    repoPath: model.repo,
    name: model.repo,
    label: labelNameFor(model.repo),
    initiative: model.initiative,
    teamKey: model.teamKey,
    projectName: model.projectName,
  };
}

// ---------------------------------------------------------------------------
// Resolve + enrich: fills ResolvedIssue.identityKey via the stored map
// (see file header). Returns a fresh ResolvedWorkspace object each call.
// ---------------------------------------------------------------------------

function withIssueIdentity(resolved: ResolvedWorkspace, map: LinearMap): ResolvedWorkspace {
  if (!resolved.project) return resolved;
  const keyByStoredId = new Map<string, string>();
  for (const [planKey, entry] of Object.entries(map.issues)) {
    keyByStoredId.set(entry.id, planKey);
  }
  // Stored map id first, description-marker fallback (CR-01) -- resolve.ts's
  // readProjectIssues already recovers a marker-based identityKey per issue,
  // so a map-loss re-run still resolves identity without a duplicate create.
  const issues = resolved.project.issues.map((issue) => ({
    ...issue,
    identityKey: keyByStoredId.get(issue.id) ?? issue.identityKey ?? null,
  }));
  return { ...resolved, project: { ...resolved.project, issues } };
}

async function resolveWorkspace(
  deps: ApplyDeps,
  model: NormalizedModel,
  map: LinearMap
): Promise<ResolvedWorkspace> {
  const entry = entryFromModel(model);
  const resolved = await buildResolvedWorkspace(deps.fetchFn, deps.endpoint, deps.auth, entry, map);
  return withIssueIdentity(resolved, map);
}

/** Canonical, order-independent signature of an operation set for drift comparison. */
function canonicalOps(operations: SyncOperation[]): string {
  return JSON.stringify(operations.map((op) => `${op.kind}:${op.identityKey}`).sort());
}

// ---------------------------------------------------------------------------
// Model lookups by identity (mirrors buildDiff's own matching, so the
// execute step never has to re-derive anything buildDiff already decided).
// ---------------------------------------------------------------------------

function findPhaseBySlug(model: NormalizedModel, slug: string): NormalizedPhase | undefined {
  return model.phases.find((phase) => phase.slug === slug);
}

function findPlanByKey(
  model: NormalizedModel,
  key: string
): { phase: NormalizedPhase; plan: NormalizedPlan } | undefined {
  for (const phase of model.phases) {
    const plan = phase.plans.find((candidate) => candidate.key === key);
    if (plan) return { phase, plan };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// GraphQL POST helper -- variables-only, never string-interpolated (T-06-01).
// ---------------------------------------------------------------------------

interface GqlEnvelope<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

async function postGraphQL<T>(
  deps: ApplyDeps,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await deps.fetchFn(deps.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: deps.auth },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Linear request failed: ${res.status}`);
  }
  const json = (await res.json()) as GqlEnvelope<T>;
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Linear GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`);
  }
  return json.data;
}

// ---------------------------------------------------------------------------
// Execute EXACTLY the approved operations, create-only, in resolve-before-
// create dependency order (team -> labels -> project -> initiative-join ->
// milestones -> issues) regardless of operations[]'s own array order. After
// each successful create the new id is written into `map` and persisted
// immediately via writeLinearMap (atomic, per-create -- not batched).
// ---------------------------------------------------------------------------

async function executeOperations(
  deps: ApplyDeps,
  model: NormalizedModel,
  resolved: ResolvedWorkspace,
  operations: SyncOperation[],
  map: LinearMap,
  mapPath: string
): Promise<void> {
  const hasOp = (kind: SyncOperation["kind"]) => operations.some((op) => op.kind === kind);
  let createdCount = 0;

  try {
    const needsTeam = hasOp("project-create") || hasOp("issue-create");
    if (needsTeam && !resolved.teamId) {
      throw new Error(`Linear team not resolved for teamKey "${model.teamKey}" -- cannot create records`);
    }

    let projectLabelId = resolved.projectLabelId;
    if (hasOp("project-label-create")) {
      // IN-01: input literals are typed against mutations.ts's *Input
      // interfaces so a shape drift (missing/extra/mistyped field) is a
      // compile error at the call site, not just a runtime GraphQL error.
      const input: ProjectLabelCreateInput = { name: labelNameFor(model.repo) };
      const data = await postGraphQL<ProjectLabelCreateResponse["data"]>(deps, PROJECT_LABEL_CREATE, { input });
      const id = data.projectLabelCreate.projectLabel?.id;
      if (!id) throw new Error("projectLabelCreate returned no id");
      projectLabelId = id;
      map.projectLabels[model.repo] = { id };
      writeLinearMap(mapPath, map);
      createdCount += 1;
    }

    let issueLabelId = resolved.issueLabelId;
    if (hasOp("issue-label-create")) {
      const input: IssueLabelCreateInput = {
        name: labelNameFor(model.repo),
        teamId: resolved.teamId ?? undefined,
      };
      const data = await postGraphQL<IssueLabelCreateResponse["data"]>(deps, ISSUE_LABEL_CREATE, { input });
      const id = data.issueLabelCreate.issueLabel?.id;
      if (!id) throw new Error("issueLabelCreate returned no id");
      issueLabelId = id;
      map.issueLabels[model.repo] = { id };
      writeLinearMap(mapPath, map);
      createdCount += 1;
    }

    let projectId = resolved.project?.id ?? null;
    let projectWasCreated = false;
    if (hasOp("project-create")) {
      const input: ProjectCreateInput = {
        name: model.projectName,
        teamIds: resolved.teamId ? [resolved.teamId] : [],
        labelIds: projectLabelId ? [projectLabelId] : undefined,
      };
      const data = await postGraphQL<ProjectCreateResponse["data"]>(deps, PROJECT_CREATE, { input });
      const id = data.projectCreate.project?.id;
      if (!id) throw new Error("projectCreate returned no id");
      projectId = id;
      projectWasCreated = true;
      map.projects[model.repo] = { id };
      writeLinearMap(mapPath, map);
      createdCount += 1;
    }
    if (!projectId) {
      throw new Error("no project id resolved or created -- cannot proceed");
    }

    if (hasOp("initiative-join") && projectWasCreated && resolved.initiativeId) {
      const input: InitiativeToProjectCreateInput = { projectId, initiativeId: resolved.initiativeId };
      const data = await postGraphQL<InitiativeToProjectCreateResponse["data"]>(
        deps,
        INITIATIVE_TO_PROJECT_CREATE,
        { input }
      );
      if (!data.initiativeToProjectCreate.success) {
        throw new Error("initiativeToProjectCreate did not report success");
      }
      createdCount += 1;
    }

    // Seed the slug -> Linear-id map from what's already resolved (existing
    // milestones this run does NOT create), then fill in each new create.
    // Stored map id first, title-hash fallback (WR-05) -- via resolve.ts's
    // resolveMilestone, mirroring diff.ts's own findMatchingMilestone so a
    // renamed-in-Linear-UI milestone is never re-created here either.
    const milestoneIdBySlug = new Map<string, string>();
    if (resolved.project) {
      for (const phase of model.phases) {
        const existing = resolveMilestone(resolved.project, phase.slug, map);
        if (existing) milestoneIdBySlug.set(phase.slug, existing);
      }
    }

    for (const op of operations.filter((o) => o.kind === "milestone-create")) {
      const phase = findPhaseBySlug(model, op.identityKey);
      if (!phase) throw new Error(`milestone-create operation references unknown phase "${op.identityKey}"`);
      const input: ProjectMilestoneCreateInput = {
        name: phase.slug,
        projectId,
        targetDate: phase.proposedDate ?? undefined,
      };
      const data = await postGraphQL<ProjectMilestoneCreateResponse["data"]>(
        deps,
        PROJECT_MILESTONE_CREATE,
        { input }
      );
      const id = data.projectMilestoneCreate.projectMilestone?.id;
      if (!id) throw new Error("projectMilestoneCreate returned no id");
      milestoneIdBySlug.set(phase.slug, id);
      map.milestones[`${model.repo}/${phase.slug}`] = { id };
      writeLinearMap(mapPath, map);
      createdCount += 1;
    }

    for (const op of operations.filter((o) => o.kind === "issue-create")) {
      const found = findPlanByKey(model, op.identityKey);
      if (!found) throw new Error(`issue-create operation references unknown plan "${op.identityKey}"`);
      const { phase, plan } = found;
      const milestoneId = milestoneIdBySlug.get(phase.slug);
      // IssueCreateInput.teamId is a required string (Pitfall 4) -- the
      // earlier `needsTeam` guard only throws when hasOp("issue-create") is
      // true, which TS can't correlate back to reaching this loop body, so
      // narrow explicitly here (IN-01) rather than asserting past the type.
      if (!resolved.teamId) {
        throw new Error(`Linear team not resolved for teamKey "${model.teamKey}" -- cannot create records`);
      }
      const input: IssueCreateInput = {
        teamId: resolved.teamId,
        title: plan.title,
        // Embeds the durable identity marker (CR-01) so a re-run can
        // recover this issue's identity from readProjectIssues alone, even
        // if linear-map.json is lost -- the title stays plan.title
        // (D-06-01, human-readable) and never carries the identity key.
        description: `${plan.taskLines.join("\n")}\n\n<!--gsd-key:${plan.key}-->`,
        projectId,
        projectMilestoneId: milestoneId,
        labelIds: issueLabelId ? [issueLabelId] : undefined,
      };
      const data = await postGraphQL<IssueCreateResponse["data"]>(deps, ISSUE_CREATE, { input });
      const id = data.issueCreate.issue?.id;
      if (!id) throw new Error("issueCreate returned no id");
      map.issues[plan.key] = { id };
      writeLinearMap(mapPath, map);
      createdCount += 1;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `apply incomplete: ${message}; map already holds ${createdCount} newly-written id(s) from this run; re-run to continue`
    );
  }
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export async function applyProject(
  deps: ApplyDeps,
  model: NormalizedModel,
  map: LinearMap,
  opts: ApplyOpts
): Promise<DiffSummary> {
  const resolved = await resolveWorkspace(deps, model, map);
  const diffSummary = buildDiff(model, resolved, map);

  const roadmapPath = opts.roadmapPath ?? DEFAULT_ROADMAP_PATH;
  const shouldPatchSnapshot = !opts.dryRun || opts.writeSnapshot === true;

  if (opts.dryRun) {
    if (shouldPatchSnapshot) {
      patchPlanAhead(roadmapPath, model.projectName, true);
    }
    return diffSummary;
  }

  // TOCTOU guard: re-resolve immediately before writing and abort if the
  // freshly-rebuilt operation set differs from what was just computed.
  const resolvedAgain = await resolveWorkspace(deps, model, map);
  const diffAgain = buildDiff(model, resolvedAgain, map);
  if (canonicalOps(diffSummary.operations) !== canonicalOps(diffAgain.operations)) {
    throw new Error("Linear state changed since the diff was shown — re-run to review");
  }

  const mapPath = opts.mapPath ?? DEFAULT_MAP_PATH;
  await executeOperations(deps, model, resolvedAgain, diffAgain.operations, map, mapPath);

  if (shouldPatchSnapshot) {
    patchPlanAhead(roadmapPath, model.projectName, true);
  }

  return diffAgain;
}
