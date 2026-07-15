---
phase: 06-sync-gsd-linear
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - scripts/sync-gsd-linear/config.ts
  - scripts/sync-gsd-linear/walker.ts
  - scripts/sync-gsd-linear/parser.ts
  - scripts/sync-gsd-linear/hash.ts
  - scripts/sync-gsd-linear/mutations.ts
  - scripts/sync-gsd-linear/dates.ts
  - scripts/sync-gsd-linear/diff.ts
  - scripts/sync-gsd-linear/resolve.ts
  - scripts/sync-gsd-linear/apply.ts
  - scripts/sync-gsd-linear/prompt.ts
  - scripts/sync-gsd-linear/cli.ts
  - scripts/sync-gsd-linear.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-15
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

The `sync-gsd-linear` CLI is well-structured and the two security invariants I was asked to
weigh most heavily hold up: the Linear token stays server-side (read once at the Node boundary
in `cli.ts`, passed only in `Authorization` headers, never logged, never written to
`linear-map.json` or `roadmap.json` — `patchPlanAhead` runs `assertNoLeak` + schema validation),
and every untrusted `.planning/` value passes through GraphQL `$variables` rather than string
interpolation (T-06-01 satisfied — no query body concatenates a slug/heading/key). The
per-project bulk-write guard in `cli.ts` (`matches.length !== 1` → hard error; `--apply`/`--yes`
without exactly one `--project` → hard error) is sound, and no `any` appears in committed code.

The one BLOCKER is against the third NON-NEGOTIABLE invariant — "Never duplicate Linear records —
match by stored id first, title-hash fallback." The title-hash fallback for **issues** is
non-functional in the runtime path: the guarantee is only proven against unit-test fixtures whose
issue titles do not match what `apply.ts` actually writes. Dedup for issues therefore relies solely
on `linear-map.json` being intact. Warnings cover input-validation gaps in the date proposer
(`--anchor`/phase-number NaN paths), fail-soft inconsistencies, and a diff/apply matching gap for
renamed milestones.

## Critical Issues

### CR-01: Issue title-hash dedup fallback is non-functional — duplicate issues on any map gap

**File:** `scripts/sync-gsd-linear/apply.ts:348`, `scripts/sync-gsd-linear/resolve.ts:317-330`, `scripts/sync-gsd-linear/diff.ts:109-121`

**Issue:** The idempotency invariant requires two dedup tiers for every record: stored map id, then a title-hash fallback. For issues, the fallback does not work in production and is validated only by contradictory test fixtures.

- The runtime execution path (`diff.ts:110-113`) matches an existing issue **only** via `issue.identityKey`, and `identityKey` is populated **only** by `withIssueIdentity` (`apply.ts:149-160`) doing a reverse lookup through `map.issues`. There is no title-hash tier in the path that actually decides whether an issue is created.
- The dedicated `resolveIssue` fallback (`resolve.ts:327-329`) compares `titleHash(planKey)` against `titleHash(issue.title)`. For that to match, the Linear issue's `title` must equal the raw plan key. But `apply.ts:348` creates issues with `title: plan.title` (the display heading), never `plan.key`. So the fallback can never fire against a real issue, and `resolveIssue` is not called by the runtime path at all.
- The unit tests that "prove" no-duplicate-on-re-run set the issue title *to the plan key* (`resolve.test.ts:323` and `:483` both use `title: planKey`), which contradicts `apply.ts:348`. The green test gives false confidence that the fallback protects production.

Consequence: dedup for issues depends entirely on `linear-map.json` carrying the id. If the map entry is missing — a crash in the window between the `issueCreate` response and the immediately-following per-create `writeLinearMap` (`apply.ts:355-358`), or a reset/lost/rebased map file — a re-run finds `identityKey: null` for the existing issue, emits `issue-create`, and produces a **duplicate Linear issue**, violating the NON-NEGOTIABLE invariant.

**Fix:** Give issues a real second tier. Simplest option that matches the existing milestone tier (where `name === slug` makes title-hash work): carry the identity key on the issue in a durable, queryable field and match on it in `diff.ts`. For example, prefix/suffix the identity key into the issue description and have `readProjectIssues` (`resolve.ts:240`) parse it back into `identityKey`, then match on it in `diff.ts` regardless of the map:
```ts
// resolve.ts readProjectIssues — recover identity from a description marker
const marker = /<!--gsd-key:([^>]+)-->/.exec(node.description ?? "");
issues.push({ ...node fields, identityKey: marker?.[1] ?? null });
// apply.ts issueCreate — embed the marker so re-runs can recover it map-free
description: `${plan.taskLines.join("\n")}\n\n<!--gsd-key:${plan.key}-->`,
```
(Requires adding `description` to `PROJECT_ISSUES_QUERY`.) If a description marker is undesirable, keep the map-only approach but then correct the docs/tests and drop the dead `resolveIssue` fallback so nothing claims a fallback exists — and explicitly document that map loss causes duplicates.

## Warnings

### WR-01: `comparePhaseNumber` yields NaN ordering for non-numeric phase slugs

**File:** `scripts/sync-gsd-linear/dates.ts:23-35`, `scripts/sync-gsd-linear/parser.ts:125-126`

**Issue:** `parser.ts` sets `number = numberMatch ? numberMatch[1] : raw.slug`, so a phase directory with no leading numeric token (e.g. `intro-notes`) gets `number` = the full non-numeric slug. `comparePhaseNumber` then does `"intro-notes".split(".").map(Number)` → `[NaN]`. Every comparison with `NaN` returns `NaN` (falsy, treated as `0`/unordered) from `aVal - bVal`, so `Array.sort` receives an inconsistent comparator and phase order becomes undefined. Since `proposeDates` assigns cadence dates by sorted position, a mis-sort silently assigns the wrong target date to the wrong phase.

**Fix:** Normalize non-numeric segments to a sentinel and keep the comparator total:
```ts
const num = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : Infinity; };
const aParts = a.split(".").map(num);
const bParts = b.split(".").map(num);
```
Or have `parser.ts` fall back `number` to a stable sortable token (e.g. `"999"`) instead of the raw slug when `NUMBER_TOKEN_RE` misses.

### WR-02: `--anchor` is never validated — invalid input produces `"NaN-NaN-NaN"` target dates

**File:** `scripts/sync-gsd-linear/dates.ts:65-78`, `scripts/sync-gsd-linear/cli.ts:156-166`

**Issue:** `proposeDates` does `new Date(`${anchor}T00:00:00.000Z`).getTime()`. A malformed `--anchor` (e.g. `--anchor xyz`) yields `Invalid Date` → `anchorMs = NaN` → `toTimelessDate(new Date(NaN))` returns `"NaN-NaN-NaN"` (since `getUTCFullYear()` etc. return `NaN`). That string flows into the diff detail and, on a real apply, into `PROJECT_MILESTONE_CREATE`'s `targetDate` (`apply.ts:329`) as a garbage value sent to Linear. The CLI validates `--cadence` (`cli.ts:157`) but not `--anchor`.

**Fix:** Validate the anchor at the boundary:
```ts
if (opts.anchor !== undefined && Number.isNaN(new Date(`${opts.anchor}T00:00:00.000Z`).getTime())) {
  throw new Error(`--anchor "${opts.anchor}" is not a valid YYYY-MM-DD date`);
}
```

### WR-03: Dead / logically-broken `resolveIssue` fallback gives false confidence

**File:** `scripts/sync-gsd-linear/resolve.ts:317-330`

**Issue:** As detailed in CR-01, `resolveIssue`'s title-hash tier (`titleHash(i.title) === titleHash(planKey)`) cannot match a production issue (titled with `plan.title`, not `plan.key`) and is not invoked by any runtime code — only by tests that feed it a contradictory fixture. It reads as a working second dedup tier but is not one. `resolveMilestone` (`resolve.ts:301-315`) is likewise exported but unused by the runtime path (`diff.ts` re-implements milestone matching inline via `findMatchingMilestone`).

**Fix:** Either wire these into the real resolve/diff path (preferred — see CR-01) or delete them and rely on `diff.ts`'s inline matching, so the codebase does not advertise a dedup tier it does not execute.

### WR-04: All-repo preview loop aborts entirely on one misconfigured entry

**File:** `scripts/sync-gsd-linear/cli.ts:194-197`, `scripts/sync-gsd-linear/cli.ts:68-70`

**Issue:** `walkPlanning` deliberately fails soft (warns and returns `[]`) so a missing sibling repo never crashes the run. But the all-repo preview loop calls `buildModel`, which throws when an entry lacks `teamKey` (`cli.ts:69`); `parseRepo` can also throw on schema-parse. The loop has no per-entry `try/catch`, so a single bad config entry aborts the preview of every *other* repo — inconsistent with the walker's stated fail-soft posture and surprising for a read-only preview.

**Fix:** Wrap each iteration so one entry's failure is reported and skipped:
```ts
for (const entry of config) {
  try { await previewProject(deps, entry, map, opts); }
  catch (err) { console.warn(`Skipping "${entry.name}": ${err instanceof Error ? err.message : err}`); }
}
```

### WR-05: Milestone dedup ignores the stored map id — renamed milestones duplicate

**File:** `scripts/sync-gsd-linear/diff.ts:40-47`, `scripts/sync-gsd-linear/apply.ts:313-320`

**Issue:** The runtime milestone match (`findMatchingMilestone`, and the mirror in `apply.ts:317`) matches **only** by `titleHash(m.name) === titleHash(phase.slug)`. It never consults `map.milestones` (unlike issues, which at least use the map). If a milestone is renamed in the Linear UI, `titleHash(m.name)` no longer equals `titleHash(phase.slug)`, so `buildDiff` emits `milestone-create` and a **duplicate milestone** is created even though `map.milestones[`${repo}/${slug}`]` still points at the original. The stored-map-first tier the invariant requires is skipped for milestones in the path that actually decides creation.

**Fix:** Consult the map before the title-hash tier in `findMatchingMilestone` (and the `apply.ts:317` seed), matching by stored id first:
```ts
const storedId = resolved.projectMap?.milestones[`${model.repo}/${phase.slug}`]?.id;
const byId = storedId && resolved.project.milestones.find((m) => m.id === storedId);
return byId ?? resolved.project.milestones.find((m) => titleHash(m.name) === titleHash(phase.slug));
```
(`resolveMilestone` in `resolve.ts` already encodes exactly this order — reusing it, per WR-03, would fix both.)

### WR-06: Dry-run + `--write-snapshot` mutates `roadmap.json` before approval

**File:** `scripts/sync-gsd-linear/apply.ts:383-390`, `scripts/sync-gsd-linear/cli.ts:107-125`

**Issue:** In `applyOneProject`, the `dryRun:true` preview call receives `writeSnapshot: opts.writeSnapshot`, and `applyProject`'s dry-run branch calls `patchPlanAhead` (writing `planAhead: true` into `public/roadmap.json`) **before** the `confirm()` prompt. So `--project X --apply --write-snapshot` mutates the committed snapshot even if the user then answers "N" to the approval gate. The local-file write is not a Linear write, so it does not breach the no-bulk-write invariant, but it violates the least-surprise expectation that declining the prompt leaves state unchanged.

**Fix:** Defer the snapshot patch until after approval — either drop `writeSnapshot` from the preview call in `applyOneProject`, or gate `patchPlanAhead` in the dry-run branch on being an explicit preview (not the pre-approval leg of an apply run).

## Info

### IN-01: Mutation `*Input` interfaces never type the actual calls

**File:** `scripts/sync-gsd-linear/apply.ts:206-224`, `:280-360`

**Issue:** `postGraphQL` takes `variables: Record<string, unknown>`, so the carefully-defined `ProjectCreateInput` / `IssueCreateInput` / etc. interfaces in `mutations.ts` are never applied to the `input` objects passed at the call sites. There is no compile-time guarantee that, e.g., `issueCreate`'s `input` omits a required field or matches the schema. (`teamId: resolved.teamId` at `apply.ts:347` is `string | null` at the type level, only saved at runtime by the guard at `:247-249`.)

**Fix:** Parameterize `postGraphQL` on the input type, or annotate each `input` literal with its `*Input` interface so TypeScript checks shape at the call site.

### IN-02: Plan identity key contains a redundant slug segment

**File:** `scripts/sync-gsd-linear/parser.ts:132-133`

**Issue:** `relativePlanPath = `phases/${raw.slug}/${basename(planFile)}`` already contains the slug, and `key = `${meta.repo}/${raw.slug}/${relativePlanPath}`` prepends it again, yielding `repo/slug/phases/slug/file`. The key is still unique and stable (no correctness impact), but the doubled slug contradicts the documented `repo/phaseSlug/relativePlanPath` shape in `config.ts:83`.

**Fix:** `const key = `${meta.repo}/${relativePlanPath}`;` — the slug inside `relativePlanPath` already disambiguates.

### IN-03: Top-level errors surface as unhandled rejections, not clean CLI output

**File:** `scripts/sync-gsd-linear.ts:1-3`, `scripts/sync-gsd-linear/cli.ts:137`

**Issue:** `runCli` throws for every failure path (missing key, bulk-write guard, GraphQL errors). The entrypoint `process.exit(await runCli(...))` has no `try/catch`, so a throw becomes an unhandled promise rejection with a full stack trace rather than the "fail-fast message" the `cli.ts` header claims. (No token leak — `auth` is never in a thrown message — but the UX is a raw stack.)

**Fix:** Wrap the entrypoint: `catch (err) { console.error(err instanceof Error ? err.message : err); process.exit(1); }`.

### IN-04: `--cadence` accepts zero and negative values

**File:** `scripts/sync-gsd-linear/cli.ts:155-160`

**Issue:** `Number.isFinite(cadenceWeeks)` accepts `0` (all not-completed phases collapse onto the same date) and negatives (dates walk backwards from the anchor). Neither is a meaningful cadence.

**Fix:** Require a positive number: `if (!Number.isFinite(cadenceWeeks) || cadenceWeeks <= 0) throw new Error(...)`.

---

_Reviewed: 2026-07-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
