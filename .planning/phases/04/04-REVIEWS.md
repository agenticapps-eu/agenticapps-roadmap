---
phase: 04
reviewers: [gemini, codex, opencode]
reviewed_at: 2026-07-01T21:31:11Z
plans_reviewed: [04-01, 04-02, 04-03, 04-04, 04-05, 04-06, 04-07]
---

# Cross-AI Plan Review — Phase 04: Roadmap timeline UI

> Reviewers: Gemini CLI, Codex CLI (gpt), OpenCode (glm-5.2). Claude CLI skipped
> (self — review was orchestrated from Claude Code for independence).

## Gemini Review
Here is a review of the implementation plans for Phase 4.

### Overall Assessment

The set of seven plans for Phase 4 is exceptionally well-structured, detailed, and technically sound. The plans demonstrate a deep understanding of the project's architecture, from the data pipeline to the nuances of the frontend stack (React Router 7 loaders, Tailwind v4, shadcn with `base-ui`). The breakdown into waves is logical, ensuring foundational work (data schema, pure utils, UI primitives) is completed before dependent components are built. Security, testing, and backward compatibility are proactively addressed throughout. The risk for this phase is **LOW** due to the meticulous planning, clear mitigation of identified risks, and comprehensive test coverage.

---

### Review of Individual Plans

#### Plan `04-01`: Add `project.url` to Pipeline

*   **Summary**: This plan surgically adds the `project.url` field to the entire data pipeline, from GraphQL query to the final Zod schema, including necessary test updates.
*   **Strengths**:
    *   Excellent isolation of the single data pipeline change as a Wave 1 prerequisite.
    *   Correctly identifies all four required file modifications and the need to update test fixtures.
    *   Crucially enforces backward compatibility by using `z.string().nullish()` in `ProjectSchema` (addresses Pitfall 1).
    *   Highlights the intentional security pattern of an explicit allow-list in `map.ts` and forbids spreading, preventing accidental data leaks (addresses Pitfall 3).
*   **Concerns**: None.
*   **Suggestions**: None. This is a model plan for a surgical data model change.
*   **Risk Assessment**: **LOW**. The changes are minimal, targeted, and well-tested, with a solid strategy for backward compatibility.

---

#### Plan `04-02`: Pure Timeline Utils

*   **Summary**: This plan creates the two pure utility modules for all date/window math and initiative color resolution, developed test-first.
*   **Strengths**:
    *   Follows best practices by separating pure logic from component rendering, enhancing testability and maintainability.
    *   Specifies a TDD approach and provides a comprehensive list of behaviors to test, covering all critical edge cases from the design decisions (D-03 clamping, D-07 short bars).
    *   Wisely avoids adding an external date library for calculations that can be handled by the native `Date` object, preventing unnecessary dependency bloat.
*   **Concerns**: None.
*   **Suggestions**: None. This plan is robust and well-designed.
*   **Risk Assessment**: **LOW**. Pure functions with high unit test coverage are inherently low-risk.

---

#### Plan `04-03`: Scaffold shadcn Components

*   **Summary**: A straightforward plan to run a single `npx shadcn add` command to scaffold the three required UI primitives (`hover-card`, `popover`, `badge`).
*   **Strengths**:
    *   Correctly identifies that this will add **zero new npm dependencies** due to the project's `base-nova` style using the pre-existing `@base-ui/react` package.
    *   Includes a critical verification step to `grep` for `@radix-ui` imports, ensuring no incorrect dependencies are introduced. This is a simple but powerful safeguard.
    *   Properly sequenced in Wave 1 to make these components available for subsequent plans.
*   **Concerns**: None.
*   **Suggestions**: None.
*   **Risk Assessment**: **LOW**. This is a simple, automated scaffolding step with an excellent verification check.

---

#### Plan `04-04`: Popover Leaves (Content + Marker)

*   **Summary**: This plan builds the two innermost UI components: the shared `ProjectPopoverContent` body and the `MilestoneMarker` diamond.
*   **Strengths**:
    *   Good "inside-out" construction, building the leaf components first.
    *   Excellent security posture. The plan explicitly calls for rendering the Linear link with `rel="noopener noreferrer"` and a `url.startsWith("https://linear.app/")` prefix guard as defense-in-depth against open redirects or XSS (T-04-01, T-04-02).
    *   The component contract for `ProjectPopoverContent` is detailed and directly implements all requirements of D-09.
    *   The `MilestoneMarker` plan correctly addresses visual specifics (diamond shape, `title` attribute) and the cluster-collapse requirement.
*   **Concerns**: None.
*   **Suggestions**: None.
*   **Risk Assessment**: **LOW**. These are presentational components with well-defined props and strong security considerations.

---

#### Plan `04-05`: Interactive Primitives (Pill + Bar)

*   **Summary**: This plan builds the core `UndatedPill` and `ScheduledBar` components, which wrap the popover content with the appropriate hover/tap triggers.
*   **Strengths**:
    *   Correctly implements the D-08 responsive trigger pattern, using `window.matchMedia` inside a `useEffect` hook to avoid SSR errors (Pitfall 5).
    *   The `ScheduledBar` logic correctly consumes the `barPosition` utility and handles all special rendering cases for clamping (D-03) and short bars (D-07).
    *   Dependencies are well-managed, consuming the utils from `04-02` and the leaves from `04-04`.
*   **Concerns**:
    *   (LOW) The implementation complexity of `ScheduledBar` is high, as it combines positioning logic, clamping cues, milestone rendering, and popover triggers. This is an inherent complexity of the feature, not a flaw in the plan. The plan correctly identifies all the required pieces.
*   **Suggestions**: None. The plan accurately captures the component's complexity.
*   **Risk Assessment**: **LOW**. While the implementation is complex, the plan itself is sound and relies on pre-built, tested utilities.

---

#### Plan `04-06`: Assembly (Axis, Lane, Page)

*   **Summary**: The final assembly plan that combines all previous components into the complete `TimelinePage`, including handling loading, empty, and error states.
*   **Strengths**:
    *   Shows an expert-level understanding of React Router 7 by correctly placing the loading state skeleton UI into the root `HydrateFallback` (`RoadmapBoundaries.tsx`) rather than the page component itself. This is a critical and subtle detail for correct loader behavior.
    *   Comprehensively covers all final assembly requirements: lane sorting, responsive scrolling (`min-w-[840px]`), and rendering the specified empty and error states.
    *   Includes a detailed `human-check` verification step, which is essential for validating the visual and interactive fidelity of a complex UI feature.
*   **Concerns**: None.
*   **Suggestions**: None.
*   **Risk Assessment**: **LOW**. This plan is primarily about assembling tested components, and the final manual verification step mitigates integration risks.

---

#### Plan `04-07`: Gated Snapshot Re-run

*   **Summary**: A manual, non-autonomous plan to re-run the snapshot script with a user-provided API key to populate the `project.url` field.
*   **Strengths**:
    *   Excellent handling of a process involving secrets. It is correctly marked as non-autonomous and a `checkpoint:human-verify`.
    *   Provides clear, step-by-step instructions for the user on how to perform the action and verify the result.
    *   Includes a crucial fallback path: the action can be deferred, and the application will degrade gracefully (by omitting the link), ensuring the phase remains shippable.
*   **Concerns**: None.
*   **Suggestions**: None.
*   **Risk Assessment**: **LOW**. The plan design is very safe. The main risk is user error during the manual step, which is mitigated by clear instructions.

---

## Codex Review

## Summary

Overall, the phase plan set is strong: it decomposes Phase 04 into sensible waves, starts with the `project.url` pipeline reach-back required by D-13, isolates pure timeline math before UI assembly, and explicitly covers the core TL-01..TL-04 requirements. The main risks are around date/window edge behavior, UI interaction complexity being specified without automated coverage, and a few dependency/order mismatches between “autonomous” plans and generated/scaffolded or human-verified work. I would treat this as implementable with moderate risk after tightening a few contracts.

## Strengths

- **Good sequencing of foundations before UI.** `04-01` handles D-13 data availability, `04-02` isolates date/color logic, `04-03` scaffolds UI primitives, and later plans consume those outputs.
- **D-13 is handled carefully.** `04-01` correctly avoids client-side URL reconstruction, preserves the explicit mapper allow-list, uses `url: z.string().nullish()`, and adds leak-gate coverage.
- **Pure date/color utilities are test-first.** `04-02` creates a clean testable layer for D-01, D-02, D-03, D-07, and D-11.
- **Security posture is explicit.** `ProjectPopoverContent` in `04-04` guards `project.url` with `https://linear.app/` and uses `rel="noopener noreferrer"`.
- **Undated work is first-class.** `04-05` and `04-06` preserve D-04’s left parking rail, which is important because most projects are undated.
- **Empty/loading/error states are included.** `04-06` explicitly covers D-12, including replacing the root loading fallback with skeleton swimlanes.
- **Human-token boundary is acknowledged.** `04-07` correctly marks snapshot regeneration as non-autonomous because `LINEAR_API_KEY` is required.

## Concerns

- **HIGH: `04-02` date math may encode ambiguous or incorrect off-window semantics.**  
  The plan says entirely-before-window returns `clampedLeft=true` and “effective width <= 0”, while entirely-after returns `left=100%, width=0`. Consumers then render stubs. That can work, but the `barPosition` return shape does not explicitly distinguish “entirely before” from “zero-duration in-window” or “bad inverted range.” A caller inferring from `width <= 0` is brittle.

- **HIGH: `04-05` asks for milestone clustering “within 12px” without giving the component enough layout information.**  
  `MilestoneMarker` gets `leftPercent`, not actual pixel positions or grid width. `ScheduledBar` cannot reliably collapse markers within 12px unless it measures the rendered bar/grid or converts percent to pixels from a known width. This is likely to be hand-wavy or skipped.

- **HIGH: `04-03` depends on `npx shadcn add`, but the environment may not permit network or writes in some execution contexts.**  
  The plan is correct conceptually, but “autonomous: true” is risky if the CLI fetches registry content or mutates package metadata. It should include a fallback to copy from the installed/verified registry output or explicitly make this a checkpoint if network is unavailable.

- **MEDIUM: Wave/dependency ordering is slightly inconsistent.**  
  `04-07` is wave 2 and depends only on `04-01`, while `04-04` is also wave 2 and depends on `04-01`/`04-03`. That is fine technically, but `04-07` verification asks to open a scheduled project popover and confirm the link appears, which depends on `04-04` through `04-06`, not only `04-01`.

- **MEDIUM: `04-06` claims an error state in `TimelinePage`, but actual loader errors likely route to `RoadmapError`.**  
  If `useRouteLoaderData("root")` is null, returning null does not display “Could not load timeline data.” The plan should clarify what condition triggers the page-level error state versus root error boundary behavior.

- **MEDIUM: Accessibility coverage is thin for interactive bars/pills.**  
  `04-05` wraps visual elements as popover triggers but does not require keyboard focusability, semantic buttons, `aria-label`s for project names, or Escape/dismiss behavior verification. Base UI helps, but the trigger element must still be accessible.

- **MEDIUM: Touch/hover detection can cause hydration/render swap quirks.**  
  The `isTouch=false` initial state means touch devices initially render HoverCard, then swap to Popover after effect. Since this app is SPA/static, risk is limited, but there may be interaction flicker and duplicated logic in both `UndatedPill` and `ScheduledBar`.

- **MEDIUM: Dark-mode color contrast is underspecified.**  
  `04-05` uses raw initiative colors and `${color}cc`; text contrast is based on the original color. This may fail on tinted/dark surfaces, especially yellow/orange and fallback colors. TL-04 asks for dark mode, so visual QA should explicitly check contrast.

- **LOW: The “Factiv lane ordered” expected human-check conflicts with the stated lane ordering.**  
  `04-06` says sort by scheduled-count desc then name asc. With zero scheduled projects, alphabetical ordering among Callbot, Factiv, fx-signals would likely be Callbot, Factiv, fx-signals. The human-check expects `agenticapps-workflow, cPARX, Callbot, Factiv, fx-signals`, which matches that, but make sure casing/localCompare behavior is deterministic.

- **LOW: `04-04` uses a literal arrow glyph in “Open in Linear ↗”.**  
  This is acceptable in UI copy if already specified, but if the repo is ASCII-oriented, use a lucide external-link icon or confirm non-ASCII is acceptable.

- **LOW: Snapshot URL population criteria in `04-07` is weaker than the truth.**  
  It says URLs for each scheduled/dated project, but D-13 fetches `Project.url` for all projects. The acceptance criterion `>= 1` is pragmatic but does not prove the pipeline populated all expected projects.

## Suggestions

- Add an explicit `BarPosition` discriminant in `04-02`, for example `placement: "normal" | "clamped-start" | "clamped-end" | "before-window" | "after-window" | "target-only"`. This will make `04-05` less dependent on interpreting `width <= 0`.

- Move `04-07` verification that requires the popover link until after `04-06`, or split it:
  - after `04-01`: regenerate snapshot and verify schema/leak gate
  - after `04-06`: verify rendered link appears in the popover

- Add a reusable `ProjectPopoverTrigger` or `ResponsiveProjectPopover` wrapper instead of duplicating hover/tap branching in both `UndatedPill` and `ScheduledBar`. That reduces risk around D-08 and keeps Base UI prop corrections in one place.

- Tighten accessibility acceptance in `04-05`:
  - triggers are keyboard focusable
  - project name is available as accessible label
  - popovers can be opened by keyboard where applicable
  - clamp cue icons are either meaningful with labels or hidden if decorative

- Replace milestone “within 12px” clustering with a simpler first pass unless measurement is implemented. For this phase, either cluster by same `targetDate`/same percent bucket or defer pixel clustering to a later polish task.

- Add a lightweight component/render test for `TimelinePage` if the test setup supports React Testing Library. At minimum, assert all initiatives render, undated pills render, and scheduled bars are present.

- Strengthen `04-07` acceptance to verify URL count equals `projects.length` after regeneration, unless Linear can return missing URLs. If graceful omission is desired, document why fewer is acceptable.

- In `04-06`, clarify error ownership:
  - loader failure: `RoadmapError`
  - empty data: page empty state
  - live unavailable notice: existing loader notice/banner pattern

## Risk Assessment

**Overall risk: MEDIUM.**

The plans are complete enough to achieve TL-01 through TL-04 and they respect D-01 through D-13. The highest risks are not architectural; they are implementation precision risks in the timeline geometry, responsive popover behavior, and visual/accessibility verification. D-13 is well-contained and low risk. The UI assembly is more fragile because it depends on several newly created components, generated shadcn files, Base UI prop details, and manual visual QA. Tightening the bar-position contract, popover wrapper, and `04-07` dependency semantics would bring the phase closer to low risk.

---

## OpenCode Review (glm-5.2)

# Cross-AI Plan Review — Phase 04: Roadmap Timeline UI

## Summary

This is a well-structured, research-backed plan suite that systematically delivers TL-01..TL-04 through 7 plans across 4 waves. The plans correctly treat D-13 (the only non-UI work) as a distinct early pipeline change, separate test-backed pure-function foundations (04-02) from the UI primitives, and defer the token-gated snapshot re-run (04-07) behind a human gate. The decision-to-plan traceability is strong, the surgical-edit discipline (explicit allow-list in `mapWorkspace`, `z.string().nullish()` for backward compat) shows genuine understanding of the pipeline's security design, and the wave/`depends_on` ordering is coherent. Primary risks are concentrated in three areas: (a) the two scheduled projects both fall outside the July 2026 window, so D-03 clamping is the *only* bar-rendering path actually exercised by real data — meaning the "normal" un-clamped bar path is visually untested in real data until projects get dated; (b) 04-07's blocking human gate with `autonomous: false` is correctly modeled, but its `wave: 2` placement creates an implicit critical path that the wave numbering doesn't surface clearly; and (c) several plans rely on `pnpm typecheck` as the only automated gate for component work, leaving visual fidelity to a single human-check in 04-06. Overall confidence is HIGH; the phase is shippable even if 04-07 is deferred (the popover link degrades gracefully), which is exactly the right resilience design.

---

## Strengths

**04-01 (D-13 pipeline)**
- **Correctly identified as the critical-path precursor.** The `url` field cannot be reconstructed client-side (D-13, confirmed via SDK type inspection showing `url: string` vs `slugId: string` as distinct fields). Threading it through `MAIN_QUERY → map → transform → schema` in one plan is the right granularity.
- **Honors the explicit allow-list security design.** Grep gate `grep -c "\.\.\.proj" scripts/linear/map.ts` returns 0 (Task 1) structurally prevents regressions of the spread anti-pattern.
- **Backward-compatible schema choice is precise.** `z.string().nullish()` (not `.string()`, not `.nullable()`) is the only Zod v4 spelling that tolerates both absent *and* null — defended against in Pitfall 1/2 with explicit reasoning.
- **PII-safety is proven, not asserted.** Task 3's `assertNoLeak(...url...).not.toThrow()` test turns the "URL is PII-safe" claim into a falsifiable assertion. The `https://linear.app/` URL form matches neither `TOKEN_RE` nor `EMAIL_RE` — verified against actual regex source.

**04-02 (pure math foundation)**
- **Test-first on the branch matrix is the right TDD shape.** The behaviors enumerate all three D-03 clamp branches (before-left, entirely-before, entirely-after), D-07 width-0, today==0, and the normal in-window case. This is genuine red-green, not "tests written after."
- **No date library.** Explicit anti-pattern guard (`grep -c "date-fns\|dayjs\|luxon\|moment"` returns 0) enforces the simplicity-first decision for a 7-month fixed window.
- **Symmetric clamping is an improvement over early drafts.** The plan now handles entirely-after-window (clamp `effectiveStart → windowEnd`, left=100%, width=0, clampedRight) — RESEARCH.md's original Pattern 1 only handled left-clamping. Good catch.
- **Color fallback determinism is underspecified enough to be simple, specified enough to be stable.** Lexicographic sort of null-color ids + modulo palette index gives reproducible output without randomness.

**04-03 (shadcn scaffold)**
- **Zero-new-deps is verified, not assumed.** Dual grep gates (no `@radix-ui` imports; no `@radix-ui` in package.json) catch a wrong-style fetch early. This matters because shadcn@4.11.0 *could* fall back to default Radix style if the registry resolution misfires (RESEARCH A2).
- **Defers `openDelay`/`closeDelay` prop verification to the consumer (04-04/05).** Correct — the scaffold shouldn't be edited, and the prop naming uncertainty (RESEARCH A1) is a consumer concern, not a scaffold concern.

**04-04 (popover leaves)**
- **Defense-in-depth on the external link is appropriately layered.** `url` is pipeline-sourced + leak-gated (04-01) *and* prefix-guarded (`startsWith("https://linear.app/")`) *and* `rel="noopener noreferrer"`. Each layer independently blocks a class of abuse (open redirect, opener access, future data anomaly).
- **Milestone omission when `targetDate === null` is explicit** (D-10), addressing the subtle fx-signals M8 case from RESEARCH Open Question 3 — pills won't show milestone markers, only bars do.
- **Tailwind v4 token guard is explicit.** `grep -c "text-muted-foreground\b"` returns 0 prevents the v3→v4 bare-token regression (the project uses `text-(--color-muted-foreground)`).

**04-05 (bars + pills)**
- **`matchMedia` inside `useEffect` (Pitfall 5) is grep-enforced** — `grep -c "useEffect"` >= 1 guards against module-level `window` access.
- **D-07 special case is correctly distinguished from percentage width.** Fixed 64px right-aligned bar, separate from the normal `width: ${width}%` path (Pitfall 4).
- **Cluster collapse for <12px milestone overlap is a real UX concern**, not over-engineering — with 2 scheduled projects and sparse milestones it rarely triggers, but it's the correct behavior if it does.

**04-06 (assembly)**
- **The loading-state refinement is accurate for React Router 7.** Recognizing that `TimelinePage` doesn't mount during suspension and the skeleton belongs in `RoadmapLoading` (the root `HydrateFallback`) is a non-obvious correctness point — a naive plan would have put the skeleton in the page body and gotten a blank screen.
- **Factiv zero-project lane is handled** (header-only collapse, not hidden) — RESEARCH Pitfall 6.
- **Human-check covers the verifiable fidelity surface** (7 specific assertions: columns, ordering, clamping, pills, popover, dark mode, responsive, skeleton).

**04-07 (snapshot re-run)**
- **`autonomous: false` + `checkpoint:human-verify` + `gate="blocking"` correctly models the token dependency.** This is the one plan that genuinely cannot run headlessly.
- **Graceful deferral is built into the contract.** "If the token cannot be provided: leave roadmap.json as-is (link omitted) and record 'deferred'." The phase's UI ships regardless — correct resilience boundary.
- **Leak-gate re-verification post-run** (`grep -c 'lin_api_'` returns 0) closes the loop on T-04-03.

**Cross-cutting**
- **Decision-to-plan traceability is explicit in every `must_haves.truths`** — each plan names the D-IDs it satisfies, making the review auditable.
- **Threat models are per-plan, not boilerplate** — each registers the threats relevant to its surface (T-04-01 link spoofing follows the link from 04-04 → 04-05 → 04-06; T-04-M1 mapWorkspace tampering is scoped to 04-01).
- **Phase is shippable if 04-07 is deferred** — the entire D-13 nullish-graceful-degradation design pays off here.

---

## Concerns

### HIGH

**C1 — Wave numbering obscures 04-07's true position.** 04-07 is `wave: 2` and `depends_on: ["04-01"]`, while 04-04 (popover) is `wave: 2` and depends on 04-01+04-03. 04-04 builds the link-rendering code path (`startsWith("https://linear.app/")`) but the link is dead until 04-07 runs. This isn't *wrong* (degradation is intentional), but the wave numbers suggest parallelism that doesn't exist semantically — 04-07 populates the data 04-04's link consumes. Consider demoting 04-07 to `wave: 4` (matching 04-06) or making the deferral intent more prominent in 04-04's `must_haves` (e.g., "link omitted when url is null — populated by 04-07"). As-is, a reader might assume 04-07 is a quick parallel task rather than the token gate.

**C2 — The "normal" un-clamped bar path is untested against real data.** RESEARCH confirms both scheduled projects (AgenticApps Roadmap, cPARX Prototype) fall outside the July 2026 window — one starts-before-clamped-left, the other is entirely-before (32px stub). So D-03 clamping is the *only* bar-rendering code path exercised by `roadmap.json`. The 04-02 unit tests cover the normal branch synthetically (Task 1 behavior: "fully inside window → left>0, width>0, clamped=false"), but 04-06's human-check never sees an un-clamped bar. If the normal-path CSS (percentage `left`/`width`, text visibility at `width < 48px`, marker positioning) has a visual bug, the human gate won't catch it until projects get dated or the window shifts. No action strictly required (unit tests cover the math), but flag for future regression risk once `LINEAR_API_KEY` enables dating more projects.

### MEDIUM

**C3 — `openDelay`/`closeDelay` prop verification is deferred but the acceptance criteria don't enforce it.** RESEARCH A1 flags these as ASSUMED prop names on base-ui PreviewCard v1.6.0. 04-05 Task 1's action says "verify the actual base-ui delay prop names ... before committing" — but *no acceptance criterion* checks it. If the props are actually `delay`/`openDelayAndCloseDelay`/etc., the 300ms/200ms timing silently won't apply (HoverCard opens instantly). Add a criterion: "HoverCard accepts the delay props without TypeScript error; if prop names differ, update the UI-SPEC and document the divergence." Low blast radius (timing only), but it's a documented assumption left unverified.

**C4 — `barPosition` return value for D-07 conflates two meanings of `width: 0`.** When `startDate === null`, the function returns `width: 0` *and* `left: rightPct` (the right-edge position), but for a normal in-window bar `width: 0` would mean zero-duration. The caller (04-05 ScheduledBar) must branch on `startDate === null` before interpreting `width === 0` as "render 64px fixed bar." This coupling isn't named in the `barPosition` interface docstring or in 04-05's acceptance criteria. If a future refactor interprets `width === 0` as "nothing to render," the D-07 bar disappears. Suggest adding a `fixedWidth: boolean` (or `kind: "fixed" | "span"`) return discriminator to make the contract explicit.

**C5 — 04-06 broadens scope into `RoadmapBoundaries.tsx` (HydrateFallback skeleton) without a separate `depends_on` or verification.** The skeleton upgrade is bundled into Task 3 alongside the page assembly, but `RoadmapBoundaries.tsx` is a root-level component affecting *all* routes during loader suspension, not just Timeline. A bug in the skeleton affects OverviewPage too. The `pnpm build` gate catches type/compile errors but won't catch a visual regression on the Overview route's loading state. Suggest either (a) splitting the skeleton change into its own task with its own human-check, or (b) adding to the human-check: "Navigate to Overview and throttle; confirm skeleton doesn't regress on Overview." Scope is justified (D-12 requires it), but the verification surface is narrower than the blast radius.

**C6 — Lane-ordering tiebreak assumes `initiative.name` is stable and present.** UI-SPEC § Lane Ordering: scheduled-count desc, then name asc. But RESEARCH shows initiative colors include `null` — does the `initiative.name` field have analogous nullability? The schema isn't cited. If a future initiative has `name: null`, the asc-sort throws or sorts unpredictably. The plan doesn't guard it. Low likelihood (Linear names are required), but the plan should assert `initiative.name` non-null in the schema or sort defensively.

### LOW

**C7 — No explicit test for `resolveInitiativeColor` determinism across *different* initiative orderings.** The 04-02 Task 2 behavior asserts "same input yields same output across repeated calls," but the function takes `allInitiatives` as a parameter — if a caller passes the array in a different order (one call `[A, B, C]`, another `[C, B, A]`), does the same null-color initiative still map to palette[0]? The lexicographic-sort-by-id logic says yes, but there's no test asserting order-independence of the *input array*. Add: "assert the same initiative resolves to the same color regardless of `allInitiatives` array order."

**C8 — Issue-counts bar "all-zero" branch is described in 04-04 prose but not in acceptance criteria.** Action text: "all-zero → single muted bar." Criterion missing. If `issueCounts = {backlog:0, started:0, done:0}`, a naive `width = count/total*100` divides by zero. The plan handles it in prose but doesn't gate it — a future refactor could regress to NaN width. Add a criterion or a 04-04 unit test for the zero-total case. (Note: 04-04 is a presentational component with `pnpm typecheck` as its only automated gate, so this would need a manual or added-test check.)

**C9 — 04-03 verifies scaffold correctness but not that it compiles against *consumer* usage.** 04-03 gates on `pnpm typecheck`, but typecheck passes even if the scaffolded component's props don't match what 04-04/04-05 expect (e.g., shadcn exports `HoverCardContent` but the consumer expects `HoverCardContent` with different prop names). The integration is only verified when 04-04 runs. Acceptable (04-04 depends on 04-03), but if 04-03 lands in isolation a consumer mismatch surfaces late. Consider an integration smoke in 04-03: `import { HoverCardContent } from "./hover-card"` compiles. Minor.

**C10 — `lucide-react` version drift (1.21.0 installed vs 1.22.0 registry) is noted in RESEARCH but not gated.** ChevronLeft/Right icons from lucide-react are used in 04-05. If `ChevronLeft` was renamed/removed in the gap, 04-05 typecheck fails late. RESEARCH already verified the icons exist; no action beyond awareness. Flagging only because the version skew is real and untested.

**C11 — Empty-state emoji "📅" baked into JSX isn't in acceptance criteria.** Cosmetic, but if the design system later rejects emoji (some do), there's no grep gate. Trivial.

---

## Suggestions

- **S1 (04-02):** Add a `kind: "span" | "fixedEnd" | "stub"` discriminator to `barPosition`'s return contract (C4). Eliminates the `width === 0` ambiguity between D-07 (64px fixed) and D-03-entirely-before (32px stub). Makes the ScheduledBar caller's branching explicit and refactor-safe.
- **S2 (04-04):** Add an acceptance criterion (or unit test) for the issue-counts all-zero case (C8): "`issueCounts` total of 0 renders a single muted bar, not a NaN-width or empty fragment."
- **S3 (04-05):** Add an acceptance criterion enforcing that the HoverCard delay props compile (C3): "HoverCard/HoverCardContent accept the delay props without TypeScript `Property does not exist` error; if base-ui uses different prop names, the divergence is documented in 04-05-SUMMARY.md."
- **S4 (04-06):** Split the `RoadmapBoundaries.tsx` change into its own task OR extend the human-check to "confirm the skeleton doesn't regress on OverviewPage during throttled load" (C5). The skeleton is root-scoped; verify it doesn't break non-Timeline routes.
- **S5 (04-07):** Consider `wave: 4` (or a non-numeric `gate: human` marker) to better reflect that this is the token gate on the critical path for the *link functionality*, even though the UI degrades gracefully (C1).
- **S6 (04-06):** Add a defensive guard or schema assertion that `initiative.name` is non-null before the lane-order sort (C6) — or document that Linear guarantees it.
- **S7 (04-02 colorUtils):** Add an order-independence test (C7): resolve the same null-color initiative with `allInitiatives` passed in two different orders; assert identical output.
- **S8 (cross-cutting):** The phase gate is `pnpm test && pnpm typecheck && pnpm build`. No component-render test (RTL/jsdom) exists for the timeline — visual fidelity rests entirely on the 04-06 human-check. Given 5 lanes × 16 projects × clamp/dash/dark-mode branches, a single smoke RTL render test (asserting all 5 lanes render, Factiv header-only, Callbot has 9 pills) would catch structural regressions cheaply. Not required, but the human-check is a thin gate for this much UI surface.

---

## Risk Assessment

**Overall risk: LOW-MEDIUM** (leaning LOW)

**Justification:**
- **Architecture risk: LOW.** Pure-function/leaf-component/assembly separation is textbook. Dependencies form a clean DAG (01→07, 02→05→06, 03→04→05→06); no cycles; wave numbering is internally consistent apart from C1.
- **Data-pipeline risk: LOW.** D-13 is additive, backward-compatible (`nullish`), leak-gate-tested (04-01 Task 3), and explicitly disconnected from the token gate (04-07 is human-deferrable without blocking UI ship).
- **Security risk: LOW.** Layered defense on the external link (pipeline source + assertNoLeak + prefix guard + noopener+noreferrer). No new auth surface. Token stays server-side/env-side; 04-07 re-verifies the leak gate post-run.
- **Scope risk: LOW.** Plans are tight; no extraneous features. C5 (RoadmapBoundaries scope creep) is the only borderline inclusion, and it's justified by D-12.
- **Verification risk: MEDIUM.** The phase leans heavily on `pnpm typecheck` for component correctness and a single 04-06 human-check for visual fidelity. The two scheduled-data quirks (C2: no un-clamped bar exercised; C4: D-07 return ambiguity) mean real-data visual coverage of the "normal" path is deferred until more projects are dated. A single RTL smoke test (S8) would materially de-risk this.
- **Deferral risk: LOW.** 04-07's graceful-deferral contract means the phase ships cleanly even if the Linear token isn't available this session — the popover link omits and D-13's nullish schema tolerates it. This is well-designed resilience.

The plans achieve the phase goals: initiative swimlanes (04-06), scheduled bars with clamping (04-05 + 04-02), undated backfill pills (04-05 + 04-06), milestone markers + popover + Linear link (04-04 + 04-05 + 04-07), color-by-initiative with fallback (04-02 + 04-06), and responsive/dark-mode/states (04-06). C1–C2 are the highest-priority items to address (clarity + future-data risk); C3–C6 are worth tightening; C7–C11 are polish.

---

## Consensus Summary

**Overall verdict:** All three reviewers agree the plan suite is strong, well-sequenced,
and achieves TL-01..TL-04 / D-01..D-13. Risk ratings: **Gemini LOW · OpenCode LOW–MEDIUM
(leaning LOW) · Codex MEDIUM.** No reviewer flagged a blocker to shipping; the concerns are
implementation-precision and verification-depth, not architecture.

### Agreed Strengths (2+ reviewers)
- **D-13 pipeline discipline** — explicit `mapWorkspace` allow-list (grep-gated against `...proj` spread), `z.string().nullish()` for backward compat, and a falsifiable `assertNoLeak` URL test. (all 3)
- **Clean wave sequencing** — data/util/primitive foundations before UI assembly; dependencies form a clean DAG. (all 3)
- **Test-first pure utils (04-02)**, no date library. (all 3)
- **Layered link security** — pipeline leak-gate + `startsWith("https://linear.app/")` prefix guard + `rel="noopener noreferrer"`. (all 3)
- **Loading skeleton in the RR7 root `HydrateFallback`** (not the page body) — a subtle correctness win. (Gemini, OpenCode)
- **04-07 graceful, non-autonomous token gate** — UI ships even if the snapshot re-run is deferred (link omits when `url` is null). (all 3)

### Agreed Concerns (highest priority first)
- **[HIGH — 2 reviewers] `barPosition` return-shape ambiguity (04-02/04-05).** `width === 0` conflates D-07 (fixed 64px bar, no startDate) with D-03 clamp stubs / zero-duration; the caller branches brittlely on `width <= 0`. **Fix:** add a discriminator to the return contract, e.g. `kind: "span" | "fixedEnd" | "stub"` (Codex + OpenCode S1). This is the single most-recommended change.
- **[MEDIUM — 2 reviewers] 04-07 wave-2 placement vs semantic dependency.** Its "open a scheduled popover and confirm the link" verification actually depends on 04-04..06, not just 04-01; the wave number implies parallelism that isn't real. **Fix:** demote 04-07 to wave 4 (or a non-numeric `gate: human` marker), or split it — regenerate+leak-verify after 04-01, verify the rendered link after 04-06 (Codex + OpenCode C1/S5).
- **[MEDIUM — 2 reviewers] Thin automated UI coverage.** Component work is gated only by `pnpm typecheck`; visual/structural fidelity rests on a single 04-06 human-check. **Fix:** add one lightweight RTL/jsdom smoke render test (assert all 5 lanes render, Factiv header-only, Callbot pill count, scheduled bars present) — cheap insurance for 5 lanes × 16 projects × clamp/dark branches (Codex + OpenCode S8).
- **[MEDIUM — 1–2 reviewers] base-ui `openDelay`/`closeDelay` props deferred but not enforced.** RESEARCH marked these `[ASSUMED]`; if the real prop names differ the 300/200ms timing silently no-ops. **Fix:** add a 04-05 acceptance criterion that the delay props compile without a TS error, and document any divergence (OpenCode C3; Codex notes base-ui prop fragility).

### Divergent Views (worth a decision)
- **04-03 `npx shadcn add` autonomy.** Codex rates it **HIGH risk** — an autonomous task that fetches from the registry / mutates package metadata may fail where network or writes are restricted, and suggests an offline fallback or a checkpoint. Gemini & OpenCode instead praise the zero-dep grep gates and see it as **LOW**. → Decide whether the execution environment has network access; if uncertain, add a fallback/checkpoint to 04-03.
- **Un-clamped "normal" bar path is untested against real data (OpenCode C2, unique).** Both current scheduled projects are off-window, so `roadmap.json` only exercises the D-03 clamp paths; the normal percentage-width bar is covered only by synthetic 04-02 unit tests until more projects get dated. Not blocking — flag for regression risk once `LINEAR_API_KEY` enables dating.
- **Accessibility depth (Codex MEDIUM, unique).** Codex wants keyboard focusability, semantic button triggers, `aria-label`s, and Escape-dismiss verification on pills/bars; the others didn't raise it. Cheap to add to 04-05 acceptance criteria.

### Recommendation
Fold the two HIGH/MEDIUM consensus items (barPosition discriminator; 04-07 wave/verification split) and, ideally, the RTL smoke test + base-ui delay-prop criterion into the plans before executing:

```
/gsd:plan-phase 04 --reviews
```

Then `/gsd:execute-phase 04`.
