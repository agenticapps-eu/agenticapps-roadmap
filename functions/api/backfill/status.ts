// ---------------------------------------------------------------------------
// Backfill status — identity-verified run->jobs->job-logs readback +
// correlation resolve (LIVE-02)
// Plan 07-02, mirrors functions/api/linear/[[path]].ts exactly.
//
// Security invariants (enforced in tests):
//  - Rejects a non-positive-integer `run` and requires either `run` or
//    `correlationId` before any fetch (T-07-11).
//  - Verifies the resolved run's `path`/`head_branch`/`event` belong to
//    backfill.yml on `main` via workflow_dispatch BEFORE reading any
//    jobs/logs — a foreign workflow's run cannot be read (finding #7).
//  - Single try/catch around the entire GitHub-call stretch; ANY failure
//    collapses to a generic 502. The token is only ever read from
//    env.GH_BACKFILL_TOKEN and placed in the Authorization header — never
//    logged, never echoed in any response body (T-07-01).
//  - `diff` is the TYPED counts object parsed from the ___DIFF_JSON___
//    marker payload — no server-side ANSI/regex parsing of human text.
//  - Cache-Control: no-store on every response.
// ---------------------------------------------------------------------------

interface Env {
  GH_BACKFILL_TOKEN: string;
}

const GITHUB_API = "https://api.github.com";
const REPO = "agenticapps-eu/agenticapps-roadmap";

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "agenticapps-roadmap-backfill",
});

interface Run {
  path: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  name: string;
}

interface DiffCounts {
  milestones: number;
  issues: number;
  labels: number;
  dates: number;
}

/** Identity verification (finding #7) — BEFORE reading any jobs/logs. */
function isIdentityValid(run: Run): boolean {
  return (
    run.path === ".github/workflows/backfill.yml" &&
    run.head_branch === "main" &&
    run.event === "workflow_dispatch"
  );
}

const DIFF_MARKER = /___DIFF_JSON___(.*)___END_DIFF___/;

function extractDiff(logsText: string): DiffCounts | undefined {
  const line = logsText.split("\n").find((l) => l.includes("___DIFF_JSON___"));
  if (!line) return undefined;
  const match = line.match(DIFF_MARKER);
  if (!match?.[1]) return undefined;
  try {
    return JSON.parse(match[1]) as DiffCounts;
  } catch {
    return undefined;
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...NO_STORE },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: NO_STORE });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const runParam = url.searchParams.get("run");
  const correlationId = url.searchParams.get("correlationId");

  // 1. Validate input — positive-integer `run` or a `correlationId`; else
  //    400 before any fetch.
  const hasValidRun = runParam !== null && /^\d+$/.test(runParam) && Number(runParam) > 0;
  if (!hasValidRun && !correlationId) {
    return textResponse("run or correlationId required", 400);
  }

  // 2. Env check — generic 500 before any fetch (fail closed).
  if (!env.GH_BACKFILL_TOKEN) {
    return textResponse("internal error", 500);
  }

  try {
    let runId: string;

    if (hasValidRun) {
      runId = runParam as string;
    } else {
      // correlationId (no run) — resolve via the workflow's runs list.
      const listRes = await fetch(
        `${GITHUB_API}/repos/${REPO}/actions/workflows/backfill.yml/runs?event=workflow_dispatch&per_page=30`,
        { headers: GH_HEADERS(env.GH_BACKFILL_TOKEN) }
      );
      if (!listRes.ok) {
        throw new Error("runs list fetch failed");
      }
      const list = (await listRes.json()) as { workflow_runs: Array<{ id: number; name: string }> };
      const match = list.workflow_runs.find((r) => r.name.includes(`[cid:${correlationId}]`));
      if (!match) {
        return jsonResponse({ status: "queued", conclusion: null }, 200);
      }
      runId = String(match.id);
    }

    // 3. Identity verification BEFORE reading jobs/logs (finding #7).
    const runRes = await fetch(`${GITHUB_API}/repos/${REPO}/actions/runs/${runId}`, {
      headers: GH_HEADERS(env.GH_BACKFILL_TOKEN),
    });
    if (!runRes.ok) {
      throw new Error("run fetch failed");
    }
    const run = (await runRes.json()) as Run;
    if (!isIdentityValid(run)) {
      return textResponse("run identity verification failed", 403);
    }

    if (run.status !== "completed") {
      return jsonResponse({ status: run.status, conclusion: run.conclusion }, 200);
    }

    // 4. status === "completed" — run -> jobs -> job-logs, extract typed diff.
    const jobsRes = await fetch(`${GITHUB_API}/repos/${REPO}/actions/runs/${runId}/jobs`, {
      headers: GH_HEADERS(env.GH_BACKFILL_TOKEN),
    });
    if (!jobsRes.ok) {
      throw new Error("jobs fetch failed");
    }
    const jobs = (await jobsRes.json()) as { jobs: Array<{ id: number; name: string }> };
    const job = jobs.jobs[0];
    if (!job) {
      return jsonResponse({ status: run.status, conclusion: run.conclusion }, 200);
    }

    const logsRes = await fetch(`${GITHUB_API}/repos/${REPO}/actions/jobs/${job.id}/logs`, {
      headers: GH_HEADERS(env.GH_BACKFILL_TOKEN),
    });
    if (!logsRes.ok) {
      throw new Error("job logs fetch failed");
    }
    const logsText = await logsRes.text();
    const diff = extractDiff(logsText);

    return jsonResponse({ status: run.status, conclusion: run.conclusion, diff }, 200);
  } catch {
    return textResponse("upstream error", 502);
  }
};
