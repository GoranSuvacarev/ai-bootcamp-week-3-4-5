import { describe, expect, it } from "vitest";
import { canDisplayRecovery, parseCompletedRecovery, recoveryMessageFromResult } from "../src/coach/recoveryFeedback";

const completed = { runId: "run-1", status: "completed", stopReason: "completed", result: { summary: "Wait, then climb.", goal: "survive", actions: ["wait", "climb"], evidence: [{ id: "threat", fact: "Recent threat: rolling hazard." }], confidence: "high", completed: true } };
describe("recovery feedback", () => {
  it("renders only a strict completed recovery envelope", () => {
    expect(parseCompletedRecovery(completed)).toMatchObject(completed.result);
    expect(parseCompletedRecovery({ ...completed, result: { ...completed.result, actions: ["fly", "climb"] } })).toBeNull();
    expect(recoveryMessageFromResult({ status: "stopped", message: "Recovery planning stopped safely." }, false).message).toBe("Recovery planning stopped safely.");
  });
  it("suppresses stale recovery requests", () => {
    const controller = new AbortController();
    expect(canDisplayRecovery(controller, controller, "damage", "damage", "playing")).toBe(true);
    controller.abort();
    expect(canDisplayRecovery(controller, controller, "damage", "damage", "playing")).toBe(false);
  });
});
