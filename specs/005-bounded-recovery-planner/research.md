# Research: Bounded Recovery Planner

## Decision 1: Extend the existing server without replacing the Hint flow

**Decision**: Add `POST /api/recovery-plan` to the HTTP server created by
`createHintServer`. Keep `/api/hint`, `createHintServer`, and all Week 04 contracts
compatible.

**Rationale**: The game already has one local backend, one Vite proxy, and tested
request cancellation. A second process or a server rename adds migration risk with
no player value.

**Rejected alternatives**:

- A second backend port duplicates configuration and cancellation behavior.
- Renaming the existing server factory creates unnecessary Week 04 churn.
- Putting the loop in the browser violates the trusted-boundary rules.

## Decision 2: Use a provider-neutral step interface

**Decision**: The orchestrator calls one `model.step(request)` method that returns a
normalized `tool_request`, `final`, or `refusal` decision. The Gemini adapter owns
function declarations, JSON schemas, provider turns, thought signatures, and SDK
errors. It stores provider conversation state by `runId` and exposes `dispose(runId)`.

**Rationale**: The orchestrator must reason about run state and policy, not Gemini
response objects. Preserving provider turns internally also retains the signed tool
turn behavior discovered in Week 04 without leaking it into shared contracts.

**Rejected alternatives**:

- Separate `propose` and `finalize` methods encode a fixed two-stage flow and cannot
  express one bounded revision cleanly.
- Returning raw Gemini content to the orchestrator makes provider details part of
  application policy.
- Cross-provider routing is outside Core and the approved constitution.

## Decision 3: Keep runtime contracts dependency-free

**Decision**: Add strict hand-written validators in a new shared recovery module and
re-export Hint and Recovery Planner contracts through a package index.

**Rationale**: Existing contracts use exact-key runtime validation and need no schema
dependency. A barrel keeps current package-root imports stable while allowing
separate source and test files.

**Rejected alternatives**:

- Adding a validation library increases dependency and migration scope for a small,
  fixed contract set.
- Adding recovery contracts to `hint.mjs` makes ownership and tests harder to read.

## Decision 4: Evaluate candidates deterministically

**Decision**: `evaluate_recovery_plan` receives model arguments containing only a
two-to-four-action candidate. The tool registry supplies the validated immutable run
context. The evaluator applies these rules:

1. Start at score 100.
2. If the first action is neither `wait` nor `avoid`, add critical violation
   `unsafe_opening` and subtract 50.
3. For goal `advance`, if no later action is `move_left`, `move_right`, or `climb`,
   add critical violation `no_forward_progress` and subtract 40.
4. For each pair of equal consecutive actions, add non-critical violation
   `repeated_action_in_plan` and subtract 10.
5. Clamp score to 0–100. The candidate is viable only when no critical violation is
   present and score is at least 60.
6. Return stable evidence for goal priority, recent threat, remaining lives, and the
   fixed next route (`ladder`). Return no raw coordinate or timestamp.

`evaluationId` is `eval-` plus the first 12 hexadecimal characters of SHA-256 over
canonical normalized context and arguments. `stateVersion` uses the same technique
with prefix `state-` over normalized context alone.

**Rationale**: These rules are small enough to explain and test, but the tool still
provides real value: it rejects unsafe openings, verifies progress for the advance
goal, detects low-quality repetition, and supplies evidence that final output can be
checked against.

**Rejected alternatives**:

- A second AI evaluator would not be deterministic or independently testable.
- A physics simulation would expand scope far beyond the bounded assignment.
- Random identifiers would make equivalent evaluator calls non-reproducible.

## Decision 5: Model the run as an explicit state machine

**Decision**: Keep one in-memory state object per HTTP request. Increment
`stepCount` when a new logical model step starts, `providerAttemptCount` before each
provider attempt, and `toolCallCount` after tool validation immediately before an
execution attempt. Retries stay inside their original step. The immutable
`stateVersion` makes an identical candidate a repeated action throughout the run.

**Rationale**: Explicit counters make limits testable and distinguish a new agent
decision from a transport retry. Counting an accepted tool attempt even when the
tool fails accurately records real execution.

**Rejected alternatives**:

- Inferring counts from logs makes stop policy difficult to prove.
- Incrementing steps per retry confuses reliability attempts with agent decisions.
- Incrementing tool calls before validation breaks the required zero-call proof.

## Decision 6: Layer total and per-call cancellation

**Decision**: Create a 35-second run signal linked to the HTTP request. For every
provider attempt create a child signal with a 12-second timer. Allow one retry for a
transient network, 429, or 5xx failure only when the per-step, global-attempt, and
total-deadline budgets all remain. Execute the local evaluator within a 250 ms guard
and reject normalized results larger than 4,096 UTF-8 bytes.

**Rationale**: No individual call can consume the complete run indefinitely, and
retries cannot multiply beyond the global budget.

**Rejected alternatives**:

- Provider timeout alone does not bound a multi-step run.
- Total deadline alone cannot identify or recover from one stalled attempt.

## Decision 7: Return a small public run envelope

**Decision**: Successful HTTP responses contain run ID, `completed`, stop reason,
and a validated nested result. Controlled stops and failures contain optional run ID,
public status, classified stop reason, and stable message. Counts remain in redacted
server telemetry rather than the player response.

**Rationale**: The UI needs terminal status and safe feedback, while detailed counts
remain available for evidence without enlarging the public contract.

**Rejected alternatives**:

- Returning raw provider errors or internal history exposes unnecessary data.
- Returning only free text makes status and evidence validation impossible.

## Decision 8: Add a separate frontend request helper

**Decision**: Add recovery parsing and stale-result checks beside the existing Hint
helper. Maintain independent AbortControllers for Hint and Recovery Planner runs;
abort both on new damage, restart, menu return, win, or loss. Neither feature
automatically cancels the other.

**Rationale**: The features remain independent while sharing the same safe session
transition rules. A helper keeps response validation testable outside the DOM.

**Rejected alternatives**:

- Merging recovery parsing into `main.ts` would make the UI flow difficult to test.
- Automatically executing returned actions violates the approved scope.

## Decision 9: Preserve only redacted bounded telemetry

**Decision**: Retain at most 50 recovery run events in memory. Store run ID, goal,
status, stop reason, step/tool/provider counts, provider/model category, elapsed time,
and validation category names. Never store context payloads, raw prompts, responses,
coordinates, keys, or hidden reasoning.

**Rationale**: This supports the assignment evidence and demo without creating a
private-data or persistence surface.

**Rejected alternatives**:

- Full prompt logs are unnecessary and conflict with the constitution.
- Persistent telemetry adds storage and retention questions outside the assignment.
