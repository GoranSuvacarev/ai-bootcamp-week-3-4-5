import { validateEvaluateRecoveryPlanArgs } from "@quattro-kong/game-contracts";
import { RECOVERY_LIMITS } from "./limits.mjs";
import { evaluateRecoveryPlan, validateEvaluationForContext } from "./plan-evaluator.mjs";

const withTimeout = (promise, milliseconds) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Object.assign(new Error("tool timeout"), { code: "TOOL_TIMEOUT" })), milliseconds);
  Promise.resolve(promise).then(resolve, reject).finally(() => clearTimeout(timer));
});

export function createRecoveryToolRegistry({ evaluator = evaluateRecoveryPlan, timeoutMs = RECOVERY_LIMITS.toolTimeoutMs, maxResultBytes = RECOVERY_LIMITS.maxToolResultBytes } = {}) {
  return Object.freeze({
    name: "evaluate_recovery_plan",
    validate(name, args) {
      if (name !== "evaluate_recovery_plan") return { error: "unknown_tool" };
      const parsed = validateEvaluateRecoveryPlanArgs(args);
      return parsed ? { args: parsed } : { error: "invalid_tool_arguments" };
    },
    async execute(context, args) {
      let result;
      try { result = await withTimeout(evaluator(Object.freeze({ ...context }), Object.freeze({ actions: [...args.actions] })), timeoutMs); }
      catch { return { error: "tool_failed" }; }
      let serialized;
      try { serialized = JSON.stringify(result); } catch { return { error: "invalid_tool_result" }; }
      if (Buffer.byteLength(serialized, "utf8") > maxResultBytes) return { error: "invalid_tool_result" };
      const evaluation = validateEvaluationForContext(result, context, args);
      return evaluation ? { evaluation } : { error: "invalid_tool_result" };
    },
  });
}
