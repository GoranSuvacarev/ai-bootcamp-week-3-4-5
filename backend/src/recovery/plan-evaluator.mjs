import { createHash } from "node:crypto";
import { validateEvaluateRecoveryPlanArgs, validatePlanEvaluation, validateRecoveryContext } from "@quattro-kong/game-contracts";

const canonical = (value) => JSON.stringify(value);
const digest = (value) => createHash("sha256").update(canonical(value)).digest("hex").slice(0, 12);

export function normalizeRecoveryContext(request) {
  const input = request?.context ?? request;
  const goal = request?.goal ?? input?.goal;
  if (!input || !goal) return null;
  const context = {
    goal,
    difficulty: input.difficulty,
    lives: input.lives,
    recentThreat: input.lastDamage?.cause === "hazard" ? "rolling_hazard" : input.lastDamage?.cause === "enemy" ? "patrol_enemy" : undefined,
    nextRoute: "ladder",
  };
  context.stateVersion = `state-${digest(context)}`;
  return validateRecoveryContext(context);
}

const evidenceFor = (context) => [
  { id: "goal", fact: context.goal === "survive" ? "Goal priority: preserve lives." : "Goal priority: make safe progress." },
  { id: "threat", fact: `Recent threat: ${context.recentThreat === "rolling_hazard" ? "rolling hazard" : "patrol enemy"}.` },
  { id: "lives", fact: `Lives remaining: ${context.lives}.` },
  { id: "route", fact: `Next known route: ${context.nextRoute}.` },
];

export function evaluateRecoveryPlan(contextInput, argsInput) {
  const context = validateRecoveryContext(contextInput);
  const args = validateEvaluateRecoveryPlanArgs(argsInput);
  if (!context || !args) return null;
  const violations = [];
  let score = 100;
  if (!["wait", "avoid"].includes(args.actions[0])) { violations.push("unsafe_opening"); score -= 50; }
  if (context.goal === "advance" && !args.actions.slice(1).some((action) => ["move_left", "move_right", "climb"].includes(action))) { violations.push("no_forward_progress"); score -= 40; }
  for (let i = 1; i < args.actions.length; i += 1) {
    if (args.actions[i] === args.actions[i - 1]) { if (!violations.includes("repeated_action_in_plan")) violations.push("repeated_action_in_plan"); score -= 10; }
  }
  score = Math.max(0, Math.min(100, score));
  const viable = score >= 60 && !violations.some((code) => code === "unsafe_opening" || code === "no_forward_progress");
  return Object.freeze({
    evaluationId: `eval-${digest({ context, actions: args.actions })}`,
    candidate: Object.freeze([...args.actions]), viable, score,
    evidence: Object.freeze(evidenceFor(context).map((item) => Object.freeze(item))),
    violations: Object.freeze(violations),
  });
}

export function validateEvaluationForContext(value, context, requestedArgs) {
  const parsed = validatePlanEvaluation(value);
  const expected = evaluateRecoveryPlan(context, requestedArgs);
  if (!parsed || !expected || canonical(parsed) !== canonical(expected)) return null;
  return parsed;
}

export const recoveryStateVersion = (context) => normalizeRecoveryContext(context)?.stateVersion ?? null;
