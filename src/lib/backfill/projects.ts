// BACKFILL_PROJECTS — Linear project id → sync.config key eligibility map
// (07-REVIEWS finding #4: the UI→CLI project-identity contract). The
// snapshot carries Linear DISPLAY names, but the CLI/dispatch allow-list
// keys are sync.config keys (`claude-workflow`, `cparx`, `fx-signal-agent`).
// This map is the rename-proof bridge: a project whose `project.id` is NOT
// a key here is NOT backfill-eligible and renders no Backfill control.
//
// Seeded from the committed linear-map.json `projects` section (repoKey ->
// { id }), inverted to id -> repoKey. New entries are added as cparx /
// fx-signal-agent are first applied and their ids land in linear-map.json.
export const BACKFILL_PROJECTS: Record<string, string> = {
  "28f29610-6662-46ad-a5d5-ca93a5c53872": "claude-workflow",
};
