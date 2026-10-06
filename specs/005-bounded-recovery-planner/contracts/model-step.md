# Internal Contract: Recovery Model Step

## Purpose

Keep provider SDK details outside the agent orchestrator while supporting one or two
tool evaluations and a final structured decision.

## Adapter interface

```ts
type RecoveryModel = {
  step(request: ModelStepRequest): Promise<ModelDecision>;
  dispose(runId: string): void;
};

type ModelStepRequest = {
  runId: string;
  goal: "survive" | "advance";
  context: RecoveryContext;
  history: Array<{
    proposal: EvaluateRecoveryPlanArgs;
    evaluation: PlanEvaluation;
  }>;
  availableTools: [EvaluateRecoveryPlanDescriptor];
  signal: AbortSignal;
};
```

The orchestrator passes only validated normalized context and validated evaluation
history. Raw browser data and secrets are absent.

## Normalized decisions

```ts
type ModelDecision =
  | {
      kind: "tool_request";
      id: string;
      name: string;
      args: unknown;
    }
  | {
      kind: "final";
      result: unknown;
    }
  | {
      kind: "refusal";
    };
```

The adapter must return one decision only. Multiple function calls, mixed function
and final output, empty content, invalid JSON, or an unrecognized response shape are
classified as invalid structured provider output.

## Allowed sequencing

```text
Step 1: tool_request required
  -> validated evaluation

Step 2: final OR a different tool_request
  -> if tool_request, validated second evaluation

Step 3: final required
```

A final result before a viable evaluation cannot complete the run. A third-step tool
request is rejected by the step/tool budget.

## Gemini adapter responsibilities

- Use the configured server-side Gemini model and API key.
- Declare only `evaluate_recovery_plan` during tool-request-capable steps.
- Use structured JSON output for final responses.
- Preserve Gemini model turns and thought signatures internally by `runId`.
- Add a validated function response exactly once after a successful evaluation.
- Append provider state only after a successful provider response; a transport retry
  must not duplicate history.
- Map SDK/network failures into safe categories without provider payloads.
- Respect the supplied AbortSignal.
- Delete all stored provider turns in `dispose(runId)` after every terminal path.

The orchestrator remains responsible for allowlisting, schemas, budgets, semantic
final validation, public errors, and stop decisions.

## Retry contract

- A logical step allows at most two provider attempts.
- The complete run allows at most five provider attempts.
- Retry only network errors, HTTP 429, or HTTP 5xx.
- Authentication/configuration, invalid output, refusal, cancellation, and policy
  rejection do not retry.
- Each attempt receives a 12-second signal linked to the 35-second run signal.
- A retry does not create a new agent step and does not re-execute a validated tool.

## Final structured schema

```json
{
  "summary": "Let the hazard pass, then climb.",
  "goal": "survive",
  "actions": ["wait", "climb"],
  "evidence": [
    { "id": "threat", "fact": "Recent threat: rolling hazard." }
  ],
  "confidence": "high",
  "completed": true
}
```

Provider-side schema guidance is not a trust boundary. The shared runtime validator
and orchestrator semantic checks remain authoritative.

## Fake adapter requirements

Tests inject a sequence-based fake that can emit valid candidates, a distinct
revision, unknown tools, invalid arguments, malformed decisions, final results,
refusal, transient errors, permanent errors, and never-resolving promises. It records
each request so tests can assert steps, retries, history, signals, and call counts.
