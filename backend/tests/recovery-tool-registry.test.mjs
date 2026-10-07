import { describe, expect, it } from "vitest";
import { createRecoveryToolRegistry } from "../src/recovery/tool-registry.mjs";
import { evaluateRecoveryPlan, normalizeRecoveryContext } from "../src/recovery/plan-evaluator.mjs";

const context = normalizeRecoveryContext({ goal: "survive", context: { difficulty: "normal", lives: 2, lastDamage: { cause: "hazard", x: 1, y: 1, time: 1 } } });
const args = { actions: ["wait", "climb"] };

describe("recovery tool registry", () => {
  it("allows only the exact evaluator arguments", () => {
    const registry = createRecoveryToolRegistry();
    expect(registry.validate("other", args)).toEqual({ error: "unknown_tool" });
    expect(registry.validate("evaluate_recovery_plan", { actions: ["wait"] })).toEqual({ error: "invalid_tool_arguments" });
    expect(registry.validate("evaluate_recovery_plan", { ...args, extra: true })).toEqual({ error: "invalid_tool_arguments" });
  });

  it("fails thrown, timed-out, malformed, and oversized evaluator output", async () => {
    await expect(createRecoveryToolRegistry({ evaluator: () => { throw new Error("no"); } }).execute(context, args)).resolves.toEqual({ error: "tool_failed" });
    await expect(createRecoveryToolRegistry({ evaluator: () => new Promise(() => {}), timeoutMs: 1 }).execute(context, args)).resolves.toEqual({ error: "tool_failed" });
    await expect(createRecoveryToolRegistry({ evaluator: () => ({ nope: true }) }).execute(context, args)).resolves.toEqual({ error: "invalid_tool_result" });
    await expect(createRecoveryToolRegistry({ evaluator: () => ({ text: "x".repeat(5000) }) }).execute(context, args)).resolves.toEqual({ error: "invalid_tool_result" });
  });

  it("accepts only an exact deterministic evaluator result", async () => {
    const registry = createRecoveryToolRegistry({ evaluator: evaluateRecoveryPlan });
    await expect(registry.execute(context, args)).resolves.toMatchObject({ evaluation: { candidate: args.actions, viable: true, score: 100 } });
  });
});
