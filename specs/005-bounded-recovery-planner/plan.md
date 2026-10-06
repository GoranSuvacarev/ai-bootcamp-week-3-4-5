# Implementation Plan: Bounded Recovery Planner

**Branch**: `005-bounded-recovery-planner` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-bounded-recovery-planner/spec.md`

## Summary

Add a second post-damage AI Coach capability without changing the Week 04 Hint.
The player selects `survive` or `advance`; a backend state machine asks Gemini for a
short candidate, validates and evaluates it through one deterministic read-only tool,
then accepts a grounded final plan or one distinct revision. Explicit step, tool,
provider-attempt, timeout, deadline, repetition, evidence, and cancellation policies
keep every run bounded. Fake-first tests prove success and negative paths before one
limited live check.

## Technical Context

**Language/Version**: TypeScript 5.9 frontend; modern Node.js ES modules for backend and shared runtime contracts

**Primary Dependencies**: Existing Vite, Vitest, Node HTTP/crypto, and `@google/genai`; no new dependency

**Storage**: No persistence; bounded in-memory provider turns and at most 50 redacted run events

**Testing**: Node test for shared contracts; Vitest fake-based unit/integration tests; existing workspace regression suite and browser smoke

**Target Platform**: Modern browser plus local Node backend on `127.0.0.1`

**Project Type**: Existing frontend/backend/shared-contract web workspace

**Performance Goals**: Deterministic local evaluation below 250 ms; provider call below 12 seconds; complete run below 35 seconds

**Constraints**: One read-only tool, at most three model steps, two tool calls, five provider attempts, no provider fallback or game-state writes

**Scale/Scope**: One local player, one active Recovery Planner request per browser control, one Gemini model, no account or history store

## Constitution Check

| Gate | Result | Evidence |
|---|---|---|
| One reviewed bounded feature | Pass | Feature 005 adds one Recovery Planner and one evaluator only. |
| Specification before implementation | Pass | Requirements checklist is approved by Goran; design and tasks precede code. |
| Deterministic core and runtime contracts | Pass | Evaluator rules, exact schemas, evidence matching, and fake tests are documented. |
| Evidence-driven changes | Pass | Quickstart defines success, rejection, failure, regressions, live smoke, and evidence capture. |
| Human review and trusted boundary | Pass pending handoff review | Backend owns model/tool policy; Goran must approve the generated package before Sara starts. |
| Session 005 limits | Pass | Step, tool, attempt, per-call, deadline, repetition, and output-size limits are explicit. |

No constitutional exception is required. Post-design review remains blocked only by
the unchecked implementation-readiness checklist.

## Project Structure

### Documentation

```text
specs/005-bounded-recovery-planner/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   ├── recovery-api.md
│   ├── tool-contract.md
│   └── model-step.md
└── checklists/
    ├── requirements.md
    └── implementation-readiness.md
```

### Source and tests

```text
packages/game-contracts/
├── src/
│   ├── hint.mjs
│   ├── recovery.mjs
│   └── index.mjs
└── tests/
    ├── hint.test.mjs
    └── recovery.test.mjs

backend/
├── src/
│   ├── hint.mjs
│   └── recovery/
│       ├── limits.mjs
│       ├── run-state.mjs
│       ├── plan-evaluator.mjs
│       ├── tool-registry.mjs
│       ├── recovery-flow.mjs
│       ├── gemini-adapter.mjs
│       └── telemetry.mjs
└── tests/
    ├── helpers/fake-recovery-model.mjs
    ├── recovery-evaluator.test.mjs
    ├── recovery-flow.test.mjs
    ├── recovery-gemini-adapter.test.mjs
    └── recovery-server.test.mjs

frontend/
├── index.html
├── src/
│   ├── main.ts
│   ├── styles.css
│   └── coach/recoveryFeedback.ts
└── tests/recoveryFeedback.test.ts
```

**Structure Decision**: Preserve the three existing workspaces. Shared code owns
wire/runtime schemas, backend recovery modules own authority and orchestration, and
the frontend owns only player input, safe rendering, cancellation, and stale-result
suppression.

## Implementation Approach

### 1. Shared contracts

- Create exact-key validators and frozen enums for request, model decision, tool
  arguments/result, final result, and public envelopes in `recovery.mjs`.
- Add `index.mjs` that re-exports existing Hint contracts and new recovery contracts;
  update package export and checks without changing package-root consumers.
- Write failing contract tests first, including extra fields, bounds, evidence IDs,
  and malformed public envelopes.

### 2. Deterministic foundation

- Centralize approved limits in `limits.mjs`.
- Create run state with explicit counter helpers, immutable normalized context,
  stable SHA-256 state fingerprint, and terminal-state enforcement.
- Implement the scoring algorithm and stable evaluation fingerprint exactly as
  documented in the tool contract.
- Implement an explicit registry entry that validates name, arguments, budget,
  repetition, execution timeout, result bytes, and output schema.

### 3. Orchestrator

- Validate input before run creation and normalize only required context.
- Start each logical step once; execute up to two provider attempts under child
  timeout signals and the run deadline.
- Validate normalized model decisions, require the evaluator at step one, allow one
  distinct revision, and reject any action after terminal state.
- Send only validated evaluations back to the adapter.
- Validate final structure, goal, viable-candidate equality, and exact evidence pairs.
- Map every exit to one terminal status/reason, emit one redacted event, dispose the
  provider session, and clean timers/listeners in `finally`.

### 4. Gemini adapter and HTTP integration

- Declare only `evaluate_recovery_plan`; constrain final turns with the JSON schema.
- Preserve signed Gemini turns internally by run ID and append function responses
  once after validated execution.
- Extend the existing server with `/api/recovery-plan`, dependency injection for
  recovery model/registry/events, and `getRecoveryEvents()` for tests/evidence.
- Preserve all `/api/hint` responses, injected collaborators, and telemetry.
- Extend backend syntax-check scripts to cover all recovery modules.

### 5. Frontend

- Add `survive` and `advance` radio controls, a Recovery Plan button, an accessible
  live status, and an ordered action list inside the AI Coach card.
- Keep an independent Recovery Planner AbortController; disable its control while
  active and abort it on every transition that already invalidates a Hint.
- Parse only the documented completed envelope. Map all stopped, failed, malformed,
  and network outcomes to stable safe UI text.
- Never translate returned actions into keyboard or game-state operations.

### 6. Evidence and handoff completion

- Run focused red-green cycles and then the full workspace suite, typecheck, build,
  and backend production audit.
- Perform one limited live success only after fake tests pass and record safe counts.
- Create `evidence.md`, update `docs/AI_USAGE_LOG.md`, and capture the seven-minute
  demo path without raw prompts or secrets.

## Error and Stop Policy

| Condition | Status/reason | Retry | Tool count effect |
|---|---|---:|---:|
| Invalid request | failed / `invalid_input` | No | 0 |
| Unknown tool | stopped / `unknown_tool` | No | 0 |
| Invalid arguments | stopped / `invalid_tool_arguments` | No | 0 |
| Repeated candidate | stopped / `repeated_action` | No | unchanged |
| Tool throws/times out | failed / `tool_failed` | No | incremented |
| Invalid tool result | failed / `invalid_tool_result` | No | incremented |
| Network, 429, 5xx | retry then failed / `provider_failed` | Once if all budgets remain | unchanged |
| Auth/config or invalid provider output | failed / `provider_failed` | No | unchanged |
| Provider refusal | stopped / `provider_refusal` | No | unchanged |
| Invalid final semantics | stopped / `invalid_final_result` | No | unchanged |
| Limit reached | stopped / matching limit | No | unchanged |
| Total deadline | failed / `deadline` | No | unchanged |
| Browser/HTTP cancellation | failed / `cancelled` | No | unchanged |

## Delivery Gate

Before implementation, Goran reviews this plan, research, data model, contracts,
quickstart, and tasks. Only after every item in
`checklists/implementation-readiness.md` is checked may Sara or her agent begin T001.

## Complexity Tracking

No constitution violation or special complexity exception is required.
