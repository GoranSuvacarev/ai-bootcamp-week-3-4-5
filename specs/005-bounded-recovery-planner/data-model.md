# Data Model: Bounded Recovery Planner

This document uses TypeScript-style notation to describe runtime-validated JavaScript
contracts. Exact-key validation rejects missing and additional fields unless a field
is explicitly optional.

## Enumerations

```ts
type RecoveryGoal = "survive" | "advance";

type RecoveryAction =
  | "move_left"
  | "move_right"
  | "jump"
  | "climb"
  | "wait"
  | "avoid";

type RunStatus = "created" | "running" | "completed" | "stopped" | "failed";

type StopReason =
  | "completed"
  | "invalid_input"
  | "invalid_model_proposal"
  | "unknown_tool"
  | "invalid_tool_arguments"
  | "invalid_tool_result"
  | "tool_failed"
  | "provider_failed"
  | "provider_refusal"
  | "step_limit"
  | "tool_call_limit"
  | "provider_attempt_limit"
  | "deadline"
  | "repeated_action"
  | "invalid_final_result"
  | "cancelled";

type ViolationCode =
  | "unsafe_opening"
  | "no_forward_progress"
  | "repeated_action_in_plan";
```

## Browser Request

```ts
type RecoveryPlanRequest = {
  goal: RecoveryGoal;
  context: {
    difficulty: "easy" | "normal";
    lives: number; // integer 0–3
    lastDamage: {
      cause: "hazard" | "enemy";
      x: number;    // finite 0–640
      y: number;    // finite 0–900
      time: number; // finite >= 0
    };
  };
};
```

The HTTP body is limited to 2,048 UTF-8 bytes. Invalid bodies are rejected before a
run, provider attempt, or tool execution exists.

## Normalized Run Context

```ts
type RecoveryContext = {
  goal: RecoveryGoal;
  difficulty: "easy" | "normal";
  lives: number;
  recentThreat: "rolling_hazard" | "patrol_enemy";
  nextRoute: "ladder";
  stateVersion: string; // state- + 12 lowercase hexadecimal characters
};
```

`recentThreat` is derived from the damage cause. Raw coordinates and timestamps are
used only for request validation and are not copied into model, tool-result, final,
or telemetry data.

## Model Decision

```ts
type ModelDecision =
  | {
      kind: "tool_request";
      id: string; // 1–128 characters
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

Only `evaluate_recovery_plan` is allowed. A final decision cannot complete the run
until a viable evaluation exists.

## Evaluator Arguments

```ts
type EvaluateRecoveryPlanArgs = {
  actions: RecoveryAction[]; // exactly 2–4 entries
};
```

The model does not supply goal, context, score, or evidence. The registry obtains
those from trusted validated run state.

## Evaluation

```ts
type EvaluationEvidence = {
  id: "goal" | "threat" | "lives" | "route";
  fact: string; // trimmed 1–160 characters
};

type PlanEvaluation = {
  evaluationId: string; // eval- + 12 lowercase hexadecimal characters
  candidate: RecoveryAction[]; // exact validated input
  viable: boolean;
  score: number; // integer 0–100
  evidence: EvaluationEvidence[]; // exactly four unique IDs
  violations: ViolationCode[]; // unique, maximum three
};
```

The normalized serialized evaluation must not exceed 4,096 UTF-8 bytes.

## Final Model Result

```ts
type RecoveryPlanResult = {
  summary: string; // trimmed 1–300 characters
  goal: RecoveryGoal;
  actions: RecoveryAction[]; // 2–4
  evidence: EvaluationEvidence[]; // 1–4 unique IDs
  confidence: "low" | "medium" | "high";
  completed: boolean;
};
```

Structural validation accepts the boolean field, but public success additionally
requires `completed === true`, a latest viable evaluation, an exact candidate match,
the immutable run goal, and evidence pairs copied exactly from that evaluation.

## Agent Run State

```ts
type AgentRunState = {
  runId: string;
  status: RunStatus;
  goal: RecoveryGoal;
  context: RecoveryContext;
  stepCount: number; // 0–3
  toolCallCount: number; // 0–2
  providerAttemptCount: number; // 0–5
  attemptsInCurrentStep: number; // 0–2
  startedAtMs: number;
  deadlineAtMs: number;
  actionKeys: string[]; // maximum two canonical keys
  evaluations: PlanEvaluation[]; // maximum two
  stopReason?: StopReason;
};
```

### Counter semantics

- Increment `stepCount` before starting a new logical model decision.
- Increment `providerAttemptCount` before every provider call, including retry.
- Reset and then increment `attemptsInCurrentStep` within one logical step.
- Increment `toolCallCount` only after allowlist, arguments, budget, and repetition
  validation, immediately before tool execution. A thrown or timed-out execution
  still counts; a rejected proposal does not.
- `actionKeys` use tool name, canonical arguments, and the immutable state version.

## Public HTTP Results

```ts
type CompletedRecoveryResponse = {
  runId: string;
  status: "completed";
  stopReason: "completed";
  result: RecoveryPlanResult & { completed: true };
};

type UnsuccessfulRecoveryResponse = {
  runId?: string;
  status: "stopped" | "failed";
  stopReason: Exclude<StopReason, "completed">;
  message: string; // stable public text, 1–160 characters
};
```

No public response includes raw context, prompts, provider output, stack traces,
credentials, counters, or hidden reasoning.

## Telemetry Event

```ts
type RecoveryRunEvent = {
  runId: string;
  operation: "recovery_plan";
  goal: RecoveryGoal;
  status: "completed" | "stopped" | "failed";
  stopReason: StopReason;
  stepCount: number;
  toolCallCount: number;
  providerAttemptCount: number;
  provider: "gemini" | "fake";
  model: string; // configured public model name, never a key
  validationResults: string[]; // bounded category names only
  elapsedMs: number;
};
```

The in-memory store retains at most 50 frozen copies.

## State Transitions

```text
created
  -> running
       -> completed (valid final after viable evaluation)
       -> stopped   (policy, validation, refusal, limit, repetition)
       -> failed    (provider/tool failure, deadline, cancellation)
```

All terminal states are final. No provider or tool call may begin afterward.

## Invariants

1. Goal and normalized context never change during a run.
2. Provider attempts never exceed five; attempts within one step never exceed two.
3. A completed run has at least two steps, one or two tool calls, and one viable
   latest evaluation.
4. A second tool call must have a different canonical action key.
5. Public final actions equal the latest viable candidate exactly.
6. Public evidence is an exact subset of the latest evaluation evidence.
7. Invalid input, unknown tool, and invalid arguments cannot increment tool calls.
8. Tool and model data never change canonical game state.
