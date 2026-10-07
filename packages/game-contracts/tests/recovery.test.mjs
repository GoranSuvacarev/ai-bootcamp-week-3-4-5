import assert from "node:assert/strict";
import test from "node:test";
import {
  validateCompletedRecoveryResponse,
  validateEvaluateRecoveryPlanArgs,
  validateModelDecision,
  validatePlanEvaluation,
  validateRecoveryFailureResponse,
  validateRecoveryPlanResult,
  validateRecoveryRequest,
} from "../src/recovery.mjs";

const request = { goal: "survive", context: { difficulty: "normal", lives: 2, lastDamage: { cause: "hazard", x: 160, y: 640, time: 4.5 } } };

test("recovery request contracts are exact and clone browser input", () => {
  const result = validateRecoveryRequest(request);
  assert.deepEqual(result, request);
  assert.notEqual(result.context, request.context);
  assert.equal(validateRecoveryRequest({ ...request, extra: true }), null);
  assert.equal(validateRecoveryRequest({ ...request, context: { ...request.context, lives: 4 } }), null);
});

test("model, evaluator, and final contracts reject unbounded shapes", () => {
  assert.deepEqual(validateModelDecision({ kind: "tool_request", id: "call-1", name: "evaluate_recovery_plan", args: {} }), { kind: "tool_request", id: "call-1", name: "evaluate_recovery_plan", args: {} });
  assert.equal(validateModelDecision({ kind: "tool_request", id: "x", name: "tool", args: {}, extra: true }), null);
  assert.deepEqual(validateEvaluateRecoveryPlanArgs({ actions: ["wait", "climb"] }), { actions: ["wait", "climb"] });
  assert.equal(validateEvaluateRecoveryPlanArgs({ actions: ["wait"] }), null);
  const final = { summary: "Wait, then climb.", goal: "survive", actions: ["wait", "climb"], evidence: [{ id: "threat", fact: "Recent threat: rolling hazard." }], confidence: "high", completed: true };
  assert.deepEqual(validateRecoveryPlanResult(final), final);
  assert.equal(validateRecoveryPlanResult({ ...final, completed: "true" }), null);
});

test("evaluation and public envelopes require exact bounded shapes", () => {
  const evaluation = {
    evaluationId: "eval-0123456789ab",
    candidate: ["wait", "climb"],
    viable: true,
    score: 100,
    evidence: [
      { id: "goal", fact: "Goal priority: preserve lives." },
      { id: "threat", fact: "Recent threat: rolling hazard." },
      { id: "lives", fact: "Lives remaining: 2." },
      { id: "route", fact: "Next known route: ladder." },
    ],
    violations: [],
  };
  assert.deepEqual(validatePlanEvaluation(evaluation), evaluation);
  assert.equal(validatePlanEvaluation({ ...evaluation, score: 101 }), null);
  assert.equal(validatePlanEvaluation({ ...evaluation, extra: true }), null);

  const result = { summary: "Wait, then climb.", goal: "survive", actions: ["wait", "climb"], evidence: [{ id: "threat", fact: "Recent threat: rolling hazard." }], confidence: "high", completed: true };
  const completed = { runId: "run-1", status: "completed", stopReason: "completed", result };
  assert.deepEqual(validateCompletedRecoveryResponse(completed), completed);
  assert.equal(validateCompletedRecoveryResponse({ ...completed, extra: true }), null);

  const failed = { runId: "run-1", status: "failed", stopReason: "provider_failed", message: "Recovery planning is unavailable right now." };
  assert.deepEqual(validateRecoveryFailureResponse(failed), failed);
  assert.equal(validateRecoveryFailureResponse({ ...failed, stopReason: "completed" }), null);
});
