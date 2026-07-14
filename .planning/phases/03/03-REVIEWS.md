---
phase: 03
reviewers: [gemini, codex]
reviewed_at: 2026-06-28
plans_reviewed: [03-01-PLAN.md, 03-02-PLAN.md, 03-03-PLAN.md, 03-04-PLAN.md, 03-05-PLAN.md]
self_skipped: claude (running inside Claude Code — skipped for independence)
---

# Cross-AI Plan Review — Phase 03 (Linear proxy + Cloudflare Access)

## Gemini Review

### Summary

This is an exemplary set of five implementation plans that collectively outline a secure, robust, and well-structured approach to adding a live data path to the application. The plans proceed logically from foundational refactoring and configuration (01-02), through the core TDD implementation of the proxy itself (03), to client-side integration (04) and final operational documentation (05). The strategy demonstrates a deep understanding of the project's security constraints and architectural patterns, rigorously adhering to the approved design contract.

### Strengths

- **Security-First Approach:** Security is the central theme. Every plan includes a threat model, and key security controls are integrated throughout, from the dependency legitimacy gate (03-02) and TDD for the proxy (03-03) to the explicit requirement that the Access policy covers `/api/*` (03-05). Reusing the audited `assertNoLeak` function is a major strength.
- **Incremental and De-risked:** Plan 03-01 tackles the most significant technical risk (bundling cross-directory imports) with a trivial probe before any complex logic is written.
- **High Fidelity to Design:** The plans meticulously implement the approved design without scope creep (named-operations registry, snapshot-as-default-and-fallback, `?source=live` toggle).
- **Test-Driven:** The explicit RED-GREEN-REFACTOR cycle for the proxy function (03-03) is the correct, disciplined approach for a component handling auth tokens across a trust boundary.
- **Completeness:** Covers code, config, dependencies, testing, and the out-of-band Cloudflare console docs.

### Concerns

- **MEDIUM — Reliance on Manual Verification for E2E Flow:** Final end-to-end validation of the live path in 03-04 relies on a manual `wrangler pages dev` smoke test, susceptible to human error. Acceptable trade-off but the largest single point of process risk.
- **LOW — Manual Dependency Audit:** 03-02 substitutes a manual check for the absent automated supply-chain audit of `@cloudflare/workers-types`. Sound, but a minor process weakness; the blocking human-verify checkpoint is the appropriate mitigation.

### Suggestions

1. **Future Enhancement: Automate E2E Testing** (Playwright/Cypress) to programmatically start `wrangler pages dev`, toggle the source, and assert API calls — automating the 03-04 smoke test in a future phase.
2. **Minor Polish: Strengthen Probe Verification** in 03-01 Task 3 — assert the response body content, not just status code.

### Risk Assessment

**LOW.** Plans are exceptionally detailed, demonstrate a rigorous security posture, and are logically sequenced to de-risk unknowns early. Primary risks are process (manual verification) rather than technical. Plans comprehensively address the "Done when" criteria.

---

## Codex Review

### Summary

The phase plan is strong on intent: it keeps snapshot as the default, introduces live data through a named-operation Pages Function instead of raw GraphQL passthrough, and carries the right security posture around token confinement and PII leak checks. The main gaps are a few load-bearing plan inconsistencies that could derail implementation or leave the phase marked complete before the second "Done when" condition is actually true — especially around the shared mapper/module boundary, live-fallback error handling, and Access verification.

### Strengths

- Disciplined design contract: named operations only, no raw client GraphQL, `buildSnapshot` + `assertNoLeak` the only path from live data to client JSON.
- Good phase slicing: 03-01 de-risks code sharing, 03-02 establishes test/type config, 03-03 does the trust-boundary code with TDD, 03-04/03-05 finish UX and operator docs.
- Security thinking materially better than average: generic error bodies, no upstream passthrough, no token in config/responses, explicit Access coverage for `/api/*`.
- Reusing `RoadmapJsonSchema` on both server output and client live revalidation is the right simplicity-first choice.
- Snapshot-default preserved well; avoids speculative scope (one op, no client GraphQL layer, no KV/DO).

### Concerns

- **[HIGH] `03-03` fixture-shape contradiction.** The plan says `gqlClean`/`gqlWithEmail` are `GqlResponse`-shaped (top-level `data`), but the test behavior stubs the fetch as `200 { data: gqlClean }` — double-wrapping `data` and breaking `mapWorkspace(json)`.
- **[HIGH] Shared-mapper placement risky for `REQ-TYPE`.** 03-01 keeps `mapWorkspace` inside `scripts/linear/client.ts`, while 03-02 gives `functions/**` a Worker-only tsconfig. Importing `client.ts` from the Function also imports a file that references `process.env` in `fetchWorkspace` — likely to fail Worker-only typechecking or force Node globals into the Worker path.
- **[HIGH] `03-04` does not make "ANY live failure falls back" concrete enough.** Covers `!ok` and schema mismatch, but unless the whole live branch is wrapped in `try/catch`, a rejected `fetch()` or `res.json()` parse failure still throws and violates the loader contract.
- **[MEDIUM] `03-03` does not explicitly cover malformed upstream JSON.** A `200` with invalid JSON also needs to map to the same generic `502`; that path is not explicitly tested.
- **[MEDIUM] "Unauthenticated requests are blocked by Access" is documented, not enforced as a completion gate.** 03-05 writes the runbook, but the phase can look "done" without proof Access was applied to both the Pages app and `/api/*`.
- **[MEDIUM] `preview:functions` script in 03-02 inconsistent with the dependency strategy.** The plan avoids adding `wrangler` as a dep, but specifies `wrangler pages dev dist`, unreliable on a clean machine unless `npx --yes wrangler@4 ...`.
- **[MEDIUM] `.dev.vars` handling too soft for token sensitivity.** If local live testing is part of the workflow, ignoring `.dev.vars` should be an explicit repo change / blocking prerequisite, not a doc footnote.
- **[LOW] `03-01` relocation fallback exceeds declared plan scope** (moves shared code to `src/lib/linear/` and updates importers not listed in front matter), making downstream plans less deterministic.
- **[LOW] Toggle keeps `?source=snapshot`** instead of returning to the clean default URL — weakens the "snapshot is the default" contract and produces noisier share URLs.

### Suggestions

- Move shared GraphQL types and `mapWorkspace` into a process-free module (e.g. `scripts/linear/map.ts`); have both `client.ts` and the Function import it.
- Fix the 03-03 fixture contract before implementation: make `gqlClean` the inner `data` payload and stub `{ data: gqlClean }`, OR make `gqlClean` the full `GqlResponse` and stub `gqlClean` directly.
- Strengthen 03-04: explicitly require `try/catch` around the entire live path (`fetch`, `res.json()`, schema parse all fall through to snapshot).
- Add a 03-03 handler test: upstream `200` with malformed JSON → generic `502`, no token/PII in body.
- Make Access proof a blocking completion artifact: capture evidence that unauthenticated `/api/linear/snapshot` is blocked and an allowed identity succeeds.
- Change `preview:functions` to `npx --yes wrangler@4 pages dev dist` if the repo won't carry a `wrangler` dep.
- If `.dev.vars` isn't ignored, add `.gitignore` to 03-05 `files_modified` and make it mandatory.
- Add a loader test: "no `?source` means no `/api/linear/*` request" so snapshot-default is enforced, not just described.
- When toggling back to snapshot, remove the `source` param instead of setting `source=snapshot`.

### Risk Assessment

**MEDIUM.** Design is sound and aligned with phase goals (token confinement, snapshot-first, no raw passthrough). Remaining risk is plan-quality, not architecture: one clear spec inconsistency, one likely type-boundary problem, one under-specified live fallback path, and Access enforcement not yet a hard completion gate. Correcting these drops execution risk to low.

---

## Consensus Summary

Both reviewers agree the **architecture is sound** and the plans are unusually security-disciplined. They diverge sharply on residual risk: Gemini sees only process weaknesses (**LOW**); Codex found concrete plan bugs Gemini and the gsd-plan-checker missed (**MEDIUM**). The Codex HIGH items are the actionable output of this review.

### Agreed Strengths (2+ reviewers)
- Named-operation registry — no raw GraphQL passthrough; reuses the audited `assertNoLeak` + `buildSnapshot` as the only live→client path.
- Threat model in every plan; generic error bodies; token never in config/responses; explicit Access coverage of `/api/*`.
- Reusing `RoadmapJsonSchema` for both server output and client live validation.
- De-risked sequencing (cross-dir bundling probe before the real handler) and TDD for the trust-boundary handler.
- No scope creep — one operation, no speculative client GraphQL layer, no KV/DO.

### Agreed Concerns (2+ reviewers) — highest priority
- **Access enforcement / live E2E is verification-by-document, not a hard completion gate.** Gemini frames it as manual-E2E process risk; Codex wants captured proof that unauth `/api/*` is blocked and an allowed identity succeeds. → Make Access verification a blocking artifact in 03-05 (or the phase verify step), not just a runbook.

### Divergent Views (Codex-only HIGH — investigate before execution)
1. **03-03 fixture double-wrap** — GqlResponse-shaped fixtures stubbed as `{ data: gqlClean }`. Real contradiction; fix the fixture/stub contract before the RED step.
2. **Shared-mapper `process.env` boundary** — extract `mapWorkspace` (+ shared GQL types) into a process-free module (`scripts/linear/map.ts`) so the Worker never imports the `process.env`-touching `client.ts` under its Worker-only tsconfig.
3. **03-04 ANY-failure fallback** — wrap the whole live branch (`fetch` + `res.json()` + parse) in `try/catch`.

### Recommended additional fixes (Codex MEDIUM/LOW, low-cost)
- 03-03: add a malformed-upstream-JSON → 502 test.
- 03-02: `preview:functions` → `npx --yes wrangler@4 pages dev dist`.
- 03-05: make `.dev.vars` gitignore an explicit mandatory change if not already ignored.
- 03-04: loader test asserting "no `?source` ⇒ no `/api/linear/*` request"; toggle-to-snapshot removes the `source` param rather than setting `source=snapshot`.

---

*To incorporate this feedback into the plans:* `/gsd-plan-phase 03 --reviews`
