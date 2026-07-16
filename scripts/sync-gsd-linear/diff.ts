// ---------------------------------------------------------------------------
// Diff engine for sync-gsd-linear (SYNC-03).
//
// Pure computation: normalized model (already date-proposed, see dates.ts)
// + resolved Linear state -> the FULL enumerated write set apply (06-06)
// will execute. Per 06-REVIEWS.md Consensus item 2, operations[] must equal
// the approved write set exactly -- nothing apply does may be missing from
// this list, and nothing on this list may go unexecuted.
//
// Resolve-before-create discipline (06-RESEARCH.md Pattern 2): every entity
// is matched against resolved state stored-map-id-first, then by identity
// (phase slug for milestones via resolve.ts's resolveMilestone -- WR-05;
// plan key for issues via ResolvedIssue.identityKey, recovered from either
// the map or the issue's description marker -- CR-01; never a display
// title) before an operation is emitted; a match means no operation is
// needed for that entity. buildDiff therefore takes `map` as an input
// alongside the resolved workspace, purely to hand it through to
// resolveMilestone.
//
// v1 apply is create-only: an EXISTING milestone whose targetDate drifted
// from the freshly-proposed date is never written (PROJECT_MILESTONE_UPDATE
// goes unused) -- surfaced only as informational drift, never as an
// operation, so the diff never claims a write that will not happen.
// ---------------------------------------------------------------------------

import type {
  DiffSummary,
  LinearMap,
  NormalizedModel,
  NormalizedPhase,
  ResolvedMilestone,
  ResolvedWorkspace,
  SyncOperation,
} from "./config.ts";
import { titleHash } from "./hash.ts";
import { resolveMilestone } from "./resolve.ts";

const LABEL_NAME_PREFIX = "roadmap:";

/** The `roadmap:<repo>` label convention (D-06-04), applied to both pools. */
function labelNameFor(repo: string): string {
  return `${LABEL_NAME_PREFIX}${repo}`;
}

/**
 * Finds the resolved milestone matching this phase, stored map id first,
 * title-hash fallback (WR-05) — delegates to resolve.ts's resolveMilestone
 * so this is the one place that order is implemented.
 */
function findMatchingMilestone(
  phase: NormalizedPhase,
  resolved: ResolvedWorkspace,
  map: LinearMap
): ResolvedMilestone | undefined {
  if (!resolved.project) return undefined;
  const id = resolveMilestone(resolved.project, phase.slug, map);
  if (!id) return undefined;
  return resolved.project.milestones.find((m) => m.id === id);
}

export function buildDiff(
  model: NormalizedModel,
  resolved: ResolvedWorkspace,
  map: LinearMap
): DiffSummary {
  const operations: SyncOperation[] = [];
  const datesInformational: string[] = [];

  const isNewProject = resolved.project === null;

  if (isNewProject) {
    operations.push({
      kind: "project-create",
      identityKey: model.repo,
      detail: `+ project ${model.projectName}`,
    });
  }

  if (resolved.projectLabelId === null) {
    operations.push({
      kind: "project-label-create",
      identityKey: labelNameFor(model.repo),
      detail: `+ project-label ${labelNameFor(model.repo)}`,
    });
  }

  if (resolved.issueLabelId === null) {
    operations.push({
      kind: "issue-label-create",
      identityKey: labelNameFor(model.repo),
      detail: `+ issue-label ${labelNameFor(model.repo)}`,
    });
  }

  // v1 does not modify an existing project's initiative membership -- only
  // join when the project is being newly created in this same apply.
  if (model.initiative && isNewProject) {
    operations.push({
      kind: "initiative-join",
      identityKey: model.initiative,
      detail: `+ join initiative ${model.initiative}`,
    });
  }

  for (const phase of model.phases) {
    const existingMilestone = findMatchingMilestone(phase, resolved, map);
    if (!existingMilestone) {
      const dateDetail = phase.proposedDate ? ` (target ${phase.proposedDate})` : "";
      operations.push({
        kind: "milestone-create",
        identityKey: phase.slug,
        detail: `+ milestone ${phase.slug}${dateDetail}`,
      });
    } else if (phase.proposedDate && existingMilestone.targetDate !== phase.proposedDate) {
      // Drift on an already-existing record -- v1 apply is create-only and
      // will not write this, so it is surfaced as informational only.
      datesInformational.push(
        `~ ${phase.slug}: ${existingMilestone.targetDate ?? "(none)"} -> ${phase.proposedDate}`
      );
    }

    for (const plan of phase.plans) {
      const planHash = titleHash(plan.key);
      const existingIssue = resolved.project?.issues.find(
        (issue) => issue.identityKey !== null && titleHash(issue.identityKey) === planHash
      );
      if (!existingIssue) {
        operations.push({
          kind: "issue-create",
          identityKey: plan.key,
          detail: `+ issue ${plan.title}`,
        });
      }
    }
  }

  const milestonesToCreate = operations.filter((op) => op.kind === "milestone-create").length;
  const issuesToCreate = operations.filter((op) => op.kind === "issue-create").length;
  const labelsToCreate = operations.filter(
    (op) => op.kind === "project-label-create" || op.kind === "issue-label-create"
  ).length;
  const datesToChange = datesInformational.length;
  const detail = operations.map((op) => op.detail);

  return {
    operations,
    datesInformational,
    milestonesToCreate,
    issuesToCreate,
    labelsToCreate,
    datesToChange,
    detail,
  };
}

// ---------------------------------------------------------------------------
// Hand-rolled ANSI helper (06-RESEARCH.md Standard Stack -- a ~10-line
// helper is sufficient for this diff's shape; no chalk/picocolors
// dependency justified per CLAUDE.md's dependency-minimal posture).
// ---------------------------------------------------------------------------

const color = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

/** Human-readable "repo -> Linear" diff summary (CONTEXT.md's mockup shape). */
export function renderDiff(summary: DiffSummary, repo: string): string {
  const lines: string[] = [];
  lines.push(`${repo} -> Linear`);
  lines.push(
    color.green(
      `+ ${summary.milestonesToCreate} milestones, + ${summary.issuesToCreate} issues, + ${summary.labelsToCreate} labels`
    )
  );
  for (const line of summary.detail) {
    lines.push(`  ${color.green(line)}`);
  }
  if (summary.datesInformational.length > 0) {
    lines.push(
      color.yellow(
        `~ ${summary.datesToChange} dates (informational only — existing milestones are not updated in v1)`
      )
    );
    for (const line of summary.datesInformational) {
      lines.push(`  ${color.yellow(line)}`);
    }
  }
  return lines.join("\n");
}
