# Phase 8 — PLAN: Deploy, gate & document

## Tasks
1. Connect repo to Cloudflare Pages; production + preview builds; bind `LINEAR_API_KEY`.
2. Apply Cloudflare Access policy (email allow-list); verify gating end-to-end.
3. README + `docs/runbook.md` (deploy, rotate token, refresh snapshot, run backfill).
4. Optional GitHub Pages public mirror of the static snapshot.
5. Tag `v0.1.0`; record an ADR for the hosting/sync decision.

## Done when
- Private URL live behind Access; snapshot auto-refreshes; backfill runbook documented.

## Gates
- verification; deploy-checklist.
