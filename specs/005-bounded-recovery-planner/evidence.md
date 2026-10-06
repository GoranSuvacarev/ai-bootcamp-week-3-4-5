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

## Automated checks

- E01-style first viable candidate: `backend/tests/recovery-flow.test.mjs`
  verifies a two-step completed plan and evaluation history.
- E02-style distinct revision: the same file verifies a non-viable candidate,
  one distinct revision, then completion.
- E04-style zero execution: the unknown-tool test verifies the evaluator spy
  is never called.
- Shared exact-shape/boundary coverage is in
  `packages/game-contracts/tests/recovery.test.mjs`.
- Browser result parsing and stale-request suppression are in
  `frontend/tests/recoveryFeedback.test.ts`.

Validation on 2026-10-07:

- `npm.cmd run test`: 85 passing tests (59 frontend, 20 backend, 6 shared).
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.

## Bounded policy

The tool registry exposes only `evaluate_recovery_plan`, accepts exactly two to
four approved actions, uses a 250 ms execution guard, validates normalized
results below 4 KiB, and rejects repeated action keys. The run permits at most
three logical steps, two tool executions, five provider attempts, two attempts
per step, and a 35-second deadline. Recovery events retain at most 50 redacted
records and contain no prompts, coordinates, provider payloads, or credentials.

## Limitation

No live Gemini request was made while recording this implementation evidence.
The fake model suite covers the core deterministic flow without requiring a
credential. A live check still requires a configured `GEMINI_API_KEY` and the
manual smoke sequence in `quickstart.md`.
