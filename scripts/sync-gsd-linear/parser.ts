// ---------------------------------------------------------------------------
// PLAN.md parser for sync-gsd-linear.
//
// Turns walker.ts's RawPhaseDir[] into the NormalizedModel config.ts
// declares. Styled after scripts/linear/transform.ts (raw -> normalized,
// small pure-helper-per-concern, final Schema.parse at the return boundary
// — see 06-PATTERNS.md).
//
// Per 06-REVIEWS.md Consensus item 1, every plan's identity `key` is the
// relative plan path, NEVER the display `title` — two generic-H1
// NN-MM-PLAN.md files in one phase must never collapse onto one identity.
// ROADMAP.md/STATE.md are read only to enrich completion status (the
// layered heuristic from 06-RESEARCH.md Pitfall 3), never to discover
// phases — phase existence always comes from the walker's directory
// listing.
// ---------------------------------------------------------------------------

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  NormalizedModelSchema,
  type NormalizedModel,
  type NormalizedPhase,
  type NormalizedPlan,
} from "./config.ts";
import type { RawPhaseDir } from "./walker.ts";

// ---------------------------------------------------------------------------
// Small pure helpers (transform.ts's bucketFor/redactEmails style)
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const H1_RE = /^#\s+(.+)$/m;
const GENERIC_HEADING_RE = /^Phase\s+\d+/i;
const NUMBER_TOKEN_RE = /^(\d+(?:\.\d+)?)/;
const TASK_LINE_RE = /^\s*-\s+\S/;
const COMPLETE_MARKER_RE = /\[x\]/i;

/** Strips a leading YAML frontmatter block, if present, returning the body. */
function stripFrontmatter(content: string): string {
  const match = content.match(FRONTMATTER_RE);
  return match ? content.slice(match[0].length) : content;
}

/** Extracts the plan body's task/checklist lines (e.g. `- [ ]`, `- [x]`, `- `). */
function taskLinesFor(body: string): string[] {
  return body
    .split(/\r?\n/)
    .filter((line) => TASK_LINE_RE.test(line))
    .map((line) => line.trim());
}

/**
 * Display title for a plan: the H1 verbatim, unless the plan is
 * frontmatter-less AND the H1 matches the generic-heading denylist — in
 * which case fall back to the filename for a NN-MM-PLAN.md, or the phase
 * slug for a single bare PLAN.md.
 */
function titleFor(planFile: string, content: string, slug: string): string {
  const hasFrontmatter = FRONTMATTER_RE.test(content);
  const body = stripFrontmatter(content);
  const h1Match = body.match(H1_RE);
  const heading = h1Match ? h1Match[1]!.trim() : slug;

  if (hasFrontmatter || !GENERIC_HEADING_RE.test(heading)) {
    return heading;
  }

  const fileName = basename(planFile);
  return fileName === "PLAN.md" ? slug : basename(planFile, ".md");
}

/** True if a ROADMAP.md line marks this phase complete (`[x]`/`✅`). */
function roadmapMarksComplete(roadmapContent: string, slug: string): boolean {
  const suffix = slug.replace(NUMBER_TOKEN_RE, "").replace(/^[-.]+/, "");
  const needles = [slug, suffix].filter((needle) => needle.length > 0);
  return roadmapContent
    .split(/\r?\n/)
    .some(
      (line) =>
        (COMPLETE_MARKER_RE.test(line) || line.includes("✅")) &&
        needles.some((needle) => line.includes(needle))
    );
}

/**
 * Layered, lenient completion heuristic (06-RESEARCH.md Pitfall 3):
 * (1) ROADMAP.md checkbox/✅ for this phase -> completed
 * (2) else a VERIFICATION.md sibling in the phase dir -> completed
 * (3) else every PLAN.md in the phase dir has a sibling SUMMARY.md -> completed
 * (4) else -> in-progress (bias toward in-progress when unsure)
 */
function completionStatusFor(raw: RawPhaseDir, roadmapContent: string | null): boolean {
  if (roadmapContent && roadmapMarksComplete(roadmapContent, raw.slug)) {
    return true;
  }

  const siblingNames = readdirSync(raw.dir);
  if (siblingNames.some((name) => /VERIFICATION\.md$/.test(name))) {
    return true;
  }

  if (
    raw.planFiles.length > 0 &&
    raw.planFiles.every((planFile) => existsSync(planFile.replace(/PLAN\.md$/, "SUMMARY.md")))
  ) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

export function parseRepo(
  rawDirs: RawPhaseDir[],
  meta: { repo: string; projectName: string; teamKey: string; initiative?: string }
): NormalizedModel {
  const roadmapPath = rawDirs[0]?.roadmapPath ?? null;
  const roadmapContent = roadmapPath ? readFileSync(roadmapPath, "utf-8") : null;

  const phases: NormalizedPhase[] = rawDirs.map((raw) => {
    const numberMatch = raw.slug.match(NUMBER_TOKEN_RE);
    const number = numberMatch ? numberMatch[1]! : raw.slug;

    const plans: NormalizedPlan[] = raw.planFiles.map((planFile) => {
      const content = readFileSync(planFile, "utf-8");
      const body = stripFrontmatter(content);
      const title = titleFor(planFile, content, raw.slug);
      const relativePlanPath = `phases/${raw.slug}/${basename(planFile)}`;
      const key = `${meta.repo}/${raw.slug}/${relativePlanPath}`;
      const taskLines = taskLinesFor(body);

      return { file: planFile, title, key, taskLines };
    });

    return {
      slug: raw.slug,
      number,
      completed: completionStatusFor(raw, roadmapContent),
      plans,
      proposedDate: null,
    };
  });

  const result = {
    repo: meta.repo,
    projectName: meta.projectName,
    teamKey: meta.teamKey,
    initiative: meta.initiative,
    phases,
  };

  return NormalizedModelSchema.parse(result);
}
