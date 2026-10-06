import assert from "node:assert/strict";
import test from "node:test";
import { validateEvaluateRecoveryPlanArgs, validateModelDecision, validateRecoveryPlanResult, validateRecoveryRequest } from "../src/recovery.mjs";

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
