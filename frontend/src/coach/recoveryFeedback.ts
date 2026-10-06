export const RECOVERY_UNAVAILABLE_MESSAGE = "Recovery planning is unavailable right now.";
export const RECOVERY_STOPPED_MESSAGE = "Recovery planning stopped safely.";

export type RecoveryResult = { summary: string; goal: "survive" | "advance"; actions: string[]; evidence: Array<{ id: string; fact: string }>; confidence: "low" | "medium" | "high"; completed: true };

const actions = new Set(["move_left", "move_right", "jump", "climb", "wait", "avoid"]);
const goals = new Set(["survive", "advance"]);
const confidences = new Set(["low", "medium", "high"]);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

export function parseCompletedRecovery(result: unknown): RecoveryResult | null {
  if (!record(result) || !exact(result, ["runId", "status", "stopReason", "result"]) || result.status !== "completed" || result.stopReason !== "completed" || typeof result.runId !== "string" || !result.runId || !record(result.result)) return null;
  const plan = result.result;
  if (!exact(plan, ["summary", "goal", "actions", "evidence", "confidence", "completed"]) || typeof plan.summary !== "string" || !plan.summary.trim() || plan.summary.trim().length > 300 || !goals.has(String(plan.goal)) || !Array.isArray(plan.actions) || plan.actions.length < 2 || plan.actions.length > 4 || !plan.actions.every((action) => typeof action === "string" && actions.has(action)) || !Array.isArray(plan.evidence) || plan.evidence.length < 1 || plan.evidence.length > 4 || !confidences.has(String(plan.confidence)) || plan.completed !== true) return null;
  const ids = new Set<string>(); const evidence: Array<{ id: string; fact: string }> = [];
  for (const item of plan.evidence) {
    if (!record(item) || !exact(item, ["id", "fact"]) || typeof item.id !== "string" || !["goal", "threat", "lives", "route"].includes(item.id) || typeof item.fact !== "string" || !item.fact.trim() || item.fact.trim().length > 160 || ids.has(item.id)) return null;
    ids.add(item.id); evidence.push({ id: item.id, fact: item.fact.trim() });
  }
  return { summary: plan.summary.trim(), goal: plan.goal as RecoveryResult["goal"], actions: [...plan.actions] as string[], evidence, confidence: plan.confidence as RecoveryResult["confidence"], completed: true };
}

export function recoveryMessageFromResult(result: unknown, responseIsOk: boolean) {
  const completed = responseIsOk ? parseCompletedRecovery(result) : null;
  if (completed) return { kind: "completed" as const, result: completed, message: completed.summary };
  if (record(result) && (result.status === "stopped" || result.status === "failed") && typeof result.message === "string" && result.message.trim() && result.message.length <= 160) return { kind: "message" as const, message: result.message.trim() };
  return { kind: "message" as const, message: RECOVERY_UNAVAILABLE_MESSAGE };
}

export function canDisplayRecovery(request: AbortController, activeRequest: AbortController | null, expectedDamage: unknown, currentDamage: unknown, view: string) {
  return request === activeRequest && expectedDamage === currentDamage && view === "playing" && !request.signal.aborted;
}
