---
phase: 04
slug: roadmap-timeline-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Test infrastructure and req→test map seeded from `04-RESEARCH.md` § Validation Architecture.
> The planner fills the Per-Task Verification Map once plan/task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4.1.9 |
| **Config file** | `vitest.config.ts` (else picked up from `vite.config.ts`) |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm typecheck`
- **Before `/gsd:verify-work`:** `pnpm test && pnpm typecheck && pnpm build` must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

> Seeded from RESEARCH req→test map. Planner MUST replace `{plan}-{task}` placeholders
> with real task IDs and confirm each row once plans exist.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | ? | ? | TL-01 | — | Month axis emits 7 correct labels | unit | `pnpm test src/lib/timeline/dateUtils.test.ts` | ❌ W0 | ⬜ pending |
| TBD | ? | ? | TL-01 | — | Bar position (left %, width %) correct | unit | `pnpm test src/lib/timeline/dateUtils.test.ts` | ❌ W0 | ⬜ pending |
| TBD | ? | ? | TL-01 | — | D-03 clamp: entirely-before-window → stub at col 0 | unit | `pnpm test src/lib/timeline/dateUtils.test.ts` | ❌ W0 | ⬜ pending |
| TBD | ? | ? | TL-01 | — | D-03 clamp: starts-before → clamp left w/ ◀ cue | unit | `pnpm test src/lib/timeline/dateUtils.test.ts` | ❌ W0 | ⬜ pending |
| TBD | ? | ? | TL-02 | — | undated pills / scheduled bars split correct | unit | `pnpm test src/lib/timeline/dateUtils.test.ts` | ❌ W0 | ⬜ pending |
| TBD | ? | ? | TL-03 | T-04-01 (open redirect) | `url` present in snapshot after D-13 pipeline | unit | `pnpm test scripts/linear/transform.test.ts` | partial | ⬜ pending |
| TBD | ? | ? | TL-03 | T-04-03 (PII leak) | `assertNoLeak` accepts a Linear URL string | unit | `pnpm test scripts/linear/transform.test.ts` | ❌ W0 | ⬜ pending |
| TBD | ? | ? | TL-04 | — | `resolveInitiativeColor` returns correct fallback | unit | `pnpm test src/lib/timeline/colorUtils.test.ts` | ❌ W0 | ⬜ pending |
| TBD | ? | ? | TL-04 | — | dark mode + responsive layout render | manual | dev server + visual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/timeline/dateUtils.test.ts` — bar position, D-03 clamping, today marker, month columns
- [ ] `src/lib/timeline/colorUtils.test.ts` — `resolveInitiativeColor` fallback algorithm
- [ ] `scripts/linear/transform.test.ts` — add `url` passthrough + `assertNoLeak` URL-string cases
- [ ] Update fixture `validSnapshot` in `src/lib/roadmap/loader.test.ts` to include `url` (or confirm `nullish` tolerates absence)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark-mode + responsive timeline render, hover/tap popover feel | TL-04 | Visual/interaction fidelity not assertable in unit tests | Run `pnpm dev`, load Timeline route, verify swimlanes/bars/pills/popover against `04-UI-SPEC.md` at desktop + narrow widths, light + dark |
| Linear link opens correct project in Linear | TL-03 | Requires live Linear + human eyeball on the destination | Click popover footer link, confirm it lands on the right Linear project (post `pnpm sync:snapshot` with `LINEAR_API_KEY`) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
