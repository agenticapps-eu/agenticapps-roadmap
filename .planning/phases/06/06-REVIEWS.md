---
phase: 6
reviewers: [gemini, codex, opencode]
reviewed_at: 2026-07-15
plans_reviewed: [Octal,Permissions Size,User Date,Modified Name,0644 .rw-r--r--@,11k donald,15 Jul,12:10 06-01-PLAN.md,0644 .rw-r--r--@,9.2k donald,15 Jul,12:11 06-02-PLAN.md,0644 .rw-r--r--@,7.2k donald,15 Jul,12:12 06-03-PLAN.md,0644 .rw-r--r--@,9.0k donald,15 Jul,12:26 06-04-PLAN.md,0644 .rw-r--r--@,9.8k donald,15 Jul,12:13 06-05-PLAN.md,0644 .rw-r--r--@,10k donald,15 Jul,12:14 06-06-PLAN.md,0644 .rw-r--r--@,13k donald,15 Jul,12:27 06-07-PLAN.md]
self_skipped: claude (running inside Claude Code CLI)
---

# Cross-AI Plan Review — Phase 6 (sync-gsd-linear CLI)

> Three independent external AIs reviewed the 7 plans. Risk verdicts diverged sharply
> (Gemini LOW · OpenCode MEDIUM-LOW · Codex HIGH), which is itself signal: the plans are
> strong on research, security, and wave-ordering, but two reviewers independently found
> the Wave-1 **contracts** (issue identity, plan body, diff-covers-all-writes, apply-mode
> truth table) under-specified in ways that could surface during execution.

---

## Gemini Review

This is an excellent and thorough set of implementation plans. The approach is sound, research-driven, and prioritizes safety and correctness.

### 1. Summary

This is a comprehensive and exceptionally high-quality set of implementation plans. The planning process demonstrates a deep understanding of the problem domain, achieved through thorough upfront research that uncovered critical, non-obvious requirements from both the filesystem structure and the Linear GraphQL API. The plans are broken down logically into five waves, ensuring foundational work like schemas and test fixtures are built first. Security, idempotency, and error handling are not afterthoughts but are woven into the core design of each component, with clear, testable acceptance criteria. The resulting CLI should be robust, safe, and precisely meet the project's success criteria.

### 2. Strengths

*   **Research-Driven:** The plans are built on a solid foundation of research (`RESEARCH.md`) that identified crucial edge cases (e.g., duplicate/decimal phase numbers, two separate Linear label pools, required `teamId`). This preemptively de-risks the implementation.
*   **Test-First Approach:** Wave 1 is dedicated to creating schemas, contracts, and a comprehensive set of test fixtures, including a mock mutation server. This enables a rigorous TDD workflow for all subsequent, more complex components.
*   **Security by Design:** Security is a core consideration. The plans include specific mitigations for GraphQL injection (variable-only queries), API key leakage (`assertNoLeak` reuse, env-var-only access), and unintended writes (a hard gate against bulk updates, dry-run by default).
*   **Idempotency Focus:** The "resolve-before-create" pattern is central to the design, and the plans include a specific integration test using a mock server to prove that a second `apply` is a no-op, directly validating a key success criterion.
*   **Logical Phasing (Waves):** The work is sequenced logically, from contracts (Wave 1) to core logic (Waves 2-3), to the write path (Wave 4), and finally to integration and verification (Wave 5). Dependencies are clear and correct.
*   **Clarity and Detail:** Each plan has specific, verifiable tasks with clear acceptance criteria. The link between requirements (SYNC-01..04) and the work is explicit.

### 3. Concerns

*   **LOW: `fx-signal-agent` Onboarding:** The research correctly identifies that the `fx-signal-agent` repo has pre-existing, non-conformant milestones (`M7`, `M8`). Plan `06-07` notes this as a manual step/caveat. While the plan is to handle this via documentation and manual seeding of `linear-map.json`, there's a small risk of user error during the first run. The tool could potentially be made safer by detecting this state (e.g., finding existing milestones with no matching hash and a name that doesn't fit the slug pattern) and forcing an explicit choice from the user, but this is a minor point and the current plan is acceptable.
*   **LOW: CLI Argument Ambiguity:** Plan `06-07` describes a scenario where `--project` might match zero or multiple entries and correctly specifies it should throw an error. It also specifies a multi-repo *preview* is possible with a `--project`-less dry run. The logic to handle all combinations (`--project <name>`, no `--project`, `--dry-run`, `--yes`) correctly is subtle. While the plan seems to cover it, the implementation in `cli.ts` will need to be very careful to avoid bugs in this argument-parsing logic. The test plan for `cli.test.ts` is crucial here and seems to cover the key cases.

### 4. Suggestions

*   **Enhance `fx-signal-agent` Safety:** Consider adding a "reconciliation mode" to the CLI for the `fx-signal-agent` case. When the resolver finds existing milestones in Linear that don't match the slug-based hash but seem related (e.g., based on a less strict name match), instead of creating duplicates, it could prompt the user to associate them, automatically seeding the `linear-map.json`. This would turn the current manual documentation-based step into a safer, tool-assisted workflow. This could be considered a follow-on improvement if the manual approach proves difficult.
*   **Clarify Multi-Project Dry-Run Output:** For the `--project`-less dry-run preview (Plan `06-07`), ensure the output is clearly delineated per-project. A simple header like `--- Diff for project: claude-workflow ---` before each `renderDiff` output would improve readability significantly when multiple repos are being previewed.
*   **Add `--config` and `--map` flags:** The paths `sync.config.json` and `linear-map.json` are currently hardcoded. For improved flexibility and testing, consider adding CLI flags (`--config <path>`, `--map <path>`) to allow overriding their locations. This is a minor "nice-to-have".

### 5. Risk Assessment

**Overall Risk: LOW**

**Justification:**
The risk for this phase is exceptionally low for a project that involves writing data to an external production system via its API. This assessment is based on:
1.  **Thorough De-risking:** The upfront research has identified and planned for the most significant technical risks (API quirks, inconsistent source data formats).
2.  **Robust Safety Mechanisms:** The design defaults to safety. The `--dry-run` default, the interactive `y/N` prompt for every write, and the hard-coded guard against bulk-project writes are all strong mitigations against accidental or unintended operations.
3.  **Comprehensive Test Strategy:** The plan includes unit tests for all logical components and, crucially, an automated integration test for the core idempotency requirement using a mock server. This significantly increases confidence that the "re-run is a no-op" success criterion will be met.
4.  **Manual Verification Gate:** The final plan (`06-07`) includes a `checkpoint:human-verify` step, ensuring a human reviews the output against the live system before the phase is considered complete. This acts as a final safety net.

The few remaining concerns are minor and relate to user experience and onboarding specific edge-case repos, not to the fundamental correctness or safety of the CLI's operation. The plans are a model of how to safely and effectively build a tool of this nature.

---

## Codex Review

## Summary

The plans are unusually well researched and thoughtfully decomposed, but they are not implementation-ready. Several cross-plan contracts make issue resolution impossible, the CLI’s apply mode is ambiguous or unreachable, and the diff does not represent every mutation that the apply engine may perform. Those gaps directly threaten all three success criteria—especially idempotency and “dates confirmed before any write.” I recommend revising the Wave-1 contracts and the CLI/apply architecture before execution.

## Strengths

- Direct inspection of the three real repositories uncovered important structural cases: duplicate phase numbers, decimal phases, generic headings, missing frontmatter, and inconsistent completion signals.
- Linear schema research correctly identified required team IDs, separate ProjectLabel/IssueLabel pools, and the initiative join mutation.
- The per-project approval boundary, environment-only token, GraphQL variables, and default read-only behavior are sound security principles.
- Pure walker/parser/date/diff modules with injected `fetch` should be straightforward to test.
- The stateful mutation fixture and live human checkpoint are appropriate for proving idempotency without routinely writing production data.
- Scope is generally disciplined: no two-way sync, browser behavior, deployment, or unnecessary dependencies.
- The explicit `fx-signal-agent` M7/M8 caution is valuable and prevents a foreseeable first-run duplication incident.

## Concerns

- **HIGH — The issue-resolution model cannot work as specified.** `ResolvedProject` contains milestones but no issues, while `resolveIssue` and `buildDiff` expect issue IDs/titles. The existing Linear read path retains only issue workflow state—not ID, title, milestone, or labels. Project labels are also absent from the existing `RawProject`. Consequently, issue deduplication and the second-run no-op cannot be implemented using the declared contracts.

- **HIGH — Plan-file identity and content are lost.** `NormalizedPlan` only contains `{file, title}`, but apply says the issue description comes from task/checklist lines. Those lines are discarded by the parser. In addition, generic headings fall back to the phase slug; multiple generic `NN-MM-PLAN.md` files in one phase would therefore receive the same title and title hash, collapsing distinct issues.

- **HIGH — The apply mode is contradictory or unreachable.** Plan 06-07 says `--dry-run` defaults to true and a dry run stops before prompting, but it defines no `--apply` or `--no-dry-run` flag. The documented command `--project claude-workflow` is described both as a dry run and as an interactive apply command. The CLI needs an explicit mode truth table before implementation.

- **HIGH — The displayed diff is not the approved write set.** `DiffSummary` only covers milestones, issues, and dates, while apply may create two labels, a project, an initiative join, milestones, issues, and snapshot/map writes. This allows hidden writes after an apparently empty or incomplete diff. It undermines “every write approved.”

- **HIGH — There is a diff/apply time-of-check gap.** The CLI builds and prints a diff, then `applyProject` performs another resolve and builds another diff. If Linear changes between those reads, the mutations can differ from what the user approved. Apply should consume the exact approved operation plan, or abort and re-display when state has drifted.

- **HIGH — “Upsert” currently means mostly “create.”** The plans declare update mutations, and the diff counts changed dates, but 06-06 only clearly creates missing milestones and issues. It never explicitly applies `PROJECT_MILESTONE_UPDATE` for an existing mismatched date. Label attachment, issue milestone repair, initiative membership, and other update ownership are also undefined. Success criterion 3 is therefore only display-level, not write-level.

- **HIGH — Initiative and label idempotency is incomplete.** The configured initiative appears to be a name, but no name-to-ID resolver or existing-join check is defined. Calling the join repeatedly violates the no-op requirement; skipping it for existing projects leaves the desired association absent. Label map IDs are written but `resolveLabels` does not use them, and existing resolved records are not clearly backfilled into the map.

- **MEDIUM — Pagination and candidate scoping are insufficient.** Existing reads cap projects at 50 and milestones at 25. The issue read is paginated but lacks dedup fields. Exact label-name queries can also return a label belonging to another team. Accurate diffs need target-specific, paginated reads containing project labels, initiative membership, milestone details, and issue identity fields.

- **MEDIUM — Canonical map keys are unspecified.** The plans do not define stable keys for projects, milestones, issues, or the two label pools. `--project` also lacks a clear config key because entries only have paths and optional display names. Ambiguous key construction will cause inconsistent lookup/write-back across modules.

- **MEDIUM — Partial failure recovery is not addressed.** Map persistence occurs after the apply returns. If project and several milestones are created before a later mutation fails, their IDs may never reach disk. Title/label fallback may recover, but that is not tested. Writes should be resumable and local state should be persisted atomically.

- **MEDIUM — `planAhead` behavior is undefined and partly unreachable.** The plans never define the boolean precisely. Writing the pre-apply diff result would leave `planAhead: true` after a successful sync; post-apply state should normally be false. Moreover, CLI dry-run stops before `applyProject`, so `--write-snapshot` cannot exercise the dry-run snapshot path described in D-06-09. Matching snapshot projects by name is also fragile; Linear ID is safer.

- **MEDIUM — Completion and ordering have edge cases.** Using `every()` over zero `NN-MM-PLAN.md` files could falsely mark a bare-`PLAN.md` phase complete. Duplicate numeric phase prefixes compare equal, leaving date ordering dependent on filesystem enumeration. Anchor and cadence validation, timezone meaning of “today,” and invalid/negative cadence handling are not planned.

- **MEDIUM — Validation does not fully prove the success criteria.** The manual accuracy check examines only `claude-workflow`; the phase criterion refers to the target repositories. There are no planned tests for stale map IDs, ambiguous matches, partial failure/restart, a changed existing date followed by a no-op rerun, multiple generic plans in one phase, or an empty diff causing zero writes.

- **LOW — Wave metadata is inconsistent.** The roadmap places 06-04 in Wave 2, while its plan declares Wave 3. This is harmless if intentional but should be reconciled.

- **LOW — Some foundation work is premature.** A full mutable GraphQL mock and all transient resolved-state interfaces are placed in Wave 1 before the real read/operation contracts are settled. This risks building a mock that validates the planned abstraction rather than actual Linear behavior.

## Suggestions

1. Revise the Wave-1 contracts before implementation:

   - Give every config entry an explicit unique `key`.
   - Add canonical identity keys such as `repo/phaseSlug/relativePlanPath`.
   - Add plan `description` or `checklistMarkdown`.
   - Add detailed resolved issues with ID, title, project ID, milestone ID, and label IDs.
   - Add initiative membership and project-label information.
   - Define a discriminated `SyncOperation` union representing every possible write.

2. Separate display titles from identity. Use the relative plan path as stable identity. For a generic numbered plan, derive its display title from the filename; only a single bare `PLAN.md` should fall back to the phase slug.

3. Build a `planSync()` stage that produces an immutable operation list. Render that complete list, prompt for approval, and apply exactly that list. If preconditions have changed, abort and print a new diff.

4. Define an explicit CLI truth table. A safe option is:

   | Invocation | Behavior |
   |---|---|
   | no flags / `--dry-run` | all-repo read-only preview |
   | `--project X --dry-run` | one-project read-only preview |
   | `--project X --apply` | print operations, then prompt |
   | `--project X --apply --yes` | explicit non-interactive apply |

   If the locked `--project X` command must itself mean apply, document that exception clearly and test every flag combination.

5. Extend the Linear read surface before writing the resolver. Use paginated target-specific queries that expose all fields required for deduplication. Treat ambiguous label/title matches and stale IDs as fail-closed conditions rather than choosing the first result.

6. Define sync ownership. At minimum, existing milestone target dates must be updated after approval. Decide explicitly whether issue titles, descriptions, milestone placement, project labels, and initiative membership are authoritative or create-only.

7. Make recovery part of idempotency:

   - Persist all resolved IDs, not only newly created IDs.
   - Write the map atomically.
   - Test a failure halfway through apply followed by a clean rerun.
   - Verify the second run issues zero mutations of every kind, including labels, joins, and date updates.

8. Define `planAhead` as a function of the operation plan. During `--write-snapshot` dry-run it should reflect current divergence; after a successful apply, re-resolve and write the post-apply value. Patch by unique Linear project ID and ensure later `sync:snapshot` runs preserve or recompute the flag.

9. Expand the final gate to review dry-run output for all three target repositories. Apply only a reconciled safe project twice; keep `fx-signal-agent` dry-run-only until its seed map is confirmed.

## Risk Assessment

**Overall: HIGH.** The decomposition, research, and security posture are strong, but the current contracts cannot support issue deduplication, the apply command is not well-defined, and the approved diff can diverge materially from the mutations executed. As written, success criterion 1 is only partially verified, criterion 2 cannot be reliably demonstrated, and criterion 3 does not guarantee that approved date changes are actually applied. Revising the Wave-1 identity/read/operation contracts should reduce the phase to MEDIUM risk without requiring a major scope expansion.

---

## OpenCode Review

# Cross-AI Plan Review: Phase 6 — sync-gsd-linear CLI

## 1. Summary

This is a high-quality, aggressively well-researched plan set. The research phase did something genuinely valuable — live GraphQL introspection against Linear's production schema and direct filesystem inspection of the three real target repos — and the plans faithfully translate the non-obvious findings (two label pools, required `teamIds`, duplicate-`NN` and decimal-phase directory collisions, frontmatter-optional plans) into concrete, TDD-structured tasks with a clean 5-wave dependency graph. The interface-first `06-01` approach (define every Zod schema + contract type + fixture set before any behavior code) is exactly right for a multi-module pipeline where downstream stages must compose against fixed shapes. There is one architectural tension I view as a real risk — the plans build a parallel in-memory mock GraphQL server in `linear-mutation-mock.ts` and lean on it heavily for the idempotency proof, which is the single most important success criterion — and a handful of smaller concerns around default-vs-explicit flag semantics, the `--write-snapshot` gate having two independent triggers, and a couple of edge cases the research flagged but the plans don't fully close. Overall this is in the top tier of GSD plans I've reviewed and is ready to execute with the fixes below.

## 2. Strengths

- **Research-grade grounding.** Every Linear mutation field name is `[VERIFIED: live introspection]`, and every filesystem quirk is grounded in direct inspection of the three named target repos. The plans don't speculate where the research already proved.
- **Interface-first wave ordering (06-01).** Defining `SyncConfigSchema`/`LinearMapSchema`/`NormalizedModelSchema` + all `Resolved*`/`DiffSummary` contracts + the three fixture sets in Wave 1 means Waves 2-4 build against frozen types. The `files_modified` lists confirm every downstream plan imports from `config.ts`.
- **Honest handling of the real-repo quirks.** Walker keys on the full directory slug (never bare number); parser carries a generic-H1 denylist with a slug fallback; `dates.ts` explicitly forbids `parseFloat` and requires component-wise segment comparison (`04.2` < `04.10`); completion heuristic is layered and biased toward the safer false-"not-complete" direction.
- **Two-pool label discipline baked in.** `resolveLabels` returns `{projectLabelId, issueLabelId}` and queries both `projectLabels` and `issueLabels`; the threat register calls out the silent-no-op failure mode. This is the single most likely silent corruption vector and it's handled correctly.
- **Team resolution is front-loaded and fail-closed.** `resolveTeam` throws a clear `Linear team "<key>" not found` before any create; `projectCreate`/`issueCreate` can't reach the "required `teamIds`/`teamId`" failure that RESEARCH Pitfall 4 warns about.
- **The bulk-write guard is enforced in code, not docs.** `cli.ts` Task 2 behavior explicitly permits `--project`-less ONLY when dry-run, and hard-requires exactly one resolved entry on the apply path with the same error string for absent/multi/zero-match. This satisfies the CLAUDE.md hard constraint and the `--project-less apply --yes → error` test is in the acceptance set.
- **Resolve-before-create is structural, not aspirational.** Every `applyProject` entity goes through the three-step lookup; the mutation-mock "re-resolve after create finds the existing id" test (06-05 Task 2, 06-06 Task 1) is the right idempotency primitive.
- **planAhead patch reuses the audited gate.** `assertNoLeak` + `RoadmapJsonSchema.parse` are imported, not reimplemented; the test asserts a token-bearing object throws before `writeFileSync`.
- **Zero new dependencies.** `node:util.parseArgs`, `node:readline/promises`, `node:crypto`, existing `zod`/`tsx`/Vitest. Package Legitimacy Gate is correctly n/a.
- **Human-verify checkpoint is scoped, not theatrical.** 06-07 Task 3 names the exact commands, calls out the fx-signal-agent M7/M8 caution from RESEARCH Open Question 2, and requires the developer to confirm both VALIDATION.md manual items before close.

## 3. Concerns

### HIGH

- **C1 — The idempotency proof rests entirely on a self-built mock that must match real Linear semantics.** `linear-mutation-mock.ts` (06-01 Task 2) is an in-memory workspace whose create handlers "append + return server id" and whose read side answers the same `fetchFn`. The 06-06 idempotency test asserts "second run creates nothing" *against that mock*. This is only as trustworthy as the mock's fidelity to Linear's actual create/label/edge behavior — and RESEARCH's own Assumption Log (A3) admits "only field *names* were introspected, not runtime create behavior." If the mock, say, lets a second `projectCreate` with the same name silently create a duplicate (Linear's real API will happily create a same-named project if you ask it to — name is not unique), then the test passes green against a mock that's hiding exactly the bug the phase is meant to prevent. **Mitigation:** the mock must reject-or-ignore duplicate creates by the same resolve keys the real CLI uses (map → label → title-hash), AND the human-verify checkpoint (06-07 Task 3 step 5) must be treated as blocking — not optional — for closing SYNC-04 success criterion #2. The plans already have the blocking gate; consider adding a non-circumventable note that the mock test is a *logic* test and the live re-run is the *contract* test.

- **C2 — The "second apply is a no-op" promise depends on write-back to `linear-map.json` succeeding atomically, but the plan has no ordering/robustness spec for the write-back.** `writeLinearMap(path, map)` is `writeFileSync(JSON.stringify(map, null, 2))` (06-06 Task 1). If the process dies between a successful `projectCreate` and the map write, or if the write corrupts (disk full, concurrent editor), the next run won't find the stored id and will create a duplicate — because *stored id* is step 1 of resolve, and the label/hash steps only catch it if the label was applied and the name/title-hash matches. **Mitigation:** (a) write the map to a temp file then `rename` (atomic on POSIX) — one extra line, worth it given this is the dedup primitive; (b) explicitly state in 06-06's must_haves that map write-back happens *immediately after each successful create*, not batched at the end, so a mid-run crash's blast radius is one duplicated record, not all of them. The current plan's "After each create, write the new id" language is good but doesn't mandate atomic write.

### MEDIUM

- **C3 — `--write-snapshot` is defined in two places with slightly different gate semantics.** 06-06 Task 2 says `patchPlanAhead` runs "when `!opts.dryRun` OR `opts.writeSnapshot === true`" — i.e., a dry-run *with* `--write-snapshot` would patch roadmap.json. 06-07 Task 2 passes `{dryRun:false, writeSnapshot:args['write-snapshot']}` only on approval, so the apply path itself implies the snapshot patch happens regardless of the `--write-snapshot` flag. This creates ambiguity: is `--write-snapshot` a "force patch even in dry-run" flag, or a "patch on apply" flag that's redundant with the apply itself? CONTEXT D-06-09 says "only on a real apply / an explicit `--write-snapshot`" — implying `--write-snapshot` is a separate trigger from apply. **Fix:** pick one model and state it in both plans. The cleaner reading is: patch fires on `(real apply) OR (dry-run AND --write-snapshot)` — i.e., `--write-snapshot` is the escape hatch to light the badge without writing to Linear. Make 06-07 pass `writeSnapshot` to `applyProject` on *every* call (not only approval) so the dry-run-with-snapshot path actually reaches `patchPlanAhead`.

- **C4 — `promoteDates` / `proposeDates` output mutates the input model, and the diff's `datesToChange` count depends on that mutation being visible to `buildDiff`.** 06-04 Task 1 returns `NormalizedPhase[]` with `proposedDate` set; 06-04 Task 2 `buildDiff(model, resolved)` compares "phases whose `proposedDate` differs from the resolved milestone's `targetDate`". This requires the *same* model instance that `proposeDates` mutated to be passed into `buildDiff`. The pipeline in 06-07 Task 2 shows `proposeDates(...) -> buildResolvedWorkspace -> buildDiff` but doesn't explicitly pass the dated model into `buildDiff`. **Fix:** make the data flow explicit: `const dated = proposeDates(model.phases, {anchor, cadence}); const resolved = await buildResolvedWorkspace(...); const diff = buildDiff({...model, phases: dated}, resolved);`. Or make `proposeDates` return a new array (non-mutating) — which is safer and matches the "pure computation" threat-model claim.

- **C5 — The apply stage doesn't reconcile existing milestones/issues that *do* match but have drifted `targetDate` or title.** `buildDiff` counts `datesToChange` (06-04 Task 2), and 06-06 exports `PROJECT_MILESTONE_UPDATE`/`ISSUE_UPDATE` via 06-03 — but 06-06 Task 1's behavior only describes the *create* path ("ensure each milestone ... PROJECT_MILESTONE_CREATE"). There's no documented behavior for: an existing milestone whose `targetDate` differs from `proposedDate` — does apply patch it via `PROJECT_MILESTONE_UPDATE`, or leave it? The date is "proposed ... shown for confirmation" (D-06-06), so a real apply presumably should write the proposed date. **Fix:** add an explicit "update existing milestone's `targetDate` when `datesToChange > 0` and the change was in the confirmed diff" behavior to 06-06 Task 1, or explicitly state "v1 only creates; existing records are never updated by the apply engine" (valid simplification, but must be stated so the `datesToChange` count isn't misleading the human reviewer into thinking writes will happen).

### LOW

- **C6 — Schema for `NormalizedPlan.title` doesn't constrain the generic-H1 denylist.** 06-01's `NormalizedPlanSchema` is `{file, title}` (string). The denylist logic lives in `parser.ts` as ad-hoc regex (`/^Phase \d+/`). If a fourth repo later has a different generic heading (`# Plan`, `# TODO`), the parser silently uses the slug. **Fix:** put the denylist in one exported `const GENERIC_H1_DENYLIST: RegExp[]` in `config.ts` so it's discoverable and doesn't get duplicated.

- **C7 — `--project` matching semantics are undefined.** "matches zero or multiple entries" — matches on what? `repoPath`? `label`? a short name? The config entry has `repoPath` (e.g. `../claude-workflow`) and `label` (e.g. `roadmap:claude-workflow`). The developer will type `--project claude-workflow`, not the full path. **Fix:** specify the match key in 06-07 Task 2 (suggest: a `name` field on `SyncConfigEntry` derived from the `repoPath` basename, or match against `label.replace(/^roadmap:/, '')`).

- **C8 — Hard-coded AGE team key in `sync.config.json` with no documented override path.** The seed (06-01 Task 3) puts `teamKey: "AGE"` on all three entries; RESEARCH Assumption A1 flags this. The schema (06-01 Task 1) correctly makes `teamKey` per-entry, so per-override *is* possible — but there's no test for "a config entry with a different `teamKey` resolves a different team." **Fix:** add one resolve test (06-05) using a second team key to prove the per-entry override works, closing Assumption A1.

- **C9 — Error handling for Linear API rate limits / transient failures is absent.** RESEARCH notes 5,000 req/hr, 3,000,000 complexity/hr and "no throttling concern at this scale." Fine for v1, but a single `projectMilestoneCreate` failure mid-apply (transient 5xx) would leave the map half-written under the current flow. **Fix:** at minimum, a `catch` around the mutation loop that logs "apply incomplete: <entity> failed, map written with N records, re-run to continue" — so the operator knows the run was partial. The atomic map write (C2 mitigation) bounds the damage to "re-run picks up where it left off."

- **C10 — `description` for issues ("the plan's task checklist") has no extraction spec.** 06-06 Task 1 says "description built from the plan's task lines" but 06-02 `parseRepo` only extracts `title` per plan (it does *not* carry the task body into the normalized model — `NormalizedPlan` is `{file, title}`). So the apply engine has no access to task lines unless it re-reads the PLAN.md file. **Fix:** either (a) add a `body?: string` (or `taskLines: string[]`) field to `NormalizedPlanSchema` populated by the parser, or (b) have `applyProject` re-read the plan file. Option (a) is cleaner (the parser already has the file open); the apply stage should stay pure-ish over the model.

## 4. Suggestions

1. **Make the mutation-mock fidelity explicit (C1).** Add to 06-01 Task 2's `linear-mutation-mock.ts`: a create handler that first runs the same resolve-keys check the real CLI uses and *returns the existing id* (not a new one) on a dup, rather than blindly appending. This makes the idempotency test meaningful rather than tautological.

2. **Atomic map write-back (C2).** Replace `writeFileSync(path, JSON.stringify(map, null, 2))` with `writeFileSync(tmp, ...); renameSync(tmp, path)` in `writeLinearMap`. One-line robustness upgrade for the dedup primitive.

3. **Non-mutating `proposeDates` (C4).** Return a new `NormalizedPhase[]` rather than mutating in place; thread it explicitly through the pipeline in 06-07. Keeps the "pure computation" threat-model claim honest and makes the data flow visible.

4. **State the update-vs-create decision (C5).** Either add `PROJECT_MILESTONE_UPDATE` / `ISSUE_UPDATE` calls to `applyProject` for date changes, or add a must_have to 06-06: "v1 scope: apply only creates; it does not mutate existing Linear records' dates or titles. `datesToChange` is informational only and shown in the diff." Pick the latter (simpler, matches "Simplicity First") but *say so*.

5. **Carry plan body in the model (C10).** Add `taskLines: string[]` to `NormalizedPlanSchema`, populate in `parser.ts`, and concatenate into the issue description in `applyProject`. Keeps the apply stage from re-reading files.

6. **Resolve `--write-snapshot` semantics (C3) in one place.** Document in 06-06 Task 2: "patchPlanAhead fires when `(dryRun === false) OR (writeSnapshot === true)`", and in 06-07 Task 2 pass `writeSnapshot: args['write-snapshot']` through on both branches so the dry-run-with-snapshot path reaches the patcher.

7. **Document `--project` matching (C7).** Add `name` to `SyncConfigEntry` (e.g., `name: "claude-workflow"`) and match on it; reflect it in `SyncConfigSchema` (06-01 Task 1) and the seed `sync.config.json` (06-01 Task 3).

## 5. Risk Assessment

**Overall: MEDIUM-LOW.** The plans are unusually well-grounded (live schema introspection + real filesystem inspection) and the wave graph is correctly ordered with interface-first contracts. The core mechanism — resolve-before-create across all six entity types with two-pool label handling and required team resolution — is sound and directly satisfies SYNC-02 and the idempotency half of SYNC-04. The bulk-write guard is enforced in code. There are no dependency-ordering issues.

The residual risk is concentrated in two places: (1) the idempotency *proof* depends on a self-built mock whose fidelity to real Linear semantics is asserted, not verified (C1) — mitigated by the blocking human-verify checkpoint, but the mock should be tightened so it can't pass green while hiding a duplicate-create bug; (2) the map write-back robustness (C2) — mitigated by the resolve-before-create fallback but should be made atomic. The remaining concerns areLow/Medium cleanup issues that don't threaten phase completion.

All three phase success criteria are achievable from these plans: #1 (dry-run accuracy) is covered by 06-02/06-04 + the 06-07 live verify; #2 (idempotent apply) is covered by 06-05/06-06 logic + the 06-07 live re-run; #3 (dates confirmed before write) is covered by 06-04 date proposal + the 06-07 approval gate. Execute after addressing C1, C2, and clarifying C3/C5.

---

## Consensus Summary

**Risk verdicts:** Gemini **LOW** · OpenCode **MEDIUM-LOW** · Codex **HIGH**. The spread is
the headline finding: all three praise the research grounding and safety posture, but two of
three independently flag that the Wave-1 *contracts* under-specify issue identity and the
write set. The disagreement is about executor latitude — Gemini treats the gaps as detail the
executor fills in; Codex treats them as blocking contract defects; OpenCode lands in between
(execute after fixing the mock + atomic map, clarify the rest).

### Agreed Strengths (2+ reviewers)
- **Research-grounded, not speculative** — Linear write API verified via live GraphQL introspection; every `.planning/` quirk verified against the three real target repos (all three reviewers).
- **Interface-first Wave 1** — schemas + contracts + fixtures frozen before behavior code; downstream waves compose against fixed shapes (Gemini, OpenCode).
- **Security by design** — variables-only GraphQL (injection), `assertNoLeak` reuse + env-only token (leakage), and the bulk-write guard **enforced in code, not docs** (all three).
- **Resolve-before-create idempotency structure** + two-pool (ProjectLabel/IssueLabel) label handling + front-loaded fail-closed team resolution (all three).
- **Zero new dependencies**; blocking human-verify checkpoint for the live wire (Gemini, OpenCode).

### Agreed Concerns (2+ reviewers — priority order)
1. **[HIGH] Wave-1 contracts under-specify issue identity + plan body.** `NormalizedPlan` is `{file, title}` only — task/checklist lines are discarded yet apply uses them for the issue description; the generic-H1→slug fallback collapses multiple plans in one phase to the **same title-hash**; the resolved read surface lacks issue id/title/milestone/label fields needed for dedup. *(Codex HIGH×2; OpenCode C6/C10)* → add `taskLines`/`body` + a stable identity key (`repo/phaseSlug/relativePlanPath`) to the schemas; carry issue identity fields in the read surface.
2. **[HIGH] The printed diff must equal the approved write set; state update-vs-create.** `DiffSummary` covers only milestones/issues/dates, but apply may also create labels + project + initiative join → **hidden writes after an "empty" diff**; and "upsert" currently only *creates* — a drifted existing `targetDate` is never written (`PROJECT_MILESTONE_UPDATE` unused), so success-criterion #3 is display-only. *(Codex HIGH×2; OpenCode C5)* → make apply write the confirmed date updates, **or** state "v1 creates only; `datesToChange` is informational", and make the diff enumerate every mutation.
3. **[MEDIUM] Apply-mode / CLI flag truth table is ambiguous.** No explicit `--apply`/`--no-dry-run`; `--project X` is described as both dry-run and apply; the `--project` match key is undefined (path? label? name?). *(Codex HIGH; OpenCode C7; Gemini LOW)* → add an explicit invocation truth table + a `name` field on config entries to match against.
4. **[MEDIUM] Map write-back robustness + partial-failure recovery.** `linear-map.json` is the dedup primitive but the write is non-atomic and batched — a crash mid-apply loses ids → duplicates on re-run. *(Codex MEDIUM; OpenCode C2/C9)* → atomic temp-file + `rename`; write-back immediately after each successful create; catch mid-apply failure and report partial state.
5. **[MEDIUM] Idempotency proof rests on a self-built mock whose fidelity is asserted, not verified.** The mock could pass green while hiding a duplicate-create bug (real Linear happily creates same-named projects). *(OpenCode C1 HIGH; Codex LOW)* → the mock must reject/return-existing on dup creates keyed the same way the CLI resolves; treat the live re-run checkpoint as the binding contract test, not the mock.
6. **[MEDIUM] `planAhead` / `--write-snapshot` semantics underdefined** and specified in two places with differing gates. *(Codex MEDIUM; OpenCode C3)* → one model: patch fires on `(real apply) OR (dry-run AND --write-snapshot)`; thread `writeSnapshot` through consistently.

### Singleton concerns worth carrying
- **[Codex, HIGH] TOCTOU between the printed diff and apply's re-resolve** — apply should consume the exact approved operation list, or abort + re-display on drift.
- **[Codex, LOW] 06-04 wave metadata** — reconcile any stale ROADMAP annotation (plan is Wave 3).
- **[Gemini/OpenCode] Nice-to-haves** — `--config`/`--map` path overrides; per-project headers in multi-repo dry-run output; a per-entry `teamKey`-override resolve test (OpenCode C8).

### Recommended action
The contract-level gaps (#1, #2, #3) are **cheap to close now, expensive to discover mid-execution**. Recommend a targeted **`/gsd-plan-phase 6 --reviews`** pass to harden the Wave-1 schemas (issue identity + body + config `name`/key), make the diff enumerate the full write set with an explicit create-only-vs-update decision, add the CLI truth table, and tighten the mock + atomic map write-back — rather than deferring these to executor discretion. #4–#6 can be folded into the same pass.
