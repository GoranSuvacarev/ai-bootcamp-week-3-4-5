# API Contract: Recovery Planner

## Endpoint

```text
POST /api/recovery-plan
Content-Type: application/json
Maximum body: 2,048 UTF-8 bytes
```

All unknown routes retain the existing 404 behavior. Methods other than `POST`
return 405 with `Allow: POST`. A missing or unsupported content type returns 415.

## Request

```json
{
  "goal": "survive",
  "context": {
    "difficulty": "normal",
    "lives": 2,
    "lastDamage": {
      "cause": "hazard",
      "x": 160,
      "y": 640,
      "time": 4.5
    }
  }
}
```

Validation is exact:

- `goal`: `survive` or `advance`.
- `difficulty`: `easy` or `normal`.
- `lives`: integer from 0 through 3.
- `cause`: `hazard` or `enemy`.
- `x`: finite 0–640; `y`: finite 0–900; `time`: finite and non-negative.
- Missing, additional, wrong-type, unsupported, and oversized values are invalid.

Invalid input is rejected before creating a run or calling the provider/tool.

## Completed Response

**HTTP 200**

```json
{
  "runId": "run-550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "stopReason": "completed",
  "result": {
    "summary": "Let the rolling hazard pass, then move toward the ladder.",
    "goal": "survive",
    "actions": ["wait", "climb"],
    "evidence": [
      { "id": "threat", "fact": "Recent threat: rolling hazard." },
      { "id": "lives", "fact": "Lives remaining: 2." }
    ],
    "confidence": "high",
    "completed": true
  }
}
```

The application accepts this envelope only after structural and semantic final
validation. The action sequence must equal the latest viable evaluation candidate,
and evidence pairs must be copied exactly from that evaluation.

## Controlled Stop Response

**HTTP 422**

```json
{
  "runId": "run-550e8400-e29b-41d4-a716-446655440000",
  "status": "stopped",
  "stopReason": "unknown_tool",
  "message": "Recovery planning stopped safely."
}
```

Used for invalid model proposals, unknown tools, invalid tool arguments, refusal,
step/tool/provider-attempt limits, repeated actions, and invalid final results.

## Failure Responses

| HTTP | Status | Stop reason category | Stable message |
|---:|---|---|---|
| 400 | failed | `invalid_input` | `Invalid recovery plan request.` |
| 415 | failed | `invalid_input` | `Expected JSON.` |
| 422 | stopped | policy or validation stop | `Recovery planning stopped safely.` |
| 499 | failed | `cancelled` | `Recovery planning was cancelled.` |
| 502 | failed | invalid tool/provider output or tool failure | `Recovery planning returned an invalid result.` |
| 503 | failed | provider failure or deadline | `Recovery planning is unavailable right now.` |

An invalid request may omit `runId` because no run exists. All other terminal
responses include it. Messages do not expose provider details or stack traces.

## Cancellation and staleness

- HTTP disconnect aborts the active run.
- A frontend session transition aborts its request signal.
- A response is displayed only when its controller is still current, the original
  damage object is still current, and the presentation view is `playing`.
- Cancellation or stale suppression never changes the canonical game state.

## Compatibility

`POST /api/hint` and its success/error contracts remain unchanged. The Vite `/api`
proxy already covers the new endpoint and needs no new port.
