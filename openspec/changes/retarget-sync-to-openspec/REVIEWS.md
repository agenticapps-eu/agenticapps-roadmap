## Reviewer: gemini
_generated 2026-07-28T15:17:49Z · timeout 300s_

VERDICT: REQUEST-CHANGES

- **Contradictory Goal on Syncing Specs:** The document is inconsistent on whether `openspec/specs/` are synced. The "Goals" and an early "Decisions" paragraph state specs WILL be read, while a post-review "Decision" and the final "Requirements" state they SHALL NOT. This conflict must be resolved. The final requirements seem correct, implying the goal statement is stale, but the whole document should agree.

- **Orphaned Issues in Linear:** The decision to not archive Linear issues when a source change is deleted is a valid scope-limitation, but it creates a long-term data quality problem. Over time, Linear will accumulate stale issues with no corresponding source artifact. The spec should require the tool to explicitly list these orphans in its final summary report (e.g., under a "Stale issues needing review" heading) to facilitate manual cleanup, rather than just silently leaving them untouched.

- **Incomplete Rollback Plan:** The plan states rollback is "one revert away", but it overlooks the stateful `linear-map.json` which is renamed to `linear-map.gsd.json`. A `git revert` would restore the GSD-era code, which would presumably fail or attempt to re-create 77 duplicate issues if it can't find its identity map. The rollback plan must include restoring `linear-map.gsd.json` to `linear-map.json`.

- **PII/Secret Risk is Under-scoped:** The risk of copying sensitive information into Linear is correctly identified but deferred as an "Open Question". A baseline security guarantee should be a requirement from the start. The implementation must include the proposed path-confinement check and a configurable file size limit to prevent accidental leakage of large or misplaced files. Punting this basic safeguard is inappropriate.

## Reviewer: codex
_generated 2026-07-28T15:20:23Z · timeout 300s_

VERDICT: REQUEST-CHANGES

- Artifact mapping remains undefined: required versus optional `proposal.md`, `tasks.md`, and `design.md`; title/body derivation; progress; malformed files; and update hashing. This matters now: all 10 current `fx-signal-agent` changes lack `design.md`, while `cparx` also lacks `tasks.md`.
- The “Linear side unchanged” claim is false. The existing pipeline is create-only and maps project → phase milestone → plan issue; the delta requires issue updates and one issue per change without specifying milestone disposition, managed fields, or protection for human edits.
- Security controls exist only in task 1.6, not normatively. Specify artifact allow-list, canonical-path/symlink rejection, concrete size limits and failure behavior, and a PII/secret egress policy. “Committed to the repo” does not mean safe to copy into Linear.
- Identity isolation is internally impossible as written: the sync cannot “not read” old-marker issues while reading descriptions to detect those markers. Require read-for-classification but exclude them from adoption/mutation. Also make the promised distinct new-generation label normative; the current delta only requires the existing configured label.
- The artifacts still contradict the delta: design goals say to read `openspec/specs/` and fail when a source contributes nothing, and still propose `RawCapability`; the requirements say never read specs and allow zero changes.
- Live-data claims are wrong: `linear-map.json` contains 77 total records—1 project, 34 milestones, 40 issues, and 2 labels—not 77 issues. Acceptance also hard-codes 12 `fx-signal-agent` changes, while there are currently 10 active changes.
- Define conflicting CLI flags (`--apply --dry-run`) and narrow “every run reports every listed repo” to every processed repo; otherwise a single-project apply normatively requires reading/reporting unrelated projects.
- `SyncBadge`’s source-unavailable behavior is implementation scope but has no requirement or scenario, so the spec delta does not capture that stated intent.

