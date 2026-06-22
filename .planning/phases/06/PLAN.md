# Phase 6 — PLAN: sync-gsd-linear CLI (backfill engine)

Make Linear reflect the repos' GSD plans — per-project, dry-run-first.

## Tasks
1. `.planning/` walker + `PLAN.md` parser → normalized `{ repo, phases[], tasks[] }`.
2. Linear resolver: stored `linear-map.json` first, `roadmap:<repo>` label, title-hash fallback.
3. Diff engine: per-project report ("would create N milestones, M issues, set D dates").
4. Date proposer: relative target dates from phase order; shown for confirmation.
5. `--dry-run` (default) and `--project <name>` apply path with explicit approval prompt.
6. Idempotent upsert via `save_milestone` / `save_issue`; write back ids to `linear-map.json`.

## Done when
- Dry-run prints an accurate diff for `claude-workflow`, `cparx`, `fx-signal-agent`.
- Applying one project creates milestones/issues with no duplicates on re-run.

## Gates
- verification (idempotency test: apply twice → second run is a no-op).
