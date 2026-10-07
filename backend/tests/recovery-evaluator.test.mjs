import { describe, expect, it } from "vitest";
import { evaluateRecoveryPlan, normalizeRecoveryContext, validateEvaluationForContext } from "../src/recovery/plan-evaluator.mjs";

const recovery = (goal = "survive") => ({ goal, context: { difficulty: "normal", lives: 2, lastDamage: { cause: "hazard", x: 160, y: 640, time: 4.5 } } });

describe("deterministic recovery evaluator", () => {
  it.each([
    ["survive", ["wait", "climb"], 100, true, []],
    ["survive", ["jump", "climb"], 50, false, ["unsafe_opening"]],
    ["advance", ["avoid", "climb"], 100, true, []],
    ["advance", ["wait", "avoid"], 60, false, ["no_forward_progress"]],
    ["survive", ["wait", "wait", "climb"], 90, true, ["repeated_action_in_plan"]],
    ["advance", ["jump", "wait"], 10, false, ["unsafe_opening", "no_forward_progress"]],
  ])("scores %s %j deterministically", (goal, actions, score, viable, violations) => {
    const context = normalizeRecoveryContext(recovery(goal));
    const evaluation = evaluateRecoveryPlan(context, { actions });
    expect(evaluation).toMatchObject({ candidate: actions, score, viable, violations });
    expect(evaluation.evidence.map((item) => item.id)).toEqual(["goal", "threat", "lives", "route"]);
    expect(validateEvaluationForContext(evaluation, context, { actions })).toEqual(evaluation);
  });

  it("uses stable fingerprints and rejects altered results without mutating input", () => {
    const input = recovery(); const context = normalizeRecoveryContext(input);
    const first = evaluateRecoveryPlan(context, { actions: ["wait", "climb"] });
    const second = evaluateRecoveryPlan(context, { actions: ["wait", "climb"] });
    expect(first.evaluationId).toBe(second.evaluationId);
    expect(context.stateVersion).toMatch(/^state-[a-f0-9]{12}$/);
    expect(input).toEqual(recovery());
    expect(validateEvaluationForContext({ ...first, score: 99 }, context, { actions: ["wait", "climb"] })).toBeNull();
  });
});
