# Architecture — agenticapps-roadmap

Decided 2026-06-22. Hybrid (Concept C), hosted on Cloudflare Pages, private.

## Decisions

| Topic | Decision |
|---|---|
| Pattern | **C — hybrid**: static snapshot default + Worker for live refresh & write-back |
| Host | **Cloudflare Pages** (primary); the Worker rides along as **Pages Functions** |
| Privacy | **Cloudflare Access** (Zero Trust) email allow-list — gates app + functions |
| Backfill | **Per-project approval** — one project at a time, explicit yes before any write |
| Dates | **Proposed from GSD phase order**, confirmed/overridden by the user |

## Why Cloudflare Pages over GitHub Pages

GitHub Pages is static-only, so "sync with Linear" would force the token into the
client or a separate worker on another origin. Cloudflare Pages bundles **Pages
Functions** (Workers) in the same project and origin: one deploy, token stays in
a Functions binding, and **Cloudflare Access** gives private gating with no auth
code. GitHub Pages can remain an optional public mirror of the static snapshot.

## Data paths

1. **Snapshot (default).** A daily CI cron (`.github/workflows/snapshot.yml`,
   `0 6 * * *` UTC) runs `sync:snapshot`, which calls Linear GraphQL with
   `LINEAR_API_KEY` and writes `public/roadmap.json` — a sanitized, token-free
   projection — committing it back to `main` when it changes. The app renders
   entirely from this file; instant load, works offline.
2. **Live (enhancement).** In "Connect" mode the app calls `/api/linear/*` Pages
   Functions, which hold the token and proxy GraphQL — for on-demand refresh and
   for write-back from the sync tool.

## `roadmap.json` shape (target)

```jsonc
{
  "generatedAt": "2026-06-22T10:00:00Z",
  "initiatives": [{ "id", "name", "color", "status" }],
  "projects": [{
    "id", "name", "summary", "initiativeId",
    "status", "priority", "startDate", "targetDate",
    "milestones": [{ "id", "name", "targetDate" }],
    "issueCounts": { "backlog", "started", "done" }
  }]
}
```

## `sync-gsd-linear` pipeline

1. Walk each `<repo>/.planning/` → parse `config.json` + `phases/NN/PLAN.md`.
2. Normalize → `{ repo, phases[], tasks[], status, spec }`.
3. Resolve Linear initiative/project via a stored map (`.planning/linear-map.json`)
   or a `roadmap:<repo>` label; title-hash fallback.
4. Diff vs Linear; print per-project ("would create N milestones, M issues, set D dates").
5. On approval, upsert idempotently. Propose dates from phase order.

Direction is configurable (repos→Linear backfill now; two-way later). Always
`--dry-run` first.

## Open follow-ups

- Whether `fbc-platform` (Linear ahead of repo) should pull *down* into a `.planning/`.
