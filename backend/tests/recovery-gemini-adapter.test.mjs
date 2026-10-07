import { describe, expect, it, vi } from "vitest";
import { createRecoveryGeminiAdapter, EVALUATE_RECOVERY_PLAN_DECLARATION, RECOVERY_FINAL_SCHEMA } from "../src/recovery/gemini-adapter.mjs";

const context = { goal: "survive", difficulty: "normal", lives: 2, recentThreat: "rolling_hazard", nextRoute: "ladder", stateVersion: "state-0123456789ab" };
const evaluation = { evaluationId: "eval-0123456789ab", candidate: ["wait", "climb"], viable: true, score: 100, evidence: [{ id: "goal", fact: "Goal priority: preserve lives." }, { id: "threat", fact: "Recent threat: rolling hazard." }, { id: "lives", fact: "Lives remaining: 2." }, { id: "route", fact: "Next known route: ladder." }], violations: [] };
const final = { summary: "Wait, then climb.", goal: "survive", actions: ["wait", "climb"], evidence: [{ id: "threat", fact: "Recent threat: rolling hazard." }], confidence: "high", completed: true };
const request = (history = []) => ({ runId: "run-test", goal: "survive", context, history, signal: new AbortController().signal });

describe("recovery Gemini adapter", () => {
  it("declares the single evaluator and preserves a tool turn for the structured final", async () => {
    const generateContent = vi.fn()
      .mockResolvedValueOnce({ functionCalls: [{ id: "tool-1", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } }], candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "evaluate_recovery_plan" } }] } }] })
      .mockResolvedValueOnce({ text: JSON.stringify(final), candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(final) }] } }] });
    const adapter = createRecoveryGeminiAdapter({ apiKey: "test", client: { models: { generateContent } } });
    await expect(adapter.step(request())).resolves.toMatchObject({ kind: "tool_request", name: "evaluate_recovery_plan" });
    await expect(adapter.step(request([{ proposal: { actions: ["wait", "climb"] }, evaluation }]))).resolves.toEqual({ kind: "final", result: final });
    expect(generateContent.mock.calls[0][0].config.tools[0].functionDeclarations).toEqual([EVALUATE_RECOVERY_PLAN_DECLARATION]);
    expect(generateContent.mock.calls[1][0].config.responseJsonSchema).toEqual(RECOVERY_FINAL_SCHEMA);
    expect(JSON.stringify(generateContent.mock.calls[1][0].contents)).toContain("functionResponse");
    adapter.dispose("run-test");
  });

  it("rejects mixed tool and text output, multiple calls, and malformed final JSON", async () => {
    for (const response of [
      { functionCalls: [{ id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } }], text: "also answer" },
      { functionCalls: [{ id: "one", name: "evaluate_recovery_plan", args: {} }, { id: "two", name: "evaluate_recovery_plan", args: {} }] },
      { text: "not-json" },
    ]) {
      const adapter = createRecoveryGeminiAdapter({ apiKey: "test", client: { models: { generateContent: vi.fn().mockResolvedValue(response) } } });
      await expect(adapter.step(request(response.text === "not-json" ? [{ proposal: { actions: ["wait", "climb"] }, evaluation }] : []))).resolves.toEqual({ kind: "invalid" });
    }
  });
});
