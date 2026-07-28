## ADDED Requirements

### Requirement: Sibling repos are read from an explicit allow-list

The sync SHALL read plans only from repositories listed in `sync.config.json`.
It SHALL NOT discover repositories by scanning the filesystem, and it SHALL NOT
read a repository absent from the allow-list even when a caller names it
directly.

#### Scenario: Repo present in the allow-list

- **WHEN** the sync runs and `sync.config.json` lists a repo with a readable
  `repoPath`
- **THEN** that repo's OpenSpec artifacts are read and reconciled

#### Scenario: Repo absent from the allow-list

- **WHEN** a caller passes `--project <name>` for a repo not in
  `sync.config.json`
- **THEN** the sync exits non-zero with an error naming the unknown project
- **AND** no Linear API write is attempted

### Requirement: Plans are sourced from OpenSpec, not from `.planning/`

The sync SHALL read in-flight work from `<repo>/openspec/changes/` and durable
current truth from `<repo>/openspec/specs/`. It SHALL NOT read
`<repo>/.planning/`.

#### Scenario: Repo with an OpenSpec slot

- **WHEN** a listed repo contains `openspec/changes/` and `openspec/specs/`
- **THEN** each change directory is read as a unit of in-flight work
- **AND** each capability under `openspec/specs/` is read as current truth

#### Scenario: Repo still carrying a frozen `.planning/` tree

- **WHEN** a listed repo contains both an `openspec/` slot and a legacy
  `.planning/phases/` tree
- **THEN** only the `openspec/` artifacts are read
- **AND** the `.planning/` tree is left untouched and unreported

### Requirement: A missing or empty source is a hard error

The sync SHALL fail loudly when a listed repo cannot supply plans. It SHALL NOT
warn-and-continue, and it SHALL NOT report success for a run in which a listed
repo contributed nothing.

**Reason for strictness**: the predecessor returned `[]` with a `console.warn`
when a source directory was missing. When `fx-signal-agent` moved its history to
`docs/legacy-planning/`, that arm silently produced no data while the run kept
reporting success, and the regression went unnoticed for weeks.

#### Scenario: Listed repo has no OpenSpec slot

- **WHEN** a listed repo has no `openspec/changes/` directory
- **THEN** the sync exits non-zero
- **AND** the error names the repo and the absent path
- **AND** no Linear API write is attempted for any repo in the run

#### Scenario: Listed repo has an empty OpenSpec slot

- **WHEN** a listed repo has `openspec/changes/` containing zero change
  directories and `openspec/specs/` containing zero capabilities
- **THEN** the sync exits non-zero and names the repo as contributing no plans

#### Scenario: Repo path does not exist

- **WHEN** a listed `repoPath` does not resolve to a directory
- **THEN** the sync exits non-zero and names the unresolvable path

### Requirement: Changes and specs map onto Linear deterministically

The sync SHALL map each OpenSpec change to one Linear issue and each capability
spec to one Linear issue, keyed by a stable identifier derived from the repo
name and the change or capability directory name. Re-running the sync against an
unmodified source SHALL produce no Linear writes.

#### Scenario: First sync of a new change

- **WHEN** a change directory exists in the source with no corresponding Linear
  issue
- **THEN** one Linear issue is created, carrying the repo's configured
  `teamKey` and `label`

#### Scenario: Re-sync with no source modification

- **WHEN** the sync runs twice against an unmodified source
- **THEN** the second run reports zero creates, zero updates, and zero archives
- **AND** performs no Linear mutation

#### Scenario: Change content modified since last sync

- **WHEN** a change's artifacts have been edited since the previous sync
- **THEN** the corresponding Linear issue is updated in place
- **AND** its stable identifier is unchanged

### Requirement: Every run is dry-run first

The sync SHALL default to dry-run. Writing to Linear SHALL require an explicit
opt-in flag on the invocation.

#### Scenario: Invoked with no write flag

- **WHEN** the sync is invoked without an explicit apply flag
- **THEN** the full create/update/archive plan is printed
- **AND** no Linear API mutation is issued

#### Scenario: Invoked with the apply flag

- **WHEN** the sync is invoked with the explicit apply flag for a single project
- **THEN** the planned mutations are issued against Linear
- **AND** a summary of applied mutations is printed

### Requirement: Writes are scoped to one project per invocation

The sync SHALL NOT write to Linear for more than one project in a single
invocation. A bulk apply across all allow-listed projects SHALL be refused.

#### Scenario: Apply requested without naming a project

- **WHEN** the apply flag is passed with no `--project`
- **THEN** the sync exits non-zero explaining that apply requires an explicit
  project
- **AND** no Linear API write is attempted

#### Scenario: Apply scoped to one project

- **WHEN** the apply flag is passed together with `--project <name>` for an
  allow-listed repo
- **THEN** only that project's mutations are applied
- **AND** other allow-listed projects are untouched
