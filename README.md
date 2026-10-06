# Quattro Kong — AI Bootcamp Weeks 3–4

Quattro Kong is a small retro-inspired browser platformer built for the AI
Bootcamp Session 003 and Session 004 challenge. The project demonstrates a
bounded game specification, repeatable evaluations, a client/server split, a
redesigned game experience, and one controlled Google Gemini hint feature.

## What is included

- A TypeScript/Vite frontend with a main menu, pause, resume, restart, and quit
  flow.
- A rooftop level using licensed pixel-art assets, directional player sprites,
  two enemy types, and a collectible beacon goal.
- A separate Node backend that keeps Gemini credentials outside the browser.
- One model-callable read-only tool, `get_game_state`, with an exact allowlist,
  runtime validation, bounded retries, cancellation, and safe public errors.
- A separate post-damage Recovery Planner. The player chooses `survive` or
  `advance`; the server may evaluate one candidate and one distinct revision
  through the read-only `evaluate_recovery_plan` tool, then returns only a
  grounded advisory plan. It never controls gameplay or executes actions.
- Shared runtime contracts for the hint request, tool proposal, game-state
  snapshot, and structured `HintResponse`.
- Local fake-based success, negative, and failure tests. Automated tests do not
  require a Gemini API key.

## Project structure

| Path | Purpose |
| --- | --- |
| `frontend/` | Browser game, UI, rendering, assets, and frontend tests |
| `backend/` | Local hint API, Gemini adapter, tool policy, and backend tests |
| `packages/game-contracts/` | Shared validated request and response contracts |
| `specs/002-client-server-separation/` | Client/server separation specification |
| `specs/003-game-experience-redesign/` | Game redesign specification and evidence |
| `specs/004-gemini-coach-tool/` | Gemini tool contract, implementation plan, tests, and evidence |
| `specs/005-bounded-recovery-planner/` | Recovery Planner specification, contracts, and implementation notes |
| `docs/` | Session 003 baseline, evaluations, handoff, and AI usage log |

Asset licensing and source-pack information are recorded in
`frontend/public/assets/ATTRIBUTION.md`.

## Run locally

Install dependencies from the repository root:

```powershell
npm.cmd install
```

Create the local backend configuration:

```powershell
Copy-Item backend/.env.example backend/.env
```

Add your key only to `backend/.env`:

```text
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

The local `.env` file is ignored by Git. Do not place the key in a `VITE_`
variable or frontend source.

Start the frontend and backend together:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/`. The game remains playable without a Gemini key;
after a collision, the hint panel displays the defined unavailable message.

## Validation

Run the complete local checks from the repository root:

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit --omit=dev --workspace @quattro-kong/backend
```

The Recovery Planner implementation currently has 85 passing automated tests:
59 frontend, 20 backend, and 6 shared-contract tests. Typecheck and production
build pass. The optional live Gemini check is intentionally not required for
the fake-based test suite.

## Evidence

- Session 003 baseline and controlled change: `docs/EVIDENCE_003.md`
- Session 003 evaluations: `docs/EVALS.md`
- Session 004 tool contract:
  `specs/004-gemini-coach-tool/contracts/tool-contract.md`
- Session 004 success, negative, failure, browser, and live-provider evidence:
  `specs/004-gemini-coach-tool/evidence.md`
- Session 005 deterministic Recovery Planner evidence:
  `specs/005-bounded-recovery-planner/evidence.md`
- AI usage record: `docs/AI_USAGE_LOG.md`

The authoritative project rules are in `.specify/memory/constitution.md`.
