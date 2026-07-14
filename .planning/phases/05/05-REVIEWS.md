---
phase: 5
reviewers: [gemini, codex, opencode]
reviewed_at: 2026-07-14T18:03:36Z
plans_reviewed: [05-01-PLAN.md, 05-02-PLAN.md, 05-03-PLAN.md, 05-04-PLAN.md, 05-05-PLAN.md, 05-06-PLAN.md]
---

# Cross-AI Plan Review — Phase 5 (Overview dashboard, filters & drill-down)

> Reviewers: **Gemini**, **Codex**, **OpenCode** (Claude skipped — it is the executing CLI).
> OpenCode and Codex inspected the live codebase; Gemini reviewed the plans as written.
> The Consensus Summary at the top is authored by the orchestrator (Claude) and every
> HIGH/MEDIUM item in it was **verified against the actual repo** — see "Verified against code".

## Consensus Summary

All three reviewers agree the phase is **well-decomposed, scope-disciplined, and faithful to
OV-01..OV-04**: pure tested selectors, the optional `planAhead` seam, guarded Linear links, the
3-wave dependency structure, and the Path-B human-UAT gate are consistently praised. Gemini rated
every plan LOW with no concerns. Codex and OpenCode — which read the code — surfaced concrete gaps.
Two of them are **blocking** and were confirmed by the orchestrator against the repo.

### Agreed Strengths (2+ reviewers)
- Snapshot-first / zero-network is preserved in the component design — only FilterBar + the dialog
  touch `useSearchParams`, all parsing delegated to tested selectors, no plan adds a fetch.
- The OV-04 seam (`z.boolean().nullish()` + truthy-guarded `SyncBadge` on two surfaces) is minimal,
  back-compat, and invisible-until-Phase-6 exactly as intended.
- Wave-1 file disjointness is real (schema.ts / lib/overview / components/ui) — safe parallel exec.
- URL round-trip is the correct OV-02 verification; repeated-param `getAll`/`append` (no CSV) is enforced.
- Threat models are concrete: open-redirect guard reused verbatim, unknown `?project` id → null → no dialog.

### Agreed / Verified Concerns (highest priority first)

- **[HIGH — BLOCKING · Codex · VERIFIED] Root loader revalidation defeats zero-network.**
  RR7 revalidates loaders on every navigation, and *all* Phase-5 filters + drill-down are
  `setSearchParams` navigations. `src/router.tsx:13` gives the root route `loader: roadmapLoader`
  with **no `shouldRevalidate`**, and `src/lib/roadmap/loader.ts:35,51` fetches `/roadmap.json`
  (and `/api/linear/snapshot` in `?source=live`). So every filter toggle / drill-down open/close
  re-runs the loader → a redundant `/roadmap.json` refetch in snapshot mode, and **repeated live
  API calls in live mode**. No plan lists `src/router.tsx` in `files_modified`, so the phase as
  written cannot fix it. **Fix:** add a root `shouldRevalidate` that returns false when only
  client-side search params changed and the effective `source` mode is unchanged (revalidate on
  snapshot↔live). This is new work — add it to 05-06 (and its `files_modified`) or as a small
  Wave-2 router plan 05-06 depends on, with tests: filter change → no reload; project open/close →
  no reload; snapshot→live and live→snapshot → reload.

- **[HIGH — BLOCKING · Codex · VERIFIED] 05-06 prescribes a conditional hook call.**
  The plan's step order is `useRouteLoaderData("root")` → guard `if (!loaderData) return …` →
  **then** `useSearchParams()`. TimelinePage gets away with the guard because it calls only *one*
  hook before returning; OverviewPage needs *two*. Calling `useSearchParams` after an early return
  violates Rules of Hooks and **fails `react-hooks/rules-of-hooks`** — confirmed active in
  `eslint.config.js:18` — which is 05-06 Task 1's own `npx eslint .` gate. **Fix:** call BOTH hooks
  before the loader-data guard (move `useSearchParams()` above the `if (!loaderData)`), or split a
  loader-guarding `OverviewPage` from an `OverviewContent` child that owns the remaining hooks.
  Update the 05-06 action's numbered order accordingly.

- **[HIGH — CONTRACT · OpenCode · VERIFIED contradiction] `resolveRange` precedence vs FilterBar "clear the other."**
  05-02 says `resolveRange` gives custom `from/to` **precedence** over `quarter` when both present.
  05-05 says FilterBar **clears** `?from`/`?to` when a quarter is set and **vice-versa**. If FilterBar
  writes mutually-exclusive params, the "both present" precedence branch is unreachable dead code;
  if precedence is real, the "clears vice-versa" instruction is wrong. The 05-02 round-trip test
  won't catch this (it operates on `Filters` independent of the write-side rule), so the 05-05
  executor faces two incompatible instructions. **Fix (preferred):** allow both in the URL, let
  `resolveRange` pick custom-over-quarter, and **delete** the "clears vice-versa" sentence in 05-05;
  add an explicit `resolveRange({quarter, from, to})` precedence test in 05-02. (Alternative: enforce
  mutual exclusion and mark the precedence branch defensive-only.)

- **[MEDIUM · Codex + OpenCode · VERIFIED] Priority domain is inconsistent (0..4 vs 0..3).**
  05-02 clamps priority to integers **0..4**; the existing `ProjectPopoverContent.tsx:4-8`
  `PRIORITY_LABELS` has keys **0..3** only (`Urgent/High/Medium/Low`). A `priority=4` project would
  filter successfully but render as the `"—"` fallback in KpiCards (05-04) and FilterBar (05-05).
  (Linear's real enum is 0=No priority,1=Urgent,2=High,3=Medium,4=Low — so the *existing* map is
  likely already off-by-one, but that's pre-existing.) **Fix:** settle ONE canonical priority domain
  + label map for the phase and use it in 05-02's clamp and every local `PRIORITY_LABELS` copy
  (05-04, 05-05), or export a single shared const.

- **[MEDIUM · Codex] "initiatives" KPI is not filtered like the others.**
  05-06 wires `computeKpis(filtered, data.initiatives.length)` — the initiatives count stays at the
  full snapshot total while projects/scheduled/by-priority/by-status all reflect the filtered set,
  which contradicts 05-06's "KPIs computed over the FILTERED projects" claim. **Fix:** decide
  explicitly whether "initiatives" means *total in snapshot* (invariant) or *initiatives represented
  by filtered projects*, encode it in the selector signature, and test it.

- **[MEDIUM · Codex] OV-03 end-to-end is unproven in default snapshot mode.**
  The committed `public/roadmap.json` has no project `url` fields (Phase-4 04-07's gated re-sync
  hasn't run), so the guarded Linear link never renders by default. The *seam* is correct, but
  success criterion "drill-down links resolve to Linear" cannot be demonstrated until the snapshot
  carries real URLs. **Fix:** make the Phase-4 snapshot URL regeneration an explicit prerequisite, or
  document OV-03 as conditionally-complete until ≥1 default-snapshot project has a valid linear.app URL.

- **[MEDIUM · Codex] 05-03 dependency-drift + failure semantics.**
  `npx shadcn add` can touch `package.json`/lockfile, absent from `files_modified`; verification only
  greps for Radix. And the plan is `autonomous: true` yet allows "manual-intervention-required" as an
  outcome — but a missing `dialog.tsx` must **block** Wave 2, not pass with a warning. **Fix:** assert
  `package.json`/lockfile unchanged (or documented), use the project-local CLI, and make registry
  failure blocking unless the verified fallback is created and typechecks.

- **[LOW → resolved] SyncBadge `variant="destructive"`.** OpenCode worried it might not exist;
  **verified present** in `src/components/ui/badge.tsx:15`. Non-issue.

- **[LOW · Codex] 05-04 depends on 05-01 unnecessarily** — neither KpiCards nor HealthStrip reads
  `planAhead`; the dep only adds critical-path coupling. Could reduce to [05-02, 05-03].

- **[LOW · OpenCode/Codex] Test-gap hardening** — add explicit tests for: a zero-project initiative
  health row; quarter edge cases (Q1..Q4 boundaries, out-of-range `2026-Q5`/`2026-Q0`, malformed);
  `planAhead: false` parse; real-calendar date validation + reversed `from > to`; number-typed
  priority fixtures so the round-trip can't falsely pass on string===string.

- **[LOW · Codex/OpenCode] Accessibility not pinned** — filter multi-selects, date inputs, the
  distribution bars, and a visible/keyboard DialogClose are "Claude's discretion" gated only by
  tsc+eslint; under Path B they slip entirely to human UAT. Consider requiring `aria-label`s + a
  visible close control as acceptance criteria.

### Divergent Views
- **Overall risk.** Gemini: **LOW** across the board, zero concerns (did not read the code).
  OpenCode: **LOW-MEDIUM** (its top item is the resolveRange/FilterBar contradiction; it did not
  flag revalidation or the hook order). Codex: **HIGH as written → MEDIUM-LOW after two fixes**
  (the only reviewer to catch both blocking issues). The orchestrator sides with Codex: both HIGH
  items are real and verified in the repo.
- **Empty-state behavior.** Codex suggests rendering zero-valued KPI/health cards alongside the
  "No projects found" message (better feedback) rather than hiding them; also mount
  `ProjectDrillDownDialog` outside the filtered-empty branch so a shared `?project=` link still opens
  when active filters exclude that project. The plan currently hides KPIs/health in the empty state.

### Recommended actions before executing Wave 2/3
1. Add root `shouldRevalidate` work + tests (05-06 `files_modified` must include `src/router.tsx`, or a new small router plan).
2. Fix 05-06's hook ordering (both hooks before the loader guard).
3. Resolve the `resolveRange` vs FilterBar precedence contradiction; add the precedence test to 05-02.
4. Establish one canonical priority domain + label map across 05-02/05-04/05-05.
5. Decide the filtered-"initiatives" KPI semantics.
6. Make real snapshot Linear URLs a prerequisite or mark OV-03 conditionally-complete.
7. Tighten 05-03 dependency-drift checks and make registry failure blocking.

---

## Gemini Review

Here is a review of the implementation plans for Phase 5.

## Overall Review Summary

This is an exceptionally high-quality and comprehensive set of plans. The 3-wave structure is logical, ensuring dependencies are met before work begins. The plans demonstrate a deep understanding of the project's architecture, adhering strictly to the "snapshot-first" principle and reusing existing patterns for consistency and efficiency. Key risks, especially around URL state management and the phased delivery of the OV-04 badge feature, are identified and mitigated with robust, test-driven solutions. The inclusion of a detailed human-verification script in the final plan is a standout feature that ensures UI/UX quality in the absence of an automated rendering test harness. The overall risk of the phase is LOW due to this meticulous planning.

---

### Review of `05-01-PLAN.md`: Schema Field

1.  **Summary**
    A very strong, low-risk plan for a minimal, surgical schema change. It is well-defined, follows existing patterns, and is driven by a comprehensive TDD approach that guarantees backward compatibility. It correctly isolates the schema change, deferring all dependent logic.

2.  **Strengths**
    *   **TDD Excellence:** The plan specifies a clear Red-Green-Refactor cycle, writing tests first to prove the necessity of the change.
    *   **Comprehensive Tests:** The test cases are thorough, covering backward compatibility (parsing a snapshot without the new field), presence, null values, and incorrect types.
    *   **Consistency:** It explicitly mirrors the existing `url: z.string().nullish()` pattern, adhering to project conventions.
    *   **Clarity:** Acceptance criteria and verification steps are clear, specific, and automatable.

3.  **Concerns**
    *   None. The plan is exemplary for a small, critical change.

4.  **Suggestions**
    *   None. The plan is excellent as is.

5.  **Risk Assessment**
    *   **LOW.** The change is additive, optional, and protected by strong typing and a solid TDD plan. It's isolated and guaranteed to be backward-compatible.

---

### Review of `05-02-PLAN.md`: Pure Selectors (TDD)

1.  **Summary**
    An outstanding plan that builds the logical core of the phase in a pure, testable, and robust way. It correctly isolates all complex logic from the UI layer, proactively settles key UX ambiguities by encoding them in tests, and demonstrates a sophisticated understanding of URL state management pitfalls.

2.  **Strengths**
    *   **Architecturally Sound:** The strict separation of concerns (no React/DOM) is perfectly executed, making the logic highly testable and reusable.
    *   **Proactive Decision Making:** The plan identifies and settles four key UX assumptions (undated project filtering, custom vs. preset range precedence, "Unassigned" health row) by locking them into tested behavior, preventing downstream ambiguity.
    *   **Robust URL Handling:** The focus on a `decode(encode(f))` round-trip test, defensive parsing of untrusted inputs, and preservation of co-resident URL params (`?project`) is best-practice.
    *   **Security-Aware:** The plan correctly identifies URL params as an attack vector and specifies defensive parsing as the mitigation.

3.  **Concerns**
    *   None. This plan is a model for building a data transformation layer.

4.  **Suggestions**
    *   To further enhance the "clean shareable URL" goal, add a specific test case to verify that `encodeFilters` omits keys for filters that are in their default (empty) state.

5.  **Risk Assessment**
    *   **LOW.** The plan is TDD-driven and security-aware. By building on pure functions, it minimizes the risk of complex state-management bugs, and the riskiest parts (URL parsing) are explicitly targeted with defensive tests.

---

### Review of `05-03-PLAN.md`: Scaffold UI Primitives

1.  **Summary**
    A simple, procedural plan executed with admirable thoroughness. It focuses on a single task—scaffolding components—while correctly identifying the expected outcome, potential failure modes, and providing a robust fallback strategy.

2.  **Strengths**
    *   **Clear and Focused:** The action is a single, clear CLI command.
    *   **Strong Verification:** The plan includes automated checks to ensure the scaffolded components adhere to project conventions (i.e., use `@base-ui` and not `@radix-ui`) and add no new dependencies.
    *   **Resilient Fallback:** The contingency plan for CLI/network failure is excellent. It provides clear instructions to either hand-author from a verified spec or explicitly flag the failure, preventing silent errors.
    *   **Supply-Chain Awareness:** The threat model correctly identifies the risk from an external component registry and mitigates it by verifying dependency integrity.

3.  **Concerns**
    *   None. This plan is rock-solid for its scope.

4.  **Suggestions**
    *   None.

5.  **Risk Assessment**
    *   **LOW.** The task is simple, and the plan includes verification and robust fallbacks that mitigate the primary risks (wrong dependencies, CLI failure).

---

### Review of `05-04-PLAN.md`: KPI/Health Components

1.  **Summary**
    A solid plan for building "dumb" presentational components. It effectively leverages the robust selector layer from `05-02` and focuses on reusing existing UI patterns, which promotes efficiency and visual consistency. The plan is realistic about its verification limitations without a render harness.

2.  **Strengths**
    *   **Adherence to Architecture:** The plan correctly implements the "thin presentational component" pattern, taking in pre-computed props and containing no business logic.
    *   **Pattern Reuse:** It emphasizes reusing existing, proven patterns from Phase 4 for UI elements like stacked bars and color chips, ensuring a consistent look and feel.
    *   **Handles Edge Cases:** The plan explicitly calls for handling the "Unassigned" row in `HealthStrip` and the `total === 0` case in distribution bars to prevent division-by-zero errors.
    *   **Good Cross-Plan Awareness:** Correctly notes that the `SyncBadge` component was intentionally moved to plan `05-05`.

3.  **Concerns**
    *   None. The plan is clear and follows the established architecture perfectly.

4.  **Suggestions**
    *   None.

5.  **Risk Assessment**
    *   **LOW.** These are presentational components whose data inputs are already processed and validated. The main risk (visual bugs) is correctly identified and deferred to human UAT.

---

### Review of `05-05-PLAN.md`: Filter/Drill-Down/Badge Components

1.  **Summary**
    This is the most complex component plan, and it is handled exceptionally well. It demonstrates mastery of URL-driven state in React, correctly implements a robust and shareable dialog pattern, and soundly closes the loop on the OV-04 data seam by creating and mounting the `SyncBadge`.

2.  **Strengths**
    *   **Expert URL State Management:** The plan correctly uses the `setParams((prev) => ...)` idiom to preserve co-resident params, a critical and often-missed detail.
    *   **Robust Dialog Logic:** The URL-controlled dialog implementation is perfect: it's stateless, robust against invalid input (`?project=foo`), and uses the correct history manipulation (`replace: true` on close) for a good user experience.
    *   **Attention to Detail:** It astutely identifies the potential pitfall of `base-ui` vs. Radix API differences for `onOpenChange`.
    *   **Sound Feature Seam:** The `SyncBadge` correctly implements the "invisible-not-error" requirement, and the plan wisely mounts it in the dialog header immediately, providing an early render surface.

3.  **Concerns**
    *   None. This plan is outstanding.

4.  **Suggestions**
    *   None.

5.  **Risk Assessment**
    *   **LOW.** Despite the inherent complexity of URL state management, the plan mitigates all common risks through established patterns, delegation to pure selectors, and defensive guards.

---

### Review of `05-06-PLAN.md`: Page Assembly & Verification

1.  **Summary**
    An excellent final assembly plan that correctly wires together all previously built parts. The data flow is sound, and the plan ensures all features have a final render surface. The inclusion of a detailed, blocking human verification checkpoint is the key feature, making the plan robust and guaranteeing phase success.

2.  **Strengths**
    *   **Correct Data Flow:** The derive-then-render pipeline (`decode` -> `resolve` -> `apply` -> `compute` -> `render`) is perfectly ordered and ensures KPIs reflect the filtered data.
    *   **Completes Feature Seams:** It mounts the `SyncBadge` in its primary location (the project list), ensuring the OV-04 feature is fully visible when data becomes available in Phase 6.
    *   **Exceptional UAT Plan:** The human verification script is comprehensive, with clear, step-by-step instructions to validate every single requirement for the phase. The suggestion to smoke-test the `planAhead` flag is particularly insightful.
    *   **Strong Quality Gate:** The final automated verification step runs the full test suite, build, and linter, acting as a comprehensive check before the human handoff.

3.  **Concerns**
    *   None. The plan is comprehensive and safe.

4.  **Suggestions**
    *   None.

5.  **Risk Assessment**
    *   **LOW.** All complex logic is based on previously tested selectors. The assembly is a straightforward wiring task that follows existing patterns. The primary risk (visual and interaction bugs) is explicitly and thoroughly mitigated by the human verification gate.

---

## Codex Review

# Cross-AI Plan Review

## Overall assessment

The phase is thoughtfully decomposed, scope-disciplined, and largely faithful to OV-01–OV-04. The pure-selector approach, optional `planAhead` seam, guarded Linear links, and three-wave dependency structure are strong. However, the plans are not implementation-ready as written: URL changes made by `useSearchParams` will revalidate the root loader and re-fetch data unless `shouldRevalidate` is added, and 05-06’s prescribed hook order violates the Rules of Hooks. Those are blocking issues. There are also smaller ambiguities around filtered initiative counts, defensive URL parsing, priority values, and the current snapshot’s lack of Linear URLs.

---

## 05-01 — Optional `planAhead` schema field

### Summary

This is a clean, narrowly scoped schema migration. It correctly treats OV-04 as a data seam rather than pulling Phase 6 scanning into the UI phase, and the RED→GREEN tests exercise the relevant backward-compatibility behavior.

### Strengths

- Uses `z.boolean().nullish()`, preserving compatibility with the existing flagless snapshot.
- Tests absent, `true`, `null`, and wrong-type inputs.
- Relies on `z.infer` instead of duplicating the `Project` type.
- Makes no changes to the snapshot or issue-level data.
- Correctly leaves actual `.planning/` comparison logic to Phase 6.

### Concerns

- **LOW:** The objective still says the badge is built in 05-04, while the final plan structure places it in 05-05.
- **LOW:** The tests do not explicitly cover `planAhead: false`, even though false is an important invisible-badge state.
- **LOW:** The Phase 6 handoff contract is implicit. A stale `true` must be cleared or omitted on later full snapshot generation if a project becomes synchronized.

### Suggestions

- Update the stale 05-04 badge reference to 05-05.
- Add a `false` parse assertion.
- State the Phase 6 producer rule: emit `true` only when ahead and otherwise emit `false` or omit the field during full regeneration.

### Risk Assessment

**LOW.** The change is additive, backward-compatible, well tested, and does not expand Phase 5 scope.

---

## 05-02 — Pure selectors and filter serialization

### Summary

This plan gets the architecture right: aggregation and URL semantics are isolated in a pure module and receive most of the phase’s automated coverage. Its principal weaknesses are ambiguous KPI semantics and defensive parsing that is not as strict as the threat model claims.

### Strengths

- Separates business logic from React and browser interaction.
- Uses repeated query parameters rather than fragile CSV encoding.
- Preserves non-filter parameters through `encodeFilters(filters, base)`.
- Tests AND-composition, undated exclusion, custom-range precedence, and Unassigned rollups.
- Keeps scheduled semantics aligned with Phase 4: `targetDate !== null`.
- Correctly distinguishes valid-filter round-trip tests from component UAT in principle.

### Concerns

- **MEDIUM:** `computeKpis(filtered, data.initiatives.length)` leaves the initiatives KPI unfiltered while every other KPI is filtered. This conflicts with 05-06’s claim that KPIs are computed over filtered data. The desired meaning of “initiatives” under status, priority, or time filters is unresolved.
- **MEDIUM:** The stated round-trip invariant is imprecise. `decodeFilters(encodeFilters(f)) === f` can hold for canonical valid `Filters`; `encodeFilters(decodeFilters(sp))` cannot equal arbitrary input because invalid values, duplicate scalar params, and ordering are normalized.
- **MEDIUM:** The proposed numeric parsing with `Number(...)` accepts noncanonical values such as an empty priority as `0`, whitespace, hexadecimal, or exponent notation.
- **MEDIUM:** A regex-shaped `YYYY-MM-DD` check can accept impossible dates such as `2026-02-31`. There is also no defined behavior for `from > to`.
- **MEDIUM:** The threat model claims oversized values are ignored, but the contract passes unknown IDs/statuses through and specifies no length, repetition, or deduplication bound.
- **MEDIUM:** The accepted priority range is `0..4`, while Phase 4 and 05-04’s label maps only define `0..3`. Priority `4` would filter successfully but display as an unknown label.
- **LOW:** Projects with `initiativeId === null` get an Unassigned health row but cannot be selected explicitly through the initiative filter.

### Suggestions

- Explicitly decide whether the initiatives KPI means:

  - total initiatives in the snapshot, invariant under filtering; or
  - initiatives represented by filtered projects.

  Reflect that decision in the selector signature and tests.
- Define the invariants as:

  - valid canonical `Filters` round-trip through encode/decode;
  - arbitrary search params decode safely;
  - re-encoding decoded arbitrary input produces a stable canonical form.
- Parse priorities with an exact allowlist or canonical decimal regex, then deduplicate them.
- Validate real calendar dates and test reversed and partial custom ranges.
- Either bound repeated values and value lengths or remove the unsupported “oversized values are ignored” claim from the threat model.
- Establish one canonical priority domain and label map.
- Consider a reserved Unassigned filter value if null-initiative projects are a supported UI case.

### Risk Assessment

**MEDIUM.** The overall design is strong, but several edge contracts should be resolved before downstream components depend on them.

---

## 05-03 — Dialog and card scaffolding

### Summary

Separating UI primitive scaffolding into Wave 1 is sensible, and the verified Base UI fallback keeps the work from depending completely on registry availability. The main risk is uncontrolled CLI side effects and ambiguous completion when scaffolding fails.

### Strengths

- Correctly targets the installed Base UI stack instead of introducing Radix.
- Provides a verified offline fallback for the more complex dialog primitive.
- Checks for prohibited Radix imports.
- Keeps runtime behavior independent of the shadcn registry.
- Unblocks both Wave 2 component plans cleanly.

### Concerns

- **MEDIUM:** `npx shadcn add` can modify `package.json`, the lockfile, or other project files, but these are absent from `files_modified`, and verification only checks for Radix—not all dependency drift.
- **MEDIUM:** The plan is marked autonomous yet allows “manual-intervention-required” to count as a possible outcome. Downstream plans cannot proceed without both files, so a missing dialog must remain a blocking failure rather than a completed plan with a warning.
- **LOW:** “Do NOT hand-write the dialog” conflicts superficially with the later sanctioned fallback, although the fallback rules resolve the intent.
- **LOW:** Using the project-local CLI explicitly would be more deterministic than relying on `npx` resolution.

### Suggestions

- Use the locally installed CLI and record a before/after manifest and lockfile diff.
- Add acceptance checks that `package.json` and the lockfile are unchanged unless an explicitly approved dependency change is documented.
- Make registry failure blocking unless the verified fallback is successfully created and typechecked.
- Do not allow a flagged-but-missing primitive to satisfy Wave 1 completion.

### Risk Assessment

**MEDIUM.** Runtime risk is low, but execution and dependency-drift controls need tightening.

---

## 05-04 — KPI cards and health strip

### Summary

These are appropriately thin components, with numerical correctness delegated to tested selectors. The component boundaries are good, although ordering, priority labeling, and accessibility need more explicit contracts.

### Strengths

- Components receive computed values rather than performing aggregation.
- Reuses Phase 4 color and stacked-bar patterns.
- Handles zero totals without producing `NaN` widths.
- Handles the null-initiative row without calling `resolveInitiativeColor` incorrectly.
- Avoids adding state or data access to presentational components.

### Concerns

- **MEDIUM:** Priority `4` is allowed by the filter selector but is missing from the prescribed label map.
- **LOW:** Sparse `Record` distributions leave zero-count priority categories absent, and by-status ordering may depend on snapshot insertion order.
- **LOW:** Bar accessibility is not specified. Visual segments should have adjacent textual totals or accessible labels and should not depend on color alone.
- **LOW:** 05-04 depends on 05-01 even though neither component consumes `planAhead`; this adds unnecessary critical-path coupling.

### Suggestions

- Resolve the shared priority domain before implementing these components.
- Define deterministic ordering: canonical priority order and either alphabetical or count-descending status order.
- Include text summaries and appropriate `aria-label`/`aria-hidden` treatment for decorative bars and chips.
- Reduce `depends_on` to 05-02 and 05-03 unless the workflow requires whole-wave barriers.

### Risk Assessment

**LOW to MEDIUM.** The component work is straightforward; remaining risks are mostly semantic consistency and presentation quality.

---

## 05-05 — FilterBar, drill-down dialog, and SyncBadge

### Summary

The component responsibilities and URL-state model are good, and the OV-04 badge is mounted on a real surface. The critical omission is router revalidation: every filter change, project open, or project close is a navigation and will rerun the root loader by default.

### Strengths

- Treats the URL as the single source of filter and dialog state.
- Preserves `project` and `source` when updating filters.
- Guards unknown project IDs before rendering the dialog.
- Deletes `project` with history replacement on close while using push on open.
- Shows only aggregate issue counts and milestones.
- Guards the external URL and includes `noopener noreferrer`.
- `SyncBadge` has the correct invisible-on-absent/false/null behavior.

### Concerns

- **HIGH:** React Router revalidates loaders on search-param changes by default. Since the root route has `roadmapLoader`, every filter or dialog interaction will refetch `/roadmap.json`; in live mode it can repeatedly call `/api/linear/snapshot`. This undermines the claimed snapshot-only in-memory interaction and offline behavior. The current root route has no `shouldRevalidate` guard in [src/router.tsx](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/src/router.tsx:13), while the loader performs fetches in [loader.ts](/Users/donald/Sourcecode/agenticapps/agenticapps-roadmap/src/lib/roadmap/loader.ts:25).
- **MEDIUM:** The dialog plan does not explicitly require a visible, keyboard-accessible close button, despite importing `DialogClose` and asking UAT to “close it.”
- **MEDIUM:** A current-plus-three-quarters preset list may not display an active quarter from an older or far-future shared URL, even though the filter remains active.
- **MEDIUM:** Filter controls lack explicit accessibility requirements such as labels, grouping, and `aria-pressed` or checkbox semantics.
- **LOW:** Full milestone lists may overflow a mobile dialog unless `max-height` and scroll behavior are specified.
- **LOW:** Component behavior remains manual-only. This is consistent with Path B, but it increases reliance on the final checkpoint.

### Suggestions

- Add a root `shouldRevalidate` policy that suppresses loader execution when navigation changes only client-side UI state and the effective `source` mode is unchanged. Test at least:

  - filter change: no reload;
  - project open/close: no reload;
  - snapshot → live: reload;
  - live → snapshot: reload;
  - explicit same-URL revalidation: preserve the router default.
- Require a visible `DialogClose` control with an accessible name.
- Always display the active quarter, even if it falls outside the default preset window.
- Specify accessible semantics for every multi-select and date input.
- Add dialog max-height and overflow behavior for long milestone lists.

### Risk Assessment

**HIGH until loader revalidation is addressed.** Without that fix, the core URL-driven interaction contradicts the intended in-memory snapshot architecture.

---

## 05-06 — Overview page assembly and UAT

### Summary

The assembly plan connects all required surfaces and includes a strong human verification script. It nevertheless contains two blocking implementation defects: conditional hook usage and the missing router revalidation change.

### Strengths

- Correctly derives filters, range, filtered projects, KPIs, and health in one page-level pipeline.
- Keeps child components presentational.
- Provides a keyboard-capable project interaction requirement.
- Mounts `SyncBadge` in both the list and dialog.
- Keeps the filter bar visible in the empty state.
- Includes comprehensive full-suite, build, lint, and manual acceptance gates.
- The UAT covers reload, coexistence of parameters, browser history, invalid project IDs, mobile, dark mode, and OV-04 smoke behavior.

### Concerns

- **HIGH:** The prescribed order calls `useSearchParams` after an early return based on `loaderData`. That is a conditional hook call and should be rejected by the configured React Hooks lint rules. Call both hooks before the guard or split guarded data rendering into a child component.
- **HIGH:** `files_modified` excludes `src/router.tsx`, so the root-loader revalidation problem cannot be fixed by this plan. Opening a project or changing a filter will refetch data.
- **MEDIUM:** `computeKpis(filtered, data.initiatives.length)` does not actually compute the initiative KPI from the filtered set.
- **MEDIUM:** The current committed `public/roadmap.json` contains no project `url` fields. Consequently, the UAT makes the Linear link conditional, while the phase success criterion says drill-down links resolve to Linear. The code seam is correct, but end-to-end OV-03 remains unproven in default snapshot mode.
- **MEDIUM:** Hiding KPIs and health entirely when filtering yields zero projects conflicts somewhat with the stated rule that KPIs and health reflect the active filter. Showing zero-valued cards may give better feedback.
- **LOW:** The dialog should be explicitly mounted outside the filtered-empty conditional so a valid shared `?project=` link still works when active filters exclude that project.
- **LOW:** The UAT’s temporary snapshot edit is reasonable but should use a guaranteed cleanup step to avoid committing test data accidentally.

### Suggestions

- Move `useSearchParams()` above the loader-data guard, or use:

  - `OverviewPage` for loader guarding; and
  - an `OverviewContent` child that owns the remaining hooks.
- Expand the plan to modify and test `src/router.tsx` with a root `shouldRevalidate` policy.
- Resolve filtered initiative-count semantics before assembly.
- Make Phase 4’s snapshot URL regeneration an explicit prerequisite, or classify OV-03 as partially verified until at least one default-snapshot project has a valid Linear URL.
- Consider rendering zero KPIs and health rows alongside the empty project-list message.
- Keep `ProjectDrillDownDialog` outside list/KPI empty-state branching.

### Risk Assessment

**HIGH.** As written, it is likely to fail lint and it does not preserve no-refetch URL interactions.

---

## Phase-wide dependency and requirement assessment

### Strengths

- Wave 1 files are largely disjoint and safe to execute in parallel.
- Wave 2 cleanly separates aggregation presentation from URL-driven interaction.
- Wave 3 is the correct place for route assembly and human UAT.
- No plan introduces client-side Linear access or `.planning/` scanning.
- OV-04’s optional seam is sound and correctly degrades to invisible.
- OV-03 remains aggregate-only, preserving the sanitized snapshot boundary.
- The threat models correctly recognize search parameters as attacker-controlled and prevent direct URL-param-to-href flow.

### Cross-plan concerns

- **HIGH:** The root loader needs search-param-aware revalidation control. This is the largest architectural gap.
- **HIGH:** 05-06’s conditional hook order is a direct implementation blocker.
- **MEDIUM:** OV-03 cannot be fully demonstrated with the current URL-less snapshot.
- **MEDIUM:** Priority semantics are inconsistent across selectors and UI plans.
- **MEDIUM:** The threat model overstates defense against oversized URL input.
- **MEDIUM:** The meaning of the initiatives KPI under active filters is unresolved.
- **LOW:** 05-03’s failure path must block downstream waves rather than merely produce a warning.
- **LOW:** 05-04 waits on 05-01 unnecessarily.

### Recommended plan changes before execution

1. Add router revalidation work and tests to 05-06, or create a small Wave 2 router plan that 05-06 depends on.
2. Fix 05-06’s hook ordering.
3. Amend 05-02 with canonical round-trip definitions, strict priority/date parsing, reversed-range behavior, and initiative-KPI semantics.
4. Establish one shared priority domain and labels.
5. Make real snapshot Linear URLs an explicit prerequisite or document OV-03 as conditionally complete.
6. Tighten 05-03’s dependency-drift checks and blocking failure behavior.

## Overall Risk Assessment

**HIGH as currently written; MEDIUM-to-LOW after the two blocking fixes.**

The design itself is strong and the phase should achieve OV-01, OV-02, and the Phase 5 portion of OV-04. The missing `shouldRevalidate` behavior is the main threat to snapshot-first/offline interaction, while the conditional hook order is likely to fail the final lint gate. OV-03’s implementation seam is complete, but its end-to-end success remains conditional until the default snapshot carries real Linear URLs.

---

## OpenCode Review

I'll review these plans against the actual codebase to ground my feedback. Let me start by examining the existing patterns referenced.
Let me verify the existing patterns for the loader wiring and routerstructure.
Let me check the build/components configuration to verify the shadcn scaffolding assumptions.
I have enough context to write a grounded review. Let me note the key cross-checks:

- `dialog.tsx`/`card.tsx` don't exist yet; `base-nova` style confirmed (components.json empty registries). 05-03's fallback path is well-justified.
- `PRIORITY_LABELS` in `ProjectPopoverContent.tsx:4-9` only has keys **0-3** (Urgent/High/Medium/Low), but 05-02 specifies priority defensived clamping range **0..4** — inconsistency.
- `loader.test.ts:16-36` `validSnapshot` has no `planAhead` field — confirms 05-01 back-compat claims are testable.
- `TimelinePage.tsx:1` imports by named export; `router.tsx:3,19` confirms OverviewPage is imported by name at the `index` route — 05-06's "no new route, named export" claim is correct.
- `popover.tsx:4,40` uses `@base-ui/react/popover` + `bg-popover` token syntax alongside `bg-sky-500` — base-ui import path and mixed token conventions are accurate.
- `AppHeader.tsx:15-29` confirms the `setParams((prev) => {...; return prev;})` idiom — 05-05 thread-prev correctly mirrors it.

# Cross-AI Plan Review — Phase 5 (Overview Dashboard, Filters & Drill-Down)

## 1. Summary

The six-plan structure is well-engineered: a clean 3-wave split with disjoint file ownership, surgical scope (one additive schema line, two pure selector modules, two scaffolded UI primitives, three presentational components, one page assembly), strict adherence to the snapshot-first/zero-network invariant, and thoughtful reuse of Phase-4 patterns (stacked-bar, total-guard, guarded Linear link, `resolveInitiativeColor`). TDD red-green discipline is enforced where it matters (05-02 selectors — the actual OV-02 crux), and Path B (no React-render harness, human UAT) is correctly scoped and gated. The OV-04 seam (`planAhead?: boolean().nullish()` + truthy-guarded `SyncBadge` mounted on two surfaces) is sound and invisible-until-Phase-6 as designed. The plan set passes its phase goals with medium confidence. The dominant residual risks are (a) an under-specified contract contradiction between `resolveRange` precedence and FilterBar's "clear the other dimension on write" rule, and (b) a priority-range discrepancy between the selectors' defensive clamp (0..4) and the existing `PRIORITY_LABELS` table (0..3). Neither blocks execution but both should be sharpened before Wave 2.

## 2. Strengths

- **Snapshot-first preserved verbatim.** Every component is presentational; the only `useSearchParams` consumers are `FilterBar` and the dialog, which delegate all parsing to the tested `selectors.ts`. No plan introduces a fetch, no plan touches `roadmap.json`, and 05-06's wiring mirrors `TimelinePage`'s loader-guard. The `loader.test.ts:16-36` fixture (no `planAhead`) confirms 05-01's back-compat claim is testable.
- **Wave-1 file disjointness is real.** 05-01 edits `schema.ts`, 05-02 creates `lib/overview/*`, 05-03 touches only `components/ui/*`. Parallel autonomous execution cannot conflict at edit-time.
- **OV-04 seam is genuinely minimal and forward-safe.** One `.nullish()` field, truthy-guarded render on two surfaces (dialog header in 05-05, project-row list in 05-06). The badge literally cannot error on a flag-less snapshot because the `SyncBadge` returns `null` for any non-truthy value. Phase 6 lights it up with no UI rework.
- **URL round-trip is the actual OV-02 verification.** 05-02 Task 2 explicitly asserts `decodeFilters(encodeFilters(f)).toEqual(f)`, the `?project`/`?source` survival case, and defensive parse of bad priority/ISO date. Repeated-param `getAll`/`append` (no CSV) is enforced by both acceptance grep and the round-trip test.
- **Threat modeling is concrete, not boilerplate.** T-05-04 (open-redirect) reuses the Phase-4 `startsWith("https://linear.app/")` guard verbatim — verified against `ProjectPopoverContent.tsx:94`. T-05-05 (unknown `?project` id → null → no dialog) is testable in 05-06 UAT step 4 (garbage-id hand-edit).
- **base-ui onOpenChange arity pitfall is pre-flagged.** The interface note `(open: boolean) => void` + "ignore 2nd details arg" is the only correct shape against `@base-ui/react`; pre-warning avoids the most likely Wave-2 defect.
- **Resilient Wave-1 scaffolding (05-03).** The verified hand-authored fallback + flag-for-manual-intervention branch means a registry outage doesn't silently produce a Radix-shaped file. `grep -c "@radix-ui" package.json` returns 0 enforces zero dep drift.

## 3. Concerns

- **HIGH — Contract contradiction between `resolveRange` precedence and FilterBar write-clears-other.** 05-02 says: "`resolveRange` gives custom from/to PRECEDENCE over a quarter preset when both are present" (A2). 05-05 says: "setting a quarter clears `?from`/`?to` on write and **vice-versa**, so the URL is unambiguous; resolveRange enforces precedence." These two are mutually exclusive in practice: if FilterBar writes mutually-exclusive params, then `?quarter=X&from=Y&to=Z` is unreachable through the UI and `resolveRange`'s precedence branch is dead defensive code. Either (i) FilterBar must allow both in URL and let `resolveRange` pick — meaning the "clears vice-versa" sentence should be deleted, or (ii) the URL is mutually exclusive and `resolveRange` should `assert(false)` or document that precedence is unreachable-but-defensive. Without clarification, the executor of 05-05 has two incompatible instructions and will pick one. The 05-02 round-trip test won't catch this because round-trip operates on `Filters{quarter,from,to}` independently of the write-side clearing rule. **Recommendation:** pick one semantic, write it explicitly in 05-02 as a new invariant test, and delete the contradictory sentence in 05-05.

- **MEDIUM — Priority range mismatch.** 05-02 defensive parse clamps priority to integers `0..4` (drops "9", "x", "1.5"). Existing `ProjectPopoverContent.tsx:4-9` `PRIORITY_LABELS` only has keys `0..3` (`{0:Urgent,1:High,2:Medium,3:Low}`). Linear's actual priority enum is 0=No priority / 1=Urgent / 2=High / 3=Medium / 4=Low (or similar) — the existing map is likely already wrong, and the 05-02 clamp now admits `priority=4` that the 05-04 `KpiCards` declared-locally `PRIORITY_LABELS` would render as `"—"`. The selectors plan says "small duplication is intentional per surgical rule" but does not specify the label keys. **Recommendation:** specify `PRIORITY_LABELS = {0:"—",1:"Urgent",2:"High",3:"Medium",4:"Low"}` (or whatever Linear uses — verify in RESEARCH.md or sync-snapshot script) in 05-02 as a shared exported const imported by 05-04 and 05-05, OR keep duplication but specify the same key set in every plan.

- **MEDIUM — HealthStrip zero-project initiative rows under-specified.** 05-02 says "initiatives with 0 projects yield a zeroed row (all counts 0)" and A3 covers the Unassigned conditional. But it never explicitly states ALL initiatives (zero-project included) get a row, nor does it require a test that exercises a zero-project initiative. `TimelinePage.tsx:45-65` explicitly renders ALL initiatives (incl. zero-project). HealthStrip's behavior should match — the plan implies it but the test doesn't pin it. **Recommendation:** add one test asserting "an initiative with zero projects appears as a row with all zeros."

- **MEDIUM — `resolveRange` quarter edge cases not enumerated.** "Invalid quarter string → null" is asserted, but "valid quarter with invalid quarter number" (e.g. `2026-Q5`, `2026-Q0`) and edge quarters (Q1 → Jan 1, Q4 → Oct 1, year boundaries). These map onto calendar boundaries that subtly differ (Q4 ends Dec 31 — what about timezone?). A small `quarterRange(q)` helper is implied but untested. **Recommendation:** enumerate test cases for Q1..Q4 ranges + at least one out-of-range quarter number + one malformed year-quarter (e.g. `garbage`, `2026-Q1-extra`).

- **LOW — No FilterBar integration verification despite being the highest-uncertainty visual surface.** FilterBar logic correctness is delegated entirely to 05-02 selector tests. The actual `<select>`/checkbox/date-input widget wiring — including multi-select toggle, "Clear filters" semantics, quarter-button preset list, and custom-from/to two-date widget — is "Claude's discretion" with only tsc+eslint gating. Visual defects and inaccessible widgets (missing label associations, no `aria-label` on multi-selects) slip to human UAT. **Recommendation:** add a `FilterBar.tsx` acceptance criterion requiring keyboard-activatable controls and visible labels/ARIA; cite D-05-06 ("no component render harness, so a11y is human-UAT" — at minimum pin control presence: 4 distinct interactive control affordances plus 1 "Clear filters" button verifiable by grep).

- **LOW — Round-trip type-coercion attention.** `encodeFilters` writes `?priority=1` (string), `decodeFilters` parses back to `number`. The round-trip `toEqual(f)` test passes only if `f.priorities` are pre-typed as numbers in the fixture. If an executor builds fixtures with string priorities, the round-trip assertion may falsely pass (string === string), masking a parse bug. **Recommendation:** in 05-02 Task 2, add "build fixture `f.priorities = [1]` (literal `number`s, not strings)" to the action block.

- **LOW — `SyncBadge` variant="destructive" not verified to exist.** `badge.tsx` exists (per glob), but the destructive variant is asserted in 05-05 acceptance criteria only via the `Badge` import line. If the shadcn base-nova badge has no `destructive` variant, 05-05's SyncBadge task RED->GREEN will fail at runtime. **Recommendation:** 05-03 should also note the expected `badge.tsx` variants as a pre-flight check (already-scaffolded file, so just read it); 05-05 acceptance should grep `destructive` in `badge.tsx` OR fall back to `variant="outline"` with a destructive token.

- **LOW — Wave-2 inherits 05-02 shape risk silently.** 05-04 and 05-05 both `import type { Kpis, InitiativeHealth, Filters } from "@/lib/overview/selectors"`. If 05-02's actual exported interface deviates (e.g. `InitiativeHealth.initiative` typed as `Initiative` instead of `Initiative | null`), both Wave-2 plans fail to typecheck, requiring a Wave-1 re-do. The interface block in the plans is correct, so this is mostly theoretical, but: **recommendation:** add a post-Wave-1 gate verifying `selectors.ts` exports match the declared interfaces byte-for-byte (already the tsc check) before spawning Wave-2.

## 4. Suggestions

- Add to 05-02 a single explicit test asserting `rollupInitiativeHealth` emits one row per **every** input initiative (incl. zero-project) plus a conditional trailing Unassigned row — this inverts the current phrasing ambiguity into a green test.
- Extract `PRIORITY_LABELS` either into `selectors.ts` and import (small sacrifice of "duplication is intentional") OR specify the exact key/value set in each plan's interface block so all three local copies (Timeline existing, 05-04 KpiCards, 05-05 dialog header, 05-05 FilterBar) agree without drift.
- Resolve the `resolveRange` vs FilterBar-clears-other contradiction explicitly:
  - **Preferred:** allow both in URL, `resolveRange` picks custom-over-quarter, and FilterBar does NOT clear the other dimension on write. This is more flexible (you can paste any URL into the address bar) and the resolveRange logic isn't dead. Update 05-05's action to delete the "clears vice-versa" sentence.
  - **Alternative:** enforce mutual exclusion in URL explicitly — then `resolveRange` precedence branch should be guarded with a comment "unreachable via FilterBar; defensive only — verify assertion by 05-05 test."
- Add an acceptance criterion to 05-05 FilterBar requiring ≥4 interactive control groups (initiative, status, priority, time range) plus 1 "Clear filters" affordance, each with an explicit `aria-label` (D-05-06 Path B compensator).
- Add to 05-03 a pre-flight read of `badge.tsx` confirming the `destructive` variant exists, so 05-05's SyncBadge doesn't RED on a missing variant.
- 05-06 acceptance criteria checks `grep -n "applyFilters" and "computeKpis" and "rollupInitiativeHealth"` — strengthen with `grep -c` returning exactly ≥1 each and verifying they run in the right order (decodeFilters → resolveRange → applyFilters → computeKpis) via a comment/whitespace-free assertion (e.g. `head -n` ordering check is overkill; a `ts-blank` test file that imports OverviewPage and asserts property wiring exists is impossible without a render harness, so the comment+grep is the pragmatic bar — flag it as such).
- The 05-06 human-verify checkpoint is well-formed but missing an explicit step 7: run `pnpm build` locally (the acceptance includes `CI=true npx vite build` but a human eye should confirm the production bundle contains no `fetch()` to `/api/linear/*` outside the already-existing live-mode hook). A `rg "fetch\(.*api/linear"` smoke would harden the zero-network guarantee.

## 5. Risk Assessment

**Overall: LOW-MEDIUM.** The phase goals are achievable, the wave ordering is sound, and the OV-04 seam is technically correct. The HIGH-flagged contract contradiction is a single-sentence fix that doesn't require restructuring — it's a documentation inconsistency, not an architectural flaw. The MEDIUM concerns (priority label key set, zero-project initiative rows, quarter-range edge cases) are test-gap issues that would surface as either failing RED tests or visual defects caught in the 05-06 human-verify checkpoint — Path B specifically absorbs visual defects. Snapshot-first is genuinely preserved: no plan introduces a network call, and 05-06 explicitly mirrors TimelinePage's loader-guard pattern. The phase will conditionally pass review as-is; I recommend sharpening the three MEDIUM/HIGH items above before granting Wave-2 spawn to reduce the risk that 05-04 + 05-05 execute in parallel against a slightly-off `selectors.ts` contract and both have to relitigate.
