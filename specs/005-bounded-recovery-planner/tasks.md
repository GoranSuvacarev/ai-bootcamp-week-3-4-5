# Tasks: Bounded Recovery Planner

**Input**: Design documents from `/specs/005-bounded-recovery-planner/`

**Prerequisites**: Approved `spec.md`; `plan.md`; `research.md`; `data-model.md`;
`contracts/`; completed `checklists/implementation-readiness.md`

**Tests**: Required. Add the named failing test before its paired implementation
task and record the red-green result in implementation notes or evidence.

**Driver**: Sara Trnjakov

**Reviewer**: Goran Suvačarev

## Format

`[ID] [P?] [Story?] Description`

- `[P]` means the task can run in parallel with other marked tasks after its stated
  dependencies are complete and it does not touch the same file.
- `[US1]`, `[US2]`, and `[US3]` map to the approved user stories.
- Do not stage the two pre-existing report renames with Feature 005 commits.

## Phase 0: Human handoff gate

- [x] T001 Goran reviews every Feature 005 artifact and checks all items in `specs/005-bounded-recovery-planner/checklists/implementation-readiness.md`; Sara stops here while any item is unchecked.

**Checkpoint**: Feature 005 is authorized for implementation. No source change may
precede this checkpoint.

---

## Phase 1: Shared runtime contracts

**Purpose**: Establish all untrusted-input and public-output boundaries before the
backend workflow exists.

- [x] T002 Add failing exact-shape and boundary tests for recovery request, model decision, evaluator arguments/result, final result, and completed/failed public envelopes in `packages/game-contracts/tests/recovery.test.mjs`.
- [x] T003 Implement frozen enums and strict runtime validators in `packages/game-contracts/src/recovery.mjs` until T002 passes; include exact keys, size/count/range checks, cloning, and no semantic success shortcut.
- [x] T004 Add `packages/game-contracts/src/index.mjs`, re-export Hint and Recovery Planner contracts, and update `packages/game-contracts/package.json` exports/typecheck/test scripts without changing existing package-root imports.
- [x] T005 Run both shared contract test files and package typecheck; prove the existing four Hint contract tests still pass.

**Checkpoint**: Browser, server, model, tool, and public recovery data can all be
validated independently without a provider or application implementation.

---

## Phase 2: Deterministic foundation

**Purpose**: Build and prove the application-owned state, evaluator, registry, and
budgets that block all user stories.

- [x] T006 [P] Add failing scoring, viability, evidence, fingerprint, size, determinism, and no-mutation tests in `backend/tests/recovery-evaluator.test.mjs` using every evaluator fixture from `quickstart.md`.
- [x] T007 Implement the approved constants in `backend/src/recovery/limits.mjs` and deterministic normalization/scoring/fingerprints in `backend/src/recovery/plan-evaluator.mjs` until T006 passes.
- [x] T008 Add failing run-state counter, immutable context, terminal-state, deadline, and canonical-action-key tests to `backend/tests/recovery-flow.test.mjs`.
- [x] T009 Implement run creation, counter guards, state transitions, and stable state version in `backend/src/recovery/run-state.mjs` until the T008 foundation cases pass.
- [x] T010 Add failing registry tests to `backend/tests/recovery-flow.test.mjs` for allowlist, exact args, remaining budget, repeated action, 250 ms timeout, 4 KB result limit, malformed result, thrown execution, and tool-count semantics.
- [x] T011 Implement the single-entry allowlist and guarded execution in `backend/src/recovery/tool-registry.mjs` until T010 passes; do not add generic unchecked dispatch.
- [x] T012 [P] Create the sequence-based fake provider in `backend/tests/helpers/fake-recovery-model.mjs` with request recording, scripted decisions/errors, pending promises, abort observation, and dispose tracking.
- [x] T013 Run evaluator and foundation tests plus all existing backend tests before starting a user story.

**Checkpoint**: Deterministic policy is green and no test needs Gemini or provider
credit.

---

## Phase 3: User Story 1 — Receive an evaluated recovery plan (P1) 🎯 MVP

**Goal**: Complete one viable candidate or one distinct revision and return a
validated evidence-based advisory plan.

**Independent Test**: E01 and E02 from `quickstart.md` pass through the orchestrator
with exact step/tool/provider counts and no game-state mutation.

### Tests

- [x] T014 [US1] Add failing E01 and E02 orchestrator tests in `backend/tests/recovery-flow.test.mjs`, including normalized context, history passed to each step, latest viable evaluation, exact final actions/evidence, terminal cleanup, and one emitted event.
- [x] T015 [P] [US1] Add failing Gemini declaration, structured-final schema, signed-turn preservation, distinct-revision history, abort, and dispose tests in `backend/tests/recovery-gemini-adapter.test.mjs`.
- [x] T016 [P] [US1] Add failing HTTP success and revision tests in `backend/tests/recovery-server.test.mjs` for `POST /api/recovery-plan`, dependency injection, completed envelope, content type/body limit, and redacted recovery event access.
- [x] T017 [P] [US1] Add failing result parsing, completed rendering data, and active-request identity tests in `frontend/tests/recoveryFeedback.test.ts`.

### Implementation

- [x] T018 [US1] Implement logical-step orchestration, one/two evaluations, provider retries, semantic final validation, terminal mapping, event emission, and `finally` cleanup in `backend/src/recovery/recovery-flow.mjs` until T014 passes.
- [x] T019 [US1] Implement the provider-neutral Gemini recovery adapter in `backend/src/recovery/gemini-adapter.mjs` until T015 passes; keep provider turns/signatures inside the adapter and declare only `evaluate_recovery_plan`.
- [x] T020 [US1] Extend `backend/src/hint.mjs` with the new route and injected recovery dependencies while preserving `/api/hint`; expose `getRecoveryEvents()` and satisfy T016.
- [x] T021 [US1] Implement strict public response parsing and stale-request predicates in `frontend/src/coach/recoveryFeedback.ts` until T017 passes.
- [x] T022 [US1] Add accessible goal radios, Recovery Plan button, live status, evidence summary, confidence, and ordered actions in `frontend/index.html` and `frontend/src/styles.css`.
- [x] T023 [US1] Wire the Recovery Planner fetch, independent AbortController, enabled/disabled state, completed rendering, and no-action-execution rule in `frontend/src/main.ts`.
- [x] T024 [US1] Run E01/E02, HTTP, adapter, frontend helper, all backend, and all frontend tests; manually confirm Hint remains independent.

**Checkpoint**: The MVP returns a validated advisory plan for both goals with one
evaluation or one bounded revision.

---

## Phase 4: User Story 2 — Reject unsafe or unsupported proposals (P1)

**Goal**: Reject model/tool/final data outside the contract before it becomes an
authorized action or player-visible success.

**Independent Test**: E03–E08, E11, E16, and E17 pass; E04 explicitly proves
`toolCallCount === 0` and an uncalled evaluator spy.

### Tests

- [x] T025 [US2] Add table-driven invalid-input, unknown-tool, invalid-argument, mixed/multiple-decision, malformed-tool-result, oversized-result, and repeated-candidate cases to `backend/tests/recovery-flow.test.mjs`.
- [x] T026 [P] [US2] Add final goal mismatch, candidate mismatch, invented/altered evidence, duplicate evidence, invalid confidence, `completed: false`, and final-before-evaluation cases to `backend/tests/recovery-flow.test.mjs`.
- [x] T027 [P] [US2] Add HTTP negative tests in `backend/tests/recovery-server.test.mjs` for invalid JSON, body size, content type, method, invalid request, safe 422/502 mapping, and absence of provider/key/payload details.

### Implementation

- [x] T028 [US2] Complete proposal sequencing, allowlist, repetition, result validation, and semantic final rejection paths in `backend/src/recovery/recovery-flow.mjs` and `backend/src/recovery/tool-registry.mjs` until T025–T026 pass.
- [x] T029 [US2] Complete public HTTP error mapping and preflight rejection in `backend/src/hint.mjs` until T027 passes; invalid input must create no run/provider/tool work.
- [x] T030 [US2] Run the full shared and backend suites and record the zero-execution proof for later evidence.

**Checkpoint**: No unsupported or ungrounded model output can execute or display as
success.

---

## Phase 5: User Story 3 — Stop safely when the run cannot complete (P2)

**Goal**: Bound all retry, timeout, limit, refusal, cancellation, and stale-result
paths with one terminal status and safe player feedback.

**Independent Test**: E09–E15 and E18–E19 pass with exact maximum counters and no
call after a terminal state.

### Tests

- [x] T031 [US3] Add transient retry, permanent/config error, provider refusal, per-call timeout, provider-attempt exhaustion, step/tool exhaustion, total deadline, cancellation, and no-call-after-terminal cases to `backend/tests/recovery-flow.test.mjs`.
- [x] T032 [P] [US3] Add one-event-only, exact redacted fields, 50-event retention, validation-category, elapsed-time, and no-sensitive-data tests in `backend/tests/recovery-flow.test.mjs` and `backend/tests/recovery-server.test.mjs`.
- [x] T033 [P] [US3] Add safe stopped/failed/malformed/network feedback and new-damage/restart/menu/win/loss stale-suppression tests in `frontend/tests/recoveryFeedback.test.ts`.

### Implementation

- [x] T034 [US3] Complete linked 12-second attempt signals, 35-second run signal, bounded retry classification, limit guards, refusal, cancellation, and cleanup in `backend/src/recovery/recovery-flow.mjs`.
- [x] T035 [US3] Implement the bounded redacted event builder/store in `backend/src/recovery/telemetry.mjs` and integrate it with server dependency assembly until T032 passes.
- [x] T036 [US3] Complete stopped/failed UI mapping and abort both Hint and Recovery requests on every invalidating session transition in `frontend/src/coach/recoveryFeedback.ts` and `frontend/src/main.ts` until T033 passes.
- [x] T037 [US3] Run all recovery tests with fake timers where appropriate and prove no scenario exceeds configured calls.

**Checkpoint**: Every run terminates predictably, cleans resources, and exposes only
safe public state.

---

## Phase 6: Integration, evidence, and delivery

- [x] T038 Update backend and shared `package.json` build/typecheck/test scripts for every new module and test entry without adding a dependency.
- [x] T039 Run `npm.cmd run test`; record old/new totals and confirm all existing 78 tests still pass alongside the recovery suite.
- [x] T040 Run `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd audit --omit=dev --workspace @quattro-kong/backend`; resolve only Feature 005 failures.
- [ ] T041 Perform the browser smoke sequence in `specs/005-bounded-recovery-planner/quickstart.md` for both goals, cancellation/staleness, existing Hint, session controls, focus, win, and loss.
- [x] T042 Perform at most one limited live Gemini success after all fake checks pass; if configuration/provider access is unavailable, record that limitation without weakening Core evidence.
- [x] T043 Create `specs/005-bounded-recovery-planner/evidence.md` with architecture, flow, provider/model, registry, E01/E02/E04 and failure traces, stop reasons, validation totals, live result/limitation, known limitation, commit references, and pair contributions.
- [x] T044 Update `docs/AI_USAGE_LOG.md` with separate agent-run, model-call, retry, and tool-call counts and no raw prompt, response, key, signature, or hidden reasoning.
- [x] T045 Update `README.md` with the Recovery Planner behavior, run instructions, validation totals, and evidence link while preserving the existing Hint documentation.
- [ ] T046 Goran reviews the final diff, security checklist, evidence, and task completion; Sara and Goran rehearse the seven-minute demo and verify both can explain the flow and zero-execution proof.

**Final checkpoint**: Feature 005 meets every acceptance criterion, the complete
workspace is green, evidence is reproducible, and both partners approve submission.

---

## Dependencies and execution order

```text
T001
  -> T002–T005 shared contracts
  -> T006–T013 deterministic foundation
  -> T014–T024 User Story 1
  -> T025–T030 User Story 2
  -> T031–T037 User Story 3
  -> T038–T046 integration and evidence
```

- `[P]` tasks may run together only after their phase prerequisites are green.
- T018 depends on T007, T009, T011, T012, and T014.
- T019 depends on T003, T015, and the model-step contract.
- T020 depends on T018–T019 and T016.
- T023 depends on T020–T022.
- T028–T029 depend on the User Story 1 checkpoint.
- T034–T036 depend on the User Story 2 checkpoint.
- Live and evidence work cannot begin before T039–T041 pass.

## Commit boundaries

Recommended logical commits:

1. `test: define recovery planner contracts`
2. `feat: add deterministic recovery evaluator`
3. `feat: add bounded recovery run`
4. `feat: integrate recovery planner UI`
5. `test: cover recovery safety and limits`
6. `docs: record week 5 recovery evidence`

Stage exact Feature 005 files for each commit. Never include the pre-existing report
renames unless Goran explicitly handles them in a separate documentation commit.

## Completion update — 2026-10-07

The implementation and automated-validation work represented by T002–T040 and
T042–T045 is complete and checked above. The resulting recovery suite covers shared contracts,
deterministic evaluator rules, run-state limits, registry guards, fake provider
flow, Gemini adapter boundaries, HTTP responses, redacted telemetry, frontend
response parsing, stale suppression, cancellation, and the full production
validation commands.

The recovery-specific portion of T041 is recorded: post-damage goal paths,
browser-level stale suppression, Hint independence, session controls, and focus
passed. The pre-existing full win/loss gameplay route remains a human demo
rehearsal before T041 is checked. T046 remains assigned to Goran and Sara because
it requires their final seven-minute demo rehearsal.
