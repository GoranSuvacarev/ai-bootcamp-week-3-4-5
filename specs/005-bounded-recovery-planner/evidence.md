# Feature 005 implementation evidence

## Architecture

```text
Browser recovery controls
  -> POST /api/recovery-plan
  -> recovery flow (limits, retries, terminal state)
  -> exact tool registry -> deterministic evaluator
  -> validated evidence -> model final -> validated public envelope
```

The browser only renders a completed validated plan. It has its own abort
controller and suppresses a result if the damage object or game view changes.
The planner never mutates game state or dispatches a returned action.

## Automated checks and traces

- E01: `tool_request(wait, climb) -> viable evaluation -> final` completes in
  two model steps with one tool call. The final actions and evidence are checked
  against that evaluation.
- E02: a non-viable first candidate may produce one distinct evaluated revision;
  a valid final then completes after three model steps and two tool calls.
- E04: an unknown first tool produces `stopped/unknown_tool`; the evaluator spy
  remains uncalled and `toolCallCount` is zero.
- Evaluator fixtures cover all approved score, viability, evidence, deterministic
  fingerprint, and mutation cases in `backend/tests/recovery-evaluator.test.mjs`.
- Registry tests cover allowlisting, invalid arguments, throw, timeout, malformed
  output, oversized output, and exact deterministic results.
- Flow tests cover invalid proposals/finals, refusal, repetition, transient retry,
  permanent failure, injected step limits, provider-attempt exhaustion, deadline,
  cancellation, disposal, and redacted event emission.
- Adapter tests cover its only declaration, function-response turn, structured
  final schema, mixed tool/text rejection, multiple calls, and malformed JSON.
- HTTP tests cover success, method/content-type, invalid JSON, oversized input,
  preflight rejection, dependency injection, and redacted events.

Validation on 2026-10-07:

- `npm.cmd run test`: 121 passing tests (59 frontend, 55 backend, 7 shared).
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd audit --omit=dev --workspace @quattro-kong/backend`: reviewer-run
  result was zero production vulnerabilities.

## Limited live verification

The final authorised review run used `gemini-3.5-flash-lite` on 2026-10-07 after
all fake checks were green. The `survive` request completed with HTTP 200 in
about 2.15 seconds, `stopReason: completed`, the advisory actions `avoid`,
`climb`, high confidence, and all four deterministic evidence facts. An earlier
post-implementation success returned `wait`, `climb`; the initial pre-correction
review run stopped safely at `step_limit` and led to the prompt and adapter
corrections. No key, prompt, raw provider payload, signature, or hidden reasoning
was retained.

## Bounded policy

The tool registry exposes only `evaluate_recovery_plan`, accepts exactly two to
four approved actions, uses a 250 ms execution guard, validates normalized
results below 4 KiB, and rejects repeated action keys. The run permits at most
three logical steps, two tool executions, five provider attempts, two attempts
per step, and a 35-second deadline. Recovery events retain at most 50 redacted
records and contain no prompts, coordinates, provider payloads, or credentials.

## Browser smoke and contributions

The final browser review confirmed that the AI controls are hidden outside play,
both post-damage actions are disabled before damage, a real collision changes
lives from 03 to 02, and both `survive` and `advance` render validated local fake
plans with explicit status, ordered actions, evidence, and confidence. It also
confirmed Hint independence, focusable controls, pause cancellation with stale
result suppression, restart, return to menu, and no browser-console errors. No
rendered plan moved the player or changed canonical game state.

The final pair confirmation records the complete pre-existing win/loss gameplay
routes and the seven-minute delivery demo as rehearsed. Both partners confirmed
that they can explain the bounded flow and the rejected-tool zero-execution proof.

Sara implemented contracts, evaluator, registry, flow, adapter, endpoint, UI,
tests, and evidence updates. Goran performed the security, repository, automated,
live-provider, and browser handoff review. Baseline implementation commit:
`24034c9`; Sara's review-correction commit: `5c0a099`.
