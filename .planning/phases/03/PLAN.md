# Phase 3 — PLAN: Pages Functions proxy + Cloudflare Access

Server-side token + private gating.

## Tasks
1. `functions/api/linear/[[path]].ts` — proxy GraphQL with `LINEAR_API_KEY` binding; allow-list operations.
2. Request validation + minimal rate-limit; never echo the token.
3. Cloudflare Access policy (email allow-list) over the Pages project + `/api/*`.
4. Client "Connect" toggle: snapshot mode vs live mode; graceful fallback if Functions down.
5. Docs: `docs/access-setup.md` (Access policy, bindings, secrets).

## Done when
- Live mode fetches through `/api/linear` with no token in the bundle.
- Unauthenticated requests are blocked by Access.

## Gates
- verification; security check (no secret in client/network logs).
