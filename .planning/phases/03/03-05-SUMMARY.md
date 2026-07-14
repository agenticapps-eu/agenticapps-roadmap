---
plan: 03-05
phase: 03-linear-proxy
status: partial
blocking_gate_open: true
requirements: [REQ-PROXY-1, REQ-PROXY-4]
---

# Plan 03-05 Summary — Access setup runbook + enforcement proof

## Status: PARTIAL — runbook complete, blocking proof DEFERRED

Task 1 (the console-only setup runbook) is complete and committed. Task 2 (the
captured Access-enforcement proof) is a **blocking** completion gate that was
**deferred by user decision** — it requires a deployed Cloudflare Pages
environment with Cloudflare Access configured in the Zero Trust dashboard, which
cannot be produced or fabricated from the codebase. **Phase 03 is therefore NOT
complete.**

## What was built (Task 1)

- **`docs/access-setup.md`** (185 lines) — a console-only runbook covering:
  1. Setting `LINEAR_API_KEY` as an encrypted Pages secret binding (never
     committed; references the `lin_api_` grep gate).
  2. Creating the Cloudflare Access email allow-list policy over **both** the
     Pages project domain **and the `/api/*` path** — with an explicit warning
     that omitting `/api/*` leaves the proxy open.
  3. The optional dashboard rate-limit rule for `/api/*` (documented as optional,
     defense-in-depth).
  4. A Verify section with the exact `curl` commands for the local smoke and the
     deployed Access check.

## What remains (Task 2 — BLOCKING)

Capture `.planning/phases/03/03-ACCESS-PROOF.md` proving:
- Unauthenticated `GET /api/linear/snapshot` → **302/403** (blocked; no Linear
  data, no token in the response), and
- An allowed identity (allow-listed email session or Access service token) →
  **200** with schema-valid RoadmapJson and no `LINEAR_API_KEY` in body/headers/logs.

This is tracked as a **blocking** item in `.planning/phases/03/03-HUMAN-UAT.md`.
The proof is expected to be captured alongside the Phase 08 deploy (which stands
up the production/preview Pages env + Access policy). Follow `docs/access-setup.md`.

## Requirements

- **REQ-PROXY-1 / REQ-PROXY-4 (Access portion):** runbook documented; enforcement
  proof PENDING. These requirements' Access-gating clause is not satisfied until
  the proof is captured. (The proxy-handler clauses of REQ-PROXY-1..4 were
  satisfied in 03-03 and confirmed by the 03-04 live smoke.)

## Key files

- `docs/access-setup.md` — created (commit `cf27371`).
- `.planning/phases/03/03-ACCESS-PROOF.md` — **not yet created** (the blocking gate).
- `.planning/phases/03/03-HUMAN-UAT.md` — created to track the blocking proof.

## Commits

- `cf27371` docs(03-05): write Cloudflare Access + secret binding setup runbook

## Self-Check: PARTIAL (blocking gate open by design — deferred per user decision)
