## Reviewer: gemini
_generated 2026-07-28T12:00:05Z · timeout 180s_

VERDICT: REQUEST-CHANGES

*   **Contradictory "Empty Source" Definition**: The requirement "A missing or empty source is a hard error" specifies that a run must fail if a repo has zero active changes. This contradicts the "Risks" section, which correctly identifies that a repo with only *archived* changes should *not* be treated as empty. The requirement must be updated to explicitly state that the presence of an `openspec/changes/archive/` directory with content is sufficient to consider a source non-empty.
*   **Questionable Mapping for Specs**: The spec assumes that capability documents from `openspec/specs/` should be mapped to Linear issues, the same as in-flight work from `openspec/changes/`. As noted in the "Open Questions", this is a questionable assumption. A spec is a long-lived document of truth, not a work item. This will create non-actionable issues in Linear. This mapping should be reconsidered; perhaps specs shouldn't be synced as issues at all, or should map to a different Linear object type like Documents.
*   **Undefined UI Failure State**: While `SyncBadge.tsx` is listed in the "Impact" section, the spec doesn't define how it should behave now that a sync run can fail hard. The "Open Questions" mention this, but it should be a formal requirement to design a "source unavailable" or "sync failed" state for the UI.
*   **Silent Failure on New Empty Dirs**: The new hard-error rule triggers if `openspec/changes/` is missing, or if it contains zero change directories. What happens if a repo is mid-migration, creates an empty `openspec/changes/` directory as a placeholder, and a sync runs before the first change is added? The current spec implies this will be treated as an empty source and fail the build. This seems overly strict for a transitional state and should be revisited. A repo with an `openspec/` slot but zero changes or specs might be a valid state, not an error.
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-roadmap)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-roadmap)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-roadmap)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-roadmap)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 13ms

## Reviewer: codex
_generated 2026-07-28T12:01:51Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- Core semantics remain undecided: archived-change handling and whether capability specs become issues are open questions, yet the delta already mandates both. Resolve these before implementation and add lifecycle scenarios.
- Acceptance 7.2 is impossible: two dry-runs cannot make the second report zero creates because the first performs no writes. The first run must apply or use pre-seeded Linear state.
- The “Linear side unchanged” assumption is false. Existing reconciliation is create-only and phase/milestone-shaped; the delta requires issue updates and mentions archives without defining update/archive mutations or milestone disposition.
- The clean cutover lacks identity migration rules. Existing `linear-map.json` keys and `<!--gsd-key:...-->` markers may cause duplicate OpenSpec issues or accidental treatment of legacy issues as orphans. Specify ownership isolation and legacy-record preservation.
- Artifact-to-issue mapping is underspecified: titles, descriptions, task progress, status, requirement counts, canonical hashing/order, optional or malformed artifacts, renames, deletions, and change archival behavior are undefined.
- Write semantics contradict current UX: the requirement says an explicit apply flag is mandatory, while `--project X --yes` currently writes without `--apply`. Decide and test the intended contract.
- Source validity is inconsistent: missing `changes/` is explicitly fatal, missing `specs/` is unspecified, and `changes/archive/` risks being classified as in-flight work or counted as content without producing a plan.
- No security/PII boundary is specified for copying repository documents into Linear. Require canonical paths confined to the allowed repo, symlink-escape protection, artifact/size limits, and an explicit policy for secrets or PII before external transmission.

