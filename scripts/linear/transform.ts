import { RoadmapJsonSchema, type RoadmapJson } from "@/lib/roadmap/schema.ts";

// ---------------------------------------------------------------------------
// Raw Linear response types (allow-list — only fields we actually read)
// ---------------------------------------------------------------------------

interface RawIssue {
  state: { type: string };
}

interface RawMilestone {
  id: string;
  name: string;
  targetDate: string | null;
}

interface RawProject {
  id: string;
  name: string;
  description: string | null;
  initiativeId: string | null;
  state: { name: string; type: string };
  priority: number;
  startedAt: string | null;
  targetDate: string | null;
  projectMilestones: { nodes: RawMilestone[] };
  issues: { nodes: RawIssue[] };
}

interface RawInitiative {
  id: string;
  name: string;
  color: string | null;
  state: string;
}

export interface RawWorkspace {
  initiatives: RawInitiative[];
  projects: RawProject[];
}

// ---------------------------------------------------------------------------
// Leak detection
// ---------------------------------------------------------------------------

const TOKEN_RE = /lin_api_[A-Za-z0-9-]+/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

/**
 * Throws if `serialized` contains an API token pattern or an email address.
 * Also checks for the live LINEAR_API_KEY value if the env var is set.
 */
export function assertNoLeak(serialized: string): void {
  if (TOKEN_RE.test(serialized)) {
    throw new Error(
      "SECURITY: snapshot contains a Linear API token pattern (lin_api_…)"
    );
  }
  const liveKey = process.env["LINEAR_API_KEY"];
  if (liveKey && serialized.includes(liveKey)) {
    throw new Error(
      "SECURITY: snapshot contains the live LINEAR_API_KEY value"
    );
  }
  if (EMAIL_RE.test(serialized)) {
    throw new Error("SECURITY: snapshot contains an email address");
  }
}

// ---------------------------------------------------------------------------
// State-type → issueCounts bucket mapping
// ---------------------------------------------------------------------------

type IssueCountKey = "backlog" | "started" | "done";

function bucketFor(stateType: string): IssueCountKey | null {
  switch (stateType) {
    case "triage":
    case "backlog":
    case "unstarted":
      return "backlog";
    case "started":
      return "started";
    case "completed":
      return "done";
    default:
      // "cancelled" and any unknown types are excluded
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

export function buildSnapshot(
  raw: RawWorkspace,
  opts?: { now?: string }
): RoadmapJson {
  const generatedAt = opts?.now ?? new Date().toISOString();

  const initiatives = raw.initiatives.map((ini) => ({
    id: ini.id,
    name: ini.name,
    color: ini.color,
    status: ini.state,
  }));

  const projects = raw.projects.map((proj) => {
    const counts = { backlog: 0, started: 0, done: 0 };
    for (const issue of proj.issues.nodes) {
      const bucket = bucketFor(issue.state.type);
      if (bucket !== null) {
        counts[bucket] += 1;
      }
    }

    const milestones = proj.projectMilestones.nodes.map((ms) => ({
      id: ms.id,
      name: ms.name,
      targetDate: ms.targetDate,
    }));

    return {
      id: proj.id,
      name: proj.name,
      summary: proj.description,
      initiativeId: proj.initiativeId,
      status: proj.state.name,
      priority: proj.priority,
      startDate: proj.startedAt,
      targetDate: proj.targetDate,
      milestones,
      issueCounts: counts,
    };
  });

  const result = { generatedAt, initiatives, projects };

  // Security gate: throw before returning if any leak pattern detected
  assertNoLeak(JSON.stringify(result));

  // Schema validation: throw if shape is wrong (returns typed value)
  return RoadmapJsonSchema.parse(result);
}
