import { describe, expect, it, vi } from "vitest";
import { createRecoveryFlow } from "../src/recovery/recovery-flow.mjs";
import { createRecoveryToolRegistry } from "../src/recovery/tool-registry.mjs";

const request = { goal: "survive", context: { difficulty: "normal", lives: 2, lastDamage: { cause: "hazard", x: 160, y: 640, time: 4.5 } } };
const final = { summary: "Wait for the hazard, then climb.", goal: "survive", actions: ["wait", "climb"], evidence: [{ id: "threat", fact: "Recent threat: rolling hazard." }], confidence: "high", completed: true };

describe("bounded recovery planner", () => {
  it("completes a grounded plan after exactly one evaluation", async () => {
    const model = { step: vi.fn().mockResolvedValueOnce({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } }).mockResolvedValueOnce({ kind: "final", result: final }), dispose: vi.fn() };
    const result = await createRecoveryFlow({ model, provider: "fake" }).run(request);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ status: "completed", result: final });
    expect(model.step).toHaveBeenCalledTimes(2);
    expect(model.step.mock.calls[1][0].history).toHaveLength(1);
    expect(model.dispose).toHaveBeenCalledOnce();
  });

  it("rejects an unknown tool without evaluating anything", async () => {
    const model = { step: vi.fn().mockResolvedValue({ kind: "tool_request", id: "one", name: "take_control", args: {} }), dispose: vi.fn() };
    const evaluator = vi.fn();
    const result = await createRecoveryFlow({ model, registry: createRecoveryToolRegistry({ evaluator }) }).run(request);
    expect(result).toMatchObject({ status: 422, body: { status: "stopped", stopReason: "unknown_tool" } });
    expect(evaluator).not.toHaveBeenCalled();
  });

  it("allows one distinct revision after a non-viable proposal", async () => {
    const model = { step: vi.fn()
      .mockResolvedValueOnce({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["jump", "climb"] } })
      .mockResolvedValueOnce({ kind: "tool_request", id: "two", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } })
      .mockResolvedValueOnce({ kind: "final", result: final }), dispose: vi.fn() };
    const result = await createRecoveryFlow({ model }).run(request);
    expect(result.status).toBe(200);
    expect(model.step).toHaveBeenCalledTimes(3);
  });
});
