/** Runtime contracts shared by the recovery planner browser and server boundaries. */
export const RECOVERY_GOALS = Object.freeze(["survive", "advance"]);
export const RECOVERY_ACTIONS = Object.freeze(["move_left", "move_right", "jump", "climb", "wait", "avoid"]);
export const RECOVERY_STOP_REASONS = Object.freeze([
  "completed", "invalid_input", "invalid_model_proposal", "unknown_tool", "invalid_tool_arguments",
  "invalid_tool_result", "tool_failed", "provider_failed", "provider_refusal", "step_limit",
  "tool_call_limit", "provider_attempt_limit", "deadline", "repeated_action", "invalid_final_result", "cancelled",
]);
export const RECOVERY_EVIDENCE_IDS = Object.freeze(["goal", "threat", "lives", "route"]);
export const RECOVERY_VIOLATIONS = Object.freeze(["unsafe_opening", "no_forward_progress", "repeated_action_in_plan"]);

const goals = new Set(RECOVERY_GOALS);
const actions = new Set(RECOVERY_ACTIONS);
const evidenceIds = new Set(RECOVERY_EVIDENCE_IDS);
const violations = new Set(RECOVERY_VIOLATIONS);
const stops = new Set(RECOVERY_STOP_REASONS);
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const text = (value, maximum) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum;
const cloneActions = (value) => Array.isArray(value) ? [...value] : value;

export function validateRecoveryRequest(value) {
  if (!exact(value, ["goal", "context"]) || !goals.has(value.goal)) return null;
  const context = value.context;
  if (!exact(context, ["difficulty", "lives", "lastDamage"])) return null;
  if (!new Set(["easy", "normal"]).has(context.difficulty) || !Number.isInteger(context.lives) || context.lives < 0 || context.lives > 3) return null;
  const damage = context.lastDamage;
  if (!exact(damage, ["cause", "x", "y", "time"]) || !new Set(["hazard", "enemy"]).has(damage.cause)) return null;
  if (!Number.isFinite(damage.x) || damage.x < 0 || damage.x > 640 || !Number.isFinite(damage.y) || damage.y < 0 || damage.y > 900 || !Number.isFinite(damage.time) || damage.time < 0) return null;
  return { goal: value.goal, context: { difficulty: context.difficulty, lives: context.lives, lastDamage: { ...damage } } };
}

export function validateEvaluateRecoveryPlanArgs(value) {
  if (!exact(value, ["actions"]) || !Array.isArray(value.actions) || value.actions.length < 2 || value.actions.length > 4) return null;
  if (Object.keys(value.actions).length !== value.actions.length || !value.actions.every((action) => actions.has(action))) return null;
  return { actions: [...value.actions] };
}

export function validateRecoveryContext(value) {
  if (!exact(value, ["goal", "difficulty", "lives", "recentThreat", "nextRoute", "stateVersion"])) return null;
  if (!goals.has(value.goal) || !new Set(["easy", "normal"]).has(value.difficulty) || !Number.isInteger(value.lives) || value.lives < 0 || value.lives > 3) return null;
  if (!new Set(["rolling_hazard", "patrol_enemy"]).has(value.recentThreat) || value.nextRoute !== "ladder" || !/^state-[a-f0-9]{12}$/.test(value.stateVersion)) return null;
  return { ...value };
}

export function validateModelDecision(value) {
  if (!isRecord(value) || typeof value.kind !== "string") return null;
  if (value.kind === "refusal" && exact(value, ["kind"])) return { kind: "refusal" };
  if (value.kind === "tool_request" && exact(value, ["kind", "id", "name", "args"]) && typeof value.id === "string" && value.id.length > 0 && value.id.length <= 128 && typeof value.name === "string" && value.name.length > 0 && value.name.length <= 128) return { kind: "tool_request", id: value.id, name: value.name, args: value.args };
  if (value.kind === "final" && exact(value, ["kind", "result"])) return { kind: "final", result: value.result };
  return null;
}

export function validateEvidence(value, { required = false } = {}) {
  if (!Array.isArray(value) || value.length < (required ? 4 : 1) || value.length > 4 || Object.keys(value).length !== value.length) return null;
  const seen = new Set();
  const evidence = [];
  for (const item of value) {
    if (!exact(item, ["id", "fact"]) || !evidenceIds.has(item.id) || !text(item.fact, 160) || seen.has(item.id)) return null;
    seen.add(item.id); evidence.push({ id: item.id, fact: item.fact.trim() });
  }
  if (required && seen.size !== 4) return null;
  return evidence;
}

export function validatePlanEvaluation(value) {
  if (!exact(value, ["evaluationId", "candidate", "viable", "score", "evidence", "violations"]) || !/^eval-[a-f0-9]{12}$/.test(value.evaluationId)) return null;
  const candidate = validateEvaluateRecoveryPlanArgs({ actions: value.candidate });
  const evidence = validateEvidence(value.evidence, { required: true });
  if (!candidate || !evidence || typeof value.viable !== "boolean" || !Number.isInteger(value.score) || value.score < 0 || value.score > 100 || !Array.isArray(value.violations) || value.violations.length > 3 || new Set(value.violations).size !== value.violations.length || !value.violations.every((item) => violations.has(item))) return null;
  return { evaluationId: value.evaluationId, candidate: candidate.actions, viable: value.viable, score: value.score, evidence, violations: [...value.violations] };
}

export function validateRecoveryPlanResult(value) {
  if (!exact(value, ["summary", "goal", "actions", "evidence", "confidence", "completed"]) || !text(value.summary, 300) || !goals.has(value.goal) || !new Set(["low", "medium", "high"]).has(value.confidence) || typeof value.completed !== "boolean") return null;
  const parsedActions = validateEvaluateRecoveryPlanArgs({ actions: value.actions });
  const evidence = validateEvidence(value.evidence);
  if (!parsedActions || !evidence) return null;
  return { summary: value.summary.trim(), goal: value.goal, actions: parsedActions.actions, evidence, confidence: value.confidence, completed: value.completed };
}

export function validateCompletedRecoveryResponse(value) {
  if (!exact(value, ["runId", "status", "stopReason", "result"]) || typeof value.runId !== "string" || !value.runId || value.status !== "completed" || value.stopReason !== "completed") return null;
  const result = validateRecoveryPlanResult(value.result);
  return result?.completed === true ? { runId: value.runId, status: "completed", stopReason: "completed", result } : null;
}

export function validateRecoveryFailureResponse(value) {
  if (!isRecord(value) || !["stopped", "failed"].includes(value.status) || !stops.has(value.stopReason) || value.stopReason === "completed" || !text(value.message, 160)) return null;
  const keys = Object.hasOwn(value, "runId") ? ["runId", "status", "stopReason", "message"] : ["status", "stopReason", "message"];
  if (!exact(value, keys) || (Object.hasOwn(value, "runId") && (typeof value.runId !== "string" || !value.runId))) return null;
  return Object.hasOwn(value, "runId") ? { runId: value.runId, status: value.status, stopReason: value.stopReason, message: value.message.trim() } : { status: value.status, stopReason: value.stopReason, message: value.message.trim() };
}

export const validateRecoveryResponse = (value) => validateCompletedRecoveryResponse(value) ?? validateRecoveryFailureResponse(value);
export const cloneRecoveryActions = cloneActions;
