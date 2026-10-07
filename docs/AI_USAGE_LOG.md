# AI Usage Log

## Setup

The setup phase was implemented from the approved Spec Kit plan and was limited
to tasks T001–T005. No private chain-of-thought, credentials, or external
provider context was used.

### Commands and results

- `npm.cmd install` — passed; added 52 packages and audited 53 packages. npm
  reported two moderate severity audit findings and an esbuild install-script
  approval warning.
- `npm.cmd run typecheck` — passed with `tsc --noEmit`.
- `npm.cmd test` — passed with Vitest 3.2.7; no test files exist yet, and the
  setup script uses `--passWithNoTests` as planned.
- `npm.cmd run build` — passed with Vite 7.3.6; produced the Vite bundle in
  `dist/`.

The first typecheck exposed an invalid Vitest config import. The setup fix was
to import `defineConfig` from `vitest/config`; the complete validation suite was
then rerun successfully.

## Foundational contract and rules

- Added the shared game types, safe-default configuration, and runtime validator.
- Added deterministic validation, movement, gravity, jump, and boundary tests.
- Added the fixed 640×900 level fixture with five platforms and four ladders.
- `npm.cmd test` — passed: 2 test files and 21 tests.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run build` — passed.

## User Story 1

- Added platform landing, grounded jumping, ladder traversal, goal completion,
  keyboard controls, Canvas rendering, and the browser animation loop.
- Browser smoke test loaded `http://127.0.0.1:5173/`, showed the required MVP
  entities and HUD, accepted `ArrowRight`, and produced no console errors after
  the favicon fix.

## User Story 2

- Added one deterministic rolling hazard and one patrol enemy with fixed bounds.
- Added collision precedence, one-life damage, respawn, one-second
  invulnerability, and the terminal `lost` state.
- Browser smoke testing reached a live collision: lives changed from 03 to 02,
  the phase stayed `playing`, and the console remained clean.

## User Story 3

- Added three fixed 100-point collectibles with one-time score transitions.
- Collection rendering hides items after collection and keeps the score HUD in
  sync with `GameState.score`.
- Browser smoke testing changed the score from 0000 to 0100 with no console
  errors; the route also crossed a hazard and reduced lives to 02.

## Baseline, controlled change, and final validation

- Defined four repeatable evaluation cases in `tests/evals.test.ts` and
  `docs/EVALS.md` before the comparison.
- Baseline command: `npm.cmd test -- tests/evals.test.ts`.
- Baseline result: E1, E2, and E3 passed; E4 failed with received velocity 180
  instead of the configured 60. This reproduced the configuration propagation
  defect.
- Controlled change: store validated `GameConfig` in `GameState` and use it for
  movement speed, jump velocity, gravity, and player boundaries.
- Post-change command: `npm.cmd test -- tests/evals.test.ts`.
- Post-change result: all four evaluation cases passed.
- Full validation: `npm.cmd test` passed with 5 files and 46 tests;
  `npm.cmd run typecheck` passed; `npm.cmd run build` passed with Vite 7.3.6.
- Confirmed pair contribution record: Goran Suvačarev was the Driver and
  focused on writing and analysing prompts and preparing and writing the
  specification. SaraTrnjakov was the Observer and reviewed the project,
  confirmed that it followed the agreed specifications, and checked the
  commands and results. No private chain-of-thought, credentials, or external
  provider context was used.

## Confirmed AI decisions and personal learning

- Accepted AI suggestion: preparation of the Spec Kit structure.
- Changed AI suggestions: the proposed specification, plan, and data model
  were changed before being used.
- Confirmed personal learning: using Spec Kit.

## Session 003 handoff review

- Reviewed the course TDD/SDD addendum against the project documents.
- Updated the README, game specification, build prompt, and context manifest so
  the handoff records current status, explicit scope boundaries, source priority,
  stop conditions, and reproducible checks.
- Confirmed that the title/originality decision remains an instructor-owned
  approval and was not silently marked as accepted.
- No source code, gameplay rule, provider, tool-calling flow, backend, or Git
  state was changed during the handoff documentation pass.

## Post-handoff Core correction

- Added a failing regression for upward ladder selection at a shared platform
  boundary and tests for the intended alternating edge layout.
- Changed the five platforms to full-width geometry and positioned ladders at
  right, left, right, and left edges.
- Made ladder entry direction-aware while preserving current-ladder movement,
  downward traversal, and automatic exits.
- Verified the focused 19-test ladder/layout set, the full 46-test suite,
  typecheck, build, and browser layout/first-ladder smoke test. The full
  right-left-right-left route is covered by the deterministic route test.

## Repository and handoff

- The project was uploaded to the private GitHub repository:
  https://github.com/GoranSuvacarev/ai-bootcamp-week-3-4
- At the time of the Session 003 handoff, no Session 004 AI Hint, tool calling,
  provider, backend, multiplayer, or stretch mechanics had been added.

## Session 004 — project separation and game redesign

- Used the Spec Kit workflow to define separate features for client/server
  separation, the visual game redesign, and the controlled Gemini coach.
- Reorganized the project into `frontend`, `backend`, and shared-contract
  workspaces while keeping one root command for development and validation.
- Reworked the game presentation with the supplied licensed tilesets and UI
  pack. Human review selected the visual direction and requested corrections to
  the route, platforms, goal beacon, enemy placement, player direction, menu,
  pause, restart, and quit flows.
- Preserved attribution details with the copied game assets.

## Session 004 — controlled Gemini hint

- Replaced the earlier direct provider approach with one server-only Google
  Gemini adapter and one allowed read-only tool, `get_game_state`.
- Used a two-turn flow: Gemini proposes the tool call, the backend validates the
  exact name and arguments, the deterministic tool returns a minimized validated
  snapshot, and Gemini returns a structured `HintResponse` that is validated
  again before display.
- Added explicit negative and failure handling for unsupported tools, invalid or
  additional arguments, direct answers, zero or multiple proposals, malformed
  snapshots, malformed final output, missing configuration, transient provider
  failures, timeout, and cancellation.
- Kept `GEMINI_API_KEY` in the ignored backend `.env` file. No key, raw provider
  payload, stack trace, or private game context is recorded in this log.

### AI calls, decisions, and verification

- Codex was used to prepare the Spec Kit documents, implement the scoped
  changes, run local checks, and organize evidence. Goran defined the task
  boundaries, selected assets, reviewed rendered results, and requested concrete
  corrections before accepting the implementation.
- Sara completed her Observer contribution before Goran began his portion of
  the work. She reviewed the project against the agreed specifications and
  checked commands and results.
- Local fake clients were used for repeatable automated coverage; these tests do
  not contact Gemini or consume provider credit.
- One limited live-provider verification was performed with the locally
  configured `gemini-3.5-flash-lite` model. The backend and browser proxy each
  returned HTTP 200 with a validated structured hint. Exact provider token and
  cost data were not captured by the local application, so no numeric usage is
  claimed.
- The live check exposed Gemini thought-signature handling in the tool turn. The
  adapter was corrected to preserve the signed model turn internally while
  keeping it out of public contracts and browser responses.

### Final Session 004 validation

- `npm.cmd run test` — passed with 78 tests: 57 frontend, 17 backend, and 4
  shared-contract tests.
- `npm.cmd run typecheck` — passed across all workspaces.
- `npm.cmd run build` — passed across the frontend and backend workspaces.
- `npm.cmd audit --omit=dev --workspace @quattro-kong/backend` — passed with zero
  production dependency vulnerabilities.
- Browser smoke checks covered menu, gameplay, pause, resume, restart, return to
  menu, unavailable-provider behavior, and a successful live Gemini hint.

## Session 005 — bounded Recovery Planner

- Agent implementation runs: 2 (initial implementation and review corrections).
- Fake-model calls during automated validation: 0 external provider calls; the
  test doubles exercised retries, cancellation, limits, and malformed output.
- Limited Recovery Planner live-provider runs recorded during implementation and
  review: 3, all using `gemini-3.5-flash-lite`. The pre-correction review run
  stopped safely at `step_limit`; the implementation-correction run completed
  with 2 model calls, 0 retries, and 1 evaluator call; the final reviewer run
  completed in about 2.15 seconds with one evaluated advisory plan.
- No API key, raw prompt, raw provider response, thought signature, coordinate,
  or hidden reasoning is recorded. The two successful live runs returned
  validated advisory plans with the actions `wait`, `climb` and `avoid`,
  `climb`, respectively.
- Validation after final review corrections: 121 tests passed (59 frontend, 55 backend,
  7 shared); typecheck and production build passed. The production dependency
  audit result recorded by the reviewer was zero vulnerabilities.
