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

- `npm.cmd run test`: 112 passing tests (59 frontend, 47 backend, 6 shared).
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd audit --omit=dev --workspace @quattro-kong/backend`: reviewer-run
  result was zero production vulnerabilities.

## Limited live verification

One authorised live run used `gemini-3.5-flash-lite` on 2026-10-07 after all
fake checks were green. The `survive` request completed with HTTP 200,
`stopReason: completed`, the advisory actions `wait`, `climb`, high confidence,
and deterministic evidence. It used one evaluator action and no retry. No key,
prompt, raw provider payload, signature, or hidden reasoning was retained.

## Bounded policy

The tool registry exposes only `evaluate_recovery_plan`, accepts exactly two to
four approved actions, uses a 250 ms execution guard, validates normalized
results below 4 KiB, and rejects repeated action keys. The run permits at most
three logical steps, two tool executions, five provider attempts, two attempts
per step, and a 35-second deadline. Recovery events retain at most 50 redacted
records and contain no prompts, coordinates, provider payloads, or credentials.

## Remaining manual check and contributions

The remaining delivery check is the full browser smoke sequence for both goals,
win/loss, focus, and stale suppression. Sara implemented contracts, evaluator,
registry, flow, adapter, endpoint, UI, tests, and evidence updates. Goran
performed the pre-fix security/repository review. Baseline implementation commit:
`24034c9`; the review corrections are intentionally uncommitted pending review.
