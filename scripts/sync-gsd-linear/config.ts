// ---------------------------------------------------------------------------
// Zod schemas + resolved-state / operation contracts for sync-gsd-linear.
//
// This is the single source of truth for every shape downstream stages
// (walker, parser, resolve, diff, dates, apply) consume — Wave 1 of Phase 6,
// hardened per 06-REVIEWS.md Consensus items 1-4:
//   - NormalizedPlan carries a stable identity `key` (repo/relativePlanPath --
//     relativePlanPath itself already embeds the phase slug, i.e.
//     phases/<slug>/<file>, so the phase slug is never prepended a second
//     time; IN-02) used for title-hashing, plus `taskLines` for the issue
//     description. `title` stays a separate display-only field so a
//     generic-H1 collision never collapses two distinct plans onto the same
//     hash.
//   - SyncConfigEntry carries `name`, the key `--project` matches against.
//   - The resolved read surface (ResolvedProject/ResolvedIssue) carries issue
//     identity so dedup / second-run-no-op is expressible against real fields.
//   - ResolvedWorkspace carries `initiativeId` — the resolved Linear Initiative id
//     — so apply's initiative-join mutation has a real id to pass.
//   - SyncOperation enumerates every mutation apply may perform, so DiffSummary's
//     printed detail equals the approved write set (no hidden writes).
//
// readFileSync is the only Node-only reference in this file; everything else is
// pure schema/type definitions safe to import from any downstream module.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { z } from "zod";

// ---------------------------------------------------------------------------
// sync.config.json — committed allow-list of repos this CLI may touch.
// ---------------------------------------------------------------------------

export const SyncConfigEntrySchema = z.object({
  repoPath: z.string(),
  // The key `--project <name>` matches against (06-REVIEWS.md C7).
  name: z.string(),
  // Applied to both the ProjectLabel and IssueLabel pools (roadmap:<repo>).
  label: z.string(),
  // Bare Linear Initiative NAME (not an id) — resolved downstream by resolve.ts.
  initiative: z.string().optional(),
  teamKey: z.string().optional(),
  projectName: z.string().optional(),
});

export const SyncConfigSchema = z.array(SyncConfigEntrySchema);

export type SyncConfigEntry = z.infer<typeof SyncConfigEntrySchema>;
export type SyncConfig = z.infer<typeof SyncConfigSchema>;

// ---------------------------------------------------------------------------
// linear-map.json — central, committed id map. One pool per Linear entity
// type this CLI resolves/creates; each pool is keyed by this CLI's own
// identity key (repoKey / phaseSlug / plan identity key), value is the
// stored Linear id.
// ---------------------------------------------------------------------------

const LinearMapEntrySchema = z.object({
  id: z.string(),
});

const LinearMapPoolSchema = z.record(z.string(), LinearMapEntrySchema);

export const LinearMapSchema = z.object({
  projects: LinearMapPoolSchema,
  milestones: LinearMapPoolSchema,
  issues: LinearMapPoolSchema,
  projectLabels: LinearMapPoolSchema,
  issueLabels: LinearMapPoolSchema,
});

export type LinearMapEntry = z.infer<typeof LinearMapEntrySchema>;
export type LinearMap = z.infer<typeof LinearMapSchema>;

// ---------------------------------------------------------------------------
// Normalized model — walker + parser output. The shape every downstream
// stage (resolve/diff/dates/apply) consumes; independent of both the raw
// `.planning/` filesystem shape and the raw Linear GraphQL shape.
// ---------------------------------------------------------------------------

export const NormalizedPlanSchema = z.object({
  file: z.string(),
  // Display title only — pulled from frontmatter/H1/slug fallback. NEVER used
  // as the hash/identity input (generic H1s like "# Phase 09 — PLAN" collide).
  title: z.string(),
  // Stable identity key: repo/relativePlanPath (relativePlanPath already
  // embeds the phase slug -- IN-02). Used for title-hashing and as the
  // linear-map.json issues-pool key.
  key: z.string(),
  // Task/checklist lines from the plan body — becomes the issue description.
  taskLines: z.array(z.string()),
});

export const NormalizedPhaseSchema = z.object({
  // Full directory slug (e.g. "03.5-quality-scoring") — the canonical phase
  // identity everywhere (never the bare leading number; see RESEARCH Pitfall 1).
  slug: z.string(),
  // Leading numeric token as a display/sort string (e.g. "03.5", "04.10").
  number: z.string(),
  completed: z.boolean(),
  plans: z.array(NormalizedPlanSchema),
  proposedDate: z.string().nullish(),
});

export const NormalizedModelSchema = z.object({
  repo: z.string(),
  projectName: z.string(),
  teamKey: z.string(),
  initiative: z.string().optional(),
  phases: z.array(NormalizedPhaseSchema),
});

export type NormalizedPlan = z.infer<typeof NormalizedPlanSchema>;
export type NormalizedPhase = z.infer<typeof NormalizedPhaseSchema>;
export type NormalizedModel = z.infer<typeof NormalizedModelSchema>;

// ---------------------------------------------------------------------------
// Resolved-state contracts — the Linear-side read surface, post-resolve.
// Not Zod-validated (this is internal computed state built by resolve.ts from
// already-typed GraphQL responses, not untrusted external input).
// ---------------------------------------------------------------------------

export interface ResolvedMilestone {
  id: string;
  name: string;
  targetDate: string | null;
}

export interface ResolvedIssue {
  id: string;
  title: string;
  // NormalizedPlan.key this issue was resolved against, if resolvable; null
  // when the issue predates this CLI's identity-key convention.
  identityKey: string | null;
  projectId: string;
  milestoneId: string | null;
  labelIds: string[];
}

export interface ResolvedProject {
  id: string;
  name: string;
  // The config entry's repo identity (SyncConfigEntry.name).
  repoKey: string;
  milestones: ResolvedMilestone[];
  issues: ResolvedIssue[];
}

export interface ResolvedWorkspace {
  teamId: string | null;
  project: ResolvedProject | null;
  projectLabelId: string | null;
  issueLabelId: string | null;
  // The resolved Linear Initiative id apply passes to
  // INITIATIVE_TO_PROJECT_CREATE — null when the config entry names no
  // initiative at all (not the same as "named but unresolved", which is a
  // fail-closed error at resolve time).
  initiativeId: string | null;
}

// ---------------------------------------------------------------------------
// Operation / diff contracts — the write set. SyncOperation enumerates every
// mutation apply may perform; DiffSummary.operations is that exact list, so
// the printed diff and the executed write set can never silently diverge.
// ---------------------------------------------------------------------------

export type SyncOperation = {
  kind:
    | "project-create"
    | "project-label-create"
    | "issue-label-create"
    | "initiative-join"
    | "milestone-create"
    | "issue-create";
  identityKey: string;
  detail: string;
};

export interface DiffSummary {
  // The immutable full write set apply executes — exactly what the diff prints.
  operations: SyncOperation[];
  // Drifted existing-milestone target dates. v1 apply is create-only and does
  // NOT write these (PROJECT_MILESTONE_UPDATE unused) — surfaced so the
  // reviewer is never misled into thinking a date change was applied.
  datesInformational: string[];
  milestonesToCreate: number;
  issuesToCreate: number;
  labelsToCreate: number;
  datesToChange: number;
  detail: string[];
}

// ---------------------------------------------------------------------------
// Loaders — validate-or-throw boundary (mirrors src/lib/roadmap/loader.ts).
// ---------------------------------------------------------------------------

export function loadSyncConfig(path: string): SyncConfig {
  const raw = readFileSync(path, "utf-8");
  const json: unknown = JSON.parse(raw);
  const parsed = SyncConfigSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid sync config at ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function loadLinearMap(path: string): LinearMap {
  const raw = readFileSync(path, "utf-8");
  const json: unknown = JSON.parse(raw);
  const parsed = LinearMapSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid linear map at ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}
