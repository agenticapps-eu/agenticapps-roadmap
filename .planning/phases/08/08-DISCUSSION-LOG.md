# Phase 8: Deploy, gate & document - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 8-Deploy, gate & document
**Areas discussed:** Access coverage & allow-list, Token/secret topology, v0.1.0 gate depth, CR-01 nonce hardening

---

## Access coverage & allow-list

| Option | Description | Selected |
|--------|-------------|----------|
| Whole domain incl. all /api/* | One Access app over app + /api/backfill/* + /api/linear/* | ✓ |
| Gate app + /api/backfill/*, leave /api/linear/* public | Read proxy reachable without login | |
| Also gate preview deployments | Additionally gate *.pages.dev preview URLs | |

**User's choice:** Whole domain incl. all /api/* (D-08-01)
**Notes:** Allow-list = existing Phase-3 family list (D-08-02); preview-gating noted as residual hardening option (deferred).

---

## Token / secret topology

| Option | Description | Selected |
|--------|-------------|----------|
| Single fine-grained PAT, both roles | One PAT (4 agenticapps-eu repos) as dispatch secret + CI checkout | ✓ |
| Two tokens (least-privilege) | Dispatch-only PAT (Pages) + checkout PAT (Actions) | |

**User's choice:** Single fine-grained PAT (D-08-03); LINEAR_API_KEY binds as Pages secret + Actions secret (D-08-04)
**Notes:** Split least-privilege tokens deferred; revisit if audience widens.

---

## v0.1.0 gate: live-proof depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full live end-to-end | Deploy + Access + real preview→apply (push+Linear write) + cron fire before tag | ✓ |
| Deploy + Access + read-path only | Write/backfill/cron verified after tag | |
| Smoke only (deploy + Access) | All live proof deferred | |

**User's choice:** Full live end-to-end (D-08-05)
**Notes:** version already 0.1.0; tagging is the remaining act once the load-bearing 07-HUMAN-UAT items pass.

---

## CR-01 nonce hardening

| Option | Description | Selected |
|--------|-------------|----------|
| Add KV binding + nonce in Phase 8 | Consume-once nonce closes replay before write path goes live | ✓ |
| Ship recency-only, defer nonce | Accept 15-min recency bound for v0.1.0 | |

**User's choice:** Add KV binding + nonce in Phase 8 (D-08-06)
**Notes:** Resolves 07-HUMAN-UAT item #13; recency bound stays as defense-in-depth.

---

## Claude's Discretion
- Runbook/README structure and ADR prose; ADR lands in new `docs/decisions/`.
- KV namespace/binding naming, nonce TTL, exact dispatch.ts nonce mechanism.

## Deferred Ideas
- Public GitHub Pages mirror of the static snapshot (own future phase).
- Preview-deployment (`*.pages.dev`) Access gating (residual hardening).
- Split least-privilege tokens (revisit if audience widens).
