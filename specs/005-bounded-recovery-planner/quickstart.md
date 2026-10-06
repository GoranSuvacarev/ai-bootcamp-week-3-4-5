# Quickstart and Evaluations: Bounded Recovery Planner

## Prerequisites

- Work on branch `005-bounded-recovery-planner`.
- Goran has completed `checklists/implementation-readiness.md`.
- Dependencies are installed from the repository root.
- Automated tests use fake collaborators and require no Gemini key.
- A live key, when used, exists only in ignored `backend/.env` as
  `GEMINI_API_KEY`; the model remains configured through `GEMINI_MODEL`.

## Red-green workflow

For every task group:

1. Add the focused test named by `tasks.md`.
2. Run that focused test and record the expected failure.
3. Implement the smallest coherent behavior.
4. Run the focused test until green.
5. Run the affected workspace tests before moving to the next checkpoint.

Do not use a live provider while contract, evaluator, flow, or failure tests are red.

## Focused commands

```powershell
npm.cmd test --workspace @quattro-kong/game-contracts
npm.cmd test --workspace @quattro-kong/backend
npm.cmd test --workspace @quattro-kong/frontend
```

Run one backend file while developing:

```powershell
npm.cmd test --workspace @quattro-kong/backend -- tests/recovery-flow.test.mjs
```

## Required fake evaluation matrix

| ID | Scenario | Expected terminal result | Expected counts |
|---|---|---|---|
| E01 | Viable first candidate, valid final | `completed` | steps 2, tools 1, provider attempts 2 |
| E02 | Non-viable first candidate, distinct viable revision | `completed` | steps 3, tools 2, provider attempts 3 |
| E03 | Invalid initial request | `failed/invalid_input` | steps 0, tools 0, provider attempts 0 |
| E04 | Unknown first tool | `stopped/unknown_tool` | steps 1, tools 0, provider attempts 1 |
| E05 | Invalid/oversized tool arguments | `stopped/invalid_tool_arguments` | steps 1, tools 0, provider attempts 1 |
| E06 | Repeated candidate | `stopped/repeated_action` | steps 2, tools 1, provider attempts 2 |
| E07 | Tool throws or times out | `failed/tool_failed` | steps 1, tools 1, provider attempts 1 |
| E08 | Malformed/oversized tool result | `failed/invalid_tool_result` | steps 1, tools 1, provider attempts 1 |
| E09 | Transient first provider attempt, retry succeeds | follows returned decision | same steps as flow; provider attempts +1 |
| E10 | Permanent/auth/config provider error | `failed/provider_failed` | no retry |
| E11 | Malformed model decision | `stopped/invalid_model_proposal` | no tool execution |
| E12 | Provider refusal | `stopped/provider_refusal` | no additional call |
| E13 | Third tool proposal | `stopped/step_limit` or `tool_call_limit` before execution | maximum tools 2 |
| E14 | Provider-attempt budget exhausted | `stopped/provider_attempt_limit` | attempts 5 maximum |
| E15 | Total deadline expires | `failed/deadline` | no call begins afterward |
| E16 | Final actions differ from latest viable candidate | `stopped/invalid_final_result` | no public success |
| E17 | Final cites invented or altered evidence | `stopped/invalid_final_result` | no public success |
| E18 | HTTP/browser cancellation | `failed/cancelled` | active attempt aborts; no next call |
| E19 | New damage/session transition before response | browser suppresses stale result | no stale DOM update |
| E20 | Existing Hint success and failure suites | unchanged | existing counts unchanged |

Tests must assert the exact tool count for E03–E06. At least E04 must explicitly
assert `toolCallCount === 0` and that the evaluator spy was never called.

## Evaluator fixtures

Use stable examples in evaluator and flow tests:

| Goal | Actions | Score | Viable | Violations |
|---|---|---:|---:|---|
| survive | `wait, climb` | 100 | yes | none |
| survive | `jump, climb` | 50 | no | `unsafe_opening` |
| advance | `avoid, climb` | 100 | yes | none |
| advance | `wait, avoid` | 60 | no | `no_forward_progress` |
| survive | `wait, wait, climb` | 90 | yes | `repeated_action_in_plan` |
| advance | `jump, wait` | 10 | no | `unsafe_opening`, `no_forward_progress` |

Verify identical normalized context/actions produce the same `stateVersion` and
`evaluationId` across calls.

## Full local validation

After all focused tests pass:

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit --omit=dev --workspace @quattro-kong/backend
```

Expected result: all existing 78 tests plus new recovery tests pass; typecheck and
build succeed; the backend production audit reports no unresolved vulnerability.

## Browser smoke

Start the local app:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Verify:

1. Hint and Recovery Planner controls are hidden outside active play.
2. Before damage, both post-damage actions are disabled.
3. After damage, choose `survive`; status becomes `running` and controls remain
   accessible.
4. A completed fake or live run shows summary, ordered actions, evidence, and
   confidence without changing player input or game state.
5. Repeat with `advance`.
6. Start a plan and then restart, return to menu, or receive new damage; the previous
   response never appears.
7. Pause/resume/restart/quit, existing Hint, win, loss, controls, and focus behavior
   still work.
8. Browser and backend consoles contain no secret, raw prompt, or stack trace.

## Limited live-provider check

Only after the fake suite and full validation are green:

1. Use a small non-private post-damage request.
2. Perform one `survive` run with the configured allowed Gemini model.
3. Confirm at least one allowed evaluator execution, validated final output, bounded
   time, and one redacted event.
4. Record date, model name, status, elapsed time, step/tool/provider counts, and stop
   reason in `evidence.md` and `docs/AI_USAGE_LOG.md`.
5. Do not record the key, raw prompt, provider response, thought signature, or hidden
   reasoning.

Development should remain within the assignment budget: at most 15 live runs total
and at most three during the final demo.

## Evidence package

Sara creates `evidence.md` during implementation with:

- final architecture and agent-flow diagram;
- tool registry and contracts;
- one E01 success trace and one E02 revision trace;
- one E04 zero-tool rejection trace;
- one provider/tool/limit failure trace;
- relevant automated results and full regression totals;
- limited live result, or an explicit safe reason it was unavailable;
- known limitation;
- Goran and Sara contributions;
- final commit references.

## Seven-minute demo

```text
0:00–0:45  Player goal and difference from AI Hint
0:45–1:30  Frontend, endpoint, orchestrator, Gemini adapter, registry, evaluator
1:30–3:00  Completed run: decision -> tool -> evidence -> final plan
3:00–4:00  Allowlist, validators, counters, timeouts, deadline
4:00–5:00  Unknown tool or repeated candidate; prove zero/no extra execution
5:00–6:00  Fake tests and regression checks
6:00–7:00  Run evidence, known limitation, and pair contributions
```

Both partners must be able to explain the tool choice, limit values, proposal and
result validation points, stop policy, and zero-execution proof.
