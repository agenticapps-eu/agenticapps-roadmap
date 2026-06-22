# Phase 2 — PLAN: Linear data layer & static snapshot

Read Linear into a sanitized, token-free `roadmap.json` the app renders from.

## Tasks
1. Typed Linear GraphQL client (initiatives, projects, milestones, issue counts).
2. `scripts/sync-snapshot.ts` → writes `public/roadmap.json` per `docs/architecture.md` shape.
3. Zod schema + parser for `roadmap.json`; typed loader hook in the app.
4. Sanitization: assert no tokens / emails-as-secrets leak into the snapshot.
5. GitHub Action `snapshot.yml` (schedule + manual dispatch) using `LINEAR_API_KEY` secret.

## Done when
- `pnpm sync:snapshot` produces a valid `roadmap.json` from the live AGE workspace.
- App renders the snapshot with zero network calls.

## Gates
- verification (schema validates; snapshot diff sane).
