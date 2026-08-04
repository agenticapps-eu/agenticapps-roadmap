#!/usr/bin/env bash
# database-sentinel — shim. Resolves the fleet-shared implementation and hands over.
#
# shim-contract: 1.2.0
#
# This file is a SHIM, not an implementation. Editing it changes nothing about
# what the hook enforces; the implementation lives in agenticapps-workflow-core
# at reference-implementations/project-hooks/database-sentinel.sh and is published to
# ~/.agenticapps/bin/ by install-project-hooks.sh. See that directory's
# README.md for the contract this file implements.
#
# Profile: published-resolution (design Decision 17). It resolves a PUBLISHED
# copy, so the two-candidate resolution order and byte-identity across every
# project both bind it.
#
# The other profile is self-hosting: core's own
# .claude/hooks/openspec-change-gate.sh resolves its WORKING-TREE reference
# implementation instead, because ADR-0028 requires core to score the bytes it
# ships rather than whichever host's installer ran last. Resolution order and
# byte-identity cannot apply to it; the contract marker, the behaviour-free rule
# and fail-open-and-report still do.
#
# A hook has exactly ONE self-hosting binder. Two would be two authorities,
# which the project-hook-binding capability's first requirement forbids.

set -u

HOOK="database-sentinel"

# --- resolution -------------------------------------------------------------
# Two candidates, in order. There is deliberately NO third <repo>/bin/ candidate:
# a repo-local copy is the drift this shim exists to remove, and as a fallback it
# would keep the drift while hiding it on exactly the machines nobody checks.

OVERRIDE_VAR="$(printf '%s' "$HOOK" | tr 'a-z-' 'A-Z_')_OVERRIDE"
OVERRIDE="${!OVERRIDE_VAR-}"
SHARED="$HOME/.agenticapps/bin/$HOOK.sh"

# --- reporting --------------------------------------------------------------
# Exit 1, never 2. Per the host's hook contract, an exit code other than 0 or 2
# is a non-blocking error: the transcript shows a "<hook> hook error" notice
# followed by THE FIRST LINE of stderr, and execution continues. Exit 2 would
# block, which is the one thing an unresolvable shim must not do — these hooks
# are registered on broad matchers, so blocking here blocks every command and
# every edit in the repository rather than the narrow thing the hook guards.
#
# The first line therefore has to carry the whole message. Everything after it
# reaches the debug log only.

report() { printf '%s\n' "$@" >&2; }

# The unresolvable-implementation condition is persistent: on an unprovisioned
# machine it holds on every Bash, Edit and Write, indefinitely. Reporting the
# whole notice each time is the alarm fatigue this change rejects elsewhere, so
# the FULL report is limited to once per hour, per hook, per machine.
#
# WHAT THE LIMIT ACTUALLY SAVES IS VERBOSITY, NOT INTERRUPTION, and saying so
# is the correction at contract 1.2.0. The exit code is not suppressible: this
# shim must exit non-zero for stderr to reach the operator at all, so a
# suppressed call still interrupts. The previous revision suppressed the message
# and kept the exit, which produced `hook error — No stderr output` on every
# call after the first — an alarm that fires exactly as often as the message
# would have and tells the operator nothing. Contentless is worse than either
# alternative: worse than reporting, which at least says what broke, and worse
# than silence, which at least does not interrupt.
#
# So a suppressed call still says ONE line, and it says something the full
# report does not — that this is a repeat. Reusing the full report's first line
# would leave the operator unable to tell a repeat from a fresh failure.
#
# ONCE PER HOUR, NOT ONCE PER SESSION, and the reason is recorded rather than
# the option dropped silently (task 2.11a): the session identifier exists only
# in the stdin payload — the host exports no session-id environment variable —
# and a shim that reads stdin to find it has consumed the implementation's
# input. An hour approximates a session closely enough to serve, while
# guaranteeing a long session sees the condition more than once.
#
# AN HOUR BUCKET, NOT A ROLLING HOUR. `epoch/3600` is wall-clock: two calls four
# seconds apart can land in different buckets and both report in full. The
# wording says "this hour" because that is what the arithmetic means.
#
# One marker path, read and written. No tool payload is inspected.
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/agenticapps"
MARKER="$STATE_DIR/$HOOK.unresolved-report"

# REPORT FIRST, THEN MARK. Ordered the other way, a failure between the two
# leaves the marker claiming a notice that was never emitted, and every later
# line this hour refers the operator to something they never saw. A marker write
# that fails therefore suppresses nothing: the shim has no record of having
# reported, and suppressing on the strength of a write that failed suppresses on
# a state that was never recorded.
report_rate_limited() {
  local now last
  now=$(( $(date +%s) / 3600 ))
  last=$(cat "$MARKER" 2>/dev/null) || last=""
  if [ "$last" = "$now" ]; then
    report "$HOOK hook: still not installed at $SHARED — this call was allowed; full notice already made this hour"
    return 0
  fi
  report "$@"
  mkdir -p "$STATE_DIR" 2>/dev/null && printf '%s\n' "$now" > "$MARKER" 2>/dev/null
}

# --- candidate 1: the explicit override -------------------------------------
# An override that is set but unusable does NOT fall through to the shared
# install. Falling through would silently ignore an explicit instruction, and
# the operator who set it would never learn it had no effect.
#
# This report is deliberately NOT rate limited (task 2.11c). The override is a
# kill switch: it is the only signal that a hook has been switched off on an
# otherwise healthy machine, and a rate limit adopted to quiet the benign,
# self-correcting condition above must not also silence it.
#
# REGULAR FILE, not merely `-x`. `-x` on a directory tests the search bit, which
# every ordinary directory has, so `[ -x "$OVERRIDE" ]` alone called a directory
# executable and `exec`ed it — bash then exited 126 with its own "is a directory"
# message, the report below never fired, and the exit code was not the 1 this
# contract states (shim-contract 1.1.0, Stage-2 finding 6).
#
# An override set to the EMPTY STRING is treated as unset and falls through,
# deliberately: `FOO=` is the conventional way to say "no override", not a way to
# name a broken one, so "set" here means set to a non-empty value. Asserted in
# tools/project-hook-shim.test.sh so the reading is a decision, not an accident.
if [ -n "$OVERRIDE" ]; then
  if [ -f "$OVERRIDE" ] && [ -x "$OVERRIDE" ]; then
    exec "$OVERRIDE" "$@"
  fi
  report "$HOOK hook: $OVERRIDE_VAR is set to '$OVERRIDE', which is not an executable regular file — this hook did NOT run, and no fallback was used" \
         "  Unset $OVERRIDE_VAR to use the shared install at $SHARED," \
         "  or point it at an executable implementation."
  exit 1
fi

# --- candidate 2: the shared install ----------------------------------------
# REGULAR FILE HERE TOO — and the omission is Stage-2 finding 6's second half.
# The override branch above was hardened to `-f` and `-x` at contract 1.1.0,
# under a comment explaining that `-x` is true of any searchable directory. This
# candidate kept the bare `-x` eleven lines below that comment, so a directory at
# the shared-install path was `exec`ed: bash exited 126 with its own "is a
# directory" message, which is neither the exit code this contract defines nor a
# sentence naming the hook or saying the call was allowed.
#
# A path that EXISTS but is not usable is reported specifically rather than
# folded into "not installed", which would be false — something is installed
# there. It is NOT rate limited, for the reason the override is not: the limit
# exists for the benign, expected unprovisioned state, and a non-regular file in
# the shared bin is an anomaly the operator has to see on the call that hit it.
if [ -e "$SHARED" ] && { [ ! -f "$SHARED" ] || [ ! -x "$SHARED" ]; }; then
  report "$HOOK hook: $SHARED exists but is not an executable regular file — this hook did NOT run, and the tool call was allowed" \
         "  Something other than the published implementation occupies that path." \
         "  Re-run install-shared-artifact.sh from agenticapps-workflow-core."
  exit 1
fi

if [ -f "$SHARED" ] && [ -x "$SHARED" ]; then
  exec "$SHARED" "$@"
fi

# --- unresolvable: allow, and report ----------------------------------------
report_rate_limited \
  "$HOOK hook: not installed at $SHARED — this hook did NOT run, and the tool call was allowed" \
  "  This machine is unprovisioned. Run install-shared-artifact.sh from" \
  "  agenticapps-workflow-core to publish the shared implementations." \
  "  Full notice at most once per hour per hook; see shim-contract 1.2.0."
exit 1
