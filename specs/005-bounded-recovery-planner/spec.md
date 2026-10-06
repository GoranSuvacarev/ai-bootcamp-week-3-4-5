# Feature Specification: Bounded Recovery Planner

**Feature Branch**: `005-bounded-recovery-planner`

**Created**: 2026-10-06

**Status**: Ready for implementation

**Input**: Extend the stable Week 04 AI coach with one bounded Recovery Planner. After losing a life, the player chooses a recovery goal, the model proposes a short action sequence, the application validates and evaluates that sequence with one deterministic read-only tool, and the model returns an evidence-based final plan without controlling the game.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive an evaluated recovery plan (Priority: P1)

As a player who has lost a life, I can choose whether to prioritize survival or
forward progress and receive a short evaluated recovery plan, so I can make my next
attempt with a clear goal without giving the AI control of the game.

**Why this priority**: This is the player value that distinguishes the Recovery
Planner from the existing single-action AI Hint.

**Independent Test**: With a fake model and deterministic evaluator, submit a valid
post-damage request, verify at least two model decisions with one allowed evaluator
execution between them, and receive a validated two-to-four-action plan whose goal
and evidence match the run.

**Acceptance Scenarios**:

1. **Given** a player has a recent damage event, **When** they select `survive`,
   **Then** the completed plan prioritizes preserving lives and avoiding the recent
   threat.
2. **Given** a player has a recent damage event, **When** they select `advance`,
   **Then** the completed plan prioritizes safe progress toward the next route.
3. **Given** the first candidate is viable, **When** the evaluator result returns to
   the model, **Then** the model may finalize the exact evaluated action sequence.
4. **Given** the first candidate is not viable, **When** budget remains, **Then** the
   model may submit one different candidate for evaluation before finalizing.
5. **Given** a completed plan is displayed, **When** the player continues the game,
   **Then** the player chooses whether to follow it and no action runs automatically.

---

### User Story 2 - Reject unsafe or unsupported proposals (Priority: P1)

As a player, I can rely on the application to execute only the defined evaluator
with valid bounded arguments, so model output cannot escape the Recovery Planner's
read-only scope.

**Why this priority**: The application, rather than the model, must remain the
authority over every tool call and final result.

**Independent Test**: Make the fake model request an unknown tool, malformed
arguments, an oversized action list, or a repeated action; verify the proposal is
rejected before execution and that an unsupported initial proposal leaves
`toolCallCount` equal to zero.

**Acceptance Scenarios**:

1. **Given** the model requests any tool other than `evaluate_recovery_plan`,
   **When** the orchestrator validates the proposal, **Then** no tool executes and
   the run stops with `unknown_tool`.
2. **Given** the evaluator arguments contain an unsupported action, fewer than two
   actions, more than four actions, or an extra field, **When** validation runs,
   **Then** the evaluator does not execute.
3. **Given** the model repeats the same evaluator call against the same run state,
   **When** repetition is detected, **Then** the call is not executed again and the
   run stops with `repeated_action`.
4. **Given** an evaluator or final result fails runtime or semantic validation,
   **When** it is processed, **Then** it is not presented as a successful plan.

---

### User Story 3 - Stop safely when the run cannot complete (Priority: P2)

As a player, I receive a stable status and safe message when planning cannot finish,
so I can continue, restart, or quit without seeing provider internals or stale
advice.

**Why this priority**: A bounded workflow must terminate predictably during provider,
tool, validation, budget, deadline, repetition, and cancellation failures.

**Independent Test**: Use fake model and tool collaborators to trigger provider
timeout, tool failure, invalid output, step exhaustion, deadline expiry, repetition,
and cancellation; verify a classified terminal state, bounded counts, and no stale
plan in the UI.

**Acceptance Scenarios**:

1. **Given** a transient provider failure, **When** attempt and deadline budget
   remain, **Then** only the failed model step may retry once.
2. **Given** the model-step, tool-call, provider-attempt, or deadline limit is
   exhausted, **When** another action is proposed, **Then** no further provider or
   tool call starts.
3. **Given** a new damage event, restart, menu return, win, or loss, **When** an older
   run later completes, **Then** its result is cancelled or ignored as stale.
4. **Given** a run fails or stops, **When** the player views its result, **Then** they
   see a stable public status without a key, raw provider response, stack trace, raw
   prompt, or chain-of-thought.

---

### Edge Cases

- The request is missing a goal or post-damage context, contains an unknown field,
  or exceeds the request-size limit; it is rejected before any model or tool call.
- The model returns a final answer before any viable evaluation; the result cannot be
  accepted as completed.
- The first candidate is invalid; it is rejected without consuming a tool execution.
- The second candidate repeats the first or arrives after the tool-call limit; it is
  not executed.
- The evaluator returns an unknown evidence identifier, a candidate different from
  the requested actions, an out-of-range score, or an oversized result; the result is
  rejected before it reaches the model.
- The final plan changes the most recently evaluated viable actions or cites evidence
  absent from that evaluation; the result is rejected.
- The provider returns a refusal; the run stops safely without inventing a plan.
- A retry would exceed the total deadline or provider-attempt budget; the retry does
  not start.
- The existing AI Hint is requested while no Recovery Planner run exists; Week 04
  behavior remains unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST add a Recovery Planner alongside the existing AI Hint
  and MUST NOT change the `/api/hint` contract or established Week 04 behavior.
- **FR-002**: A Recovery Planner request MUST contain exactly one goal, `survive` or
  `advance`, plus a bounded current-round context containing difficulty, remaining
  lives, and one recent validated damage event. Invalid input MUST result in zero
  model and tool calls.
- **FR-003**: The Recovery Planner MUST expose exactly one model-callable tool named
  `evaluate_recovery_plan`. It MUST be deterministic, local, read-only, and callable
  only through the backend Recovery Planner orchestrator.
- **FR-004**: Evaluator arguments MUST contain exactly one `actions` array with two to
  four values from `move_left`, `move_right`, `jump`, `climb`, `wait`, and `avoid`.
  Unknown tools, fields, types, values, or counts MUST be rejected before execution.
- **FR-005**: A validated evaluator result MUST contain a non-empty evaluation ID,
  the exact evaluated candidate, a boolean viability result, an integer score from
  zero through 100, a bounded list of evidence facts with unique IDs, and a bounded
  list of known violation codes. Invalid or oversized output MUST not return to the
  model.
- **FR-006**: Each request MUST create one logical run with a run ID, immutable goal,
  status, step count, tool-call count, provider-attempt count, start time, deadline,
  recent action keys, latest validated evaluation, and terminal stop reason.
- **FR-007**: A normal completed run MUST contain at least two model decisions and at
  least one real evaluator execution between model decisions.
- **FR-008**: After the first evaluation, the model MAY finalize a viable candidate or
  request one different candidate evaluation. A run MUST NOT execute more than two
  tool calls or make more than three model decisions.
- **FR-009**: Every run MUST enforce at most three model steps, two tool calls, two
  attempts per model step, five provider attempts in total, a 12-second timeout per
  provider call, and a 35-second total deadline.
- **FR-010**: A provider retry MUST NOT count as a new model step. Only explicitly
  transient network, rate-limit, or server failures may retry, and a retry MUST NOT
  start without remaining attempt and deadline budget.
- **FR-011**: Before executing a tool, the application MUST validate current run
  status, remaining budget, tool allowlist, exact arguments, allowed context, and a
  canonical repetition key made from tool name, normalized arguments, and run-state
  version. A rejected proposal MUST NOT increment the successful tool-call count.
- **FR-012**: A successful final result MUST contain exactly a bounded summary, the
  immutable goal, two to four allowed actions, evidence references, confidence of
  `low`, `medium`, or `high`, and a `completed` boolean.
- **FR-013**: A final result with `completed: true` MUST match the most recently
  evaluated viable action sequence exactly, and every evidence reference MUST resolve
  to that evaluation. Confidence MUST NOT substitute for evidence.
- **FR-014**: Terminal statuses MUST distinguish `completed`, `stopped`, and `failed`.
  Stop reasons MUST cover invalid input or proposal, unknown tool, invalid arguments
  or output, tool or provider failure, refusal, step/tool/attempt limits, deadline,
  repeated action, invalid final result, and cancellation.
- **FR-015**: Each run MUST emit safe evidence containing run ID, final status, goal
  category, step count, tool-call count, provider-attempt count, provider/model,
  elapsed time, validation outcomes, and stop reason without recording secrets, raw
  prompts, raw provider responses, coordinates, stack traces, or chain-of-thought.
- **FR-016**: Gemini credentials, provider calls, tool authorization, validation,
  budgets, retries, and stop decisions MUST remain on the backend. The browser MUST
  display only validated public states and results.
- **FR-017**: The UI MUST expose the two goals only after a recent life loss, display
  `running`, `completed`, `stopped`, or `failed`, and prevent stale results after a
  newer damage event or session transition.
- **FR-018**: Local fake-based tests MUST cover normal completion, one revision,
  invalid initial input, unknown tool, invalid arguments, malformed model/tool/final
  output, provider and tool failure, bounded retry, repeated action, all run limits,
  deadline, cancellation, stale UI suppression, and evidence mismatch.
- **FR-019**: The feature MUST NOT add write actions, automatic player control,
  arbitrary network/filesystem/shell access, persistence, accounts, deployment,
  provider fallback, additional tools, or a general autonomous agent.

### Key Entities

- **Recovery plan request**: One validated player goal and the minimum post-damage
  context required to begin a run.
- **Agent run**: The application-owned state and budgets for one logical planning
  attempt from creation to a classified terminal result.
- **Model decision**: A normalized proposal to evaluate a candidate, return a final
  result, or refuse; it is untrusted until validated.
- **Plan evaluation**: The deterministic result for one candidate action sequence,
  including viability, score, evidence, and violations.
- **Recovery plan result**: The validated advisory action sequence and evidence shown
  to the player.
- **Run evidence event**: A redacted record of counts, validations, timing, provider,
  and stop reason for testing and demonstration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Local tests demonstrate a completed run with two model decisions, one
  permitted evaluator execution, two to four final actions, and evidence drawn only
  from the validated evaluation.
- **SC-002**: Local tests demonstrate a non-viable first candidate followed by one
  different evaluated revision and a valid final plan within three model steps and
  two tool calls.
- **SC-003**: Invalid initial input results in zero model and tool calls; unknown tools
  and invalid arguments result in zero evaluator executions.
- **SC-004**: Repetition, step limit, tool-call limit, provider-attempt limit, total
  deadline, cancellation, and provider/tool failure each reach a classified terminal
  state without an unbounded call.
- **SC-005**: A final plan that changes the evaluated actions, cites invented
  evidence, or otherwise fails runtime validation is never displayed as completed.
- **SC-006**: During a local smoke test, a player can select either goal after damage
  and receive a validated plan or stable safe outcome within 35 seconds while normal
  gameplay, restart, and menu controls remain usable.
- **SC-007**: Existing Week 03 and Week 04 tests continue to pass without changes to
  the AI Hint contract or deterministic game behavior.
- **SC-008**: A reviewer can inspect one success run and one rejected or failed run
  and identify their model-step count, tool-call count, provider attempts, validation
  outcomes, elapsed time, and stop reason without seeing secrets or private model
  reasoning.

## Assumptions

- Quattro Kong remains a local single-player game with no account or persistent
  server-side game history.
- `survive` prioritizes life preservation and avoiding the recent threat; `advance`
  prioritizes safe progress toward the next route. Neither goal permits unsafe or
  unavailable actions.
- The browser supplies local round context, but the backend treats it as untrusted,
  validates it, and sends only a minimized normalized form to the model.
- One configured server-side Gemini model is sufficient for Core. Provider fallback
  remains out of scope.
- The existing post-damage AI Hint remains available and independent from Recovery
  Planner runs.
- A Recovery Planner result is advisory text and actions only; the player remains the
  sole authority over game input.
