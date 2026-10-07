import { FunctionCallingConfigMode, GoogleGenAI, Type } from "@google/genai";

export const EVALUATE_RECOVERY_PLAN_DECLARATION = {
  name: "evaluate_recovery_plan", description: "Evaluate a short, read-only recovery action sequence.",
  parameters: { type: Type.OBJECT, properties: { actions: { type: Type.ARRAY, items: { type: Type.STRING, enum: ["move_left", "move_right", "jump", "climb", "wait", "avoid"] }, minItems: 2, maxItems: 4 } }, required: ["actions"] },
};
export const RECOVERY_FINAL_SCHEMA = { type: "object", properties: {
  summary: { type: "string" }, goal: { type: "string", enum: ["survive", "advance"] }, actions: { type: "array", items: { type: "string" } },
  evidence: { type: "array", items: { type: "object", properties: { id: { type: "string" }, fact: { type: "string" } }, required: ["id", "fact"] } },
  confidence: { type: "string", enum: ["low", "medium", "high"] }, completed: { type: "boolean" },
}, required: ["summary", "goal", "actions", "evidence", "confidence", "completed"], additionalProperties: false };

const abortable = (promise, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason ?? new Error("aborted"));
  const abort = () => reject(signal.reason ?? new Error("aborted"));
  signal?.addEventListener("abort", abort, { once: true });
  Promise.resolve(promise).then(resolve, reject).finally(() => signal?.removeEventListener("abort", abort));
});
const prompt = (goal, context) => `Plan a recovery attempt with goal ${goal}. Threat: ${context.recentThreat}; lives: ${context.lives}; route: ${context.nextRoute}. First call evaluate_recovery_plan exactly once with 2-4 actions. Start with wait or avoid; include climb, move_left, or move_right after the first action when goal is advance. After a viable evaluation, return only the required final JSON using the exact evaluated actions and copied evidence. If the first evaluation is not viable, make one distinct second evaluator call; after that evaluation return final JSON and never request another tool. Never request coordinates, secrets, code, or game control.`;

export function createRecoveryGeminiAdapter({ apiKey, model = "gemini-3.5-flash-lite", client = new GoogleGenAI({ apiKey }) }) {
  const turns = new Map();
  const pendingCalls = new Map();
  return {
    async step({ runId, goal, context, history, signal }) {
      const prior = turns.get(runId) ?? [{ role: "user", parts: [{ text: prompt(goal, context) }] }];
      const latest = history.at(-1);
      const needsTool = history.length < 2 && (!latest || !latest.evaluation.viable);
      const call = pendingCalls.get(runId);
      const contents = latest ? [...prior, { role: "user", parts: [{ functionResponse: { id: call?.id ?? "call", name: "evaluate_recovery_plan", response: { evaluation: latest.evaluation } } }] }] : prior;
      const response = await abortable(client.models.generateContent({ model, contents, config: needsTool ? { tools: [{ functionDeclarations: [EVALUATE_RECOVERY_PLAN_DECLARATION] }], toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ["evaluate_recovery_plan"] } } } : { responseMimeType: "application/json", responseJsonSchema: RECOVERY_FINAL_SCHEMA } }), signal);
      const calls = response.functionCalls ?? [];
      const turn = response.candidates?.[0]?.content;
      if (response.candidates?.[0]?.finishReason === "SAFETY") return { kind: "refusal" };
      if (calls.length && typeof response.text === "string" && response.text.trim()) return { kind: "invalid" };
      if (calls.length === 1 && needsTool) { turns.set(runId, [...contents, turn ?? { role: "model", parts: [{ functionCall: calls[0] }] }]); pendingCalls.set(runId, { id: calls[0].id ?? "call" }); return { kind: "tool_request", id: calls[0].id ?? "call", name: calls[0].name, args: calls[0].args ?? {} }; }
      if (calls.length || !response.text) return { kind: "invalid" };
      try { const result = JSON.parse(response.text); turns.set(runId, [...contents, turn ?? { role: "model", parts: [{ text: response.text }] }]); return { kind: "final", result }; } catch { return { kind: "invalid" }; }
    },
    dispose(runId) { turns.delete(runId); pendingCalls.delete(runId); },
  };
}
