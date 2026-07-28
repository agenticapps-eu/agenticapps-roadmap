## ADDED Requirements

### Requirement: Sibling repos are read from an explicit allow-list

The sync SHALL read plans only from repositories listed in `sync.config.json`.
It SHALL NOT discover repositories by scanning the filesystem, and it SHALL NOT
read a repository absent from the allow-list even when a caller names it
directly.

#### Scenario: Repo present in the allow-list

- **WHEN** the sync runs and `sync.config.json` lists a repo with a readable
  `repoPath`
- **THEN** that repo's OpenSpec changes are read and reconciled

#### Scenario: Repo absent from the allow-list

- **WHEN** a caller passes `--project <name>` for a repo not in
  `sync.config.json`
- **THEN** the sync exits non-zero with an error naming the unknown project
- **AND** no Linear API write is attempted

### Requirement: Changes are the only synced unit of work

The sync SHALL read in-flight work from `<repo>/openspec/changes/` and SHALL NOT
read `<repo>/.planning/`. Capability specifications under `<repo>/openspec/specs/`
SHALL NOT be synced to Linear in any form.

**Rationale**: a capability spec is durable truth, not a work item. Mapping specs
onto issues produces non-actionable Linear records that never close. Both plan
reviewers raised this independently.

#### Scenario: Repo with an OpenSpec slot

- **WHEN** a listed repo contains `openspec/changes/`
- **THEN** each active change directory is read as one unit of in-flight work

#### Scenario: Repo with populated capability specs

- **WHEN** a listed repo contains capabilities under `openspec/specs/`
- **THEN** no Linear record is created, updated, or read for any of them

#### Scenario: Repo still carrying a frozen `.planning/` tree

- **WHEN** a listed repo contains both an `openspec/` slot and a legacy
  `.planning/phases/` tree
- **THEN** only the `openspec/changes/` artifacts are read
- **AND** the `.planning/` tree is left untouched and unreported

### Requirement: An unusable source is a hard error; an empty one is not

The sync SHALL fail loudly when a listed repo cannot supply plans because it is
misconfigured. It SHALL NOT fail when a repo is correctly configured but has no
active work. Every run SHALL report the change count contributed by each listed
repo, including zero.

**Reason for strictness**: the predecessor returned `[]` with a `console.warn`
when a source directory was missing. When `fx-signal-agent` moved its history to
`docs/legacy-planning/`, that arm silently produced no data while the run kept
reporting success, and the regression went unnoticed for weeks. The defect was
indistinguishable success and failure — which per-repo reporting fixes — not the
absence of work itself.

#### Scenario: Listed repo has no OpenSpec slot

- **WHEN** a listed repo has no `openspec/changes/` directory
- **THEN** the sync exits non-zero
- **AND** the error names the repo and the absent path
- **AND** no Linear API write is attempted for any repo in the run

#### Scenario: Repo path does not exist

- **WHEN** a listed `repoPath` does not resolve to a directory
- **THEN** the sync exits non-zero and names the unresolvable path

#### Scenario: Slot present with no active changes

- **WHEN** a listed repo has `openspec/changes/` containing zero active change
  directories, whether because all work is archived or because the slot is newly
  initialised
- **THEN** the sync succeeds
- **AND** reports that repo as contributing 0 changes

#### Scenario: Archived changes are not work

- **WHEN** a listed repo has changes under `openspec/changes/archive/`
- **THEN** those changes are not read as in-flight work
- **AND** they do not cause the repo to be treated as unusable

### Requirement: Identity starts clean and never claims a GSD-era record

The sync SHALL key each Linear issue on a stable identifier derived from the repo
name and the change directory name, written into the issue description under a
marker distinct from the GSD-era `<!--gsd-key:...-->`. It SHALL read issue
descriptions only far enough to CLASSIFY them, and SHALL NOT adopt, update, or
archive any issue carrying a `<!--gsd-key:...-->` marker. New-generation issues
SHALL additionally carry a Linear label distinct from the GSD generation's.

**On the read/classify split**: an earlier draft said the sync "SHALL NOT read"
old-marker issues, which is not implementable — detecting the marker requires
reading the description that carries it. Classification is permitted; acting on
the result is what is forbidden.

**Rationale**: `linear-map.json` holds 77 records keyed to GSD phase identities.
This is a deliberate clean cutover — those records are abandoned in place rather
than translated. Isolation is therefore a correctness requirement, not a
courtesy: without it the new sync would either adopt legacy issues under a
mismatched shape or treat them as orphans.

#### Scenario: First sync of a new change

- **WHEN** a change directory exists in the source with no corresponding Linear
  issue under the new marker
- **THEN** one Linear issue is created, carrying the repo's configured `teamKey`
  and `label` and the new identity marker

#### Scenario: A GSD-era issue exists for similar work

- **WHEN** the Linear team contains an issue carrying a `<!--gsd-key:...-->`
  marker
- **THEN** the sync neither adopts nor modifies it
- **AND** creates its own issue independently if the source calls for one

#### Scenario: Re-sync with no source modification

- **WHEN** the sync runs twice in apply mode against an unmodified source
- **THEN** the second run reports zero creates and zero updates
- **AND** performs no Linear mutation

#### Scenario: Change content modified since last sync

- **WHEN** a change's artifacts have been edited since the previous sync
- **THEN** the corresponding Linear issue is updated in place
- **AND** its stable identifier is unchanged

### Requirement: Reconciliation creates and updates only

The sync SHALL create and update Linear issues. It SHALL NOT archive, close, or
delete them. A change that disappears from the source SHALL leave its Linear
issue untouched.

**Rationale**: `mutations.ts` implements `issueCreate` and `issueUpdate` and no
archive path. Disposal of stale issues is deliberately a human decision and is
out of scope for this change.

#### Scenario: Change removed from the source

- **WHEN** a change directory that was previously synced no longer exists
- **THEN** its Linear issue is left unmodified
- **AND** the run reports it as no longer present in the source

### Requirement: Writing requires `--apply`

The sync SHALL default to dry-run. `--apply` SHALL be the sole opt-in to writing.
`--yes` SHALL only suppress the confirmation prompt and SHALL NOT authorise a
write on its own.

**Rationale**: the predecessor documented `--project X --yes` as writing without
`--apply` (`cli.ts:18`), giving two independent write triggers. One is enough.

#### Scenario: Invoked with no flags

- **WHEN** the sync is invoked without `--apply`
- **THEN** the full create/update plan is printed
- **AND** no Linear API mutation is issued

#### Scenario: Invoked with `--yes` but not `--apply`

- **WHEN** the sync is invoked with `--yes` and no `--apply`
- **THEN** the run is a dry-run and issues no mutation

#### Scenario: Invoked with `--apply`

- **WHEN** the sync is invoked with `--apply` and `--project <name>` for an
  allow-listed repo
- **THEN** the planned mutations are issued after confirmation
- **AND** a summary of applied mutations is printed

#### Scenario: Invoked with `--apply --yes`

- **WHEN** both flags are passed with a single `--project`
- **THEN** the mutations are applied without a confirmation prompt

### Requirement: Writes are scoped to one project per invocation

The sync SHALL NOT write to Linear for more than one project in a single
invocation. A bulk apply across all allow-listed projects SHALL be refused.

#### Scenario: Apply requested without naming a project

- **WHEN** `--apply` is passed with no `--project`
- **THEN** the sync exits non-zero explaining that apply requires an explicit
  project
- **AND** no Linear API write is attempted

#### Scenario: Apply scoped to one project

- **WHEN** `--apply` is passed together with `--project <name>` for an
  allow-listed repo
- **THEN** only that project's mutations are applied
- **AND** other allow-listed projects are untouched
