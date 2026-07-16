# Phase 6: sync-gsd-linear CLI (backfill engine) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 06-sync-gsd-linear-cli
**Areas discussed:** Mapping granularity, Repo scope & config, Date proposal heuristic, Apply UX & write path, Repo→Linear structure, planAhead emission

---

## Mapping granularity (issue grain)

| Option | Description | Selected |
|--------|-------------|----------|
| One issue per PLAN.md | Each `NN-MM-PLAN.md` → one issue; tasks stay as checklist in body | ✓ |
| One issue per task line | Each numbered task → its own issue (noisy, volatile) | |
| Milestones only, no issues | phase → milestone and stop; drops the issue layer | |

**User's choice:** One issue per PLAN.md (D-06-01).
**Notes:** `repo → Project`, `phase → milestone`, `plan file → issue`. Task lines are too granular and churn during execution, breaking title-hash dedup.

---

## Repo scope & config

| Option | Description | Selected |
|--------|-------------|----------|
| Committed allow-list config | Checked-in config in roadmap repo; central `linear-map.json` | ✓ |
| Discover all siblings | Walk every `../*/.planning`; needs an ignore-list anyway | |
| Flag-only, per invocation | `--repo <path>` each run; per-repo scattered map | |

**User's choice:** Committed allow-list config (D-06-04, D-06-05).
**Notes:** ~13 sibling `.planning/` dirs (bench-*, testbeds, opencode) must be kept out of Linear. `--project <name>` narrows to one entry. Map lives centrally in this repo.

---

## Date proposal heuristic

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed cadence from an anchor | Next-up anchored (default today), +N weeks/phase, configurable | ✓ |
| Spread across a horizon | Distribute remaining phases evenly to a target end date | |
| Preserve existing, fill gaps only | Keep Linear dates; only propose for undated phases | |

**User's choice:** Fixed cadence from an anchor (D-06-06).
**Notes:** Completed phases untouched. Anchor + cadence via `--anchor`/`--cadence`; no interactive per-date editor (YAGNI). Dates shown in the diff for confirmation.

---

## Apply UX & write path

| Option | Description | Selected |
|--------|-------------|----------|
| Interactive confirm, per project | `--dry-run` default; diff then `y/N` prompt; `--yes` for CI | ✓ |
| Flag-driven, no prompt | `--project X --apply` writes with no prompt | |

**User's choice:** Interactive confirm, per project (D-06-07).
**Notes:** Surfaced during analysis: the stub's `save_milestone`/`save_issue` are MCP-tool names a standalone CLI can't call — write path is raw Linear GraphQL mutations with `LINEAR_API_KEY` (D-06-08).

---

## Repo → Linear structure

| Option | Description | Selected |
|--------|-------------|----------|
| Project under a config-named Initiative | repo → Project, optionally attached to an existing initiative | ✓ |
| Standalone Project, no initiative | top-level project, no grouping | |
| All repos under one shared initiative | uniform, but flattens distinct products | |

**User's choice:** Project under a config-named Initiative (D-06-02).
**Notes:** Forced repo→Project by the locked phase→milestone mapping (milestones are children of projects). Initiative attachment optional per config entry.

---

## planAhead emission

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — emit planAhead as a byproduct of the diff | CLI patches `roadmap.json` planAhead; lights OV-04 badge | ✓ |
| No — leave planAhead for a later phase | badge stays dormant until Phase 7 | |

**User's choice:** Yes — emit planAhead (D-06-09).
**Notes:** Closes the Phase-5 D-05-02 seam. Snapshot patch gated to real apply / explicit `--write-snapshot`, never plain `--dry-run`; keeps `roadmap.json` token-free.

---

## Claude's Discretion

- Config filename/shape, CLI arg parser, diff-rendering library.
- Internal module layout of walker/parser/resolver/diff/date/apply stages.
- Precise GraphQL mutation set and read pagination.

## Deferred Ideas

- Two-way sync (Linear → `.planning/` pull-down) — out of scope.
- UI-triggered backfill + live refresh — Phase 7.
- Scheduled snapshot refresh cadence — Phase 7/8.
- `fbc-platform` pull-down — architecture open follow-up.
- Interactive per-date editing — YAGNI.
