// ---------------------------------------------------------------------------
// useBackfill — thin React glue over the pure backfill.ts core (LIVE-02,
// 07-03). ALL branching/retry/conclusion logic lives in backfill.ts; this
// hook only wires React state + lifecycle around it. Local `useState` only
// (RESEARCH "Don't Hand-Roll" — no Zustand/Redux/Context).
//
// Key naming note (07-REVIEWS finding MEDIUM "hook/UI interface
// underspecified"): `projectId` is the Map key the consuming UI already
// uses everywhere (OverviewPage/SyncBadge/ProjectDrillDownDialog — the
// Linear id), and it is the key of the EXTERNALLY-owned optimistic
// `BackfillStateMap` passed in via `setBackfillState`. `projectKey` is the
// distinct sync.config key sent to the dispatch route. `startPreview` only
// ever receives `projectKey` (no id exists yet at preview time), so this
// hook's OWN internal per-project state (diff/status/error/previewRunId)
// is keyed by whichever string is passed to it: `startPreview` keys by
// `projectKey`; `applyBackfill` reads the stored previewRunId back out
// under that same `projectKey` (it receives both, so no lookup ambiguity
// there), then re-keys the hook-local status/diff/error entry under
// `projectId` going forward so `diffFor`/`statusFor`/`errorFor`/
// `clearError` (all `projectId`-keyed per the published contract) resolve
// correctly post-preview. Callers should query `diffFor`/`statusFor` with
// `projectKey` immediately after `startPreview` (pre-apply diff review)
// and with `projectId` after `applyBackfill` has run.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyBackfillOutcome,
  dispatchBackfill,
  pollBackfillStatus,
  type BackfillStateMap,
  type DiffCounts,
} from "./backfill.ts";

export type BackfillHookStatus =
  | "idle"
  | "previewing"
  | "pending"
  | "done"
  | "error"
  | "unknown";

interface ProjectHookState {
  status: BackfillHookStatus;
  diff?: DiffCounts;
  error?: string;
  previewRunId?: number;
}

const IDLE_STATE: ProjectHookState = { status: "idle" };

const POLL_OPTIONS = { intervalMs: 3000, maxTicks: 100, maxRetries: 3 };

export interface UseBackfillResult {
  startPreview(projectKey: string): Promise<void>;
  applyBackfill(projectId: string, projectKey: string): Promise<void>;
  diffFor(projectId: string): DiffCounts | undefined;
  statusFor(projectId: string): BackfillHookStatus;
  errorFor(projectId: string): string | undefined;
  clearError(projectId: string): void;
}

/**
 * `setBackfillState` is the setter for the externally-owned
 * `Map<projectId, { pendingBackfill; planAheadOverride }>` (owner: the UI
 * wiring plan, 07-04). This hook never owns that Map itself — it only
 * dispatches optimistic-flip/outcome updates into it via
 * `applyBackfillOutcome`.
 */
export function useBackfill(
  setBackfillState: (updater: (prev: BackfillStateMap) => BackfillStateMap) => void,
): UseBackfillResult {
  const [hookState, setHookState] = useState<Map<string, ProjectHookState>>(new Map());
  // One AbortController per in-flight poll, keyed the same way as hookState.
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  const setEntry = useCallback((key: string, entry: ProjectHookState) => {
    setHookState((prev) => {
      const next = new Map(prev);
      next.set(key, entry);
      return next;
    });
  }, []);

  const abortAndClear = useCallback((key: string) => {
    controllersRef.current.get(key)?.abort();
    controllersRef.current.delete(key);
  }, []);

  // Abort every in-flight poll on unmount so a tab-close/navigate-away
  // mid-poll issues no further fetch (07-REVIEWS finding MEDIUM).
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    };
  }, []);

  const startPreview = useCallback(
    async (projectKey: string) => {
      abortAndClear(projectKey);
      const controller = new AbortController();
      controllersRef.current.set(projectKey, controller);

      setEntry(projectKey, { status: "previewing" });

      const dispatched = await dispatchBackfill(fetch, projectKey, "dry-run");
      if (!dispatched.ok) {
        setEntry(projectKey, { status: "error", error: dispatched.message });
        return;
      }

      const handle = dispatched.runId === null
        ? { correlationId: dispatched.correlationId }
        : { runId: dispatched.runId };

      const result = await pollBackfillStatus(fetch, handle, {
        ...POLL_OPTIONS,
        signal: controller.signal,
      });

      if (result.ok) {
        // The previewRunId the server requires to authorize a later apply
        // is only ever a concrete run id — a correlation-only preview
        // cannot be applied against yet (no numeric id to prove identity).
        const previewRunId = "runId" in handle ? handle.runId : undefined;
        setEntry(projectKey, { status: "done", diff: result.diff, previewRunId });
        return;
      }

      if (result.kind === "unknown") {
        setEntry(projectKey, { status: "unknown" });
        return;
      }
      setEntry(projectKey, { status: "error", error: result.message });
    },
    [abortAndClear, setEntry],
  );

  const applyBackfill = useCallback(
    async (projectId: string, projectKey: string) => {
      const preview = hookState.get(projectKey);

      abortAndClear(projectId);
      const controller = new AbortController();
      controllersRef.current.set(projectId, controller);

      setEntry(projectId, { status: "pending" });
      setBackfillState((prev) => applyBackfillOutcome(prev, projectId, "start"));

      const dispatched = await dispatchBackfill(
        fetch,
        projectKey,
        "apply",
        preview?.previewRunId,
      );
      if (!dispatched.ok) {
        setEntry(projectId, { status: "error", error: dispatched.message });
        setBackfillState((prev) => applyBackfillOutcome(prev, projectId, "failure"));
        return;
      }

      const handle = dispatched.runId === null
        ? { correlationId: dispatched.correlationId }
        : { runId: dispatched.runId };

      const result = await pollBackfillStatus(fetch, handle, {
        ...POLL_OPTIONS,
        signal: controller.signal,
      });

      if (result.ok) {
        setEntry(projectId, { status: "done", diff: result.diff });
        setBackfillState((prev) => applyBackfillOutcome(prev, projectId, "success"));
        return;
      }

      if (result.kind === "unknown") {
        setEntry(projectId, { status: "unknown" });
        setBackfillState((prev) => applyBackfillOutcome(prev, projectId, "unknown"));
        return;
      }

      setEntry(projectId, { status: "error", error: result.message });
      setBackfillState((prev) => applyBackfillOutcome(prev, projectId, result.kind));
    },
    [abortAndClear, hookState, setBackfillState, setEntry],
  );

  const diffFor = useCallback(
    (projectId: string) => hookState.get(projectId)?.diff,
    [hookState],
  );

  const statusFor = useCallback(
    (projectId: string) => (hookState.get(projectId) ?? IDLE_STATE).status,
    [hookState],
  );

  const errorFor = useCallback(
    (projectId: string) => hookState.get(projectId)?.error,
    [hookState],
  );

  const clearError = useCallback(
    (projectId: string) => {
      const current = hookState.get(projectId);
      if (!current) return;
      setEntry(projectId, { ...current, status: "idle", error: undefined });
    },
    [hookState, setEntry],
  );

  return { startPreview, applyBackfill, diffFor, statusFor, errorFor, clearError };
}
