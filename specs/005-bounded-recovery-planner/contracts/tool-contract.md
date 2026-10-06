# Tool Contract: evaluate_recovery_plan

## Purpose

Deterministically evaluate one short candidate recovery sequence against the
validated immutable Recovery Planner context. The result supplies evidence for a
bounded final plan or one revised candidate.

## Authority and mode

| Attribute | Contract |
|---|---|
| Name | `evaluate_recovery_plan` |
| Caller | Recovery Planner orchestrator only |
| Mode | Deterministic, local, read-only |
| Registry | Exact allowlist entry; no dynamic dispatch outside the registry |
| Network/filesystem | Forbidden |
| Game-state writes | Forbidden |
| Execution limit | Maximum two accepted attempts per run |
| Timeout | 250 ms |
| Maximum normalized result | 4,096 UTF-8 bytes |

The model proposes a call. The backend validates and executes it. The browser never
authorizes or executes it.

## Model Arguments

```json
{
  "actions": ["wait", "climb"]
}
```

Rules:

- The object contains exactly `actions`.
- The array contains two through four values.
- Values are exactly `move_left`, `move_right`, `jump`, `climb`, `wait`, or `avoid`.
- Unknown fields, sparse arrays, non-strings, and unsupported values are invalid.
- Goal and context are not model arguments; the registry supplies them from run state.

An invalid proposal causes zero executions and does not increment `toolCallCount`.

## Trusted Context

```json
{
  "goal": "survive",
  "difficulty": "normal",
  "lives": 2,
  "recentThreat": "rolling_hazard",
  "nextRoute": "ladder",
  "stateVersion": "state-0123456789ab"
}
```

The tool receives no raw browser object, coordinate, timestamp, credential,
environment value, file, or mutable game reference.

## Deterministic Rules

1. Start at 100 points.
2. First action outside `wait` or `avoid`: add `unsafe_opening`, subtract 50.
3. For `advance`, no later `move_left`, `move_right`, or `climb`: add
   `no_forward_progress`, subtract 40.
4. Each equal consecutive pair: add `repeated_action_in_plan` once and subtract ten
   for each pair.
5. Clamp score to 0–100.
6. Viable means score >= 60 and neither critical violation is present.
7. Produce exactly one evidence fact for each stable ID: `goal`, `threat`, `lives`,
   and `route`.
8. Produce a deterministic evaluation fingerprint from canonical context and args.

`unsafe_opening` and `no_forward_progress` are critical.
`repeated_action_in_plan` is non-critical.

## Result

```json
{
  "evaluationId": "eval-0123456789ab",
  "candidate": ["wait", "climb"],
  "viable": true,
  "score": 100,
  "evidence": [
    { "id": "goal", "fact": "Goal priority: preserve lives." },
    { "id": "threat", "fact": "Recent threat: rolling hazard." },
    { "id": "lives", "fact": "Lives remaining: 2." },
    { "id": "route", "fact": "Next known route: ladder." }
  ],
  "violations": []
}
```

Result validation requires exact fields, candidate equality, correct score and
viability for the deterministic rules, all four unique evidence IDs, known unique
violations, valid sizes, and a matching evaluation fingerprint. The orchestrator
does not trust a malformed implementation result.

## Repetition

The orchestrator creates a canonical action key from tool name, normalized actions,
and immutable `stateVersion`. If the key already exists, the tool does not execute,
`toolCallCount` does not increase, and the run stops with `repeated_action`.

## Failure behavior

- Invalid name or arguments: controlled stop before execution.
- Execution throw or 250 ms timeout: failed run with `tool_failed`; the accepted
  execution remains counted.
- Invalid or oversized result: failed run with `invalid_tool_result`; do not send the
  result to the model.
- No failure path retries the deterministic tool automatically.

## Forbidden behavior

The tool must not mutate lives, score, level, player, enemies, configuration, or
presentation state; call Gemini or any network; read environment variables or files;
return secrets or raw context; create a new tool; or execute a returned action.
