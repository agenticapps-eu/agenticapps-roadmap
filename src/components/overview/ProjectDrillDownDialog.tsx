// ProjectDrillDownDialog — OV-03 ?project-controlled drill-down. Open state
// is derived from the ?project URL param (D-05-04): an unknown/absent id
// resolves to null and renders NO dialog (guarded, T-05-05). Shows the
// issueCounts breakdown, milestones list, a header-mounted SyncBadge
// (OV-04 render surface), and a guarded Linear deep-link (T-05-04) — it does
// NOT list individual issues (D-05-03; the snapshot stores aggregate counts
// only). Closing deletes the param with { replace: true } so Back doesn't
// re-open it, and preserves co-resident filter params (05-RESEARCH Pitfall 2).
//
// 07-04 (LIVE-02): also owns the `useBackfill` hook instance and renders an
// eligibility-gated (BACKFILL_PROJECTS) two-phase Backfill control in a
// sibling footer section — Preview (dry-run, typed-diff render) then Apply
// (gated on a successful preview), optimistically flipping the
// OverviewPage-owned `backfillState` Map and surfacing a dismissible inline
// error on failure/cancelled.

import { useSearchParams } from "react-router-dom";
import { PRIORITY_LABELS } from "@/lib/overview/selectors";
import type { RoadmapJson } from "@/lib/roadmap/schema";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncBadge } from "@/components/overview/SyncBadge";
import { useBackfill } from "@/lib/backfill/useBackfill";
import type { BackfillStateMap } from "@/lib/backfill/backfill";
import { BACKFILL_PROJECTS } from "@/lib/backfill/projects";
import { X } from "lucide-react";

export function ProjectDrillDownDialog({
  data,
  backfillState,
  setBackfillState,
}: {
  data: RoadmapJson;
  backfillState: BackfillStateMap;
  setBackfillState: (updater: (prev: BackfillStateMap) => BackfillStateMap) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const project = projectId
    ? (data.projects.find((p) => p.id === projectId) ?? null)
    : null;

  const { startPreview, applyBackfill, diffFor, statusFor, errorFor, clearError } =
    useBackfill(setBackfillState);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setSearchParams(
        (prev) => {
          prev.delete("project");
          return prev;
        },
        { replace: true }
      );
    }
  }

  const total = project
    ? project.issueCounts.backlog +
      project.issueCounts.started +
      project.issueCounts.done
    : 0;

  // Eligibility gate (07-REVIEWS finding #4): only projects with a known
  // Linear-id -> sync.config-key mapping get a Backfill control, and the
  // control dispatches the config KEY, never `project.name`.
  const backfillKey = project ? BACKFILL_PROJECTS[project.id] : undefined;
  const entry = project ? backfillState.get(project.id) : undefined;

  // Key-space per useBackfill.ts's header comment (07-03 key-decisions):
  // startPreview stores its diff/status/error under `backfillKey`;
  // applyBackfill re-keys under `project.id` afterward. Prefer the
  // post-apply (projectId-keyed) view when present, else fall back to the
  // pre-apply (backfillKey-keyed) preview.
  const previewDiff = backfillKey ? diffFor(backfillKey) : undefined;
  const applyDiff = project ? diffFor(project.id) : undefined;
  const diff = applyDiff ?? previewDiff;

  // WR-03/IN-01: statusFor is keyed by backfillKey pre-apply (see
  // useBackfill.ts's key-space comment above) — it's how the Preview button
  // knows a dry-run dispatch is in flight.
  const previewing = backfillKey ? statusFor(backfillKey) === "previewing" : false;

  const previewError = backfillKey ? errorFor(backfillKey) : undefined;
  const applyError = project ? errorFor(project.id) : undefined;
  const visibleError = applyError ?? previewError;

  function dismissBackfillError() {
    if (!project) return;
    if (applyError) clearError(project.id);
    else if (previewError && backfillKey) clearError(backfillKey);
  }

  return (
    <Dialog open={project !== null} onOpenChange={handleOpenChange}>
      {project && (
        <DialogContent>
          <div className="flex items-start justify-between gap-2 border-b border-(--color-border) pb-2">
            <DialogTitle className="truncate">{project.name}</DialogTitle>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              <Badge variant="outline">{project.status}</Badge>
              <Badge variant="outline">
                {PRIORITY_LABELS[project.priority] ?? "—"}
              </Badge>
              <SyncBadge
                project={project}
                planAheadOverride={entry?.planAheadOverride}
                pending={entry?.pendingBackfill}
              />
            </div>
          </div>

          {/* Issue counts */}
          <div className="py-2">
            <div className="text-xs text-(--color-muted-foreground)">
              Issues
            </div>
            <div className="mt-1 flex h-2 overflow-hidden rounded-full">
              {total === 0 ? (
                <div className="h-full w-full bg-(--color-muted)" />
              ) : (
                <>
                  <div
                    className="h-full bg-(--color-muted)"
                    style={{
                      width: `${(project.issueCounts.backlog / total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-sky-500"
                    style={{
                      width: `${(project.issueCounts.started / total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${(project.issueCounts.done / total) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>
            <div className="mt-1 text-xs text-(--color-muted-foreground)">
              {project.issueCounts.backlog} backlog ·{" "}
              {project.issueCounts.started} started · {project.issueCounts.done}{" "}
              done
            </div>
          </div>

          {/* Milestones */}
          {project.milestones.length > 0 && (
            <div className="border-t border-(--color-border) py-2">
              {project.milestones.map((milestone) => (
                <div key={milestone.id} className="text-xs">
                  {milestone.name}{" "}
                  <span className="text-(--color-muted-foreground)">
                    {milestone.targetDate ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Guarded Linear deep-link (T-05-04, copied verbatim) */}
          {project.url?.startsWith("https://linear.app/") && (
            <div className="border-t border-(--color-border) pt-2">
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-(--color-primary)"
              >
                Open in Linear ↗
              </a>
            </div>
          )}

          {/* Backfill (LIVE-02, 07-04) — eligibility-gated on BACKFILL_PROJECTS
              (07-REVIEWS finding #4); dispatches the config KEY, never
              project.name. Two-phase: Preview (dry-run typed diff) then
              Apply, disabled until a successful preview exists. */}
          {backfillKey && (
            <div className="border-t border-(--color-border) pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  Backfill: {project.name}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={previewing}
                    onClick={() => startPreview(backfillKey)}
                  >
                    {previewing ? "Previewing…" : "Preview"}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    disabled={!previewDiff || entry?.pendingBackfill === true}
                    onClick={() => applyBackfill(project.id, backfillKey)}
                  >
                    Apply
                  </Button>
                </div>
              </div>

              {diff && (
                <p className="mt-1 text-xs text-(--color-muted-foreground)">
                  + {diff.milestones} milestones, + {diff.issues} issues,{" "}
                  + {diff.labels} labels, ~ {diff.dates} dates
                </p>
              )}

              {visibleError && (
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="destructive">{visibleError}</Badge>
                  <button
                    type="button"
                    onClick={dismissBackfillError}
                    aria-label="Dismiss backfill error"
                    className="text-(--color-muted-foreground) hover:text-(--color-foreground)"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
